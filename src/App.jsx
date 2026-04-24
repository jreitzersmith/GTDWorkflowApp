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
  inbox:   { label: "📥 Inbox",           desc: "Unprocessed — capture everything here first", color: COLORS.inbox },
  next:    { label: "⚡ Next Actions",     desc: "Concrete physical actions to do this week",   color: COLORS.next },
  project: { label: "📁 Projects",        desc: "Anything requiring more than one step",        color: COLORS.project },
  waiting: { label: "⏳ Waiting For",     desc: "Delegated — ball in someone else's court",     color: COLORS.waiting },
  someday: { label: "💭 Someday / Maybe", desc: "Ideas and aspirations, not commitments",       color: COLORS.someday },
  done:    { label: "✅ Completed",        desc: "Finished tasks",                              color: COLORS.done },
};

const COACH_MODES = {
  chat:    { label: "Chat",        icon: "💬" },
  process: { label: "Process",     icon: "📥" },
  review:  { label: "Review",      icon: "📋" },
  dump:    { label: "Brain Dump",  icon: "🧠" },
};

const SYSTEM_PROMPTS = {
  chat: `You are a GTD (Getting Things Done) coach for a knowledge worker. You have access to their full task list (provided in each message). Help them stay organized, clarify tasks, define next actions, and maintain their GTD system. Be concise — under 100 words per response. When recommending a bucket move, be explicit: say "→ Move to Next Actions" or similar.`,
  process: `You are a GTD inbox processor. For each inbox item the user gives you:
1. Determine if it's actionable
2. If yes: identify the very next physical action (verb + specific object)
3. Assign it to exactly one bucket: Next Actions, Projects, Waiting For, or Someday/Maybe
4. Be direct, under 70 words
5. Always end with exactly this format on its own line: →MOVE:[bucket] where bucket is one of: next, project, waiting, someday
Example ending: →MOVE:next`,
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

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

function formatBubble(text) {
  const parts = text.split(/(→MOVE:\w+)/g);
  return parts.map((part, i) => {
    const moveMatch = part.match(/→MOVE:(\w+)/);
    if (moveMatch) return null; // hidden from display
    return <span key={i} dangerouslySetInnerHTML={{ __html: part.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>') }} />;
  });
}

function extractMove(text) {
  const m = text.match(/→MOVE:(\w+)/);
  return m ? m[1] : null;
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
  const [pendingMove, setPendingMove] = useState(null); // { taskId, bucket }
  const chatEndRef = useRef(null);
  const chatInputRef = useRef(null);

  useEffect(() => {
    localStorage.setItem("gtd_tasks", JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const getTaskContext = useCallback(() => {
    const bucketNames = { inbox: "Inbox", next: "Next Actions", project: "Projects", waiting: "Waiting For", someday: "Someday/Maybe" };
    return Object.entries(bucketNames).map(([k, label]) => {
      const items = tasks.filter(t => t.bucket === k).map(t => t.text);
      return `${label} (${items.length}): ${items.length ? items.join(" | ") : "empty"}`;
    }).join("\n");
  }, [tasks]);

  const callClaude = useCallback(async (userMsg, mode, history) => {
    const systemPrompt = SYSTEM_PROMPTS[mode] + "\n\n[Current Task List]\n" + getTaskContext();
    const newHistory = [...history, { role: "user", content: userMsg }];

    setLoading(true);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: systemPrompt,
          messages: newHistory,
        }),
      });
      const data = await res.json();
      const reply = data.content?.[0]?.text || "Sorry, something went wrong.";
      const updatedHistory = [...newHistory, { role: "assistant", content: reply }];
      setChatHistory(updatedHistory);
      setMessages(prev => [...prev, { role: "assistant", text: reply }]);

      // check for move suggestion
      const move = extractMove(reply);
      if (move) setPendingMove({ bucket: move });

      return reply;
    } catch (e) {
      const err = "Connection error — please try again.";
      setMessages(prev => [...prev, { role: "assistant", text: err }]);
    } finally {
      setLoading(false);
    }
  }, [getTaskContext]);

  const sendChat = useCallback(async () => {
    const text = chatInput.trim();
    if (!text || loading) return;
    setChatInput("");
    setMessages(prev => [...prev, { role: "user", text }]);
    await callClaude(text, coachMode, chatHistory);
  }, [chatInput, loading, coachMode, chatHistory, callClaude]);

  const switchCoachMode = useCallback((mode, introMsg) => {
    setCoachMode(mode);
    setChatHistory([]);
    setPendingMove(null);
    setMessages([{ role: "assistant", text: introMsg }]);
  }, []);

  const startProcessInbox = () => {
    setCurrentBucket("inbox");
    const inbox = tasks.filter(t => t.bucket === "inbox");
    if (inbox.length === 0) {
      switchCoachMode("process", "Your inbox is empty — nothing to process! Add some tasks first or do a Brain Dump.");
      return;
    }
    switchCoachMode("process", `You have **${inbox.length} item${inbox.length > 1 ? "s" : ""}** in your inbox. Let's go through them.\n\nFirst: **"${inbox[0].text}"**\n\nIs this actionable? What's the very next physical step?`);
  };

  const startWeeklyReview = () => {
    const total = tasks.filter(t => t.bucket !== "done").length;
    switchCoachMode("review", `Let's do your Weekly Review. You have **${total} active tasks** across your lists.\n\n**Step 1: Capture loose ends.**\nLook around — any sticky notes, papers, or things not yet in your system?`);
  };

  const startBrainDump = () => {
    switchCoachMode("dump", "Let's surface everything in your head and get it into your inbox.\n\n**Starting with work:** What professional tasks, deadlines, or commitments have been on your mind that aren't written down anywhere?");
  };

  const askAIAboutTask = (task) => {
    switchCoachMode("process", `Let's clarify: **"${task.text}"**\n\nIs this actionable right now? If yes — what's the very next physical action you'd take?`);
    chatInputRef.current?.focus();
  };

  const addTask = (bucket) => {
    const text = addText.trim();
    if (!text) return;
    setTasks(prev => [{ id: genId(), text, bucket: bucket || currentBucket, done: false, created: Date.now() }, ...prev]);
    setAddText("");
  };

  const addAndProcess = () => {
    const text = addText.trim();
    if (!text) return;
    const task = { id: genId(), text, bucket: "inbox", done: false, created: Date.now() };
    setTasks(prev => [task, ...prev]);
    setAddText("");
    setCurrentBucket("inbox");
    askAIAboutTask(task);
  };

  const moveTask = (id, bucket) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, bucket, done: bucket === "done" } : t));
    setMoveMenu(null);
    setPendingMove(null);
  };

  const deleteTask = (id) => setTasks(prev => prev.filter(t => t.id !== id));
  const completeTask = (id) => setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done, bucket: !t.done ? "done" : "inbox" } : t));

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
      </div>

      {/* MAIN */}
      <div style={s.main}>
        {/* TASK PANEL */}
        <div style={s.taskPanel}>
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
            ) : (
              bucketTasks.map(task => (
                <TaskRow
                  key={task.id}
                  task={task}
                  currentBucket={currentBucket}
                  moveMenu={moveMenu}
                  setMoveMenu={setMoveMenu}
                  onComplete={completeTask}
                  onDelete={deleteTask}
                  onMove={moveTask}
                  onAskAI={askAIAboutTask}
                  pendingMove={pendingMove}
                />
              ))
            )}
          </div>
        </div>

        {/* COACH PANEL */}
        <div style={s.coachPanel}>
          <div style={s.coachHeader}>
            <span style={{ fontSize: 11, fontWeight: 600, color: COLORS.text2, letterSpacing: "0.06em", textTransform: "uppercase", flex: 1 }}>🤖 AI Coach</span>
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
            {pendingMove && (
              <PendingMoveBar
                bucket={pendingMove.bucket}
                inboxTask={tasks.find(t => t.bucket === "inbox")}
                onMove={(taskId) => moveTask(taskId, pendingMove.bucket)}
                onDismiss={() => setPendingMove(null)}
                tasks={tasks}
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

function TaskRow({ task, currentBucket, moveMenu, setMoveMenu, onComplete, onDelete, onMove, onAskAI, pendingMove }) {
  const [hover, setHover] = useState(false);
  const highlight = pendingMove && task.bucket === "inbox";

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ display: "flex", alignItems: "flex-start", gap: 9, padding: "8px 18px", background: highlight ? COLORS.inboxBg : (hover ? COLORS.surface2 : "transparent"), borderLeft: `3px solid ${highlight ? COLORS.inbox : "transparent"}`, opacity: task.done ? 0.4 : 1, transition: "all 0.12s" }}
    >
      <div
        onClick={() => onComplete(task.id)}
        style={{ width: 15, height: 15, borderRadius: "50%", border: `1.5px solid ${task.done ? COLORS.next : COLORS.border2}`, background: task.done ? COLORS.next : "transparent", flexShrink: 0, marginTop: 2, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#111", transition: "all 0.15s" }}
      >
        {task.done ? "✓" : ""}
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13.5, color: COLORS.text, textDecoration: task.done ? "line-through" : "none", lineHeight: 1.4 }}>{task.text}</div>
      </div>

      {hover && (
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          {currentBucket === "inbox" && (
            <ActionBtn onClick={() => onAskAI(task)} color={COLORS.inbox}>✦ AI</ActionBtn>
          )}
          <div style={{ position: "relative" }} onClick={e => e.stopPropagation()}>
            <ActionBtn onClick={() => setMoveMenu(moveMenu === task.id ? null : task.id)}>Move ▾</ActionBtn>
            {moveMenu === task.id && (
              <div style={{ position: "absolute", right: 0, top: "100%", background: COLORS.surface3, border: `1px solid ${COLORS.border2}`, borderRadius: 8, padding: 4, zIndex: 100, minWidth: 150, boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}>
                {Object.entries(BUCKETS).filter(([k]) => k !== currentBucket && k !== "done").map(([k, cfg]) => (
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

function PendingMoveBar({ bucket, tasks, onMove, onDismiss }) {
  const inboxTasks = tasks.filter(t => t.bucket === "inbox");
  if (inboxTasks.length === 0) return null;
  const task = inboxTasks[0];
  const cfg = BUCKETS[bucket];
  if (!cfg) return null;

  return (
    <div style={{ background: COLORS.surface3, border: `1px solid ${cfg.color}44`, borderRadius: 9, padding: "9px 12px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <span style={{ fontSize: 12, color: COLORS.text2, flex: 1 }}>
        Move <strong style={{ color: COLORS.text }}>"{task.text}"</strong> → <span style={{ color: cfg.color }}>{cfg.label}</span>?
      </span>
      <button onClick={() => onMove(task.id)} style={{ padding: "4px 12px", borderRadius: 6, border: `1px solid ${cfg.color}`, background: "transparent", color: cfg.color, fontFamily: "inherit", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
        Move ✓
      </button>
      <button onClick={onDismiss} style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.muted, fontFamily: "inherit", fontSize: 11, cursor: "pointer" }}>
        Skip
      </button>
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
