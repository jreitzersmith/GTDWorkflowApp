import { useState, useEffect, useRef } from 'react';
import { supabase, taskToDb, dbToTask, rowToQueueEntry } from '../api/supabase.js';
import { DEFAULT_EFFORTS } from '../features/settings/useAppSettings.js';

/**
 * Owns all Supabase persistence effects: initial task/settings reads,
 * write-sync diffs, debounced settings upserts, offline-flush, realtime
 * subscription, and the gmail_queue load.  Also keeps localStorage in
 * sync for unauthenticated sessions and writes tasks on every change.
 *
 * @param {{
 *   authUser: object|null,
 *   tasks: Array, setTasks: Function,
 *   locations: Array, efforts: Array, calibrationOverrides: object, categories: Array,
 *   skippedCalendarIds: Set, seenCalendarEventIds: Set,
 *   recurringAcknowledgedMap: Map, recurringReviewDays: number,
 *   standaloneProjectId: string|null,
 *   setLocations: Function, setEfforts: Function, setCalibrationOverrides: Function, setCategories: Function,
 *   setSkippedCalendarIds: Function, setSeenCalendarEventIds: Function,
 *   setRecurringAcknowledgedMap: Function, setRecurringReviewDays: Function,
 *   setStandaloneProjectId: Function,
 *   setGmailQueue: Function,
 * }} params
 * @returns {{ syncStatus: string, supabaseReady: boolean }}
 */
