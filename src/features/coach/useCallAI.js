import { useCallback, useEffect, useState, useRef } from 'react';
import { SYSTEM_PROMPTS, OPENWEBUI_URL, COACH_MODES } from '../../constants.jsx';
import { TOOLS, doWebSearch } from './webSearch.js';
import { GMAIL_SEARCH_TOOL, GMAIL_LIST_LABELS_TOOL, GMAIL_LABEL_TOOL,
  GMAIL_BATCH_LABEL_TOOL, GMAIL_COMPOSE_TOOL, GMAIL_SEND_TOOL, GMAIL_CREATE_LABEL_TOOL,
  GMAIL_LIST_FILTERS_TOOL, GMAIL_CREATE_FILTER_TOOL, GMAIL_DELETE_FILTER_TOOL,
  GMAIL_BULK_ACTION_TOOL, GMAIL_QUEUE_ADD_TOOL,
  doGmailSearch, doGmailListLabels, doGmailCreateLabel,
  doGmailListFilters, doGmailCreateFilter, doGmailDeleteFilter, doGmailBatchLabel,
  doGmailBulkAction, doGmailLabel, doGmailCompose, doGmailSend } from '../email/gmailTools.js';
import { doCalendarCreateEvent, doCalendarUpdateEvent, doCalendarDeleteEvent,
  genId } from '../calendar/calendarApi.js';
import { buildCalibrationContext, normalizeEffort, extractAction, extractUpdateAction, extractAddAction,
  extractCreateAction, extractCalendarCreateAction, extractCalendarUpdateAction,
  extractCalendarDeleteAction } from '../tasks/taskUtils.jsx';
import { supabase, queueEntryToRow } from '../../api/supabase.js';
import { docsCreateDocument, docsAppendText, docsAppendMarkdown, docsMoveToFolder } from '../../api/docsApi.js';
import { driveListFiles, driveGetFile, driveDownloadFile, driveExportFile } from '../../api/driveApi.js';
import { sheetsCreateSpreadsheet, sheetsAppendRows, sheetsBatchUpdate, sheetsMoveToFolder } from '../../api/sheetsApi.js';
import { createAndUploadPptx, PPTX_MIME } from '../../api/pptxApi.js';
import { peopleSearchContacts } from '../../api/peopleApi.js';

// Lazy task-retrieval tool — used in chat mode so the full task list isn't
// sent on every message. The AI calls this when it needs task details.
const GET_TASK_CONTEXT_TOOL = {
  name: 'get_task_context',
  description: 'Retrieve the full task list. Call this when you need to reference specific tasks, check for duplicates, evaluate workload, or answer questions about projects and actions.',
  input_schema: {
    type: 'object',
    properties: {
      buckets: {
        type: 'array',
        items: { type: 'string', enum: ['inbox', 'next', 'project', 'waiting', 'someday'] },
        description: 'Buckets to include. Omit or pass null for all buckets.',
      },
    },
  },
};

// Drive search tool — available in chat mode when Drive is connected (FR#59/FR#99)
const DRIVE_SEARCH_TOOL = {
  name: 'drive_search',
  description: "Search Google Drive for files by name or content. Returns matching files with IDs, names, MIME types, and view links. Use before get_drive_file to find the file_id. IMPORTANT: query must use Drive query syntax — e.g. \"name contains 'LeanIX'\" or \"fullText contains 'LeanIX'\" or \"'root' in parents and trashed=false\". Plain text keywords without an operator will be rejected by the API.",
  input_schema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: "Drive query syntax string. Examples: \"name contains 'report'\", \"fullText contains 'budget'\", \"name contains 'LeanIX' or fullText contains 'LeanIX'\", \"'root' in parents and trashed=false\". Do NOT pass plain keywords — they cause a 400 error.",
      },
      max_results: {
        type: 'number',
        description: 'Maximum number of files to return (default 10, max 50).',
      },
    },
    required: ['query'],
  },
};

const GET_DRIVE_FILE_TOOL = {
  name: 'get_drive_file',
  description: 'Read the text content of a Google Drive file (Google Doc, Sheet, or other text-based file). Use drive_search first to get the file_id.',
  input_schema: {
    type: 'object',
    properties: {
      file_id: {
        type: 'string',
        description: 'The Google Drive file ID from drive_search results.',
      },
      mime_type: {
        type: 'string',
        description: 'Export format. Defaults to text/plain for Docs, text/csv for Sheets. Leave blank for auto-detect.',
      },
    },
    required: ['file_id'],
  },
};

// Weather tool -- available in chat mode when VITE_OPENWEATHERMAP_API_KEY is set (FR#105)
const GET_WEATHER_TOOL = {
  name: 'get_weather',
  description: 'Get current weather conditions and a 24-hour forecast for a city. Use when the user asks about weather, plans outdoor activities, or needs weather context for scheduling.',
  input_schema: {
    type: 'object',
    properties: {
      city: { type: 'string', description: "City name. Omit to use the user's configured default city." },
      units: { type: 'string', enum: ['imperial', 'metric'], description: 'Temperature units: imperial = °F, metric = °C. Defaults to imperial.' },
    },
  },
};

// Contacts lookup tool — available in chat mode when Contacts is connected (FR#115)
const CONTACTS_LOOKUP_TOOL = {
  name: 'contacts_lookup',
  description: "Search the user's Google Contacts by name or email address. Returns matching contacts with names, email addresses, and phone numbers. Use when the user asks to find someone's contact info, or when composing an email to a person by name.",
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Name or email to search for.' },
      max_results: { type: 'number', description: 'Maximum contacts to return (default 5, max 30).' },
    },
    required: ['query'],
  },
};

// Buckets to include in the task context for each coach mode.
// Modes not listed here receive all buckets (null = no filter).
const MODE_CONTEXT_BUCKETS = {
  process:         ['inbox', 'project', 'waiting'],
  projectReview:   ['project'],
  projectMetadata: ['project'],
  calendarEvent:   ['project'],
};

// Parse |tab:<Name>[|params...]|tab:<Name>[|params...] sections from a create-sheet ACTION line.
// parts[0] = spreadsheet title; remaining parts are tab: separators and filter params.
// Returns [{ name: string, params: string[] }, ...] — one entry per tab.
// Falls back to a single Sheet1 tab containing all parts when no tab: markers are present.
function parseSheetTabs(parts) {
  var tabs = [];
  var current = null;
  for (var i = 1; i < parts.length; i++) {
    var p = parts[i].trim();
    if (p.startsWith('tab:')) {
      if (current) tabs.push(current);
      current = { name: p.slice(4).trim() || 'Sheet', params: [], columns: null };
    } else if (current) {
      if (p.startsWith('columns:')) {
        current.columns = p.slice(8).split(',').map(function(c) { return c.trim(); }).filter(Boolean);
      } else {
        current.params.push(p);
      }
    }
  }
  if (current) tabs.push(current);
  if (tabs.length === 0) {
    var colPart = parts.slice(1).find(function(p) { return p.trim().startsWith('columns:'); });
    var columns = colPart ? colPart.slice(colPart.indexOf(':') + 1).split(',').map(function(c) { return c.trim(); }).filter(Boolean) : null;
    var params = parts.slice(1).filter(function(p) { return !p.trim().startsWith('columns:'); });
    tabs.push({ name: 'Sheet1', params: params, columns: columns });
  }
  return tabs;
}

