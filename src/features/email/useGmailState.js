import { useState, useEffect } from "react";

// ── useGmailState ─────────────────────────────────────────────────────────────
// Owns email view state and simple localStorage persistence.
// Note: the unread-count fetch (depends on googleToken) and the Supabase
// gmail_queue load (depends on authUser + supabaseReady) remain in GTDManager
// until those dependencies are also extracted.
function useGmailState() {
  const [currentView, setCurrentView]           = useState("gtd");
  const [emailTab, setEmailTab]                 = useState(() => localStorage.getItem("gtd_email_tab") || "inbox");
  const [gmailQueue, setGmailQueue]             = useState(() => {
    try { return JSON.parse(localStorage.getItem("gtd_gmail_queue") || "[]"); } catch { return []; }
  });
  const [gmailUnreadCount, setGmailUnreadCount] = useState(null);

  useEffect(() => { localStorage.setItem("gtd_email_tab",   emailTab); }, [emailTab]);
  useEffect(() => { localStorage.setItem("gtd_gmail_queue", JSON.stringify(gmailQueue)); }, [gmailQueue]);

  return { currentView, setCurrentView, emailTab, setEmailTab, gmailQueue, setGmailQueue, gmailUnreadCount, setGmailUnreadCount };
}


export { useGmailState };
