import { useState, useEffect, useRef, useCallback } from "react";

const COLORS = {
  bg: "#111210", surface: "#1a1c18", surface2: "#222420", surface3: "#2a2c28",
  border: "#333530", border2: "#404240",
  text: "#e8e4dc", text2: "#a8a49c", muted: "#5a5c58",
  inbox: "#e8c84a", inboxBg: "#2a2618",
  next: "#5ab878", nextBg: "#182418",
  project: "#5a8fd4", projectBg: "#181e2a",
  waiting: "#d4845a", waitingBg: "#2a1e14",
  someday: "#9a8ad4", somedayBg: "#1e1a2a",
  done: "#5a5c58",
};

const BUCKETS = {
  inbox:        { label: "📥 Inbox",           desc: "Unprocessed — capture everything here first", color: COLORS.inbox },
  next:         { label: "⚡ Next Actions",     desc: "Concrete physical actions to do this week",   color: COLORS.next },
  project:      { label: "📁 Projects",        desc: "Anything requiring more than one step",        color: COLORS.project },
  waiting:      { label: "⏳ Waiting For",     desc: "Delegated — ball in someone else's court",     color: COLORS.waiting },
  someday:      { label: "💭 Someday / Maybe", desc: "Ideas and aspirations, not commitments",       color: COLORS.someday },
  done:         { label: "✅ Completed",        desc: "Finished tasks",                              color: COLORS.done },
  inboxHistory: { label: "📋 Inbox History",   desc: "Processed inbox items — archived for reference", color: COLORS.muted },
};

const COACH_MODES = {
  chat:    { label: "Chat",        icon: "💬" },
  process: { label: "Process",     icon: "📥" },
  review:  { label: "Review",      icon: "📋" },
  dump:    { label: "Brain Dump",  icon: "🧠" },
};

const SYSTEM_PROMPTS = {
  chat: `You are a GTD (Getting Things Done) coach for a knowledge worker. You have access to their full task list (provided in each message). Help them stay organized, clarify tasks, define next actions, and maintain their GTD system. Be concise — under 100 words per response. When recommending a bucket move, be explicit: say "→ Move to Next Actions" or similar.`,
  process: `You are a GTD inbox processor. For each inbox item given to you:

1. Determine if it's actionable. If not actionable, end with: →ACTION:delete
2. If actionable, decide: is this a SINGLE next action, or a multi-step PROJECT?
   - If you need clarification to decide, ask ONE specific question. Do NOT include an →ACTION tag until clarified.
3. Reword the action as a concrete physical action starting with a strong verb (e.g. "Call", "Draft", "Research", "Buy").
4. End your response with EXACTLY one of these tags on its own line:

Single next action:
→ACTION:next|<Reworded action title>

Multi-step project (requires planning or multiple steps):
→ACTION:project|<Project name>|<First next action title>

Someday / not urgent:
→ACTION:someday|<Reworded title>

Waiting on someone:
→ACTION:waiting|<What you are waiting for>

Not actionable / delete:
→ACTION:delete

Be concise — under 80 words before the tag. Never include the →ACTION tag mid-response.`,
  review: `You are running a GTD Weekly Review. Guide the user through 7 steps one at a time:
1. Capture loose ends (anything physical not captured)
2. Process inbox to zero
3. Review Next Actions — anything to complete or remove?
4. Review Projects — does each have a next action?
5. Review Waiting For — any follow-ups needed?
6. Review Someday/Maybe — anything ready to activate?
7. New ideas or goals to add?
Ask one step at a time. Acknowledge their answer, then move on. Under 90 words each.`,
  dump: `You are a GTD brain dump coach. Surface open loops by asking about one life area at a time:
Work tasks → Emails to send → People to follow up with → Projects falling behind → Personal errands → Home tasks → Health commitments → Finances → Learning goals → Anything nagging you
For each response say "Got it — add that to your inbox." then immediately ask about the next area. Under 50 words each. After all areas, give a summary and encourage them to process their inbox.`,
};

const OPENWEBUI_URL = (import.meta.env.VITE_OPENWEBUI_URL || "http://192.168.0.102:3000").replace(/\/$/, "");

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

