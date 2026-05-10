import { useCallback, useEffect, useState } from 'react';
import { SYSTEM_PROMPTS, OPENWEBUI_URL } from '../../constants.jsx';
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
import { buildCalibrationContext, extractAction, extractUpdateAction, extractAddAction,
  extractCreateAction, extractCalendarCreateAction, extractCalendarUpdateAction,
  extractCalendarDeleteAction } from '../tasks/taskUtils.jsx';
import { supabase, queueEntryToRow } from '../../api/supabase.js';

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

// Buckets to include in the task context for each coach mode.
// Modes not listed here receive all buckets (null = no filter).
const MODE_CONTEXT_BUCKETS = {
  process:         ['inbox', 'project'],
  projectReview:   ['project'],
  projectMetadata: ['project'],
  calendarEvent:   ['next', 'project'],
};

/**
 * Owns the AI fetch loop, all tool-dispatch branches, action-line parsing,
 * the Ollama model list fetcher, and the sendChat convenience wrapper.
 *
 * @param {{
 *   tasks: Array, efforts: Array, calibrationOverrides: object,
 *   provider: string, localModel: string,
 *   googleToken: string|null, googleScope: string|null, calendarEnabled: boolean,
 *   authUser: object|null,
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
  coachMode, chatInput, chatHistory, loading,
  getTaskContext, recordUsage,
  setTasks, setCalendarEvents, setGmailQueue,
  setMessages, setChatHistory, setChatInput,
  setLoading, setAvailableModels, setPendingAction,
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

  const callAI = useCallback(async (userMsg, mode, history) => {
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
          return `\n\n[Task Overview — ${counts}]\nCall get_task_context to retrieve full task details when needed.`;
        })()
      : `\n\n[Current Task List]\n${getTaskContext(MODE_CONTEXT_BUCKETS[mode] ?? null)}`;
    const systemPrompt = SYSTEM_PROMPTS[mode] + calibCtx + taskContextPart;
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
              if (googleScope === 'send')
                availableTools.push(GMAIL_SEND_TOOL);
            }
            if (availableTools.length > 0) reqBody.tools = availableTools;
          }
          if (loopCount > 1) {
            setMessages(prev => [...prev, { role: 'assistant', text: `⏳ Thinking... (step ${loopCount})`, isSearchChip: true }]);
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
                setMessages(prev => [...prev, { role: 'assistant', text: `📤 Sending email...`, isSearchChip: true }]);
                try {
                  const result = await doGmailSend(
                    toolUse.input.to, toolUse.input.subject, toolUse.input.body,
                    toolUse.input.thread_id, googleToken
                  );
                  toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: JSON.stringify(result) });
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

      // Apply →ACTION lines when in chat mode — supports multiple actions per response
      let updateChip = null;
      let actionError = null;
      if (mode === 'chat') {
        const taskActionLines = reply.split('\n')
          .map(l => l.trim())
          .filter(l => /^→ACTION:(update|add|create)\|/.test(l));

        if (taskActionLines.length > 0) {
          // Process all actions against a local working copy so parent lookups
          // work across the batch (e.g. create parent then add children in same response)
          let workingTasks = [...tasks];
          const chips = [];
          const actionErrors = [];

          for (const line of taskActionLines) {
            const upd = extractUpdateAction(line);
            if (upd) {
              const target = workingTasks.find(t => t.id === upd.taskId);
              if (target) {
                workingTasks = workingTasks.map(t =>
                  t.id === upd.taskId ? { ...t, ...upd.changes } : t
                );
                const fieldLabels = Object.keys(upd.changes).map(k => ({
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
              const { title, parentId: parentRef, bucket = 'next', dueDate = null,
                      deferUntil = null, effort = null, location = [], recurrence = null } = add;
              // ID lookup first; fall back to exact title match (supports newly-created parents)
              const parent = workingTasks.find(t => t.id === parentRef)
                          || workingTasks.find(t => t.text.toLowerCase() === parentRef.toLowerCase());
              if (parent) {
                const newId = genId();
                const newTask = {
                  id: newId, text: title, bucket, done: false, created: Date.now(),
                  parentId: parent.id, priority: [], location, dueDate, effort,
                  actualEffort: null, deferUntil, notes: null, recurrence,
                  category: parent.category ?? null,
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
              const { title, bucket, dueDate = null, dueTime = null, deferUntil = null,
                      effort = null, location = [], recurrence = null } = create;
              const newId = genId();
              const newTask = {
                id: newId, text: title, bucket, done: false, created: Date.now(),
                priority: [], location, dueDate, dueTime, effort, actualEffort: null,
                deferUntil, notes: null, recurrence,
              };
              workingTasks = [newTask, ...workingTasks];
              chips.push({ taskName: title, fields: ['created in ' + bucket] });
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
            });
            setCalendarEvents(prev => [...prev, ev]);
            if (calCreate.taskId) {
              setTasks(prev => prev.map(t => t.id === calCreate.taskId ? { ...t, calendarEventId: ev.id } : t));
            } else {
              const newId = genId();
              setTasks(prev => [{
                id: newId, text: calCreate.title, bucket: 'inbox', done: false, created: Date.now(),
                priority: [], location: [], dueDate: calCreate.date, effort: null, actualEffort: null,
                deferUntil: null, notes: calCreate.description || null, recurrence: null,
                calendarEventId: ev.id,
              }, ...prev]);
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
              setTasks(prev => prev.map(t => t.id === calUpdate.taskId ? { ...t, dueDate: calUpdate.date } : t));
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
              setTasks(prev => prev.map(t =>
                (t.calendarEventId === calDelete.eventId || t.calendarEventId === masterEventId)
                  ? { ...t, calendarEventId: null } : t
              ));
            } else {
              setCalendarEvents(prev => prev.filter(e => e.id !== calDelete.eventId));
              setTasks(prev => prev.map(t => t.calendarEventId === calDelete.eventId ? { ...t, calendarEventId: null } : t));
            }
            updateChip = { taskName: 'Calendar event', fields: ['deleted from Google Calendar'] };
          } catch (e) { actionError = `⚠ Calendar action failed: ${e.message}`; }
        }
      }

      if (actionError) {
        setMessages(prev => [...prev,
          { role: 'assistant', text: reply, updateChip },
          { role: 'assistant', text: actionError },
        ]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', text: reply, updateChip }]);
      }

      const action = extractAction(reply);
      if (action) setPendingAction(action);

      return reply;
    } catch (e) {
      console.error('[callAI error]', e);
      const err = `Error: ${e.message}`;
      setMessages(prev => [...prev, { role: 'assistant', text: err }]);
    } finally {
      setLoading(false);
    }
  }, [getTaskContext, tasks, efforts, calibrationOverrides, provider, localModel,
      googleToken, googleScope, calendarEnabled, setCalendarEvents,
      recordUsage, setLastInputLog, setTasks, setGmailQueue, setMessages, setChatHistory,
      setLoading, setPendingAction, authUser]); // eslint-disable-line react-hooks/exhaustive-deps

  const sendChat = useCallback(async () => {
    const text = chatInput.trim();
    if (!text || loading) return;
    setChatInput('');
    setMessages(prev => [...prev, { role: 'user', text }]);
    await callAI(text, coachMode, chatHistory);
  }, [chatInput, loading, coachMode, chatHistory, callAI, setChatInput, setMessages]);

  return { callAI, sendChat, fetchModels, lastInputLog };
}

export { useCallAI }