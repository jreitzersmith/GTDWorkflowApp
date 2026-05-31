// Gmail tool definitions and API helpers.
// Pure async functions — no React dependencies.
import { parseApiResponse } from "../calendar/calendarApi.js";

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Wraps fetch with automatic retry on 429 / 500 / 503.
// Respects the Retry-After header Gmail sends on 429; falls back to
// exponential backoff (1 s → 2 s → 4 s) when the header is absent.
async function fetchWithBackoff(url, options = {}, maxRetries = 3) {
  let attempt = 0;
  while (true) {
    const res = await fetch(url, options);
    if (res.ok) return res;
    const retryable = res.status === 429 || res.status === 500 || res.status === 503;
    if (!retryable || attempt >= maxRetries) return res; // caller handles non-OK
    const retryAfter = res.headers.get('Retry-After');
    const waitMs = retryAfter ? parseFloat(retryAfter) * 1000 : (2 ** attempt) * 1000;
    await sleep(waitMs);
    attempt++;
  }
}

// Like Promise.all but processes items in chunks to avoid Gmail rate limits.
// Fires at most batchSize requests concurrently, then waits delayMs before
// the next chunk. Results are returned in the original order.
async function batchedAll(items, asyncFn, batchSize = 10, delayMs = 150) {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const chunk = items.slice(i, i + batchSize);
    const chunkResults = await Promise.all(chunk.map(asyncFn));
    results.push(...chunkResults);
    if (i + batchSize < items.length) await sleep(delayMs);
  }
  return results;
}

// ── Gmail tool (Anthropic tool use) ──────────────────────────────────────────
const GMAIL_SEARCH_TOOL = {
  name: "gmail_search",
  description: "Search the user's Gmail for emails. Use this when the user asks about emails, correspondence, commitments made via email, or wants to find messages from a specific sender or about a specific topic. Supports Gmail search operators: from:, to:, subject:, has:attachment, after:2024/01/01, before:, is:unread, in:inbox, in:sent, label:. Always use 'in:inbox' (not bare 'inbox') when filtering to the inbox. Results include a 'Gmail-ID' field — use that exact value when calling gmail_label.",
  input_schema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Gmail search query (supports operators: from:, to:, subject:, is:unread, has:attachment, after:2024/01/01, etc.)" },
      max_results: { type: "integer", description: "Number of emails to return (1-50, default 10). Use a higher value when the user wants to bulk-label or process many messages." },
    },
    required: ["query"],
  },
};