function useSupabaseSync({
  authUser,
  tasks, setTasks,
  locations, efforts, calibrationOverrides, categories,
  skippedCalendarIds, seenCalendarEventIds, recurringAcknowledgedMap, recurringReviewDays,
  standaloneProjectId,
  setLocations, setEfforts, setCalibrationOverrides, setCategories,
  setSkippedCalendarIds, setSeenCalendarEventIds, setRecurringAcknowledgedMap, setRecurringReviewDays,
  setStandaloneProjectId,
  setGmailQueue,
}) {
  // true once the initial Supabase read (or migration) has completed
  const [supabaseReady, setSupabaseReady] = useState(false);
  // 'synced' | 'offline'
  const [syncStatus, setSyncStatus] = useState('synced');
  // tracks previous tasks snapshot for write-sync diffing
  const prevTasksRef = useRef(null);
  // gates settings write-sync — flipped true after initial load/migration completes
  const settingsReadyRef = useRef(false);
  // debounce timer for settings upsert
  const settingsDebounceRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('gtd_tasks', JSON.stringify(tasks));
  }, [tasks]);

  // Supabase read: fetch tasks once auth resolves; auto-migrate localStorage if empty
  useEffect(() => {
    if (!authUser) return;
    supabase
      .from('tasks')
      .select('*')
      .eq('user_id', authUser.id)
      .order('created', { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          console.error('Supabase read error:', error);
          setSupabaseReady(true);
          return;
        }
        if (data && data.length > 0) {
          // Supabase has data — use it as the source of truth
          setTasks(data.map(dbToTask));
          setSupabaseReady(true);
        } else {
          // Supabase is empty — migrate from localStorage
          const local = (() => {
            try { return JSON.parse(localStorage.getItem('gtd_tasks') || '[]'); } catch { return []; }
          })();
          if (local.length > 0) {
            const rows = local.map(t => taskToDb(t, authUser.id));
            supabase.from('tasks').insert(rows).then(({ error: e2 }) => {
              if (e2) console.error('Migration failed:', e2);
              setSupabaseReady(true);
            });
          } else {
            setSupabaseReady(true);
          }
        }
      });
  }, [authUser]); // eslint-disable-line react-hooks/exhaustive-deps

  // Supabase read: fetch user_settings once auth resolves; auto-migrate localStorage if empty
  useEffect(() => {
    if (!authUser) return;
    supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', authUser.id)
      .single()
      .then(({ data, error }) => {
        // PGRST116 = no rows returned — treat as "not yet migrated"
        if (error && error.code !== 'PGRST116') {
          console.error('Settings load error:', error);
          settingsReadyRef.current = true;
          return;
        }
        if (data) {
          // Server wins — overwrite local state
          if (Array.isArray(data.locations)) setLocations([...data.locations].sort((a, b) => a.localeCompare(b)));
          if (Array.isArray(data.efforts)) setEfforts(data.efforts);
          if (Array.isArray(data.categories)) setCategories([...data.categories].sort((a, b) => a.localeCompare(b)));
          if (data.calibration_overrides && typeof data.calibration_overrides === 'object')
            setCalibrationOverrides(data.calibration_overrides);
          if (Array.isArray(data.cal_skipped_tasks)) setSkippedCalendarIds(new Set(data.cal_skipped_tasks));
          if (Array.isArray(data.cal_seen_events))   setSeenCalendarEventIds(new Set(data.cal_seen_events));
          if (Array.isArray(data.cal_recurring_acknowledged)) setRecurringAcknowledgedMap(new Map(data.cal_recurring_acknowledged));
          if (typeof data.recurring_review_days === 'number') setRecurringReviewDays(data.recurring_review_days);
          if (data.standalone_project_id) setStandaloneProjectId(data.standalone_project_id);
          settingsReadyRef.current = true;
        } else {
          // Supabase empty — migrate from localStorage
          const localLocations = (() => { try { return JSON.parse(localStorage.getItem('gtd_locations') || 'null') || ['Home', 'Work', 'Phone', 'Computer']; } catch { return ['Home', 'Work', 'Phone', 'Computer']; } })();
          const localEfforts   = (() => { try { return JSON.parse(localStorage.getItem('gtd_efforts')   || 'null') || DEFAULT_EFFORTS; } catch { return DEFAULT_EFFORTS; } })();
          const localCalib     = (() => { try { return JSON.parse(localStorage.getItem('gtd_effort_calibration') || 'null') || {}; } catch { return {}; } })();
          const localSkipped   = (() => { try { return JSON.parse(localStorage.getItem('gtd_cal_skipped') || '[]'); } catch { return []; } })();
          const localCategories = (() => { try { return JSON.parse(localStorage.getItem('gtd_categories') || 'null') || []; } catch { return []; } })();
          supabase.from('user_settings').insert({
            user_id: authUser.id,
            locations: localLocations,
            efforts: localEfforts,
            calibration_overrides: localCalib,
            categories: localCategories,
            cal_skipped_tasks: localSkipped,
            cal_seen_events: [],
          }).then(({ error: e2 }) => {
            if (e2) console.error('Settings migration failed:', e2);
            settingsReadyRef.current = true;
          });
        }
      });
  }, [authUser]); // eslint-disable-line react-hooks/exhaustive-deps

  // Supabase write: diff tasks on every change and sync inserts/updates/deletes
  useEffect(() => {
    if (!authUser || !supabaseReady) { prevTasksRef.current = tasks; return; }
    const prev = prevTasksRef.current;
    prevTasksRef.current = tasks;
    if (!prev) return;

    const prevMap = new Map(prev.map(t => [t.id, t]));
    const currMap = new Map(tasks.map(t => [t.id, t]));

    const upserts = tasks.filter(t => {
      const old = prevMap.get(t.id);
      return !old || JSON.stringify(old) !== JSON.stringify(t);
    });
    const deletes = prev.filter(t => !currMap.has(t.id));
    if (!upserts.length && !deletes.length) return;

    const queuePending = (ops) => {
      const existing = JSON.parse(localStorage.getItem('gtd_pending_writes') || '[]');
      localStorage.setItem('gtd_pending_writes', JSON.stringify([...existing, ...ops]));
      setSyncStatus('offline');
    };

    if (upserts.length) {
      supabase.from('tasks')
        .upsert(upserts.map(t => taskToDb(t, authUser.id)), { onConflict: 'id' })
        .then(({ error }) => {
          if (error) {
            console.error('Supabase upsert:', error);
            queuePending(upserts.map(t => ({ type: 'upsert', row: taskToDb(t, authUser.id) })));
          } else { setSyncStatus('synced'); }
        });
    }
    if (deletes.length) {
      supabase.from('tasks').delete()
        .in('id', deletes.map(t => t.id)).eq('user_id', authUser.id)
        .then(({ error }) => {
          if (error) {
            console.error('Supabase delete:', error);
            queuePending(deletes.map(t => ({ type: 'delete', id: t.id })));
          } else if (!upserts.length) { setSyncStatus('synced'); }
        });
    }
  }, [tasks, authUser, supabaseReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // Supabase write: debounced upsert of settings whenever locations/efforts/calibration change
  useEffect(() => {
    if (!authUser || !settingsReadyRef.current) return;
    clearTimeout(settingsDebounceRef.current);
    settingsDebounceRef.current = setTimeout(() => {
      supabase.from('user_settings')
        .upsert({
          user_id: authUser.id,
          locations,
          efforts,
          calibration_overrides: calibrationOverrides,
          categories,
          cal_skipped_tasks: [...skippedCalendarIds],
          cal_seen_events:   [...seenCalendarEventIds],
          cal_recurring_acknowledged: [...recurringAcknowledgedMap.entries()],
          recurring_review_days: recurringReviewDays,
          standalone_project_id: standaloneProjectId,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })
        .then(({ error }) => {
          if (error) console.error('Settings sync error:', error);
          else setSyncStatus('synced');
        });
    }, 1500);
    return () => clearTimeout(settingsDebounceRef.current);
  }, [locations, efforts, calibrationOverrides, categories, skippedCalendarIds, seenCalendarEventIds, recurringAcknowledgedMap, recurringReviewDays, standaloneProjectId, authUser]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fallback: keep localStorage in sync for unauthenticated sessions
  useEffect(() => {
    if (!authUser) localStorage.setItem('gtd_cal_skipped',     JSON.stringify([...skippedCalendarIds]));
  }, [skippedCalendarIds, authUser]);
  useEffect(() => {
    if (!authUser) localStorage.setItem('gtd_cal_seen_events', JSON.stringify([...seenCalendarEventIds]));
  }, [seenCalendarEventIds, authUser]);
  useEffect(() => {
    if (!authUser) localStorage.setItem('gtd_cal_recurring_ack', JSON.stringify([...recurringAcknowledgedMap.entries()]));
  }, [recurringAcknowledgedMap, authUser]);
  useEffect(() => {
    if (!authUser) localStorage.setItem('gtd_recurring_review_days', String(recurringReviewDays));
  }, [recurringReviewDays, authUser]);

  // Phase 6 — offline resilience: flush pending writes when connectivity returns
  useEffect(() => {
    const flushPending = async () => {
      const raw = localStorage.getItem('gtd_pending_writes');
      if (!raw || !authUser) return;
      const pending = JSON.parse(raw);
      if (!pending?.length) return;
      const upserts = pending.filter(p => p.type === 'upsert');
      const deletes = pending.filter(p => p.type === 'delete');
      let ok = true;
      if (upserts.length) {
        const { error } = await supabase.from('tasks')
          .upsert(upserts.map(p => p.row), { onConflict: 'id' });
        if (error) { console.error('Flush upsert failed:', error); ok = false; }
      }
      if (ok && deletes.length) {
        const { error } = await supabase.from('tasks').delete()
          .in('id', deletes.map(p => p.id)).eq('user_id', authUser.id);
        if (error) { console.error('Flush delete failed:', error); ok = false; }
      }
      if (ok) {
        localStorage.removeItem('gtd_pending_writes');
        setSyncStatus('synced');
      }
    };
    setSyncStatus(navigator.onLine ? 'synced' : 'offline');
    window.addEventListener('online', flushPending);
    window.addEventListener('offline', () => setSyncStatus('offline'));
    return () => {
      window.removeEventListener('online', flushPending);
      window.removeEventListener('offline', () => setSyncStatus('offline'));
    };
  }, [authUser]); // eslint-disable-line react-hooks/exhaustive-deps

  // Phase 7 — realtime: receive changes from other devices
  useEffect(() => {
    if (!authUser || !supabaseReady) return;
    const channel = supabase
      .channel(`tasks-${authUser.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'tasks',
        filter: `user_id=eq.${authUser.id}`,
      }, (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const incoming = dbToTask(payload.new);
          setTasks(prev => {
            const idx = prev.findIndex(t => t.id === incoming.id);
            if (idx === -1) return [incoming, ...prev];
            const next = [...prev];
            next[idx] = incoming;
            return next;
          });
        } else if (payload.eventType === 'DELETE') {
          setTasks(prev => prev.filter(t => t.id !== payload.old.id));
        }
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [authUser, supabaseReady]);

  // Load gmail_queue from Supabase on auth ready, merge with any localStorage entries
  useEffect(() => {
    if (!authUser || !supabaseReady) return;
    supabase.from('gmail_queue').select('*').eq('user_id', authUser.id).then(({ data, error }) => {
      if (error) { console.error('gmail_queue load error', error); return; }
      if (!data || data.length === 0) return;
      const fromServer = data.map(rowToQueueEntry);
      setGmailQueue(prev => {
        const serverIds = new Set(fromServer.map(e => e.id));
        const localOnly = prev.filter(e => !serverIds.has(e.id));
        return [...fromServer, ...localOnly];
      });
    });
  }, [authUser, supabaseReady]); // eslint-disable-line react-hooks/exhaustive-deps

  return { syncStatus, supabaseReady };
}

export { useSupabaseSync };
