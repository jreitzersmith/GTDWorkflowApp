import { useState, useEffect, useCallback } from "react";
import { generateCodeVerifier, generateCodeChallenge } from "../features/email/gmailTools.js";
import { CALENDAR_SCOPE } from "../features/calendar/calendarApi.js";

// ── Scope string maps ──────────────────────────────────────────────────────────
const GMAIL_SCOPES = {
  readonly: 'https://www.googleapis.com/auth/gmail.readonly',
  modify:   'https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.settings.basic',
  compose:  'https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.compose https://www.googleapis.com/auth/gmail.settings.basic',
  send:     'https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.settings.basic',
};
const DRIVE_SCOPES = {
  standard: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.appdata',
  full:     'https://www.googleapis.com/auth/drive',
};
const DOCS_SCOPES = {
  readonly: 'https://www.googleapis.com/auth/documents.readonly',
  full:     'https://www.googleapis.com/auth/documents',
};
const SHEETS_SCOPES = {
  readonly: 'https://www.googleapis.com/auth/spreadsheets.readonly',
  full:     'https://www.googleapis.com/auth/spreadsheets',
};
const SLIDES_SCOPES = {
  readonly: 'https://www.googleapis.com/auth/presentations.readonly',
  full:     'https://www.googleapis.com/auth/presentations',
};
const CONTACTS_SCOPES = {
  readonly: 'https://www.googleapis.com/auth/contacts.readonly',
  full:     'https://www.googleapis.com/auth/contacts',
};

export { GMAIL_SCOPES, DRIVE_SCOPES, DOCS_SCOPES, SHEETS_SCOPES, SLIDES_SCOPES, CONTACTS_SCOPES };

const TOKEN_KEY = 'gtd_google_token';
const PKCE_KEY  = 'gtd_google_pkce';
const PREFS_KEY = 'gtd_google_scope_prefs';

const DEFAULT_PREFS = {
  gmail: 'modify', calendar: true,
  drive: 'standard', docs: 'full', sheets: 'full', slides: 'full', contacts: false,
};