// Build headers + data rows for a single sheet tab from a filtered task list.
function buildSheetData(filteredTasks, taskById, columns) {
  var BUCKET_LABELS = { next: 'Next Actions', waiting: 'Waiting For', project: 'Projects', someday: 'Someday/Maybe', inbox: 'Inbox', deferred: 'Deferred' };
  var NODE_TYPE_LABELS = { category: 'Category', subcategory: 'Subcategory', project: 'Project', subproject: 'Subproject' };
  var COLUMN_EXTRACTORS = {
    'task':           function(t) { return t.text; },
    'bucket':         function(t) { return BUCKET_LABELS[t.bucket] || t.bucket || ''; },
    'status':         function(t) { return t.done ? 'Done' : 'Active'; },
    'created date':   function(t) { return t.created ? new Date(t.created).toISOString().slice(0, 10) : ''; },
    'completed date': function(t) { return t.completedDate || ''; },
    'due date':       function(t) { return t.dueDate || ''; },
    'category':       function(t) { return t.category || ''; },
    'flags':          function(t) { return [t.isWaitingFor && 'Waiting For', t.isSomeday && 'Someday'].filter(Boolean).join(', '); },
    'type':           function(t) { return NODE_TYPE_LABELS[t.nodeType] || t.nodeType || ''; },
    'project':        function(t) { return t.parentId && taskById[t.parentId] ? taskById[t.parentId].text : ''; },
    'priority':       function(t) { return (t.priority || []).join(', '); },
    'location':       function(t) { return (t.location || []).join(', '); },
    'est. effort':    function(t) { return t.effort || ''; },
    'actual effort':  function(t) { return t.actualEffort || ''; },
    'repeat':         function(t) { return t.recurrence ? (typeof t.recurrence === 'string' ? t.recurrence : JSON.stringify(t.recurrence)) : ''; },
    'notes':          function(t) { return t.notes || ''; },
  };
  var DEFAULT_COLUMNS = ['Task', 'Bucket', 'Status', 'Created Date', 'Completed Date', 'Due Date', 'Category', 'Flags', 'Type', 'Project', 'Priority', 'Location', 'Est. Effort', 'Actual Effort', 'Repeat', 'Notes'];
  var activeColumns = (columns && columns.length)
    ? columns.filter(function(c) { return COLUMN_EXTRACTORS[c.toLowerCase()]; })
    : DEFAULT_COLUMNS;
  if (!activeColumns.length) activeColumns = DEFAULT_COLUMNS;
  var headers = [activeColumns];
  var rows = filteredTasks.map(function(t) {
    return activeColumns.map(function(col) {
      var fn = COLUMN_EXTRACTORS[col.toLowerCase()];
      return fn ? fn(t) : '';
    });
  });
  return headers.concat(rows);
}

// Shared task filter — used by create-sheet, create-doc, and create-slides ACTION handlers.
// parts: pipe-split ACTION parameter array (parts[0] is the title; params start from parts[1])
// Supported params: after:YYYY-MM-DD  before:YYYY-MM-DD  due_after:YYYY-MM-DD  due_before:YYYY-MM-DD
//   status:done|active  bucket:<name>  category:<text>  priority:<tag>  location:<tag>
//   effort:<value>  project:<name or id>  overdue
function applyTaskFilters(parts, tasks) {
  var get = function(prefix) {
    var part = parts.find(function(p) { return p.startsWith(prefix + ':'); });
    return part ? part.slice(prefix.length + 1).trim() : null;
  };
  var has = function(flag) { return parts.some(function(p) { return p.trim() === flag; }); };
  var afterDate      = get('after');
  var beforeDate     = get('before');
  var dueAfter       = get('due_after');
  var dueBefore      = get('due_before');
  var statusFilter   = get('status');
  var categoryFilter = get('category');
  var bucketFilter   = get('bucket');
  var priorityFilter = get('priority');
  var locationFilter = get('location');
  var effortFilter   = get('effort');
  var projectFilter  = get('project');
  var overdueFlag    = has('overdue');
  var today          = new Date().toISOString().slice(0, 10);
  var BUCKET_MAP = {
    'next actions': 'next',   'next': 'next',
    'projects': 'project',    'project': 'project',
    'waiting for': 'waiting', 'waiting': 'waiting',
    'someday maybe': 'someday', 'someday': 'someday',
    'inbox': 'inbox', 'done': 'done', 'completed': 'done', 'deferred': 'deferred',
  };
  var result = tasks.filter(function(t) { return t.bucket !== 'inboxHistory'; });
  // Status: done=done only, active=active only, no status+no creation-date=active only, no status+date=all
  if (statusFilter === 'done') {
    result = result.filter(function(t) { return t.done || t.bucket === 'done'; });
  } else if (statusFilter === 'active' || (!statusFilter && !afterDate && !beforeDate)) {
    result = result.filter(function(t) { return !t.done && t.bucket !== 'done'; });
  }
  if (bucketFilter) {
    var bucketKey = BUCKET_MAP[bucketFilter.toLowerCase()] || bucketFilter.toLowerCase();
    result = result.filter(function(t) { return t.bucket === bucketKey; });
  }
  if (afterDate)  result = result.filter(function(t) { return t.created && new Date(t.created).toISOString().slice(0, 10) >= afterDate; });
  if (beforeDate) result = result.filter(function(t) { return t.created && new Date(t.created).toISOString().slice(0, 10) <= beforeDate; });
  if (dueAfter)   result = result.filter(function(t) { return t.dueDate && t.dueDate >= dueAfter; });
  if (dueBefore)  result = result.filter(function(t) { return t.dueDate && t.dueDate <= dueBefore; });
  if (overdueFlag) result = result.filter(function(t) { return t.dueDate && t.dueDate < today; });
  if (categoryFilter) {
    var cat = categoryFilter.toLowerCase();
    result = result.filter(function(t) { return t.category && t.category.toLowerCase().includes(cat); });
  }
  if (priorityFilter) {
    var pri = priorityFilter.toLowerCase();
    result = result.filter(function(t) { return (t.priority || []).some(function(p) { return p.toLowerCase().includes(pri); }); });
  }
  if (locationFilter) {
    var loc = locationFilter.toLowerCase();
    result = result.filter(function(t) { return (t.location || []).some(function(l) { return l.toLowerCase().includes(loc); }); });
  }
  if (effortFilter) {
    var eff = effortFilter.toLowerCase();
    result = result.filter(function(t) { return t.effort && t.effort.toLowerCase().includes(eff); });
  }
  if (projectFilter) {
    var pf = projectFilter.toLowerCase();
    var taskById = Object.fromEntries(tasks.map(function(t) { return [t.id, t]; }));
    var root = tasks.find(function(t) {
      return t.id === projectFilter ||
        (t.text && t.text.toLowerCase().includes(pf) && t.childIds && t.childIds.length > 0);
    });
    if (root) {
      var subtreeIds = new Set();
      var queue = [root.id];
      while (queue.length) {
        var qid = queue.shift();
        subtreeIds.add(qid);
        var task = taskById[qid];
        if (task && task.childIds) task.childIds.forEach(function(cid) { queue.push(cid); });
      }
      result = result.filter(function(t) { return subtreeIds.has(t.id); });
    }
  }
  return result;
}

/**
 * Owns the AI fetch loop, all tool-dispatch branches, action-line parsing,
 * the Ollama model list fetcher, and the sendChat convenience wrapper.
 *
 * @param {{
 *   tasks: Array, efforts: Array, calibrationOverrides: object,
 *   provider: string, localModel: string,
 *   googleToken: string|null, googleScope: string|null, calendarEnabled: boolean,
 *   authUser: object|null,
 *   docsEnabled: boolean, sheetsEnabled: boolean, slidesEnabled: boolean,
 *   coachMode: string, chatInput: string, chatHistory: Array, loading: boolean,
 *   getTaskContext: Function, recordUsage: Function,
 *   setTasks: Function, setCalendarEvents: Function, setGmailQueue: Function,
 *   setMessages: Function, setChatHistory: Function, setChatInput: Function,
 *   setLoading: Function, setAvailableModels: Function, setPendingAction: Function,
 * }} params
 * @returns {{ callAI: Function, sendChat: Function }}
 */