function formatBubble(text) {
  const parts = text.split(/(→ACTION:[^\n]+)/g);
  return parts.map((part, i) => {
    if (part.match(/→ACTION:/)) return null;
    return <span key={i} dangerouslySetInnerHTML={{ __html: part.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>') }} />;
  });
}

function extractAction(text) {
  const m = text.match(/→ACTION:(next|project|someday|waiting|delete)\|?([^|\n]*)?\|?([^\n]*)?/);
  if (!m) return null;
  return {
    type: m[1],
    title: (m[2] || "").trim(),
    nextAction: (m[3] || "").trim(),
  };
}

export default function GTDManager() {
  const [tasks, setTasks] = useState(() => {
    try { return JSON.parse(localStorage.getItem("gtd_tasks") || "[]"); } catch { return []; }
  });
  const [currentBucket, setCurrentBucket] = useState("inbox");
  const [addText, setAddText] = useState("");
  const [messages, setMessages] = useState([{ role: "assistant", text: "Hi! I'm your GTD Coach. I can see your task list and help you stay organized.\n\nAdd tasks to your **Inbox**, then hit **Process Inbox with AI** to sort them — or just ask me anything." }]);
  const [chatHistory, setChatHistory] = useState([]);
  const [coachMode, setCoachMode] = useState("chat");
  const [chatInput, setChatInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [moveMenu, setMoveMenu] = useState(null);
  const [pendingAction, setPendingAction] = useState(null); // { type, title, nextAction }
  const chatEndRef = useRef(null);
  const chatInputRef = useRef(null);
  const [provider, setProvider] = useState(() => localStorage.getItem("gtd_provider") || "claude");
  const [localModel, setLocalModel] = useState(() => localStorage.getItem("gtd_local_model") || "llama3.3:70b");
  const [availableModels, setAvailableModels] = useState([]);
  const [locations, setLocations] = useState(() => {
    try { return JSON.parse(localStorage.getItem("gtd_locations") || "null") || ["Home", "Work", "Phone", "Computer"]; } catch { return ["Home", "Work", "Phone", "Computer"]; }
  });
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    localStorage.setItem("gtd_tasks", JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => { localStorage.setItem("gtd_provider", provider); }, [provider]);
  useEffect(() => { localStorage.setItem("gtd_local_model", localModel); }, [localModel]);
  useEffect(() => { localStorage.setItem("gtd_locations", JSON.stringify(locations)); }, [locations]);

  const getTaskContext = useCallback(() => {
    const bucketNames = { inbox: "Inbox", next: "Next Actions", project: "Projects", waiting: "Waiting For", someday: "Someday/Maybe" };
    return Object.entries(bucketNames).map(([k, label]) => {
      const items = tasks.filter(t => t.bucket === k).map(t => t.text);
      return `${label} (${items.length}): ${items.length ? items.join(" | ") : "empty"}`;
    }).join("\n");
  }, [tasks]);

  const fetchModels = useCallback(async () => {
    try {
      const res = await fetch(`${OPENWEBUI_URL}/api/models`, {
        headers: { "Authorization": `Bearer ${import.meta.env.VITE_OPENWEBUI_API_KEY}` },
      });
      const data = await res.json();
      const models = (data.data || []).map(m => m.id).filter(Boolean);
      if (models.length) setAvailableModels(models);
    } catch { /* Open WebUI not reachable — fail silently */ }
  }, []);

  useEffect(() => {
    if (provider === "local") fetchModels();
  }, [provider, fetchModels]);

  const callAI = useCallback(async (userMsg, mode, history) => {
    const systemPrompt = SYSTEM_PROMPTS[mode] + "\n\n[Current Task List]\n" + getTaskContext();
    const newHistory = [...history, { role: "user", content: userMsg }];

    setLoading(true);
    try {
      let reply;

      if (provider === "claude") {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-6",
            max_tokens: 1000,
            system: systemPrompt,
            messages: newHistory,
          }),
        });
        const data = await res.json();
        console.log("[Claude API response]", data);
        if (!res.ok || data.error) {
          throw new Error(`Anthropic error ${res.status}: ${data.error?.message || JSON.stringify(data)}`);
        }
        reply = data.content?.[0]?.text || "Sorry, something went wrong.";
      } else {
        const res = await fetch(`${OPENWEBUI_URL}/api/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${import.meta.env.VITE_OPENWEBUI_API_KEY}`,
          },
          body: JSON.stringify({
            model: localModel,
            messages: [
              { role: "system", content: systemPrompt },
              ...newHistory,
            ],
          }),
        });
        const data = await res.json();
        console.log("[Open WebUI response]", data);
        if (!res.ok || data.error) {
          throw new Error(`Open WebUI error ${res.status}: ${data.error?.message || JSON.stringify(data)}`);
        }
        reply = data.choices?.[0]?.message?.content || "Sorry, something went wrong.";
      }

      const updatedHistory = [...newHistory, { role: "assistant", content: reply }];
      setChatHistory(updatedHistory);
      setMessages(prev => [...prev, { role: "assistant", text: reply }]);

      const action = extractAction(reply);
      if (action) setPendingAction(action);

      return reply;
    } catch (e) {
      console.error("[callAI error]", e);
      const err = `Error: ${e.message}`;
      setMessages(prev => [...prev, { role: "assistant", text: err }]);
    } finally {
      setLoading(false);
    }
  }, [getTaskContext, provider, localModel]);

  const sendChat = useCallback(async () => {
    const text = chatInput.trim();
    if (!text || loading) return;
    setChatInput("");
    setMessages(prev => [...prev, { role: "user", text }]);
    await callAI(text, coachMode, chatHistory);
  }, [chatInput, loading, coachMode, chatHistory, callAI]);

  const switchCoachMode = useCallback((mode, introMsg) => {
    setCoachMode(mode);
    setChatHistory([]);
    setPendingAction(null);
    setMessages([{ role: "assistant", text: introMsg }]);
  }, []);

  const processNextInboxItem = useCallback(async (task) => {
    setPendingAction(null);
    setChatHistory([]);
    const prompt = `Process this GTD inbox item: "${task.text}"`;
    setMessages(prev => [...prev, { role: "user", text: `Processing: **"${task.text}"**` }]);
    await callAI(prompt, "process", []);
  }, [callAI]);

  const handleConfirmMove = useCallback(() => {
    if (!pendingAction) return;
    const { type, title, nextAction } = pendingAction;

    const inboxItems = tasks.filter(t => t.bucket === "inbox");
    const current = inboxItems[0];
    const nextItem = inboxItems[1];

    if (!current) return;

    // Archive the original inbox item
    setTasks(prev => prev.map(t =>
      t.id === current.id ? { ...t, bucket: "inboxHistory" } : t
    ));

    // Create new tasks based on action type
    if (type === "next") {
      setTasks(prev => [{ id: genId(), text: title || current.text, bucket: "next", done: false, created: Date.now(), priority: [], location: [], dueDate: null }, ...prev]);
    } else if (type === "project") {
      const projectId = genId();
      const actionId = genId();
      setTasks(prev => [
        { id: projectId, text: title || current.text, bucket: "project", done: false, created: Date.now(), childIds: [actionId], priority: [], location: [], dueDate: null },
        { id: actionId, text: nextAction || title, bucket: "next", done: false, created: Date.now(), parentId: projectId, priority: [], location: [], dueDate: null },
        ...prev,
      ]);
    } else if (type === "someday") {
      setTasks(prev => [{ id: genId(), text: title || current.text, bucket: "someday", done: false, created: Date.now(), priority: [], location: [], dueDate: null }, ...prev]);
    } else if (type === "waiting") {
      setTasks(prev => [{ id: genId(), text: title || current.text, bucket: "waiting", done: false, created: Date.now(), priority: [], location: [], dueDate: null }, ...prev]);
    }
    // type === "delete": just archive, no new task

    setPendingAction(null);

    // Auto-continue to next inbox item
    if (nextItem) {
      setTimeout(() => processNextInboxItem(nextItem), 300);
    } else {
      setMessages(prev => [...prev, { role: "assistant", text: "🎉 **Inbox is clear!** Every item has been processed. Well done." }]);
    }
  }, [pendingAction, tasks, processNextInboxItem]);

  const startProcessInbox = useCallback(async () => {
    setCurrentBucket("inbox");
    const inbox = tasks.filter(t => t.bucket === "inbox");
    if (inbox.length === 0) {
      switchCoachMode("process", "Your inbox is empty — nothing to process! Add some tasks first or do a Brain Dump.");
      return;
    }
    switchCoachMode("process", `You have **${inbox.length} item${inbox.length > 1 ? "s" : ""}** in your inbox. Processing them one by one…`);
    setTimeout(() => processNextInboxItem(inbox[0]), 100);
  }, [tasks, switchCoachMode, processNextInboxItem]);

  const startWeeklyReview = () => {
    const total = tasks.filter(t => t.bucket !== "done").length;
    switchCoachMode("review", `Let's do your Weekly Review. You have **${total} active tasks** across your lists.\n\n**Step 1: Capture loose ends.**\nLook around — any sticky notes, papers, or things not yet in your system?`);
  };

  const startBrainDump = () => {
    switchCoachMode("dump", "Let's surface everything in your head and get it into your inbox.\n\n**Starting with work:** What professional tasks, deadlines, or commitments have been on your mind that aren't written down anywhere?");
  };

  const askAIAboutTask = useCallback(async (task) => {
    setCurrentBucket("inbox");
    switchCoachMode("process", `Let's clarify: **"${task.text}"**`);
    setTimeout(() => processNextInboxItem(task), 100);
  }, [switchCoachMode, processNextInboxItem]);

  const addTask = (bucket) => {
    const text = addText.trim();
    if (!text) return;
    setTasks(prev => [{ id: genId(), text, bucket: bucket || currentBucket, done: false, created: Date.now(), priority: [], location: [], dueDate: null }, ...prev]);
    setAddText("");
  };

  const addAndProcess = () => {
    const text = addText.trim();
    if (!text) return;
    const task = { id: genId(), text, bucket: "inbox", done: false, created: Date.now(), priority: [], location: [], dueDate: null };
    setTasks(prev => [task, ...prev]);
    setAddText("");
    setCurrentBucket("inbox");
    askAIAboutTask(task);
  };

  const moveTask = (id, bucket) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, bucket, done: bucket === "done" } : t));
    setMoveMenu(null);
    setPendingAction(null);
  };

  const deleteTask = (id) => setTasks(prev => prev.filter(t => t.id !== id));
  const completeTask = (id) => setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done, bucket: !t.done ? "done" : "inbox" } : t));
  const updateTask = useCallback((id, changes) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...changes } : t));
  }, []);

  const addLocation = useCallback((name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setLocations(prev => prev.includes(trimmed) ? prev : [...prev, trimmed]);
  }, []);

  const renameLocation = useCallback((oldName, newName) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return;
    setLocations(prev => prev.map(l => l === oldName ? trimmed : l));
    setTasks(prev => prev.map(t => ({
      ...t,
      location: (t.location || []).map(l => l === oldName ? trimmed : l),
    })));
  }, []);

  const removeLocation = useCallback((name, replaceName) => {
    setLocations(prev => prev.filter(l => l !== name));
    setTasks(prev => prev.map(t => {
      const loc = t.location || [];
      if (!loc.includes(name)) return t;
      const next = loc.filter(l => l !== name);
      if (replaceName && !next.includes(replaceName)) next.push(replaceName);
      return { ...t, location: next };
    }));
  }, []);

  const bucketTasks = tasks.filter(t => t.bucket === currentBucket);
  const counts = Object.fromEntries(Object.keys(BUCKETS).map(k => [k, tasks.filter(t => t.bucket === k).length]));

  const s = {
    app: { display: "flex", height: "100vh", background: COLORS.bg, color: COLORS.text, fontFamily: "'Instrument Sans', 'Segoe UI', sans-serif", fontSize: 14, overflow: "hidden" },
    sidebar: { width: 240, background: COLORS.surface, borderRight: `1px solid ${COLORS.border}`, display: "flex", flexDirection: "column", flexShrink: 0 },
    sidebarHeader: { padding: "18px 16px 14px", borderBottom: `1px solid ${COLORS.border}` },
    logo: { fontFamily: "Georgia, serif", fontSize: 17, fontWeight: 300, color: COLORS.text },
    logoEm: { fontStyle: "italic", color: COLORS.inbox },
    sidebarSub: { fontSize: 11, color: COLORS.muted, marginTop: 3 },
    bucketList: { flex: 1, padding: "8px 0", overflowY: "auto" },
    sidebarActions: { padding: 10, borderTop: `1px solid ${COLORS.border}`, display: "flex", flexDirection: "column", gap: 6 },
    main: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" },
    taskPanel: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", borderBottom: `1px solid ${COLORS.border}` },
    panelHeader: { padding: "14px 18px 10px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", alignItems: "center", gap: 10 },
    addRow: { display: "flex", gap: 6, padding: "8px 16px", borderBottom: `1px solid ${COLORS.border}` },
    taskList: { flex: 1, overflowY: "auto", padding: "4px 0" },
    coachPanel: { height: "42vh", display: "flex", flexDirection: "column" },
    coachHeader: { padding: "8px 14px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", alignItems: "center", gap: 8, flexShrink: 0 },
    chatMessages: { flex: 1, overflowY: "auto", padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8 },
    chatInputRow: { display: "flex", gap: 6, padding: "8px 12px", borderTop: `1px solid ${COLORS.border}`, flexShrink: 0, alignItems: "flex-end" },
  };

  return (
    <div style={s.app} onClick={() => setMoveMenu(null)}>
      {/* SIDEBAR */}
      <div style={s.sidebar}>
        <div style={s.sidebarHeader}>
          <div style={s.logo}>GTD <em style={s.logoEm}>Manager</em></div>
          <div style={s.sidebarSub}>Knowledge Worker Edition</div>
        </div>

        <div style={s.bucketList}>
          {Object.entries(BUCKETS).map(([key, cfg]) => (
            <BucketItem key={key} bkey={key} cfg={cfg} count={counts[key]} active={currentBucket === key} onClick={() => setCurrentBucket(key)} />
          ))}
        </div>

        <div style={s.sidebarActions}>
          <SidebarBtn primary onClick={startProcessInbox}>🤖 Process Inbox with AI</SidebarBtn>
          <SidebarBtn onClick={startWeeklyReview}>📋 Weekly Review</SidebarBtn>
          <SidebarBtn onClick={startBrainDump}>🧠 Brain Dump</SidebarBtn>
        </div>

        <div style={{ padding: "8px 10px", borderTop: `1px solid ${COLORS.border}` }}>
          <SidebarBtn onClick={() => setShowSettings(v => !v)}>⚙ Settings</SidebarBtn>
        </div>
      </div>

      {/* MAIN */}
      <div style={s.main}>
        {/* TASK PANEL */}
        <div style={s.taskPanel}>
          {showSettings ? (
            <SettingsPanel
              locations={locations}
              tasks={tasks}
              onAdd={addLocation}
              onRename={renameLocation}
              onRemove={removeLocation}
              onClose={() => setShowSettings(false)}
            />
          ) : (
            <>
              <div style={s.panelHeader}>
                <div>
                  <div style={{ fontFamily: "Georgia, serif", fontSize: 16, fontWeight: 300 }}>{BUCKETS[currentBucket].label}</div>
                  <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>{BUCKETS[currentBucket].desc}</div>
                </div>
              </div>

              <div style={s.addRow}>
                <input
                  value={addText}
                  onChange={e => setAddText(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addTask()}
                  placeholder="Add a task… (Enter to add)"
                  style={{ flex: 1, background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 7, padding: "7px 11px", fontFamily: "inherit", fontSize: 13, color: COLORS.text, outline: "none" }}
                />
                <Btn onClick={() => addTask()} style={{ fontSize: 12 }}>+ Add</Btn>
                <Btn onClick={addAndProcess} style={{ fontSize: 12, borderColor: COLORS.inbox, color: COLORS.inbox }}>+ Add & Ask AI</Btn>
              </div>

              <div style={s.taskList}>
                {bucketTasks.length === 0 ? (
                  <EmptyState bucket={currentBucket} />
                ) : currentBucket === "project" ? (
                  bucketTasks.map(task => (
                    <div key={task.id}>
                      <TaskRow task={task} currentBucket={currentBucket} moveMenu={moveMenu} setMoveMenu={setMoveMenu}
                        onComplete={completeTask} onDelete={deleteTask} onMove={moveTask} onAskAI={askAIAboutTask} onUpdateTask={updateTask}
                        pendingAction={pendingAction} allTasks={tasks} onNavigate={setCurrentBucket} locations={locations} />
                      {(task.childIds || []).map(childId => {
                        const child = tasks.find(t => t.id === childId);
                        return child ? (
                          <TaskRow key={childId} task={child} currentBucket={currentBucket} moveMenu={moveMenu} setMoveMenu={setMoveMenu}
                            onComplete={completeTask} onDelete={deleteTask} onMove={moveTask} onAskAI={askAIAboutTask} onUpdateTask={updateTask}
                            pendingAction={pendingAction} allTasks={tasks} onNavigate={setCurrentBucket} isSubtask locations={locations} />
                        ) : null;
                      })}
                    </div>
                  ))
                ) : (
                  bucketTasks.map(task => (
                    <TaskRow key={task.id} task={task} currentBucket={currentBucket} moveMenu={moveMenu} setMoveMenu={setMoveMenu}
                      onComplete={completeTask} onDelete={deleteTask} onMove={moveTask} onAskAI={askAIAboutTask} onUpdateTask={updateTask}
                      pendingAction={pendingAction} allTasks={tasks} onNavigate={setCurrentBucket} locations={locations} />
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {/* COACH PANEL */}
        <div style={s.coachPanel}>
          <div style={s.coachHeader}>
            <span style={{ fontSize: 11, fontWeight: 600, color: COLORS.text2, letterSpacing: "0.06em", textTransform: "uppercase" }}>🤖 AI Coach</span>
          <ProviderSelector
            provider={provider} setProvider={setProvider}
            localModel={localModel} setLocalModel={setLocalModel}
            availableModels={availableModels} fetchModels={fetchModels}
          />
            <div style={{ display: "flex", gap: 4 }}>
              {Object.entries(COACH_MODES).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => {
                    if (key === "process") startProcessInbox();
                    else if (key === "review") startWeeklyReview();
                    else if (key === "dump") startBrainDump();
                    else switchCoachMode("chat", "I can see your task list. Ask me anything — clarify a task, plan your day, or check in on your system.");
                  }}
                  style={{ padding: "3px 9px", borderRadius: 6, border: `1px solid ${coachMode === key ? COLORS.border2 : COLORS.border}`, background: coachMode === key ? COLORS.surface3 : "transparent", color: coachMode === key ? COLORS.text : COLORS.muted, fontFamily: "inherit", fontSize: 11, cursor: "pointer" }}
                >
                  {cfg.label}
                </button>
              ))}
            </div>
          </div>

          <div style={s.chatMessages}>
            {messages.map((msg, i) => (
              <ChatBubble key={i} msg={msg} />
            ))}
            {loading && <TypingIndicator />}
            {pendingAction && (
              <PendingActionBar
                action={pendingAction}
                onConfirm={handleConfirmMove}
                onDismiss={() => setPendingAction(null)}
              />
            )}
            <div ref={chatEndRef} />
          </div>

          <div style={s.chatInputRow}>
            <textarea
              ref={chatInputRef}
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
              placeholder="Ask the coach anything…"
              rows={1}
              style={{ flex: 1, background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "7px 11px", fontFamily: "inherit", fontSize: 13, color: COLORS.text, outline: "none", resize: "none", maxHeight: 80 }}
            />
            <button
              onClick={sendChat}
              disabled={loading}
              style={{ width: 34, height: 34, background: loading ? COLORS.surface3 : COLORS.inbox, color: "#111", border: "none", borderRadius: 8, cursor: loading ? "not-allowed" : "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
            >↑</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function BucketItem({ bkey, cfg, count, active, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 16px", cursor: "pointer", background: active ? COLORS.surface2 : "transparent", borderLeft: `3px solid ${active ? cfg.color : "transparent"}`, transition: "background 0.1s" }}
    >
      <div style={{ width: 7, height: 7, borderRadius: "50%", background: cfg.color, flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: 13, color: active ? COLORS.text : COLORS.text2 }}>{cfg.label}</span>
      <span style={{ fontSize: 11, background: COLORS.surface3, color: COLORS.muted, padding: "1px 7px", borderRadius: 10, minWidth: 22, textAlign: "center" }}>{count}</span>
    </div>
  );
}

function SidebarBtn({ children, onClick, primary }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ padding: "7px 11px", borderRadius: 7, border: `1px solid ${primary ? COLORS.inbox : COLORS.border}`, background: primary ? (hover ? "#f0d060" : COLORS.inbox) : (hover ? COLORS.surface2 : "transparent"), color: primary ? "#111" : (hover ? COLORS.text : COLORS.text2), fontFamily: "inherit", fontSize: 12, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 7, fontWeight: primary ? 600 : 400, transition: "all 0.12s" }}
    >
      {children}
    </button>
  );
}

function Btn({ children, onClick, style = {} }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ padding: "7px 12px", borderRadius: 7, border: `1px solid ${COLORS.border}`, background: hover ? COLORS.surface3 : COLORS.surface2, color: COLORS.text2, fontFamily: "inherit", cursor: "pointer", transition: "all 0.12s", whiteSpace: "nowrap", ...style }}
    >
      {children}
    </button>
  );
}

const PRIORITIES = ["Imperative", "As Possible", "Financial", "External"];

function TaskRow({ task, currentBucket, moveMenu, setMoveMenu, onComplete, onDelete, onMove, onAskAI, onUpdateTask, pendingAction, allTasks, onNavigate, isSubtask, locations }) {
  const [hover, setHover] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const highlight = pendingAction && task.bucket === "inbox";
  const parentProject = task.parentId ? (allTasks || []).find(t => t.id === task.parentId) : null;
  const indent = isSubtask ? 28 : 0;

  const taskPriority = task.priority || [];
  const taskLocation = task.location || [];
  const taskDueDate = task.dueDate || "";

  const togglePriority = (p) => {
    const next = taskPriority.includes(p) ? taskPriority.filter(x => x !== p) : [...taskPriority, p];
    onUpdateTask(task.id, { priority: next });
  };

  const toggleLocation = (loc) => {
    const next = taskLocation.includes(loc) ? taskLocation.filter(x => x !== loc) : [...taskLocation, loc];
    onUpdateTask(task.id, { location: next });
  };

  const hasMetadata = taskPriority.length > 0 || taskLocation.length > 0 || taskDueDate;

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ borderLeft: `3px solid ${highlight ? COLORS.inbox : isSubtask ? COLORS.project + "55" : "transparent"}`, opacity: task.done ? 0.4 : 1, transition: "all 0.12s" }}
    >
      {/* Main task row */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 9, padding: `8px 18px 8px ${18 + indent}px`, background: highlight ? COLORS.inboxBg : (hover ? COLORS.surface2 : "transparent") }}>
        {isSubtask && <span style={{ color: COLORS.project, fontSize: 10, marginTop: 3, flexShrink: 0 }}>↳</span>}
        <div
          onClick={() => onComplete(task.id)}
          style={{ width: 15, height: 15, borderRadius: "50%", border: `1.5px solid ${task.done ? COLORS.next : COLORS.border2}`, background: task.done ? COLORS.next : "transparent", flexShrink: 0, marginTop: 2, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#111", transition: "all 0.15s" }}
        >
          {task.done ? "✓" : ""}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, color: COLORS.text, textDecoration: task.done ? "line-through" : "none", lineHeight: 1.4 }}>{task.text}</div>
          {/* Metadata summary chips (collapsed) */}
          {!expanded && hasMetadata && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
              {taskLocation.map(loc => (
                <span key={loc} style={{ fontSize: 10, padding: "1px 6px", borderRadius: 10, background: COLORS.surface3, color: COLORS.project, border: `1px solid ${COLORS.project}44` }}>{loc}</span>
              ))}
              {taskDueDate && (
                <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 10, background: COLORS.surface3, color: COLORS.waiting, border: `1px solid ${COLORS.waiting}44` }}>📅 {taskDueDate}</span>
              )}
              {taskPriority.map(p => (
                <span key={p} style={{ fontSize: 10, padding: "1px 6px", borderRadius: 10, background: COLORS.surface3, color: COLORS.inbox, border: `1px solid ${COLORS.inbox}44` }}>{p}</span>
              ))}
            </div>
          )}
          {/* Parent project link for Next Actions */}
          {parentProject && currentBucket === "next" && hover && (
            <div
              onClick={() => onNavigate("project")}
              style={{ marginTop: 3, fontSize: 11, color: COLORS.project, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, opacity: 0.85 }}
              title="Go to project"
            >
              <span>↑</span>
              <span style={{ textDecoration: "underline" }}>{parentProject.text}</span>
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 4, flexShrink: 0, alignItems: "center" }}>
          {/* Chevron — always visible if has metadata, else on hover */}
          {(hover || expanded || hasMetadata) && (
            <button
              onClick={e => { e.stopPropagation(); setExpanded(x => !x); }}
              title="Task details"
              style={{ padding: "2px 5px", borderRadius: 5, border: `1px solid ${expanded ? COLORS.border2 : COLORS.border}`, background: expanded ? COLORS.surface3 : "transparent", color: expanded ? COLORS.text : COLORS.muted, fontFamily: "inherit", fontSize: 11, cursor: "pointer", lineHeight: 1, transition: "all 0.1s" }}
            >
              {expanded ? "▾" : "›"}
            </button>
          )}
          {hover && (
            <>
              {currentBucket === "inbox" && (
                <ActionBtn onClick={() => onAskAI(task)} color={COLORS.inbox}>✦ AI</ActionBtn>
              )}
              <div style={{ position: "relative" }} onClick={e => e.stopPropagation()}>
                <ActionBtn onClick={() => setMoveMenu(moveMenu === task.id ? null : task.id)}>Move ▾</ActionBtn>
                {moveMenu === task.id && (
                  <div style={{ position: "absolute", right: 0, top: "100%", background: COLORS.surface3, border: `1px solid ${COLORS.border2}`, borderRadius: 8, padding: 4, zIndex: 100, minWidth: 150, boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}>
                    {Object.entries(BUCKETS).filter(([k]) => k !== currentBucket && k !== "done" && k !== "inboxHistory").map(([k, cfg]) => (
                      <div
                        key={k}
                        onClick={() => onMove(task.id, k)}
                        style={{ padding: "7px 10px", borderRadius: 5, fontSize: 12, cursor: "pointer", color: COLORS.text2, display: "flex", alignItems: "center", gap: 7 }}
                        onMouseEnter={e => e.currentTarget.style.background = COLORS.surface2}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                      >
                        <span style={{ color: cfg.color }}>●</span> {cfg.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <ActionBtn onClick={() => onDelete(task.id)} color="#d45a5a">✕</ActionBtn>
            </>
          )}
        </div>
      </div>

      {/* Expanded metadata panel */}
      {expanded && (
        <div
          onClick={e => e.stopPropagation()}
          style={{ margin: `0 18px 8px ${18 + indent + 24}px`, padding: "10px 12px", background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 8, display: "flex", flexDirection: "column", gap: 10 }}
        >
          {/* Location */}
          <div>
            <div style={{ fontSize: 10, color: COLORS.muted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 5 }}>Location</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {(locations || []).map(loc => {
                const active = taskLocation.includes(loc);
                return (
                  <button
                    key={loc}
                    onClick={() => toggleLocation(loc)}
                    style={{ padding: "3px 9px", borderRadius: 10, border: `1px solid ${active ? COLORS.project : COLORS.border}`, background: active ? COLORS.project + "22" : "transparent", color: active ? COLORS.project : COLORS.text2, fontFamily: "inherit", fontSize: 11, cursor: "pointer", transition: "all 0.1s" }}
                  >
                    {loc}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Due Date */}
          <div>
            <div style={{ fontSize: 10, color: COLORS.muted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 5 }}>Due Date</div>
            <input
              type="date"
              value={taskDueDate}
              onChange={e => onUpdateTask(task.id, { dueDate: e.target.value || null })}
              style={{ background: COLORS.surface3, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "4px 8px", color: COLORS.text, fontFamily: "inherit", fontSize: 12, outline: "none", colorScheme: "dark" }}
            />
            {taskDueDate && (
              <button
                onClick={() => onUpdateTask(task.id, { dueDate: null })}
                style={{ marginLeft: 6, padding: "4px 8px", borderRadius: 6, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.muted, fontFamily: "inherit", fontSize: 11, cursor: "pointer" }}
              >✕</button>
            )}
          </div>

          {/* Priority */}
          <div>
            <div style={{ fontSize: 10, color: COLORS.muted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 5 }}>Priority</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {PRIORITIES.map(p => {
                const active = taskPriority.includes(p);
                return (
                  <button
                    key={p}
                    onClick={() => togglePriority(p)}
                    style={{ padding: "3px 9px", borderRadius: 10, border: `1px solid ${active ? COLORS.inbox : COLORS.border}`, background: active ? COLORS.inbox + "22" : "transparent", color: active ? COLORS.inbox : COLORS.text2, fontFamily: "inherit", fontSize: 11, cursor: "pointer", transition: "all 0.1s" }}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ActionBtn({ children, onClick, color }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ padding: "3px 7px", borderRadius: 5, border: `1px solid ${color ? color + "44" : COLORS.border}`, background: hover ? COLORS.surface3 : COLORS.surface2, color: color || COLORS.muted, fontFamily: "inherit", fontSize: 11, cursor: "pointer", transition: "all 0.1s" }}
    >
      {children}
    </button>
  );
}

function ChatBubble({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div style={{ display: "flex", gap: 7, flexDirection: isUser ? "row-reverse" : "row", maxWidth: "100%" }}>
      <div style={{ width: 22, height: 22, borderRadius: "50%", background: isUser ? COLORS.surface3 : COLORS.inbox, color: isUser ? COLORS.text2 : "#111", display: "flex", alignItems: "center", justifyContent: "center", fontSize: isUser ? 9 : 11, fontFamily: "Georgia, serif", flexShrink: 0, marginTop: 1 }}>
        {isUser ? "Y" : "G"}
      </div>
      <div style={{ padding: "8px 11px", borderRadius: 11, fontSize: 13, lineHeight: 1.55, maxWidth: "calc(100% - 70px)", background: isUser ? COLORS.surface3 : COLORS.surface2, color: isUser ? COLORS.text2 : COLORS.text, borderTopLeftRadius: isUser ? 11 : 3, borderTopRightRadius: isUser ? 3 : 11 }}>
        {formatBubble(msg.text)}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div style={{ display: "flex", gap: 7 }}>
      <div style={{ width: 22, height: 22, borderRadius: "50%", background: COLORS.inbox, color: "#111", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontFamily: "Georgia, serif", flexShrink: 0 }}>G</div>
      <div style={{ padding: "9px 13px", borderRadius: 11, borderTopLeftRadius: 3, background: COLORS.surface2, display: "flex", gap: 4, alignItems: "center" }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: COLORS.muted, animation: `bounce 1.2s ${i * 0.2}s infinite` }} />
        ))}
      </div>
      <style>{`@keyframes bounce { 0%,60%,100%{transform:translateY(0);opacity:.3} 30%{transform:translateY(-4px);opacity:1} }`}</style>
    </div>
  );
}

function PendingActionBar({ action, onConfirm, onDismiss }) {
  if (!action) return null;
  const { type, title, nextAction } = action;

  const configs = {
    next:    { color: COLORS.next,    label: "Next Actions", confirmText: "Create ✓" },
    project: { color: COLORS.project, label: "Project + Next Action", confirmText: "Create ✓" },
    someday: { color: COLORS.someday, label: "Someday / Maybe", confirmText: "Move ✓" },
    waiting: { color: COLORS.waiting, label: "Waiting For", confirmText: "Move ✓" },
    delete:  { color: COLORS.muted,   label: "Archive (not actionable)", confirmText: "Archive ✓" },
  };
  const cfg = configs[type] || configs.next;

  return (
    <div style={{ background: COLORS.surface3, border: `1px solid ${cfg.color}44`, borderRadius: 9, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 7 }}>
      <div style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>→ {cfg.label}</div>
      {type === "project" ? (
        <div style={{ fontSize: 12, color: COLORS.text2, lineHeight: 1.5 }}>
          <div><span style={{ color: COLORS.muted }}>Project: </span><strong style={{ color: COLORS.text }}>{title}</strong></div>
          <div><span style={{ color: COLORS.muted }}>Next action: </span><strong style={{ color: COLORS.next }}>{nextAction}</strong></div>
        </div>
      ) : type !== "delete" ? (
        <div style={{ fontSize: 12, color: COLORS.text2 }}>
          <strong style={{ color: cfg.color }}>{title}</strong>
        </div>
      ) : null}
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={onConfirm} style={{ padding: "4px 14px", borderRadius: 6, border: `1px solid ${cfg.color}`, background: "transparent", color: cfg.color, fontFamily: "inherit", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
          {cfg.confirmText}
        </button>
        <button onClick={onDismiss} style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.muted, fontFamily: "inherit", fontSize: 11, cursor: "pointer" }}>
          Skip
        </button>
      </div>
    </div>
  );
}

function ProviderSelector({ provider, setProvider, localModel, setLocalModel, availableModels, fetchModels }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);

  const handleOpen = (e) => {
    e.stopPropagation();
    if (!open) fetchModels();
    setOpen(o => !o);
  };

  const activeLabel = provider === "claude" ? "Claude" : localModel;
  const activeColor = provider === "claude" ? COLORS.inbox : COLORS.next;

  return (
    <div style={{ position: "relative", flex: 1, display: "flex", justifyContent: "center" }} onClick={e => e.stopPropagation()}>
      <button
        onClick={handleOpen}
        style={{ padding: "3px 10px", borderRadius: 6, border: `1px solid ${activeColor}55`, background: COLORS.surface2, color: activeColor, fontFamily: "inherit", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
      >
        <span>{provider === "claude" ? "✦" : "◈"}</span>
        <span>{activeLabel}</span>
        <span style={{ opacity: 0.5, fontSize: 9 }}>▾</span>
      </button>

      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)", background: COLORS.surface3, border: `1px solid ${COLORS.border2}`, borderRadius: 9, padding: 4, zIndex: 200, minWidth: 200, boxShadow: "0 8px 28px rgba(0,0,0,0.55)" }}>
          <div style={{ padding: "4px 8px 3px", fontSize: 10, color: COLORS.muted, letterSpacing: "0.07em", textTransform: "uppercase" }}>Claude API</div>
          <ProviderOption label="Claude Sonnet" icon="✦" color={COLORS.inbox} active={provider === "claude"}
            onClick={() => { setProvider("claude"); setOpen(false); }} />

          <div style={{ margin: "4px 0", borderTop: `1px solid ${COLORS.border}` }} />
          <div style={{ padding: "4px 8px 3px", fontSize: 10, color: COLORS.muted, letterSpacing: "0.07em", textTransform: "uppercase" }}>Open WebUI</div>

          {availableModels.length === 0
            ? <div style={{ padding: "6px 10px", fontSize: 11, color: COLORS.muted, fontStyle: "italic" }}>Fetching models…</div>
            : availableModels.map(m => (
              <ProviderOption key={m} label={m} icon="◈" color={COLORS.next} active={provider === "local" && localModel === m}
                onClick={() => { setProvider("local"); setLocalModel(m); setOpen(false); }} />
            ))
          }
        </div>
      )}
    </div>
  );
}

function ProviderOption({ label, icon, color, active, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <div onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ padding: "6px 10px", borderRadius: 6, fontSize: 12, cursor: "pointer", background: active || hover ? COLORS.surface2 : "transparent", color: active ? color : COLORS.text2, display: "flex", alignItems: "center", gap: 7, transition: "background 0.1s" }}
    >
      <span style={{ color: active ? color : COLORS.muted }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {active && <span style={{ color, fontSize: 9 }}>●</span>}
    </div>
  );
}

function SettingsPanel({ locations, tasks, onAdd, onRename, onRemove, onClose }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "14px 18px 10px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 16, fontWeight: 300 }}>⚙ Settings</div>
          <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>Configure your GTD system</div>
        </div>
        <button
          onClick={onClose}
          style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.muted, fontFamily: "inherit", fontSize: 11, cursor: "pointer" }}
        >✕ Close</button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
        <LocationManager locations={locations} tasks={tasks} onAdd={onAdd} onRename={onRename} onRemove={onRemove} />
      </div>
    </div>
  );
}

function LocationManager({ locations, tasks, onAdd, onRename, onRemove }) {
  const [newLocText, setNewLocText] = useState("");
  const [editingIdx, setEditingIdx] = useState(null);   // index into locations
  const [editText, setEditText] = useState("");
  const [removingName, setRemovingName] = useState(null);  // location being removed
  const [replaceWith, setReplaceWith] = useState("");

  const usedByCount = (name) => tasks.filter(t => (t.location || []).includes(name)).length;

  const handleAdd = () => {
    const trimmed = newLocText.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setNewLocText("");
  };

  const startEdit = (idx) => {
    setEditingIdx(idx);
    setEditText(locations[idx]);
    setRemovingName(null);
  };

  const confirmEdit = () => {
    if (editingIdx !== null) {
      onRename(locations[editingIdx], editText);
      setEditingIdx(null);
      setEditText("");
    }
  };

  const startRemove = (name) => {
    setRemovingName(name);
    setReplaceWith("");
    setEditingIdx(null);
  };

  const confirmRemove = () => {
    onRemove(removingName, replaceWith || null);
    setRemovingName(null);
    setReplaceWith("");
  };

  const inUse = removingName ? usedByCount(removingName) : 0;

  return (
    <div style={{ maxWidth: 480 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, marginBottom: 4 }}>Locations</div>
      <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 16, lineHeight: 1.5 }}>
        Locations tag where a task can be done. Changes cascade to all existing tasks.
      </div>

      {/* Location list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 16 }}>
        {locations.map((loc, idx) => {
          const count = usedByCount(loc);
          const isEditing = editingIdx === idx;
          const isRemoving = removingName === loc;

          return (
            <div key={loc} style={{ background: COLORS.surface2, border: `1px solid ${isRemoving ? "#d45a5a55" : COLORS.border}`, borderRadius: 8, overflow: "hidden" }}>
              {/* Main row */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.project, flexShrink: 0 }} />
                {isEditing ? (
                  <input
                    autoFocus
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") confirmEdit(); if (e.key === "Escape") setEditingIdx(null); }}
                    style={{ flex: 1, background: COLORS.surface3, border: `1px solid ${COLORS.border2}`, borderRadius: 5, padding: "3px 7px", color: COLORS.text, fontFamily: "inherit", fontSize: 13, outline: "none" }}
                  />
                ) : (
                  <span style={{ flex: 1, fontSize: 13, color: COLORS.text }}>{loc}</span>
                )}
                <span style={{ fontSize: 11, color: COLORS.muted, flexShrink: 0 }}>{count} task{count !== 1 ? "s" : ""}</span>
                {isEditing ? (
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={confirmEdit} style={{ padding: "3px 9px", borderRadius: 5, border: `1px solid ${COLORS.next}55`, background: "transparent", color: COLORS.next, fontFamily: "inherit", fontSize: 11, cursor: "pointer" }}>Save</button>
                    <button onClick={() => setEditingIdx(null)} style={{ padding: "3px 7px", borderRadius: 5, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.muted, fontFamily: "inherit", fontSize: 11, cursor: "pointer" }}>✕</button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => startEdit(idx)} style={{ padding: "3px 8px", borderRadius: 5, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.text2, fontFamily: "inherit", fontSize: 11, cursor: "pointer" }}>✎ Rename</button>
                    <button onClick={() => startRemove(loc)} style={{ padding: "3px 8px", borderRadius: 5, border: `1px solid #d45a5a44`, background: "transparent", color: "#d45a5a", fontFamily: "inherit", fontSize: 11, cursor: "pointer" }}>✕ Remove</button>
                  </div>
                )}
              </div>

              {/* Remove confirmation sub-row */}
              {isRemoving && (
                <div style={{ padding: "8px 12px 10px", borderTop: `1px solid ${COLORS.border}`, background: COLORS.surface3 }}>
                  {inUse > 0 ? (
                    <>
                      <div style={{ fontSize: 12, color: COLORS.text2, marginBottom: 8 }}>
                        <strong style={{ color: "#d45a5a" }}>{inUse} task{inUse !== 1 ? "s" : ""}</strong> use this location. Replace with:
                      </div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <select
                          value={replaceWith}
                          onChange={e => setReplaceWith(e.target.value)}
                          style={{ flex: 1, background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "5px 8px", color: COLORS.text, fontFamily: "inherit", fontSize: 12, outline: "none" }}
                        >
                          <option value="">— remove tag only —</option>
                          {locations.filter(l => l !== loc).map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                        <button onClick={confirmRemove} style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid #d45a5a", background: "transparent", color: "#d45a5a", fontFamily: "inherit", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>Confirm</button>
                        <button onClick={() => setRemovingName(null)} style={{ padding: "5px 9px", borderRadius: 6, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.muted, fontFamily: "inherit", fontSize: 12, cursor: "pointer" }}>Cancel</button>
                      </div>
                    </>
                  ) : (
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <span style={{ flex: 1, fontSize: 12, color: COLORS.text2 }}>Remove <strong>{loc}</strong>? No tasks use it.</span>
                      <button onClick={confirmRemove} style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid #d45a5a", background: "transparent", color: "#d45a5a", fontFamily: "inherit", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>Remove</button>
                      <button onClick={() => setRemovingName(null)} style={{ padding: "4px 9px", borderRadius: 6, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.muted, fontFamily: "inherit", fontSize: 12, cursor: "pointer" }}>Cancel</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add new location */}
      <div style={{ display: "flex", gap: 6 }}>
        <input
          value={newLocText}
          onChange={e => setNewLocText(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleAdd()}
          placeholder="New location…"
          style={{ flex: 1, background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 7, padding: "7px 11px", fontFamily: "inherit", fontSize: 13, color: COLORS.text, outline: "none" }}
        />
        <button
          onClick={handleAdd}
          disabled={!newLocText.trim()}
          style={{ padding: "7px 14px", borderRadius: 7, border: `1px solid ${COLORS.project}`, background: "transparent", color: COLORS.project, fontFamily: "inherit", fontSize: 12, cursor: newLocText.trim() ? "pointer" : "not-allowed", opacity: newLocText.trim() ? 1 : 0.4 }}
        >+ Add</button>
      </div>
    </div>
  );
}

function EmptyState({ bucket }) {
  const msgs = {
    inbox:   ["Your inbox is clear", "Add tasks above, or use Brain Dump to surface open loops."],
    next:    ["No next actions", "Process your inbox and move concrete actions here."],
    project: ["No projects", "Multi-step goals go here."],
    waiting: ["Nothing waiting", "Track delegated items here."],
    someday: ["No someday items", "Capture future ideas without committing to them."],
    done:    ["Nothing completed yet", "Complete tasks and they'll appear here."],
  };
  const [title, sub] = msgs[bucket] || ["Empty", ""];
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, padding: 40, textAlign: "center", gap: 6, color: COLORS.muted, minHeight: 120 }}>
      <div style={{ fontSize: 28, opacity: 0.3 }}>○</div>
      <strong style={{ fontSize: 13 }}>{title}</strong>
      <div style={{ fontSize: 12 }}>{sub}</div>
    </div>
  );
}
