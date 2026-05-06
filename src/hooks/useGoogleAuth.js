import { useState, useEffect, useCallback } from "react";
import { generateCodeVerifier, generateCodeChallenge } from "../api/gmailTools.js";
import { CALENDAR_SCOPE } from "../api/calendarApi.js";

// ── useGoogleAuth ─────────────────────────────────────────────────────────────
// Manages Google OAuth: token storage, PKCE exchange, silent refresh, and the
// five connect/disconnect callbacks. Accepts setCalendarEvents so disconnectCalendar
// can clear calendar view state that lives in GTDManager.
function useGoogleAuth({ setCalendarEvents }) {
  const [googleToken, setGoogleToken] = useState(() => {
    try {
      const stored = localStorage.getItem('gtd_google_token');
      if (!stored) return null;
      const { access_token, expiry } = JSON.parse(stored);
      if (Date.now() > expiry) return null; // keep stored data — refresh_token still usable
      return access_token;
    } catch { return null; }
  });
  const [googleScope, setGoogleScope] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gtd_google_token') || 'null')?.scope || null; }
    catch { return null; }
  });
  const [calendarEnabled, setCalendarEnabled] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gtd_google_token') || 'null')?.calendarEnabled || false; }
    catch { return false; }
  });
  const [gmailError, setGmailError] = useState(null);
  // Capture Google OAuth callback data synchronously during render.
  // Google callbacks have state starting with 'gtd_'; Supabase magic-link codes don't.
  // READ-ONLY: no side effects here — React StrictMode double-invokes useState
  // initializers, so any removeItem() in the first call would leave the second
  // call empty, causing React to use null as the state value. Cleanup is in
  // the useEffect below, which uses an atomic claim pattern.
  const [pendingGoogleAuth] = useState(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      const code = p.get('code');
      const state = p.get('state');
      if (!code || !state?.startsWith('gtd_')) return null;
      const stored = JSON.parse(localStorage.getItem('gtd_google_pkce') || 'null');
      if (!stored || Date.now() - stored.ts > 300000 || state !== stored.state) return null;
      return { code, verifier: stored.verifier };
    } catch { return null; }
  });

  // Google OAuth — exchange code for token
  // Atomic claim: localStorage.getItem('gtd_google_pkce') acts as a mutex.
  // React StrictMode runs effects twice; the second run finds the entry already
  // removed by the first run and exits, preventing a double exchange.
  useEffect(() => {
    if (!pendingGoogleAuth) return;
    const pkceRaw = localStorage.getItem('gtd_google_pkce');
    if (!pkceRaw) return;
    localStorage.removeItem('gtd_google_pkce');
    const pkceData = (() => { try { return JSON.parse(pkceRaw); } catch { return {}; } })();
    const pkceScope = pkceData.scope || 'readonly';
    const pkceCalendarEnabled = pkceData.calendarEnabled || false;
    window.history.replaceState({}, document.title, window.location.pathname);
    const { code, verifier } = pendingGoogleAuth;
    (async () => {
      try {
        const res = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: import.meta.env.VITE_GOOGLE_DESKTOPCLIENT_ID,
            client_secret: import.meta.env.VITE_GOOGLE_DESKTOPCLIENT_SECRET,
            code,
            code_verifier: verifier,
            grant_type: 'authorization_code',
            redirect_uri: window.location.origin,
          }),
        });
        const data = await res.json();
        if (data.access_token) {
          const expiry = Date.now() + (data.expires_in || 3600) * 1000;
          localStorage.setItem('gtd_google_token', JSON.stringify({ access_token: data.access_token, refresh_token: data.refresh_token ?? null, expiry, scope: pkceScope, calendarEnabled: pkceCalendarEnabled }));
          setGoogleToken(data.access_token);
          setGoogleScope(pkceScope);
          setCalendarEnabled(pkceCalendarEnabled);
          setGmailError(null);
        } else {
          const msg = data.error_description || data.error || JSON.stringify(data);
          console.error('[Google OAuth] Token exchange failed:', data);
          setGmailError(`Google error: ${msg}`);
        }
      } catch (e) {
        console.error('[Google OAuth] Fetch error:', e);
        setGmailError(`Network error: ${e.message}`);
      }
    })();
  }, [pendingGoogleAuth]);

  const signInWithGoogle = useCallback(async (accessLevel = 'readonly') => {
    const verifier = generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);
    const state = 'gtd_' + generateCodeVerifier().slice(0, 16);
    localStorage.setItem('gtd_google_pkce', JSON.stringify({ verifier, state, ts: Date.now(), scope: accessLevel }));
    const scopeMap = {
      readonly: 'https://www.googleapis.com/auth/gmail.readonly',
      modify:   'https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.settings.basic',
      compose:  'https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.compose https://www.googleapis.com/auth/gmail.settings.basic',
      send:     'https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.settings.basic',
    };
    const params = new URLSearchParams({
      client_id: import.meta.env.VITE_GOOGLE_DESKTOPCLIENT_ID,
      redirect_uri: window.location.origin,
      response_type: 'code',
      scope: scopeMap[accessLevel] || scopeMap.readonly,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      access_type: 'offline',
      prompt: 'consent',
      state,
    });
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }, []);

  const disconnectGmail = useCallback(() => {
    localStorage.removeItem('gtd_google_token');
    localStorage.removeItem('gtd_google_pkce');
    setGoogleToken(null);
    setGoogleScope(null);
    setCalendarEnabled(false);
    setGmailError(null);
  }, []);

  // Connect Google Calendar — re-auths with calendar.events scope, preserving any existing Gmail scope
  const connectCalendar = useCallback(async () => {
    const verifier = generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);
    const state = 'gtd_' + generateCodeVerifier().slice(0, 16);
    const gmailScopeMap = {
      readonly: 'https://www.googleapis.com/auth/gmail.readonly',
      modify:   'https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.settings.basic',
      compose:  'https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.compose https://www.googleapis.com/auth/gmail.settings.basic',
      send:     'https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.settings.basic',
    };
    const gmailScopeStr = googleScope ? (gmailScopeMap[googleScope] || gmailScopeMap.readonly) : '';
    const scopeStr = [gmailScopeStr, CALENDAR_SCOPE].filter(Boolean).join(' ');
    localStorage.setItem('gtd_google_pkce', JSON.stringify({ verifier, state, ts: Date.now(), scope: googleScope || 'readonly', calendarEnabled: true }));
    const params = new URLSearchParams({
      client_id: import.meta.env.VITE_GOOGLE_DESKTOPCLIENT_ID,
      redirect_uri: window.location.origin,
      response_type: 'code',
      scope: scopeStr,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      access_type: 'offline',
      prompt: 'consent',
      state,
    });
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }, [googleScope]);

  // Disconnect calendar only (keep Gmail token intact)
  const disconnectCalendar = useCallback(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('gtd_google_token') || 'null');
      if (stored) { stored.calendarEnabled = false; localStorage.setItem('gtd_google_token', JSON.stringify(stored)); }
    } catch {}
    setCalendarEnabled(false);
    setCalendarEvents([]);
  }, [setCalendarEvents]);

  // Silently exchange a stored refresh_token for a new access_token.
  const refreshGoogleToken = useCallback(async () => {
    try {
      const stored = JSON.parse(localStorage.getItem('gtd_google_token') || 'null');
      if (!stored?.refresh_token) return null;
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: import.meta.env.VITE_GOOGLE_DESKTOPCLIENT_ID,
          client_secret: import.meta.env.VITE_GOOGLE_DESKTOPCLIENT_SECRET,
          refresh_token: stored.refresh_token,
          grant_type: 'refresh_token',
        }),
      });
      const data = await res.json();
      if (data.access_token) {
        const expiry = Date.now() + (data.expires_in || 3600) * 1000;
        localStorage.setItem('gtd_google_token', JSON.stringify({ ...stored, access_token: data.access_token, expiry }));
        setGoogleToken(data.access_token);
        return data.access_token;
      }
      console.warn('[Gmail OAuth] Refresh failed:', data.error);
      localStorage.removeItem('gtd_google_token');
      setGoogleToken(null);
      setGmailError('Gmail session expired — please reconnect.');
      return null;
    } catch (e) {
      console.warn('[Gmail OAuth] Refresh network error:', e.message);
      setGmailError('Could not refresh Gmail session — check your connection.');
      return null;
    }
  }, []);

  // On mount: if the access token was expired at startup but a refresh_token is stored, refresh silently.
  useEffect(() => {
    if (googleToken) return;
    const stored = JSON.parse(localStorage.getItem('gtd_google_token') || 'null');
    if (stored?.refresh_token) refreshGoogleToken();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Proactive refresh: schedule a token refresh 5 min before it expires so the session never goes stale.
  useEffect(() => {
    if (!googleToken) return;
    const stored = JSON.parse(localStorage.getItem('gtd_google_token') || 'null');
    if (!stored?.expiry || !stored?.refresh_token) return;
    const msUntilRefresh = stored.expiry - Date.now() - 5 * 60 * 1000;
    if (msUntilRefresh <= 0) { refreshGoogleToken(); return; }
    const timer = setTimeout(() => refreshGoogleToken(), msUntilRefresh);
    return () => clearTimeout(timer);
  }, [googleToken, refreshGoogleToken]);

  return { googleToken, googleScope, calendarEnabled, gmailError,
           signInWithGoogle, disconnectGmail, connectCalendar, disconnectCalendar, refreshGoogleToken };
}


export { useGoogleAuth };