// ── useGoogleAuth ──────────────────────────────────────────────────────────────
// Manages Google OAuth for Gmail, Calendar, Drive, Docs, Sheets, and Slides.
// All services are authorized in a single OAuth flow via reauthorizeGoogle().
// connectCalendar() is kept for backward-compat use in CalendarManagementView.
function useGoogleAuth({ setCalendarEvents }) {

  // ── State — all initializers read from localStorage ─────────────────────────
  const [googleToken, setGoogleToken] = useState(() => {
    try {
      const raw = localStorage.getItem(TOKEN_KEY);
      if (!raw) return null;
      const t = JSON.parse(raw);
      // Schema migration: old { scope } → new { gmailScope }
      if (t.scope !== undefined && t.gmailScope === undefined) {
        t.gmailScope    = t.scope;
        t.driveEnabled  = false;
        t.docsEnabled   = false;
        t.sheetsEnabled = false;
        t.slidesEnabled = false;
        delete t.scope;
        localStorage.setItem(TOKEN_KEY, JSON.stringify(t));
      }
      if (Date.now() > t.expiry) return null; // keep entry — refresh_token still usable
      return t.access_token;
    } catch { return null; }
  });

  // googleScope is the exported name for backward compat (EmailPanel, CoachPanel read it)
  const [googleScope, setGoogleScope] = useState(() => {
    try { return JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null')?.gmailScope || null; }
    catch { return null; }
  });

  const [calendarEnabled, setCalendarEnabled] = useState(() => {
    try { return JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null')?.calendarEnabled || false; }
    catch { return false; }
  });
  const [driveEnabled,  setDriveEnabled]  = useState(() => {
    try { return JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null')?.driveEnabled  || false; } catch { return false; }
  });
  const [docsEnabled,   setDocsEnabled]   = useState(() => {
    try { return JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null')?.docsEnabled   || false; } catch { return false; }
  });
  const [sheetsEnabled, setSheetsEnabled] = useState(() => {
    try { return JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null')?.sheetsEnabled || false; } catch { return false; }
  });
  const [slidesEnabled, setSlidesEnabled] = useState(() => {
    try { return JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null')?.slidesEnabled || false; } catch { return false; }
  });
  const [contactsEnabled, setContactsEnabled] = useState(() => {
    try { return JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null')?.contactsEnabled || false; } catch { return false; }
  });

  // scopePrefs: desired access level per service — stored separately from the token
  // so they survive a Disconnect and pre-populate the next auth flow.
  const [scopePrefs, _setScopePrefs] = useState(() => {
    try { return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') }; }
    catch { return { ...DEFAULT_PREFS }; }
  });

  const [gmailError, setGmailError] = useState(null);

  // ── Scope prefs ──────────────────────────────────────────────────────────────
  const setScopePref = useCallback((service, level) => {
    _setScopePrefs(prev => {
      const next = { ...prev, [service]: level };
      localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  // ── Pending OAuth callback — read-only, no side effects ─────────────────────
  // Google callbacks have state starting with 'gtd_'; Supabase magic-link codes don't.
  // READ-ONLY: no side effects here — React StrictMode double-invokes useState
  // initializers, so any removeItem() in the first call would leave the second empty.
  const [pendingGoogleAuth] = useState(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      const code = p.get('code');
      const state = p.get('state');
      if (!code || !state?.startsWith('gtd_')) return null;
      const stored = JSON.parse(localStorage.getItem(PKCE_KEY) || 'null');
      if (!stored || Date.now() - stored.ts > 300000 || state !== stored.state) return null;
      return { code, verifier: stored.verifier };
    } catch { return null; }
  });

  // ── Token exchange ───────────────────────────────────────────────────────────
  // Atomic claim: localStorage.getItem(PKCE_KEY) acts as a mutex so StrictMode's
  // double-effect invocation only runs the exchange once.
  useEffect(() => {
    if (!pendingGoogleAuth) return;
    const pkceRaw = localStorage.getItem(PKCE_KEY);
    if (!pkceRaw) return;
    localStorage.removeItem(PKCE_KEY);
    const pkce = (() => { try { return JSON.parse(pkceRaw); } catch { return {}; } })();
    window.history.replaceState({}, document.title, window.location.pathname);
    const { code, verifier } = pendingGoogleAuth;
    (async () => {
      try {
        const res = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id:     import.meta.env.VITE_GOOGLE_DESKTOPCLIENT_ID,
            client_secret: import.meta.env.VITE_GOOGLE_DESKTOPCLIENT_SECRET,
            code,
            code_verifier: verifier,
            grant_type:    'authorization_code',
            redirect_uri:  window.location.origin,
          }),
        });
        const data = await res.json();
        if (data.access_token) {
          const expiry  = Date.now() + (data.expires_in || 3600) * 1000;
          const payload = {
            access_token:   data.access_token,
            refresh_token:  data.refresh_token ?? null,
            expiry,
            gmailScope:      pkce.gmailScope     || 'modify',
            calendarEnabled: pkce.calendarEnabled ?? false,
            driveEnabled:    pkce.driveEnabled    ?? true,
            docsEnabled:     pkce.docsEnabled     ?? true,
            sheetsEnabled:   pkce.sheetsEnabled   ?? true,
            slidesEnabled:    pkce.slidesEnabled   ?? true,
            contactsEnabled:  pkce.contactsEnabled ?? false,
          };
          localStorage.setItem(TOKEN_KEY, JSON.stringify(payload));
          setGoogleToken(data.access_token);
          setGoogleScope(payload.gmailScope);
          setCalendarEnabled(payload.calendarEnabled);
          setDriveEnabled(payload.driveEnabled);
          setDocsEnabled(payload.docsEnabled);
          setSheetsEnabled(payload.sheetsEnabled);
          setSlidesEnabled(payload.slidesEnabled);
          setContactsEnabled(payload.contactsEnabled);
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

  // ── Core redirect helper ─────────────────────────────────────────────────────
  // overrides.calendarEnabled — lets connectCalendar() force calendar on regardless
  //   of scopePrefs.calendar (for backward compat with CalendarManagementView).
  // overrides.prefs — pass a freshly computed prefs object to avoid stale closure
  //   (used by setScopePref + immediate auth sequences).
  const doGoogleAuth = useCallback(async (overrides = {}) => {
    const verifier  = generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);
    const state     = 'gtd_' + generateCodeVerifier().slice(0, 16);
    const prefs        = overrides.prefs || scopePrefs;
    const calOn        = overrides.calendarEnabled ?? prefs.calendar;
    const contactsOn   = overrides.contactsEnabled ?? !!(prefs.contacts);

    const scopeParts = [
      GMAIL_SCOPES[prefs.gmail]    || GMAIL_SCOPES.modify,
      calOn ? CALENDAR_SCOPE        : null,
      DRIVE_SCOPES[prefs.drive]   || DRIVE_SCOPES.standard,
      DOCS_SCOPES[prefs.docs]     || DOCS_SCOPES.full,
      SHEETS_SCOPES[prefs.sheets] || SHEETS_SCOPES.full,
      SLIDES_SCOPES[prefs.slides] || SLIDES_SCOPES.full,
      contactsOn ? CONTACTS_SCOPES.full : null,
    ].filter(Boolean).join(' ');

    localStorage.setItem(PKCE_KEY, JSON.stringify({
      verifier,
      state,
      ts:              Date.now(),
      gmailScope:      prefs.gmail,
      calendarEnabled: calOn,
      driveEnabled:    true,
      docsEnabled:     true,
      sheetsEnabled:   true,
      slidesEnabled:    true,
      contactsEnabled:  contactsOn,
    }));

    const params = new URLSearchParams({
      client_id:             import.meta.env.VITE_GOOGLE_DESKTOPCLIENT_ID,
      redirect_uri:          window.location.origin,
      response_type:         'code',
      scope:                 scopeParts,
      code_challenge:        challenge,
      code_challenge_method: 'S256',
      access_type:           'offline',
      prompt:                'consent',
      state,
    });
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }, [scopePrefs]);

  // ── Public connect / authorize ───────────────────────────────────────────────

  // Unified re-auth from Settings — grants all services at their current scope prefs.
  const reauthorizeGoogle = useCallback(() => doGoogleAuth(), [doGoogleAuth]);

  // Backward-compat: used by CalendarManagementView and CoachPanel.
  // Forces calendar scope on even if scopePrefs.calendar is currently false.
  const connectCalendar = useCallback(() => doGoogleAuth({ calendarEnabled: true }), [doGoogleAuth]);

  // ── Disconnect helpers ───────────────────────────────────────────────────────

  // Full disconnect — clears token, all flags, and calendar event state.
  const disconnectGmail = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(PKCE_KEY);
    setGoogleToken(null);
    setGoogleScope(null);
    setCalendarEnabled(false);
    setDriveEnabled(false);
    setDocsEnabled(false);
    setSheetsEnabled(false);
    setSlidesEnabled(false);
    setContactsEnabled(false);
    setGmailError(null);
    setCalendarEvents([]);
  }, [setCalendarEvents]);

  const disconnectAll = disconnectGmail;

  // Flip a single enabled flag in state + persisted token without revoking the token.
  const _flipOff = useCallback((setter, key) => {
    try {
      const stored = JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null');
      if (stored) { stored[key] = false; localStorage.setItem(TOKEN_KEY, JSON.stringify(stored)); }
    } catch {}
    setter(false);
  }, []);

  const disconnectCalendar = useCallback(() => {
    _flipOff(setCalendarEnabled, 'calendarEnabled');
    setCalendarEvents([]);
  }, [_flipOff, setCalendarEvents]);

  const disconnectDrive  = useCallback(() => _flipOff(setDriveEnabled,  'driveEnabled'),  [_flipOff]);
  const disconnectDocs   = useCallback(() => _flipOff(setDocsEnabled,   'docsEnabled'),   [_flipOff]);
  const disconnectSheets = useCallback(() => _flipOff(setSheetsEnabled, 'sheetsEnabled'), [_flipOff]);
  const disconnectSlides   = useCallback(() => _flipOff(setSlidesEnabled,   'slidesEnabled'),   [_flipOff]);
  const disconnectContacts = useCallback(() => _flipOff(setContactsEnabled, 'contactsEnabled'), [_flipOff]);

  // ── Silent token refresh ─────────────────────────────────────────────────────
  const refreshGoogleToken = useCallback(async () => {
    try {
      const stored = JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null');
      if (!stored?.refresh_token) return null;
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id:     import.meta.env.VITE_GOOGLE_DESKTOPCLIENT_ID,
          client_secret: import.meta.env.VITE_GOOGLE_DESKTOPCLIENT_SECRET,
          refresh_token: stored.refresh_token,
          grant_type:    'refresh_token',
        }),
      });
      const data = await res.json();
      if (data.access_token) {
        const expiry = Date.now() + (data.expires_in || 3600) * 1000;
        localStorage.setItem(TOKEN_KEY, JSON.stringify({ ...stored, access_token: data.access_token, expiry }));
        setGoogleToken(data.access_token);
        return data.access_token;
      }
      console.warn('[Google OAuth] Refresh failed:', data.error);
      localStorage.removeItem(TOKEN_KEY);
      setGoogleToken(null);
      setGmailError('Google session expired — please reconnect.');
      return null;
    } catch (e) {
      console.warn('[Google OAuth] Refresh network error:', e.message);
      setGmailError('Could not refresh Google session — check your connection.');
      return null;
    }
  }, []);

  // On mount: if token was expired at startup but a refresh_token is stored, refresh silently.
  useEffect(() => {
    if (googleToken) return;
    const stored = JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null');
    if (stored?.refresh_token) refreshGoogleToken();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Proactive refresh: schedule a token refresh 5 min before expiry.
  useEffect(() => {
    if (!googleToken) return;
    const stored = JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null');
    if (!stored?.expiry || !stored?.refresh_token) return;
    const msUntilRefresh = stored.expiry - Date.now() - 5 * 60 * 1000;
    if (msUntilRefresh <= 0) { refreshGoogleToken(); return; }
    const timer = setTimeout(() => refreshGoogleToken(), msUntilRefresh);
    return () => clearTimeout(timer);
  }, [googleToken, refreshGoogleToken]);

  return {
    // Token + gmail scope (googleScope name kept for backward compat with EmailPanel/CoachPanel)
    googleToken, googleScope, gmailError,
    // Per-service enabled flags
    calendarEnabled, driveEnabled, docsEnabled, sheetsEnabled, slidesEnabled, contactsEnabled,
    // Scope preferences (desired level per service)
    scopePrefs, setScopePref,
    // Auth actions
    reauthorizeGoogle, connectCalendar,
    // Disconnect actions
    disconnectGmail, disconnectAll,
    disconnectCalendar, disconnectDrive, disconnectDocs, disconnectSheets, disconnectSlides, disconnectContacts,
    // Token maintenance
    refreshGoogleToken,
  };
}

export { useGoogleAuth };