// PKCE helpers for Google OAuth2
function generateCodeVerifier() {
  const array = new Uint8Array(64);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
async function generateCodeChallenge(verifier) {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function doGmailSearch(query, token, maxResults = 10) {
  const limit = Math.min(Math.max(1, maxResults), 50);
  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${limit}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const listData = await parseApiResponse(listRes, 'Gmail API');
  const messages = listData.messages || [];
  if (!messages.length) return "No emails found matching that query.";
  const details = (await batchedAll(
    messages,
    async ({ id }) => {
      try {
        const msgRes = await fetchWithBackoff(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata`
          + `&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!msgRes.ok) return null; // message moved/deleted between list and get
        const msg = await msgRes.json();
        const hdrs = msg.payload?.headers || [];
        const get = (name) => hdrs.find(h => h.name === name)?.value || '';
        return `Gmail-ID: ${id}\nFrom: ${get('From')}\nDate: ${get('Date')}\nSubject: ${get('Subject')}\nSnippet: ${msg.snippet || ''}`;
      } catch { return null; }
    }
  )).filter(Boolean);
  if (!details.length) return "No emails found matching that query.";
  return `Found ${messages.length} email(s). Top ${details.length} result(s):\n\n${details.join('\n\n---\n\n')}`;
}

const GMAIL_LIST_LABELS_TOOL = {
  name: "gmail_list_labels",
  description: "List all Gmail labels with their IDs and display names. ALWAYS call this immediately before any gmail_label call that uses a custom label — never reuse a label ID from a previous turn, as labels can be created or deleted between calls. System labels (STARRED, UNREAD, IMPORTANT, INBOX) are always valid without calling this.",
  input_schema: { type: "object", properties: {}, required: [] },
};

const GMAIL_LABEL_TOOL = {
  name: "gmail_label",
  description: "Apply or remove labels on a Gmail message — e.g. add STARRED, apply a custom label, or mark as read (remove UNREAD). The message_id must be the 'Gmail-ID' value from gmail_search results (a hex string like '18f1a2b3c4d5'). Always call gmail_list_labels first to resolve a label name to its ID before calling this tool. Requires Organize access or higher.",
  input_schema: {
    type: "object",
    properties: {
      message_id:      { type: "string", description: "Gmail message ID" },
      add_label_ids:   { type: "array", items: { type: "string" }, description: "Label IDs to add (system: STARRED, IMPORTANT, UNREAD; or custom label IDs)" },
      remove_label_ids:{ type: "array", items: { type: "string" }, description: "Label IDs to remove (e.g. UNREAD to mark as read, INBOX to archive)" },
    },
    required: ["message_id"],
  },
};

const GMAIL_BATCH_LABEL_TOOL = {
  name: "gmail_batch_label",
  description: "Apply or remove labels on multiple Gmail messages in a single call. Use this instead of calling gmail_label in a loop whenever you need to label, archive, or modify more than one message. Always call gmail_list_labels first to resolve custom label names to IDs. INBOX in remove_label_ids archives the messages.",
  input_schema: {
    type: "object",
    properties: {
      message_ids:     { type: "array", items: { type: "string" }, description: "Array of Gmail-ID values from gmail_search results" },
      add_label_ids:   { type: "array", items: { type: "string" }, description: "Label IDs to add to every message (system: STARRED, IMPORTANT, UNREAD; or custom IDs)" },
      remove_label_ids:{ type: "array", items: { type: "string" }, description: "Label IDs to remove from every message (e.g. INBOX to archive, UNREAD to mark read)" },
    },
    required: ["message_ids"],
  },
};

const GMAIL_COMPOSE_TOOL = {
  name: "gmail_compose",
  description: "Create a draft email or reply in Gmail. The draft is saved but NOT sent — the user reviews it first. Requires Compose access or higher.",
  input_schema: {
    type: "object",
    properties: {
      to:        { type: "string", description: "Recipient email address(es), comma-separated" },
      subject:   { type: "string", description: "Email subject" },
      body:      { type: "string", description: "Email body in plain text" },
      thread_id: { type: "string", description: "Thread ID to reply to — omit for a new email" },
    },
    required: ["to", "subject", "body"],
  },
};

const GMAIL_SEND_TOOL = {
  name: "gmail_send",
  description: "Send an email from the user's Gmail account. Only use when the user explicitly asks to send — not just draft — an email. Requires Send access.",
  input_schema: {
    type: "object",
    properties: {
      to:        { type: "string", description: "Recipient email address(es), comma-separated" },
      subject:   { type: "string", description: "Email subject" },
      body:      { type: "string", description: "Email body in plain text" },
      thread_id: { type: "string", description: "Thread ID to reply to — omit for a new email" },
    },
    required: ["to", "subject", "body"],
  },
};

const GMAIL_CREATE_LABEL_TOOL = {
  name: "gmail_create_label",
  description: "Create a new Gmail label. IMPORTANT: Only call this tool after explicitly telling the user the label name and receiving confirmation. If the user asked to label a message and no matching label exists, say something like 'There\'s no [name] label yet — shall I create one?' and wait for a yes before proceeding.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Display name for the new label" },
    },
    required: ["name"],
  },
};

const GMAIL_LIST_FILTERS_TOOL = {
  name: "gmail_list_filters",
  description: "List all existing Gmail filters with their criteria and actions. Call this before creating or deleting a filter to show the user what rules are already in place.",
  input_schema: { type: "object", properties: {}, required: [] },
};

