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
  const [authError,   setAuthError]   = useState(null);

  const sendMagicLink = useCallback(async () => {
    if (!authEmail.trim()) return;
    setAuthError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: authEmail.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) {
      console.error('Supabase signInWithOtp:', error);
      setAuthError(
        error.status === 429 || /rate limit/i.test(error.message || '')
          ? "Too many login link requests \u2014 please wait a bit and try again."
          : "Couldn't send login link. Please try again."
      );
      return;
    }
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
    // Handle magic-link hash callback (#access_token=...)
    const _hash = new URLSearchParams(window.location.hash.substring(1));
    const _accessToken = _hash.get('access_token');
    const _refreshToken = _hash.get('refresh_token');
    if (_accessToken && _refreshToken) {
      supabase.auth.setSession({ access_token: _accessToken, refresh_token: _refreshToken })
        .then(({ error }) => {
          if (error) console.error('Supabase hash session:', error);
          else window.history.replaceState(null, '', window.location.pathname);
        });
    }
    return () => subscription.unsubscribe();
  }, []);

  return { authUser, authLoading, authEmail, setAuthEmail, authSent, authError, sendMagicLink };
}


export { useSupabaseAuth };
