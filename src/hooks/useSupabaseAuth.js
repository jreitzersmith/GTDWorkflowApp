import { useState, useEffect, useCallback } from "react";
import { supabase } from "../api/supabase.js";

// ── useSupabaseAuth ──────────────────────────────────────────────────────────
// Manages Supabase authentication: session restore, magic-link exchange,
// and auth state change listener. Owns authUser, authLoading, authEmail, authSent.
function useSupabaseAuth() {
  const [authUser,    setAuthUser]    = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authEmail,   setAuthEmail]   = useState('');
  const [authSent,    setAuthSent]    = useState(false);

  const sendMagicLink = useCallback(async () => {
    if (!authEmail.trim()) return;
    await supabase.auth.signInWithOtp({ email: authEmail.trim() });
    setAuthSent(true);
  }, [authEmail]);

  // Restore session on mount; listen for magic-link callback; exchange Supabase
  // ?code= param (detectSessionInUrl is disabled — we handle it manually here).
  // Google OAuth codes have state starting with 'gtd_' — those are skipped.
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthUser(session?.user ?? null);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user ?? null);
    });
    const _p = new URLSearchParams(window.location.search);
    const _code = _p.get('code');
    const _state = _p.get('state');
    if (_code && !_state?.startsWith('gtd_')) {
      supabase.auth.exchangeCodeForSession(_code)
        .then(({ error }) => { if (error) console.error('Supabase code exchange:', error); });
    }
    return () => subscription.unsubscribe();
  }, []);

  return { authUser, authLoading, authEmail, setAuthEmail, authSent, sendMagicLink };
}


export { useSupabaseAuth };