const GMAIL_CREATE_FILTER_TOOL = {
  name: "gmail_create_filter",
  description: "Create a Gmail filter that automatically processes all future matching incoming emails. IMPORTANT: Gmail allows at most ONE custom (user-created) label per filter — do not pass multiple custom label IDs in action_add_label_ids. System label IDs (INBOX, STARRED, UNREAD, IMPORTANT) do not count toward this limit. Before calling, present the full filter rule in plain English and wait for explicit user confirmation.",
  input_schema: {
    type: "object",
    properties: {
      criteria_from:    { type: "string", description: "Match emails from this sender (email address or domain)" },
      criteria_to:      { type: "string", description: "Match emails sent to this address" },
      criteria_subject: { type: "string", description: "Match emails with this subject text" },
      criteria_query:   { type: "string", description: "Match emails using a Gmail search query string" },
      action_add_label_ids:    { type: "array", items: { type: "string" }, description: "Label IDs to apply to matching messages" },
      action_remove_label_ids: { type: "array", items: { type: "string" }, description: "Label IDs to remove (e.g. INBOX to skip inbox / archive automatically)" },
    },
    required: [],
  },
};

const GMAIL_DELETE_FILTER_TOOL = {
  name: "gmail_delete_filter",
  description: "Delete an existing Gmail filter. IMPORTANT: Tell the user exactly which filter you are about to delete (criteria + action) and get explicit confirmation before calling this tool.",
  input_schema: {
    type: "object",
    properties: {
      filter_id: { type: "string", description: "Filter ID from gmail_list_filters" },
    },
    required: ["filter_id"],
  },
};

const GMAIL_BULK_ACTION_TOOL = {
  name: "gmail_bulk_action",
  description: `Apply labels or archive ALL Gmail messages matching a search query — no per-batch limit. Use this for bulk inbox cleanup (e.g. label + archive every promotional email from a sender).

BEFORE calling this tool you MUST:
1. Sample the sender using gmail_search to identify distinguishing patterns.
2. Build the most restrictive query possible:
   - Prefer the specific sending address or subdomain over a bare domain (e.g. 'from:store-news@amazon.com' not 'from:amazon.com').
   - Add the keyword 'unsubscribe' (plain word, not an operator) when the sample emails contain an unsubscribe footer — this excludes transactional mail (order receipts, shipping alerts, password resets) which never contain that word.
   - Add subject-keyword filters (e.g. 'subject:(deal OR offer OR sale OR promo)') only when they help narrow scope without over-filtering.
   - Combine operators to exclude known non-promotional addresses from the same domain.
3. Show the user the exact query and a plain-English explanation of what it will match AND what it intentionally excludes (e.g. 'will NOT match order confirmations from auto-confirm@amazon.com').
4. Wait for explicit user confirmation before calling.`,
  input_schema: {
    type: "object",
    properties: {
      query:             { type: "string",  description: "Gmail search query — must be as restrictive as possible (see tool description)" },
      add_label_ids:     { type: "array",   items: { type: "string" }, description: "Label IDs to add to every matching message" },
      remove_label_ids:  { type: "array",   items: { type: "string" }, description: "Label IDs to remove (use INBOX to archive)" },
    },
    required: ["query"],
  },
};

const GMAIL_QUEUE_ADD_TOOL = {
  name: "gmail_queue_add",
  description: "Save a confirmed newsletter/promotional cleanup entry to the user's bulk action queue. Only call this AFTER the user has explicitly confirmed the search query and label. The queue persists across sessions so the user can run bulk actions later.",
  input_schema: {
    type: "object",
    properties: {
      label_name:    { type: "string",  description: "Human-readable label name (e.g. 'Newsletters/Morning Brew')" },
      label_id:      { type: "string",  description: "Gmail label ID if already created; omit if the label doesn't exist yet" },
      query:         { type: "string",  description: "The confirmed, most-restrictive Gmail search query" },
      description:   { type: "string",  description: "Plain-English explanation of what the query matches and what it intentionally excludes" },
      archive:       { type: "boolean", description: "Whether to remove from INBOX (default true)" },
      create_filter: { type: "boolean", description: "Whether to create a Gmail filter after running (default true)" },
    },
    required: ["label_name", "query", "description"],
  },
};