function useCallAI({
  tasks, efforts, calibrationOverrides,
  provider, localModel,
  googleToken, googleScope, calendarEnabled,
  authUser,
  docsEnabled, sheetsEnabled, slidesEnabled,
  coachMode, chatInput, chatHistory, loading,
  getTaskContext, recordUsage,
  setTasks, setCalendarEvents, setGmailQueue,
  setMessages, setChatHistory, setChatInput,
  setLoading, setAvailableModels, setPendingAction,
  setRawApiThread,
  calendarReminderMinutes,
  uncategorizedProjectId,
  exportFormat,
  userCity,
  userHomeAddress,
  userWorkAddress,
  coachName,
  userName,
  driveEnabled,
  contactsEnabled,
  driveDocumentFolderId,
  driveSpreadsheetFolderId,
  driveSlideDeckFolderId,
  driveBaseFolderId,
  receiptSheetId,
  onFocusSet,
}) {
  const fetchModels = useCallback(async () => {
    try {
      const res = await fetch(`${OPENWEBUI_URL}/api/models`, {
        headers: { 'Authorization': `Bearer ${import.meta.env.VITE_OPENWEBUI_API_KEY}` },
      });
      const data = await res.json();
      const models = (data.data || []).map(m => m.id).filter(Boolean);
      if (models.length) setAvailableModels(models);
    } catch { /* Open WebUI not reachable — fail silently */ }
  }, [setAvailableModels]);

  useEffect(() => {
    if (provider === 'local') fetchModels();
  }, [provider, fetchModels]);

  const [lastInputLog, setLastInputLog] = useState(null);
  // Persists email context across multi-turn conversations initiated by processEmailWithAI
  const emailContextRef = useRef(null);
  const setEmailContext = useCallback((ctx) => { emailContextRef.current = ctx; }, []);

  const callAI = useCallback(async (userMsg, mode, history, { emailContext = null } = {}) => {
    // Inject calibration context only for modes that suggest effort estimates
    const calibCtx = (mode === 'process' || mode === 'projectMetadata')
      ? buildCalibrationContext(tasks, efforts, calibrationOverrides)
      : '';
    // For chat mode with the Claude provider, send only a compact task summary.
    // The AI can call get_task_context to retrieve the full list on demand,
    // keeping per-message token cost low.
    const isLazyMode = mode === 'chat' && provider === 'claude';
    const taskContextPart = isLazyMode
      ? (() => {
          const BUCKET_LABELS = { inbox: 'Inbox', next: 'Next Actions', project: 'Projects', waiting: 'Waiting For', someday: 'Someday/Maybe' };
          const counts = Object.entries(BUCKET_LABELS)
            .map(([k, label]) => { const n = tasks.filter(t => t.bucket === k && !t.done).length; return n ? `${label}: ${n}` : null; })
            .filter(Boolean).join(' · ');
          return `\n\n[Task Overview — Today: ${new Date().toISOString().slice(0, 10)} | ${counts}]\nCall get_task_context to retrieve full task details when needed.`;
        })()
      : `\n\n[Current Task List]\n${getTaskContext(MODE_CONTEXT_BUCKETS[mode] ?? null)}`;
    const _locParts = [
      userCity ? 'City: ' + userCity : null,
      userHomeAddress ? 'Home address: ' + userHomeAddress : null,
      userWorkAddress ? 'Work address: ' + userWorkAddress : null,
    ].filter(Boolean);
    const locationCtx = _locParts.length ? '\n\n[User Location]\n' + _locParts.join('\n') : '';
    const personalizationCtx = [
      coachName ? 'Your name is ' + coachName + '.' : null,
      userName ? "The user's name is " + userName + "." : null,
    ].filter(Boolean).join(' ');
    const systemPrompt = (personalizationCtx ? personalizationCtx + '\n\n' : '') + SYSTEM_PROMPTS[mode] + calibCtx + locationCtx + taskContextPart;
    let inputLogSet = false;
    const newHistory = [...history, { role: 'user', content: userMsg }];

    setLoading(true);
    try {
      let reply;

      if (provider === 'claude') {
        let apiMessages = [...newHistory];
        let loopCount = 0;
        while (loopCount < 15) {
          loopCount++;
          const reqBody = {
            model: 'claude-sonnet-4-6',
            max_tokens: 2048,
            system: systemPrompt,
            messages: apiMessages,
          };
          if (mode === 'chat') {
            const availableTools = [GET_TASK_CONTEXT_TOOL];
            if (import.meta.env.VITE_TAVILY_API_KEY) availableTools.push(...TOOLS);
            if (googleToken) {
              availableTools.push(GMAIL_SEARCH_TOOL);
              if (googleScope === 'modify' || googleScope === 'compose' || googleScope === 'send') {
                availableTools.push(GMAIL_LIST_LABELS_TOOL);
                availableTools.push(GMAIL_LABEL_TOOL);
                availableTools.push(GMAIL_BATCH_LABEL_TOOL);
                availableTools.push(GMAIL_CREATE_LABEL_TOOL);
                availableTools.push(GMAIL_LIST_FILTERS_TOOL);
                availableTools.push(GMAIL_CREATE_FILTER_TOOL);
                availableTools.push(GMAIL_DELETE_FILTER_TOOL);
                availableTools.push(GMAIL_BULK_ACTION_TOOL);
                availableTools.push(GMAIL_QUEUE_ADD_TOOL);
              }
              if (googleScope === 'compose' || googleScope === 'send')
                availableTools.push(GMAIL_COMPOSE_TOOL);
              if (googleScope === 'modify' || googleScope === 'compose' || googleScope === 'send')
                availableTools.push(GMAIL_SEND_TOOL);
            }
            if (googleToken && driveEnabled) {
              availableTools.push(DRIVE_SEARCH_TOOL);
              availableTools.push(GET_DRIVE_FILE_TOOL);
            }
            if (googleToken && contactsEnabled) availableTools.push(CONTACTS_LOOKUP_TOOL);
            if (import.meta.env.VITE_OPENWEATHERMAP_API_KEY) availableTools.push(GET_WEATHER_TOOL);
            if (availableTools.length > 0) reqBody.tools = availableTools;
          }
          if (loopCount > 1) {
            setMessages(prev => [...prev, { role: 'assistant', text: `⏳ Processing Tool #${loopCount - 1} Output...`, isSearchChip: true }]);
          }
          const reqStart = Date.now();
          const abortCtrl = new AbortController();
          const abortTimer = setTimeout(() => abortCtrl.abort(), 90000);
          let res, data;
          try {
            res = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true',
              },
              body: JSON.stringify(reqBody),
              signal: abortCtrl.signal,
            });
            data = await res.json();
          } catch (fetchErr) {
            if (fetchErr.name === 'AbortError') throw new Error('Request timed out after 90 seconds — try a simpler request or break it into smaller steps.');
            throw fetchErr;
          } finally {
            clearTimeout(abortTimer);
          }
          if (!res.ok || data.error) {
            throw new Error(`Anthropic error ${res.status}: ${data.error?.message || JSON.stringify(data)}`);
          }
          if (data.usage) {
            recordUsage(data.usage.input_tokens || 0, data.usage.output_tokens || 0, Date.now() - reqStart, mode, 'claude');
            if (!inputLogSet) {
              setLastInputLog({ systemPrompt, userMsg, mode, inputTokens: data.usage.input_tokens || 0, ts: new Date().toISOString() });
              inputLogSet = true;
            }
          }
          if (data.stop_reason === 'tool_use') {
            const toolUseBlocks = data.content.filter(b => b.type === 'tool_use');
            const toolResults = [];
            for (const toolUse of toolUseBlocks) {
              if (toolUse.name === 'get_task_context') {
                setMessages(prev => [...prev, { role: 'assistant', text: '📋 Loading task list…', isSearchChip: true }]);
                try {
                  const buckets = Array.isArray(toolUse.input?.buckets) && toolUse.input.buckets.length
                    ? toolUse.input.buckets
                    : null;
                  const result = getTaskContext(buckets);
                  toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: result });
                } catch (e) { toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, is_error: true, content: e.message }); }
              } else if (toolUse.name === 'web_search') {
                const query = toolUse.input.query;
                setMessages(prev => [...prev, {
                  role: 'assistant', text: `🔍 Searching: "${query}"`, isSearchChip: true,
                }]);
                try {
                  const result = await doWebSearch(query);
                  toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: result });
                } catch (e) { toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, is_error: true, content: e.message }); }
              } else if (toolUse.name === 'gmail_search') {
                const query = toolUse.input.query;
                setMessages(prev => [...prev, {
                  role: 'assistant', text: `📧 Searching Gmail: "${query}"`, isSearchChip: true,
                }]);
                try {
                  const result = await doGmailSearch(query, googleToken, toolUse.input.max_results || 10);
                  toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: result });
                } catch (e) { toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, is_error: true, content: e.message }); }
              } else if (toolUse.name === 'gmail_list_labels') {
                try {
                  const result = await doGmailListLabels(googleToken);
                  toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: result });
                } catch (e) { toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, is_error: true, content: e.message }); }
              } else if (toolUse.name === 'gmail_create_label') {
                try {
                  const result = await doGmailCreateLabel(toolUse.input.name, googleToken);
                  toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: JSON.stringify(result) });
                } catch (e) { toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, is_error: true, content: e.message }); }
              } else if (toolUse.name === 'gmail_list_filters') {
                try {
                  const result = await doGmailListFilters(googleToken);
                  toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: result });
                } catch (e) { toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, is_error: true, content: e.message }); }
              } else if (toolUse.name === 'gmail_create_filter') {
                setMessages(prev => [...prev, { role: 'assistant', text: `🔧 Creating filter...`, isSearchChip: true }]);
                try {
                  const result = await doGmailCreateFilter(
                    toolUse.input.criteria_from, toolUse.input.criteria_to,
                    toolUse.input.criteria_subject, toolUse.input.criteria_query,
                    toolUse.input.action_add_label_ids, toolUse.input.action_remove_label_ids,
                    googleToken
                  );
                  toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: JSON.stringify(result) });
                } catch (e) { toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, is_error: true, content: e.message }); }
              } else if (toolUse.name === 'gmail_delete_filter') {
                try {
                  const result = await doGmailDeleteFilter(toolUse.input.filter_id, googleToken);
                  toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: JSON.stringify(result) });
                } catch (e) { toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, is_error: true, content: e.message }); }
              } else if (toolUse.name === 'gmail_batch_label') {
                setMessages(prev => [...prev, { role: 'assistant', text: `🏷️ Labelling ${toolUse.input.message_ids?.length || 0} message(s)...`, isSearchChip: true }]);
                try {
                  const result = await doGmailBatchLabel(
                    toolUse.input.message_ids, toolUse.input.add_label_ids,
                    toolUse.input.remove_label_ids, googleToken
                  );
                  toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: JSON.stringify(result) });
                } catch (e) { toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, is_error: true, content: e.message }); }
              } else if (toolUse.name === 'gmail_bulk_action') {
                setMessages(prev => [...prev, { role: 'assistant', text: `🏷️ Bulk action: searching all matching emails…`, isSearchChip: true }]);
                try {
                  const result = await doGmailBulkAction(
                    toolUse.input.query, toolUse.input.add_label_ids,
                    toolUse.input.remove_label_ids, googleToken
                  );
                  setMessages(prev => [...prev, { role: 'assistant', text: `✅ Bulk action complete — ${result.succeeded ?? 0} message(s) updated.`, isSearchChip: true }]);
                  toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: JSON.stringify(result) });
                } catch (e) { toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, is_error: true, content: e.message }); }
              } else if (toolUse.name === 'gmail_queue_add') {
                try {
                  const entry = {
                    id: genId(),
                    savedAt: new Date().toISOString(),
                    labelName:    toolUse.input.label_name,
                    labelId:      toolUse.input.label_id || null,
                    query:        toolUse.input.query,
                    description:  toolUse.input.description,
                    archive:      toolUse.input.archive !== false,
                    createFilter: toolUse.input.create_filter !== false,
                    status: 'pending',
                  };
                  setGmailQueue(prev => [entry, ...prev]);
                  if (authUser) {
                    supabase.from('gmail_queue').upsert(queueEntryToRow(entry, authUser.id)).then(({ error }) => {
                      if (error) console.error('gmail_queue upsert error', error);
                    });
                  }
                  toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: JSON.stringify({ status: 'Saved to cleanup queue', id: entry.id }) });
                } catch (e) { toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, is_error: true, content: e.message }); }
              } else if (toolUse.name === 'gmail_label') {
                try {
                  const result = await doGmailLabel(
                    toolUse.input.message_id, toolUse.input.add_label_ids,
                    toolUse.input.remove_label_ids, googleToken
                  );
                  toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: JSON.stringify(result) });
                } catch (e) { toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, is_error: true, content: e.message }); }
              } else if (toolUse.name === 'gmail_compose') {
                setMessages(prev => [...prev, { role: 'assistant', text: `✏️ Creating draft...`, isSearchChip: true }]);
                try {
                  const result = await doGmailCompose(
                    toolUse.input.to, toolUse.input.subject, toolUse.input.body,
                    toolUse.input.thread_id, googleToken
                  );
                  toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: JSON.stringify(result) });
                } catch (e) { toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, is_error: true, content: e.message }); }
              } else if (toolUse.name === 'gmail_send') {
                setPendingAction({
                  type: 'gmail_send',
                  to: toolUse.input.to,
                  subject: toolUse.input.subject,
                  body: toolUse.input.body,
                  threadId: toolUse.input.thread_id || null,
                });
                toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: JSON.stringify({ status: 'Email staged for sending — awaiting user confirmation in the action bar.' }) });
              } else if (toolUse.name === 'drive_search') {
                const driveQuery = toolUse.input.query;
                const driveMax = Math.min(toolUse.input.max_results || 10, 50);
                // Normalize plain-text keywords to valid Drive query syntax.
                // The Drive API rejects bare keywords (e.g. "LeanIX") with 400 Invalid Value;
                // they must be wrapped in a contains operator.
                let normalizedQuery = driveQuery;
                if (!/(contains|!=|=|in\s|has\s|>\s|<\s|\s+and\s+|\s+or\s+|\s+not\s+)/i.test(driveQuery)) {
                  const escaped = driveQuery.replace(/'/g, "\\'");
                  normalizedQuery = "name contains '" + escaped + "' or fullText contains '" + escaped + "'";
                }
                setMessages(prev => [...prev, {
                  role: 'assistant', text: '🔍 Searching Drive: "' + driveQuery + '"', isSearchChip: true,
                }]);
                try {
                  const result = await driveListFiles({ token: googleToken, q: normalizedQuery, pageSize: driveMax });
                  const files = (result.files || []).map(function(f) {
                    return { id: f.id, name: f.name, mimeType: f.mimeType, modifiedTime: f.modifiedTime, webViewLink: f.webViewLink };
                  });
                  toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: JSON.stringify(files) });
                } catch (e) { toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, is_error: true, content: e.message }); }
              } else if (toolUse.name === 'get_drive_file') {
                const driveFileId = toolUse.input.file_id;
                setMessages(prev => [...prev, {
                  role: 'assistant', text: '📄 Reading Drive file…', isSearchChip: true,
                }]);
                try {
                  const meta = await driveGetFile({ token: googleToken, fileId: driveFileId });
                  const fileMime = meta.mimeType || '';
                  let fileContent;
                  if (fileMime.startsWith('application/vnd.google-apps.')) {
                    const exportMime = toolUse.input.mime_type || (fileMime.includes('spreadsheet') ? 'text/csv' : 'text/plain');
                    fileContent = await driveExportFile({ token: googleToken, fileId: driveFileId, mimeType: exportMime });
                  } else {
                    fileContent = await driveDownloadFile({ token: googleToken, fileId: driveFileId });
                  }
                  if (fileContent.length > 50000) fileContent = fileContent.slice(0, 50000) + '\n[content truncated at 50,000 chars]';
                  toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: fileContent });
                } catch (e) { toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, is_error: true, content: e.message }); }
              } else if (toolUse.name === 'get_weather') {
                const weatherCity = toolUse.input.city || userCity;
                const weatherUnits = toolUse.input.units || 'imperial';
                if (!weatherCity) {
                  toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: 'No city specified and no default city configured. Ask the user for their city.' });
                } else {
                  setMessages(prev => [...prev, { role: 'assistant', text: '🌤️ Fetching weather for ' + weatherCity + '…', isSearchChip: true }]);
                  try {
                    const owmKey = import.meta.env.VITE_OPENWEATHERMAP_API_KEY;
                    const [curRes, fcastRes] = await Promise.all([
                      fetch('https://api.openweathermap.org/data/2.5/weather?q=' + encodeURIComponent(weatherCity) + '&appid=' + owmKey + '&units=' + weatherUnits),
                      fetch('https://api.openweathermap.org/data/2.5/forecast?q=' + encodeURIComponent(weatherCity) + '&appid=' + owmKey + '&units=' + weatherUnits + '&cnt=8'),
                    ]);
                    const curData = await curRes.json();
                    const fcastData = await fcastRes.json();
                    if (curData.cod !== 200) throw new Error(curData.message || 'City not found');
                    const unitLabel = weatherUnits === 'metric' ? '°C' : '°F';
                    const result = {
                      city: curData.name,
                      country: curData.sys.country,
                      current: {
                        temp: curData.main.temp,
                        feels_like: curData.main.feels_like,
                        humidity: curData.main.humidity,
                        description: curData.weather[0].description,
                        wind_speed: curData.wind.speed,
                        units: unitLabel,
                        wind_units: weatherUnits === 'metric' ? 'm/s' : 'mph',
                      },
                      forecast: (fcastData.list || []).map(function(f) {
                        return { time: f.dt_txt, temp: f.main.temp, description: f.weather[0].description, pop: Math.round((f.pop || 0) * 100) };
                      }),
                    };
                    toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: JSON.stringify(result) });
                  } catch (e) { toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, is_error: true, content: 'Weather fetch failed: ' + e.message }); }
                }
              } else if (toolUse.name === 'contacts_lookup') {
                const contactsQuery = toolUse.input.query;
                const contactsMax = Math.min(toolUse.input.max_results || 5, 30);
                setMessages(prev => [...prev, { role: 'assistant', text: `👤 Searching contacts: "${contactsQuery}"`, isSearchChip: true }]);
                try {
                  const results = await peopleSearchContacts({ token: googleToken, query: contactsQuery, maxResults: contactsMax });
                  toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: JSON.stringify(results) });
                } catch (e) { toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, is_error: true, content: e.message }); }
              }
            }
            // Ensure every tool_use block has a result (empty content triggers Anthropic 400)
            for (const tu of toolUseBlocks) {
              if (!toolResults.find(r => r.tool_use_id === tu.id)) {
                toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: '(no result)' });
              }
            }
            apiMessages = [
              ...apiMessages,
              { role: 'assistant', content: data.content },
              { role: 'user', content: toolResults },
            ];
          } else {
            reply = data.content?.find(b => b.type === 'text')?.text || 'Sorry, something went wrong.';
            // FR#102: capture tool rounds from this turn
            if (setRawApiThread) {
              const toolRoundsRaw = apiMessages.slice(newHistory.length);
              if (toolRoundsRaw.length > 0) {
                const toolRoundsForTurn = [];
                for (let i = 0; i < toolRoundsRaw.length; i += 2) {
                  const asst = toolRoundsRaw[i]; const usr = toolRoundsRaw[i + 1];
                  if (asst && usr) toolRoundsForTurn.push({
                    toolCalls: asst.content.filter(b => b.type === 'tool_use'),
                    toolResults: usr.content.filter(b => b.type === 'tool_result'),
                  });
                }
                if (toolRoundsForTurn.length > 0) {
                  setRawApiThread(prev => [...prev, { userMessage: userMsg, toolRounds: toolRoundsForTurn, finalReply: reply }]);
                }
              }
            }
            break;
          }
        }
        if (!reply) reply = 'I ran out of steps before finishing — the operation may be too complex for one turn. Try breaking it into smaller requests (e.g. one sender at a time).';
      } else {
        const ollamaStart = Date.now();
        const res = await fetch(`${OPENWEBUI_URL}/api/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_OPENWEBUI_API_KEY}`,
          },
          body: JSON.stringify({
            model: localModel,
            messages: [
              { role: 'system', content: systemPrompt },
              ...newHistory,
            ],
          }),
        });
        const data = await res.json();
        if (!res.ok || data.error) {
          throw new Error(`Open WebUI error ${res.status}: ${data.error?.message || JSON.stringify(data)}`);
        }
        if (data.usage) {
          recordUsage(data.usage.prompt_tokens || 0, data.usage.completion_tokens || 0, Date.now() - ollamaStart, mode, 'ollama');
          if (!inputLogSet) {
            setLastInputLog({ systemPrompt, userMsg, mode, inputTokens: data.usage.prompt_tokens || 0, ts: new Date().toISOString() });
            inputLogSet = true;
          }
        }
        reply = data.choices?.[0]?.message?.content || 'Sorry, something went wrong.';
      }

      const updatedHistory = [...newHistory, { role: 'assistant', content: reply }];
      setChatHistory(updatedHistory);

      // Apply →ACTION lines when in chat or dump mode — supports multiple actions per response
      let updateChip = null;
      let actionError = null;
      if (mode === 'chat' || mode === 'dump' || mode === 'daily' || mode === 'review') {
        // Extract →ACTION lines — notes values may span multiple non-blank lines,
        // so match each block until the first blank line (\n\n) which separates
        // action lines from the AI's subsequent prose response.
        const taskActionLines = [];
        const actionRe = /→ACTION:(?:update|add|create|link_email|next|someday|waiting)\|(?:[^\n]|\n(?!\n)(?!→ACTION:))+/g;
        for (const am of reply.matchAll(actionRe)) {
          taskActionLines.push(am[0].trimEnd());
        }

        let workingTasks = [...tasks];
        if (taskActionLines.length > 0) {
          // Process all actions against a local working copy so parent lookups
          // work across the batch (e.g. create parent then add children in same response)
          const chips = [];
          const actionErrors = [];

          for (const line of taskActionLines) {
            const upd = extractUpdateAction(line);
            if (upd) {
              const target = workingTasks.find(t => t.id === upd.taskId);
              if (target) {
                const resolvedChanges = { ...upd.changes };
                if (resolvedChanges.notesAppend !== undefined) {
                  const existing = target.notes || '';
                  resolvedChanges.notes = existing
                    ? existing + '\n' + resolvedChanges.notesAppend
                    : resolvedChanges.notesAppend;
                  delete resolvedChanges.notesAppend;
                }
                workingTasks = workingTasks.map(t =>
                  t.id === upd.taskId ? { ...t, ...resolvedChanges } : t
                );
                const fieldLabels = Object.keys(resolvedChanges).map(k => ({
                  notes: 'notes', dueDate: 'due date', deferUntil: 'defer date',
                  effort: 'effort', actualEffort: 'actual effort', text: 'title', bucket: 'bucket',
                  priority: 'priority', location: 'location', recurrence: 'recurrence',
                }[k] || k));
                chips.push({ taskName: target.text, fields: fieldLabels });
              } else {
                actionErrors.push(`⚠ Action failed: no task found with ID "${upd.taskId}". The task may have been deleted or the ID is incorrect.`);
              }
              continue;
            }

            const add = extractAddAction(line);
            if (add) {
              const { title, parentId: parentRef, bucket: addBucket = 'next', dueDate = null,
                      deferUntil = null, effort = null, location = [], recurrence = null, category = null } = add;
              const addIsNext = addBucket === 'next';
              const addBucketFinal = addIsNext ? 'project' : addBucket;
              // ID lookup first; fall back to exact title match (supports newly-created parents)
              const parent = workingTasks.find(t => t.id === parentRef)
                          || workingTasks.find(t => t.text.toLowerCase() === parentRef.toLowerCase());
              if (parent) {
                const newId = genId();
                const newTask = {
                  id: newId, text: title, bucket: addBucketFinal, done: false, created: Date.now(),
                  parentId: parent.id, priority: [], location, dueDate, effort: normalizeEffort(effort, efforts),
                  actualEffort: null, deferUntil, notes: add.notes || null, recurrence,
                  category: category || parent.category || null,
                  ...(addIsNext ? { isNextAction: true } : {}),
                };
                workingTasks = [
                  ...workingTasks.map(t => t.id === parent.id
                    ? { ...t, childIds: [...(t.childIds || []), newId] }
                    : t
                  ),
                  newTask,
                ];
                chips.push({ taskName: title, fields: ['added under ' + parent.text] });
              } else {
                actionErrors.push(`⚠ Action failed: no task found with ID or title "${parentRef}". The parent may not exist or has been deleted.`);
              }
              continue;
            }

            const create = extractCreateAction(line);
            if (create) {
              const { title, bucket: rawBucket, dueDate = null, dueTime = null, deferUntil = null,
                      effort = null, location = [], recurrence = null } = create;
              const createIsNext = rawBucket === 'next';
              const bucket = createIsNext ? 'project' : rawBucket;
              const newId = genId();
              const parentId = (createIsNext && uncategorizedProjectId) ? uncategorizedProjectId : undefined;
              const newTask = {
                id: newId, text: title, bucket, done: false, created: Date.now(),
                priority: [], location, dueDate, dueTime, effort: normalizeEffort(effort, efforts), actualEffort: null,
                deferUntil, notes: create.notes || null, recurrence,
                ...(createIsNext ? { isNextAction: true } : {}),
                ...(parentId ? { parentId } : {}),
              };
              if (parentId) {
                workingTasks = [newTask, ...workingTasks.map(t => t.id === parentId
                  ? { ...t, childIds: [...(t.childIds || []), newId] }
                  : t)];
              } else {
                workingTasks = [newTask, ...workingTasks];
              }
              chips.push({ taskName: title, fields: ['created in ' + (createIsNext ? 'Next Actions' : bucket)] });
            }

            // →ACTION:link_email|<task_title_or_id>|<gmail_message_id>[|<subject>]
            if (line.startsWith('→ACTION:link_email|')) {
              const parts = line.slice('→ACTION:link_email|'.length).split('|');
              const ref     = (parts[0] || '').trim();
              const gmailId = (parts[1] || '').trim();
              const subj    = (parts[2] || ref).trim();
              if (ref && gmailId) {
                const target = workingTasks.find(t => t.id === ref || t.text.toLowerCase() === ref.toLowerCase());
                if (target) {
                  workingTasks = workingTasks.map(t => {
                    if (t.id !== target.id) return t;
                    const existing = t.driveAttachments || [];
                    if (existing.find(a => a.id === gmailId)) return t;
                    return { ...t, driveAttachments: [...existing, { id: gmailId, name: subj, type: 'email' }] };
                  });
                  chips.push({ taskName: target.text, fields: ['email linked'] });
                }
              }
              continue;
            }

            // →ACTION:next|<title>[|due:YYYY-MM-DD][|defer:YYYY-MM-DD][|effort:<label>][|priority:<p1,p2>][|location:<loc>][|notes:<text>]
            if (line.startsWith('→ACTION:next|')) {
              const parts = line.slice('→ACTION:next|'.length).split('|');
              const title = (parts[0] || '').trim();
              const xtra = {};
              for (let i = 1; i < parts.length; i++) {
                const ci = parts[i].indexOf(':');
                if (ci < 0) continue;
                const k = parts[i].slice(0, ci).trim();
                const v = parts[i].slice(ci + 1).trim();
                if (k === 'due')      xtra.dueDate    = v;
                if (k === 'defer')    xtra.deferUntil = v;
                if (k === 'effort')   xtra.effort     = normalizeEffort(v, efforts);
                if (k === 'notes')    xtra.notes      = v;
                if (k === 'location') xtra.location   = v.split(',').map(s => s.trim()).filter(Boolean);
                if (k === 'priority') xtra.priority   = v.split(',').map(s => s.trim()).filter(Boolean);
              }
              if (title) {
                const newId = genId();
                const parentId = uncategorizedProjectId || undefined;
                const newTask = {
                  id: newId, text: title, bucket: 'project', done: false, created: Date.now(),
                  priority: xtra.priority || [], location: xtra.location || [],
                  dueDate: xtra.dueDate || null, effort: xtra.effort || null, actualEffort: null,
                  deferUntil: xtra.deferUntil || null, notes: xtra.notes || null,
                  recurrence: null, isNextAction: true,
                  ...(parentId ? { parentId } : {}),
                };
                if (parentId) {
                  workingTasks = [newTask, ...workingTasks.map(t => t.id === parentId
                    ? { ...t, childIds: [...(t.childIds || []), newId] } : t)];
                } else {
                  workingTasks = [newTask, ...workingTasks];
                }
                chips.push({ taskName: title, fields: ['created in Next Actions'] });
              }
              continue;
            }

            // →ACTION:someday|<title>[|due:YYYY-MM-DD][|defer:YYYY-MM-DD][|effort:<label>][|notes:<text>]
            if (line.startsWith('→ACTION:someday|')) {
              const parts = line.slice('→ACTION:someday|'.length).split('|');
              const title = (parts[0] || '').trim();
              const xtra = {};
              for (let i = 1; i < parts.length; i++) {
                const ci = parts[i].indexOf(':');
                if (ci < 0) continue;
                const k = parts[i].slice(0, ci).trim();
                const v = parts[i].slice(ci + 1).trim();
                if (k === 'due')      xtra.dueDate    = v;
                if (k === 'defer')    xtra.deferUntil = v;
                if (k === 'effort')   xtra.effort     = normalizeEffort(v, efforts);
                if (k === 'notes')    xtra.notes      = v;
                if (k === 'location') xtra.location   = v.split(',').map(s => s.trim()).filter(Boolean);
                if (k === 'priority') xtra.priority   = v.split(',').map(s => s.trim()).filter(Boolean);
              }
              if (title) {
                const newId = genId();
                const parentId = uncategorizedProjectId || undefined;
                const newTask = {
                  id: newId, text: title, bucket: 'project', done: false, created: Date.now(),
                  priority: xtra.priority || [], location: xtra.location || [],
                  dueDate: xtra.dueDate || null, effort: xtra.effort || null, actualEffort: null,
                  deferUntil: xtra.deferUntil || null, notes: xtra.notes || null,
                  recurrence: null, isSomeday: true,
                  ...(parentId ? { parentId } : {}),
                };
                if (parentId) {
                  workingTasks = [newTask, ...workingTasks.map(t => t.id === parentId
                    ? { ...t, childIds: [...(t.childIds || []), newId] } : t)];
                } else {
                  workingTasks = [newTask, ...workingTasks];
                }
                chips.push({ taskName: title, fields: ['created in Someday/Maybe'] });
              }
              continue;
            }

            // →ACTION:waiting|<title>[|due:YYYY-MM-DD][|defer:YYYY-MM-DD][|notes:<text>]
            if (line.startsWith('→ACTION:waiting|')) {
              const parts = line.slice('→ACTION:waiting|'.length).split('|');
              const title = (parts[0] || '').trim();
              const xtra = {};
              for (let i = 1; i < parts.length; i++) {
                const ci = parts[i].indexOf(':');
                if (ci < 0) continue;
                const k = parts[i].slice(0, ci).trim();
                const v = parts[i].slice(ci + 1).trim();
                if (k === 'due')   xtra.dueDate    = v;
                if (k === 'defer') xtra.deferUntil = v;
                if (k === 'notes') xtra.notes      = v;
              }
              if (title) {
                const newId = genId();
                const parentId = uncategorizedProjectId || undefined;
                const newTask = {
                  id: newId, text: title, bucket: 'project', done: false, created: Date.now(),
                  priority: [], location: [],
                  dueDate: xtra.dueDate || null, effort: null, actualEffort: null,
                  deferUntil: xtra.deferUntil || null, notes: xtra.notes || null,
                  recurrence: null, isWaitingFor: true,
                  ...(parentId ? { parentId } : {}),
                };
                if (parentId) {
                  workingTasks = [newTask, ...workingTasks.map(t => t.id === parentId
                    ? { ...t, childIds: [...(t.childIds || []), newId] } : t)];
                } else {
                  workingTasks = [newTask, ...workingTasks];
                }
                chips.push({ taskName: title, fields: ['created in Waiting For'] });
              }
              continue;
            }
          }

          // Commit all mutations in one setTasks call
          setTasks(workingTasks);

          if (chips.length === 1) {
            updateChip = chips[0];
          } else if (chips.length > 1) {
            updateChip = { taskName: `${chips.length} tasks`, fields: ['created/updated'] };
          }
          if (actionErrors.length > 0) {
            actionError = actionErrors.join('\n');
          }
        }
      }

      if (googleToken && calendarEnabled) {
        const calCreate = extractCalendarCreateAction(reply);
        const calUpdate = extractCalendarUpdateAction(reply);
        const calDelete = extractCalendarDeleteAction(reply);
        if (calCreate) {
          try {
            const ev = await doCalendarCreateEvent(googleToken, {
              summary: calCreate.title, description: calCreate.description || '',
              date: calCreate.date, startTime: calCreate.startTime, endTime: calCreate.endTime,
              attendees: calCreate.attendees, sendUpdates: calCreate.sendUpdates,
              recurrence: calCreate.recurrence || null,
              reminderMinutes: calendarReminderMinutes ?? 10,
            });
            setCalendarEvents(prev => [...prev, ev]);
            if (calCreate.taskId) {
              workingTasks = workingTasks.map(t => t.id === calCreate.taskId ? { ...t, calendarEventId: ev.id } : t);
              setTasks(workingTasks);
            } else {
              const newId = genId();
              workingTasks = [{
                id: newId, text: calCreate.title, bucket: 'inbox', done: false, created: Date.now(),
                priority: [], location: [], dueDate: calCreate.date, effort: null, actualEffort: null,
                deferUntil: null, notes: calCreate.description || null, recurrence: null,
                calendarEventId: ev.id,
              }, ...workingTasks];
              setTasks(workingTasks);
            }
            updateChip = { taskName: calCreate.title, fields: ['created in Google Calendar', 'added to Inbox'] };
          } catch (e) { actionError = `⚠ Calendar action failed: ${e.message}`; }
        } else if (calUpdate) {
          try {
            const ev = await doCalendarUpdateEvent(googleToken, calUpdate.eventId, {
              summary: calUpdate.title, date: calUpdate.date,
              startTime: calUpdate.startTime, endTime: calUpdate.endTime,
              attendees: calUpdate.attendees, sendUpdates: calUpdate.sendUpdates,
            });
            setCalendarEvents(prev => prev.map(e => e.id === ev.id ? ev : e));
            if (calUpdate.taskId) {
              workingTasks = workingTasks.map(t => t.id === calUpdate.taskId ? { ...t, dueDate: calUpdate.date } : t);
              setTasks(workingTasks);
            }
            updateChip = { taskName: calUpdate.title || calUpdate.eventId, fields: ['updated in Google Calendar'] };
          } catch (e) { actionError = `⚠ Calendar action failed: ${e.message}`; }
        } else if (calDelete) {
          try {
            const delResult = await doCalendarDeleteEvent(googleToken, calDelete.eventId);
            if (delResult) {
              const { masterEventId, cutoffDateStr } = delResult;
              setCalendarEvents(prev => prev.filter(e => {
                const eId = e.recurringEventId || e.id;
                if (eId !== masterEventId && e.id !== masterEventId) return true;
                if (cutoffDateStr === null) return false;
                const eStart = e.start?.date || e.start?.dateTime?.slice(0, 10);
                return eStart && eStart < cutoffDateStr;
              }));
              workingTasks = workingTasks.map(t =>
                (t.calendarEventId === calDelete.eventId || t.calendarEventId === masterEventId)
                  ? { ...t, calendarEventId: null } : t
              );
              setTasks(workingTasks);
            } else {
              setCalendarEvents(prev => prev.filter(e => e.id !== calDelete.eventId));
              workingTasks = workingTasks.map(t => t.calendarEventId === calDelete.eventId ? { ...t, calendarEventId: null } : t);
              setTasks(workingTasks);
            }
            updateChip = { taskName: 'Calendar event', fields: ['deleted from Google Calendar'] };
          } catch (e) { actionError = `⚠ Calendar action failed: ${e.message}`; }
        }
      }

      // →ACTION:create-doc|<title>[|task:<id>] — create Google Doc from coach
      if (googleToken && docsEnabled) {
        const docLine = reply.split('\n').map(l => l.trim()).find(l => l.startsWith('\u2192ACTION:create-doc|'));
        if (docLine) {
          try {
            const parts = docLine.slice('\u2192ACTION:create-doc|'.length).split('|');
            const modeDocLabel = (COACH_MODES[coachMode] || {}).label || coachMode;
            const docDateStr = new Date().toISOString().slice(0, 10);
            const docTitle = modeDocLabel + ' — ' + (parts[0] || 'Coach Output').trim() + ' — ' + docDateStr;
            const taskRef = (parts.find(p => p.startsWith('task:')) || '').replace('task:', '').trim();
            const doc = await docsCreateDocument({ token: googleToken, title: docTitle });
            const bodyText = reply.replace(/\u2192ACTION:[^\n]*/g, '').trim();
            if (bodyText) {
              const fmt = exportFormat || 'rtf';
              if (fmt === 'markdown') {
                await docsAppendText({ token: googleToken, documentId: doc.documentId, text: bodyText, onTokenRefresh: refreshGoogleToken });
              } else if (fmt === 'text') {
                const plain = bodyText.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1').replace(/^#{1,6}\s+/gm, '').replace(/^>\s*/gm, '').replace(/^---$/gm, '');
                await docsAppendText({ token: googleToken, documentId: doc.documentId, text: plain, onTokenRefresh: refreshGoogleToken });
              } else {
                await docsAppendMarkdown({ token: googleToken, documentId: doc.documentId, markdownText: bodyText, onTokenRefresh: refreshGoogleToken });
              }
            }
            const docUrl = `https://docs.google.com/document/d/${doc.documentId}/edit`;
            if (taskRef) {
              const target = tasks.find(t => t.id === taskRef || t.text.toLowerCase() === taskRef.toLowerCase());
              if (target) {
                const existing = target.driveAttachments || [];
                setTasks(prev => prev.map(t => t.id === target.id
                  ? { ...t, driveAttachments: [...existing, { id: doc.documentId, name: docTitle, mimeType: 'application/vnd.google-apps.document', url: docUrl }] }
                  : t));
              }
            }
            const docTargetFolder = driveDocumentFolderId || driveBaseFolderId || null;
            if (docTargetFolder) {
              await docsMoveToFolder({ token: googleToken, documentId: doc.documentId, newParentId: docTargetFolder, onTokenRefresh: refreshGoogleToken });
            }
            updateChip = { taskName: docTitle, fields: ['Google Doc created'], url: docUrl };
          } catch (e) { actionError = `\u26a0 Doc creation failed: ${e.message}`; }
        }
      }

      // →ACTION:create-sheet|<title>[|after:YYYY-MM-DD][|before:YYYY-MM-DD] — create Google Sheet from coach
      if (googleToken && sheetsEnabled) {
        const sheetLine = reply.split('\n').map(l => l.trim()).find(l => l.startsWith('\u2192ACTION:create-sheet|'));
        if (sheetLine) {
          try {
            const sheetParts = sheetLine.slice('\u2192ACTION:create-sheet|'.length).split('|');
            const sheetTitle = (sheetParts[0] || 'Coach Spreadsheet').trim();
            const sheetTabs = parseSheetTabs(sheetParts);
            const sheet = await sheetsCreateSpreadsheet({ token: googleToken, title: sheetTitle });
            const sheetId = sheet.spreadsheetId;
            const sheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;
            const taskById = Object.fromEntries(tasks.map(t => [t.id, t]));
            // Rename default Sheet1 tab and create additional tabs in one batchUpdate
            const batchReqs = [{ updateSheetProperties: { properties: { sheetId: 0, title: sheetTabs[0].name }, fields: 'title' } }];
            for (var ti = 1; ti < sheetTabs.length; ti++) {
              batchReqs.push({ addSheet: { properties: { title: sheetTabs[ti].name } } });
            }
            await sheetsBatchUpdate({ token: googleToken, spreadsheetId: sheetId, requests: batchReqs });
            // Populate each tab with filtered task data
            var totalRows = 0;
            for (var ti = 0; ti < sheetTabs.length; ti++) {
              var tab = sheetTabs[ti];
              var tabTasks = applyTaskFilters(tab.params, tasks);
              totalRows += tabTasks.length;
              var tabValues = buildSheetData(tabTasks, taskById, tab.columns);
              await sheetsAppendRows({ token: googleToken, spreadsheetId: sheetId, range: tab.name, values: tabValues });
            }
            var tabsLabel = sheetTabs.length > 1 ? sheetTabs.length + ' tabs, ' + totalRows + ' tasks' : totalRows + ' tasks';
            const sheetTargetFolder = driveSpreadsheetFolderId || driveBaseFolderId || null;
            if (sheetTargetFolder) {
              await sheetsMoveToFolder({ token: googleToken, spreadsheetId: sheetId, newParentId: sheetTargetFolder, onTokenRefresh: refreshGoogleToken });
            }
            updateChip = { taskName: sheetTitle, fields: ['Google Sheet created — ' + tabsLabel], url: sheetUrl };
          } catch (e) { actionError = `\u26a0 Sheet creation failed: ${e.message}`; }
        }
      }

      // →ACTION:append-sheet|<date>|<vendor>|<amount>|<currency>|<category>|<description>
      // Appends one receipt row to the configured receipt sheet (Settings → Receipt Tracking)
      if (googleToken && sheetsEnabled && receiptSheetId) {
        const appendLine = reply.split('\n').map(l => l.trim()).find(l => l.startsWith('→ACTION:append-sheet|'));
        if (appendLine) {
          try {
            const parts = appendLine.slice('→ACTION:append-sheet|'.length).split('|');
            const [rowDate, rowVendor, rowAmount, rowCurrency, rowCategory, ...descParts] = parts;
            const rowDescription = descParts.join('|').trim();
            const row = [
              (rowDate || new Date().toISOString().slice(0, 10)).trim(),
              (rowVendor || '').trim(),
              (rowAmount || '').trim(),
              (rowCurrency || 'USD').trim(),
              (rowCategory || '').trim(),
              rowDescription,
            ];
            await sheetsAppendRows({ token: googleToken, spreadsheetId: receiptSheetId, range: 'Sheet1', values: [row], onTokenRefresh: refreshGoogleToken });
            updateChip = { taskName: rowVendor || 'Receipt', fields: ['appended to receipt sheet'] };
          } catch (e) { actionError = `⚠ Receipt sheet append failed: ${e.message}`; }
        }
      }

      // →ACTION:create-slides|<title> — create PowerPoint (.pptx) via pptxgenjs + Drive upload
      if (googleToken && slidesEnabled) {
        const slidesLine = reply.split('\n').map(l => l.trim()).find(l => l.startsWith('\u2192ACTION:create-slides|'));
        if (slidesLine) {
          try {
            const slidesParts = slidesLine.slice('\u2192ACTION:create-slides|'.length).split('|');
            const slidesTitle = (slidesParts[0] || 'Coach Presentation').trim();
            const slidesTheme = (slidesParts.find(function(p) { return p.startsWith('template:'); }) || '').replace('template:', '').trim() || 'dark-slate';
            // Parse slide sections: split on --- dividers, ## heading = title, rest = body
            const parsedSlides = reply.split(/\n?---\n?/)
              .map(function(section) {
                const lines = section.trim().split('\n');
                const titleLine = lines.find(function(l) { return /^#+\s/.test(l); });
                if (!titleLine) return null;
                const title = titleLine.replace(/^#+\s*/, '').replace(/^\s*Slide\s+\d+[:.\s]\s*/i, '').trim();
                const body = lines.filter(function(l) { return l !== titleLine; }).join('\n').trim();
                return title ? { title: title, body: body } : null;
              })
              .filter(Boolean);
            const slideCount = parsedSlides.length;
            const slidesTargetFolder = driveSlideDeckFolderId || driveBaseFolderId || undefined;
            const result = await createAndUploadPptx({
              token: googleToken,
              title: slidesTitle,
              slides: parsedSlides,
              theme: slidesTheme,
              folderId: slidesTargetFolder,
            });
            const fieldLabel = slideCount > 0 ? slideCount + ' slides' : 'PowerPoint created';
            updateChip = { taskName: result.fileName, fields: [fieldLabel], url: result.webViewLink };
          } catch (e) { actionError = `⚠ Presentation creation failed: ${e.message}`; }
        }
      }

      // →ACTION:set-focus|<id1>,<id2>,... — daily mode focus selection
      if (mode === 'daily') {
        const focusLine = reply.split('\n').map(l => l.trim()).find(l => l.startsWith('→ACTION:set-focus|'));
        if (focusLine) {
          const ids = focusLine.replace('→ACTION:set-focus|', '').split(',').map(id => id.trim()).filter(Boolean);
          if (ids.length > 0) {
            const today = new Date().toISOString().slice(0, 10);
            localStorage.setItem(`gtd-todays-focus-${today}`, JSON.stringify({ ids, date: today }));
            updateChip = { taskName: `${ids.length} task${ids.length !== 1 ? 's' : ''}`, fields: ["set as Today's Focus"] };
            if (onFocusSet) onFocusSet();
          }
        }
      }

      // After SoD response, inject MIT picker so user can select via checkboxes
      let mitPickerMsg = null;
      if (mode === 'daily' && userMsg.includes('[SoD Summary]')) {
        const today8601 = new Date().toISOString().slice(0, 10);
        const active = tasks.filter(t => !t.done && t.bucket !== 'done' && t.bucket !== 'inboxHistory');
        const overdueList = active.filter(t => t.dueDate && t.dueDate < today8601);
        const dueTodayList = active.filter(t => t.dueDate === today8601);
        if (overdueList.length > 0 || dueTodayList.length > 0) {
          mitPickerMsg = { role: 'assistant', type: 'mit-picker', overdue: overdueList, dueToday: dueTodayList };
        }
      }

      if (actionError) {
        setMessages(prev => {
          const next = [...prev, { role: 'assistant', text: reply, updateChip }, { role: 'assistant', text: actionError }];
          if (mitPickerMsg) next.push(mitPickerMsg);
          return next;
        });
      } else {
        setMessages(prev => {
          const next = [...prev, { role: 'assistant', text: reply, updateChip }];
          if (mitPickerMsg) next.push(mitPickerMsg);
          return next;
        });
      }

      const action = extractAction(reply);
      // Shared question guard — check for '?' ONLY in the last non-empty line
      // before →ACTION. Checking the full preceding text is too broad:
      // follow-up questions like 'Anything else?' after a confirmation would incorrectly
      // suppress the action. Only the last line matters — that's where a
      // question about the action itself would appear.
      const _guardIdx = reply.search(/→ACTION:/);
      const _beforeAction = _guardIdx !== -1 ? reply.slice(0, _guardIdx) : '';
      const _lastLine = _beforeAction.split('\n').map(l => l.trim()).filter(Boolean).pop() || '';
      const _hasQuestion = _lastLine.replace(/\[[^\]]*\]/g, '').includes('?');
      if (action) {
        if (!_hasQuestion) {
          // Resolve parent name for →ACTION:add and →ACTION:project so PendingActionBar can display it
          if ((action.type === 'add' || action.type === 'project') && action.parentRef) {
            const parent = tasks.find(t => t.id === action.parentRef)
                        || tasks.find(t => t.text.toLowerCase() === action.parentRef.toLowerCase());
            action.parentName = parent?.text || action.parentRef;
          }
          setPendingAction(action);
        }
      } else {
        // extractAction only handles next/project/someday/waiting/delete.
        // For update actions (review mode marking tasks done/moved), try extractUpdateAction.
        const updateAction = extractUpdateAction(reply);
        if (updateAction && !_hasQuestion) {
          const target = tasks.find(t => t.id === updateAction.taskId);
          setPendingAction({
            type: 'update',
            taskId: updateAction.taskId,
            changes: updateAction.changes,
            title: target?.text || updateAction.taskId,
          });
        } else {
          // For →ACTION:add (process mode: add child task to existing project),
          // try extractAddAction. extractAction never returns type:'add' because its
          // regex only matches next/project/someday/waiting/delete.
          const addAction = extractAddAction(reply);
          if (addAction && !_hasQuestion) {
            const _spPrl = (addAction.parentId || '').toLowerCase();
            const parent = tasks.find(t => t.id === addAction.parentId)
                        || tasks.find(t => t.text.toLowerCase() === _spPrl)
                        || tasks.find(t => t.bucket === 'project' && !t.done && (t.text.toLowerCase().includes(_spPrl) || _spPrl.includes(t.text.toLowerCase())));
            setPendingAction({
              type: 'add',
              title: addAction.title,
              parentRef: addAction.parentId,
              parentName: parent?.text || addAction.parentId,
              dueDate: addAction.dueDate || null,
              deferUntil: addAction.deferUntil || null,
              effort: addAction.effort || null,
              location: addAction.location || [],
              priority: addAction.priority || [],
              category: addAction.category || null,
              notes: addAction.notes || null,
              recurrence: addAction.recurrence || null,
            });
          }
        }
      }

      return reply;
    } catch (e) {
      console.error('[callAI error]', e);
      const err = `Error: ${e.message}`;
      setMessages(prev => [...prev, { role: 'assistant', text: err }]);
    } finally {
      setLoading(false);
    }
  }, [getTaskContext, tasks, efforts, calibrationOverrides, provider, localModel,
      googleToken, googleScope, calendarEnabled, docsEnabled, sheetsEnabled, slidesEnabled,
      setCalendarEvents, recordUsage, setLastInputLog, setTasks, setGmailQueue,
      setMessages, setChatHistory, setLoading, setPendingAction, authUser, userCity, userHomeAddress, userWorkAddress, coachName, userName,
      driveEnabled, contactsEnabled, driveDocumentFolderId, driveSpreadsheetFolderId, driveSlideDeckFolderId, driveBaseFolderId, receiptSheetId, onFocusSet]); // eslint-disable-line react-hooks/exhaustive-deps

  const sendChat = useCallback(async () => {
    const text = chatInput.trim();
    if (!text || loading) return;
    setChatInput('');
    setMessages(prev => [...prev, { role: 'user', text }]);
    await callAI(text, coachMode, chatHistory, { emailContext: emailContextRef.current });
  }, [chatInput, loading, coachMode, chatHistory, callAI, setChatInput, setMessages]);

  // Quick-reply variant: sends a fixed string without touching chatInput state.
  // Used by CoachPanel's OK button to confirm Step 3a interpretations.
  const sendChatWithText = useCallback(async (text) => {
    if (!text || loading) return;
    setMessages(prev => [...prev, { role: 'user', text }]);
    await callAI(text, coachMode, chatHistory, { emailContext: emailContextRef.current });
  }, [loading, coachMode, chatHistory, callAI, setMessages]);

  return { callAI, sendChat, sendChatWithText, fetchModels, lastInputLog, setEmailContext };
}

export { useCallAI }