// Display metadata for Gmail scope levels — used in Settings UI
const GMAIL_SCOPE_OPTS = [
  { key: 'readonly', label: 'Read only', desc: 'Search and read emails' },
  { key: 'modify',   label: 'Organize',  desc: '+ label, archive, mark read/unread, filters' },
  { key: 'compose',  label: 'Compose',   desc: '+ create drafts and replies' },
  { key: 'send',     label: 'Send',      desc: '+ send emails directly' },
];
const GMAIL_SCOPE_DISPLAY = { readonly: 'read only', modify: 'organize', compose: 'compose', send: 'send' };

// Fetch all label names + IDs (requires gmail.modify scope or higher)
// Returns a formatted string for AI tool use.
async function doGmailListLabels(token) {
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseApiResponse(res, 'Gmail API');
  const labels = (data.labels || [])
    .map(l => `${l.name} (ID: ${l.id})`)
    .join('\n');
  return labels || 'No labels found.';
}

// Fetch all labels as raw objects — for UI use (Rules tab, queue runner).
async function doGmailFetchLabelsRaw(token) {
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseApiResponse(res, 'Gmail API');
  return data.labels || [];
}

// Modify message labels (requires gmail.modify scope)
async function doGmailLabel(messageId, addLabelIds, removeLabelIds, token) {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ addLabelIds: addLabelIds || [], removeLabelIds: removeLabelIds || [] }),
    }
  );
  await parseApiResponse(res, 'Gmail API');
  return { success: true, message_id: messageId };
}

// Modify labels on multiple messages in parallel (requires gmail.modify scope)
async function doGmailBatchLabel(messageIds, addLabelIds, removeLabelIds, token) {
  const body = { addLabelIds: addLabelIds || [], removeLabelIds: removeLabelIds || [] };
  const results = await Promise.allSettled(
    messageIds.map(id =>
      fetchWithBackoff(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}/modify`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(async r => {
        if (!r.ok) { const d = await r.json(); throw new Error(d.error?.message || `Gmail API ${r.status}`); }
        return id;
      })
    )
  );
  const succeeded = results.filter(r => r.status === 'fulfilled').map(r => r.value);
  const failed    = results.filter(r => r.status === 'rejected').map((r, i) => ({ id: messageIds[i], error: r.reason?.message }));
  return {
    success_count: succeeded.length,
    failed_count: failed.length,
    failed,
    status: failed.length === 0 ? `All ${succeeded.length} messages updated successfully` : `${succeeded.length} succeeded, ${failed.length} failed`,
  };
}

// Build a base64url-encoded RFC 2822 message for the Gmail API
function buildRawMessage(to, subject, body) {
  const lines = [`To: ${to}`, `Subject: ${subject}`, 'Content-Type: text/plain; charset=utf-8', '', body];
  return btoa(unescape(encodeURIComponent(lines.join('\r\n'))))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// Create a draft email (requires gmail.compose scope)
async function doGmailCompose(to, subject, body, threadId, token) {
  const raw = buildRawMessage(to, subject, body);
  const payload = { message: { raw } };
  if (threadId) payload.message.threadId = threadId;
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await parseApiResponse(res, 'Gmail API');
  return { draft_id: data.id, status: 'Draft created \u2014 not yet sent' };
}

// Send an email (requires gmail.send scope)
async function doGmailSend(to, subject, body, threadId, token) {
  const raw = buildRawMessage(to, subject, body);
  const payload = { raw };
  if (threadId) payload.threadId = threadId;
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await parseApiResponse(res, 'Gmail API');
  return { message_id: data.id, status: 'Email sent successfully' };
}

// Create a Gmail label (requires gmail.settings.basic scope)
async function doGmailCreateLabel(name, token) {
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, labelListVisibility: 'labelShow', messageListVisibility: 'show' }),
  });
  const data = await parseApiResponse(res, 'Gmail API');
  return { label_id: data.id, name: data.name, status: 'Label created successfully' };
}

// List all filters (requires gmail.settings.basic scope)
async function doGmailListFilters(token) {
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/settings/filters', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseApiResponse(res, 'Gmail API');
  const filters = data.filter || [];
  if (!filters.length) return 'No filters found.';
  return filters.map(f => {
    const c = f.criteria || {};
    const a = f.action || {};
    const criteria = [c.from && `from:${c.from}`, c.to && `to:${c.to}`,
      c.subject && `subject:${c.subject}`, c.query && `query:${c.query}`]
      .filter(Boolean).join(', ') || '(any)';
    const action = [a.addLabelIds?.length && `add: ${a.addLabelIds.join(', ')}`,
      a.removeLabelIds?.length && `remove: ${a.removeLabelIds.join(', ')}`]
      .filter(Boolean).join('; ') || '(no action)';
    return `Filter ID: ${f.id}\nCriteria: ${criteria}\nAction: ${action}`;
  }).join('\n\n---\n\n');
}

// Create a filter (requires gmail.settings.basic scope)
async function doGmailCreateFilter(criteriaFrom, criteriaTo, criteriaSubject, criteriaQuery, actionAddLabelIds, actionRemoveLabelIds, token) {
  const body = { criteria: {}, action: {} };
  if (criteriaFrom)              body.criteria.from    = criteriaFrom;
  if (criteriaTo)                body.criteria.to      = criteriaTo;
  if (criteriaSubject)           body.criteria.subject = criteriaSubject;
  if (criteriaQuery)             body.criteria.query   = criteriaQuery;
  if (actionAddLabelIds?.length) body.action.addLabelIds    = actionAddLabelIds;
  if (actionRemoveLabelIds?.length) body.action.removeLabelIds = actionRemoveLabelIds;
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/settings/filters', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await parseApiResponse(res, 'Gmail API');
  return { filter_id: data.id, status: 'Filter created successfully' };
}

// Delete a filter (requires gmail.settings.basic scope)
async function doGmailDeleteFilter(filterId, token) {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/settings/filters/${filterId}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
  );
  if (res.status === 204 || res.ok) return { status: 'Filter deleted successfully', filter_id: filterId };
  const d = await res.json();
  throw new Error(d.error?.message || `Gmail API ${res.status}`);
}

// Label/archive ALL messages matching a query — pages through every result, no per-batch limit
async function doGmailBulkAction(query, addLabelIds, removeLabelIds, token) {
  // Collect all matching message IDs via paginated messages.list
  const allIds = [];
  let pageToken = undefined;
  do {
    const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
    url.searchParams.set('q', query);
    url.searchParams.set('maxResults', '500');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) { const d = await res.json(); throw new Error(d.error?.message || `Gmail API ${res.status}`); }
    const data = await res.json();
    (data.messages || []).forEach(m => allIds.push(m.id));
    pageToken = data.nextPageToken;
    if (pageToken) await sleep(250); // avoid rate-limit between pages
  } while (pageToken);

  if (!allIds.length) return { matched: 0, status: 'No messages found matching that query — nothing was changed.' };

  // Apply changes via batchModify in chunks of 1,000
  const body = { addLabelIds: addLabelIds || [], removeLabelIds: removeLabelIds || [] };
  const chunkSize = 1000;
  let totalSucceeded = 0;
  const errors = [];
  for (let i = 0; i < allIds.length; i += chunkSize) {
    const chunk = allIds.slice(i, i + chunkSize);
    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/batchModify', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: chunk, ...body }),
    });
    if (res.ok || res.status === 204) {
      totalSucceeded += chunk.length;
    } else {
      const d = await res.json().catch(() => ({}));
      errors.push(d.error?.message || `Gmail API ${res.status} on chunk starting at index ${i}`);
    }
    if (i + chunkSize < allIds.length) await sleep(200); // avoid rate-limit between chunks
  }
  if (errors.length) {
    return { matched: allIds.length, succeeded: totalSucceeded, errors, status: `Partial success: ${totalSucceeded}/${allIds.length} messages updated. Errors: ${errors.join('; ')}` };
  }
  return { matched: allIds.length, succeeded: totalSucceeded, status: `All ${totalSucceeded} matching messages updated successfully.` };
}

// ── Email Management helper functions ────────────────────────────────────────

// Recursively extract all plain-text parts from a Gmail message payload.
// Concatenates across parts so split/chunked bodies are fully captured.
// For multipart/alternative the html part returns '' (mimeType check fails),
// so concatenation is safe — no duplicate content.
function extractGmailPlainText(payload) {
  if (!payload) return '';
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    try {
      return decodeURIComponent(escape(atob(payload.body.data.replace(/-/g, '+').replace(/_/g, '/'))));
    } catch { return ''; }
  }
  if (payload.parts) {
    return payload.parts.map(p => extractGmailPlainText(p)).join('');
  }
  return '';
}

// Fetch inbox messages as structured objects (for the Email Management inbox tab)
// Returns { emails, nextPageToken } — pass pageToken to load the next page
async function doGmailFetchInbox(token, pageToken = null, searchQuery = '') {
  const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
  url.searchParams.set('q', searchQuery.trim() ? `in:inbox ${searchQuery.trim()}` : 'in:inbox');
  url.searchParams.set('maxResults', '50');
  if (pageToken) url.searchParams.set('pageToken', pageToken);
  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
  const data = await parseApiResponse(res, 'Gmail API');
  const messages = data.messages || [];
  if (!messages.length) return { emails: [], nextPageToken: null };
  const details = await batchedAll(
    messages,
    async ({ id }) => {
      try {
        const msgRes = await fetchWithBackoff(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata` +
          `&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!msgRes.ok) return null;
        const msg = await msgRes.json();
        const hdrs = msg.payload?.headers || [];
        const get = name => hdrs.find(h => h.name === name)?.value || '';
        const fromRaw = get('From');
        const nameMatch = fromRaw.match(/^"?(.+?)"?\s*<.+>$/);
        const fromName = nameMatch ? nameMatch[1] : fromRaw.replace(/<.*>/, '').trim() || fromRaw;
        const fromEmail = (fromRaw.match(/<(.+?)>/) || [])[1] || fromRaw;
        const isUnread = (msg.labelIds || []).includes('UNREAD');
        return { id, from: fromRaw, fromName, fromEmail, date: get('Date'), subject: get('Subject'), snippet: msg.snippet || '', isUnread, labelIds: msg.labelIds || [] };
      } catch { return null; }
    }
  );
  return { emails: details.filter(Boolean), nextPageToken: data.nextPageToken || null };
}

// Fetch full message body for the detail panel
async function doGmailGetMessageBody(id, token) {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const msg = await parseApiResponse(res, 'Gmail API');
  const hdrs = msg.payload?.headers || [];
  const get = name => hdrs.find(h => h.name === name)?.value || '';
  return {
    id,
    from: get('From'), to: get('To'), subject: get('Subject'), date: get('Date'),
    body: extractGmailPlainText(msg.payload).trim(),
    snippet: msg.snippet || '',
    labelIds: msg.labelIds || [],
  };
}

// Fetch all filters as structured objects (for the Rules tab)
async function doGmailFetchFilters(token) {
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/settings/filters', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseApiResponse(res, 'Gmail API');
  return data.filter || [];
}


export { GMAIL_SEARCH_TOOL, generateCodeVerifier, generateCodeChallenge, fetchWithBackoff, batchedAll, doGmailSearch, GMAIL_LIST_LABELS_TOOL, GMAIL_LABEL_TOOL, GMAIL_BATCH_LABEL_TOOL, GMAIL_COMPOSE_TOOL, GMAIL_SEND_TOOL, GMAIL_CREATE_LABEL_TOOL, GMAIL_LIST_FILTERS_TOOL, GMAIL_CREATE_FILTER_TOOL, GMAIL_DELETE_FILTER_TOOL, GMAIL_BULK_ACTION_TOOL, GMAIL_QUEUE_ADD_TOOL, GMAIL_SCOPE_OPTS, GMAIL_SCOPE_DISPLAY, doGmailListLabels, doGmailFetchLabelsRaw, doGmailLabel, doGmailBatchLabel, buildRawMessage, doGmailCompose, doGmailSend, doGmailCreateLabel, doGmailListFilters, doGmailCreateFilter, doGmailDeleteFilter, doGmailBulkAction, extractGmailPlainText, doGmailFetchInbox, doGmailGetMessageBody, doGmailFetchFilters };
