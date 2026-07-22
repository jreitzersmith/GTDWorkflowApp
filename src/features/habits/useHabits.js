// src/features/habits/useHabits.js
// Data hook for the Habits feature (FR#193).
//
// Responsibilities:
//   - Load all habit entries from Supabase on mount
//   - Load habits config (skill list, active skill) from user_settings
//   - Expose saveEntry to upsert an entry and update local state
//   - Expose updateConfig to patch habits config

import { useState, useEffect, useCallback } from 'react';
import {
  fetchHabitEntries,
  saveHabitEntry,
  deleteHabitEntry,
  fetchHabitsConfig,
  updateHabitsConfig,
} from '../../api/supabase.js';

/**
 * @param {{ supabaseReady: boolean }} opts
 */
function useHabits({ supabaseReady }) {
  const [entries,       setEntries]       = useState([]);
  const [habitsConfig,  setHabitsConfig]  = useState({});
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState(null);

  // ── Load on mount ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!supabaseReady) return;
    setLoading(true);
    Promise.all([fetchHabitEntries(), fetchHabitsConfig()])
      .then(([loadedEntries, loadedConfig]) => {
        setEntries(loadedEntries);
        setHabitsConfig(loadedConfig);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [supabaseReady]);

  // ── Save / update a single entry ────────────────────────────────────────────
  // options.replace = true  → delete existing entries for this (habit, date) first
  // options.editId  = uuid  → delete this specific entry before inserting (edit flow)
  const saveEntry = useCallback(async (habitId, entryDate, content, options = {}) => {
    const { replace = false, editId = null } = options;
    try {
      const saved = await saveHabitEntry({ habitId, entryDate, content, replace, editId });
      setEntries(prev => {
        let base = prev;
        if (editId) {
          base = prev.filter(e => e.id !== editId);
        } else if (replace) {
          base = prev.filter(e => !(e.habit_id === habitId && e.entry_date === entryDate));
        }
        return [saved, ...base];
      });
      return saved;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  // ── Delete a single entry ─────────────────────────────────────────────────
  const deleteEntry = useCallback(async (id) => {
    try {
      await deleteHabitEntry(id);
      setEntries(prev => prev.filter(e => e.id !== id));
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  // ── Update habits config ────────────────────────────────────────────────────
  const saveConfig = useCallback(async (patch) => {
    try {
      const merged = await updateHabitsConfig(patch);
      setHabitsConfig(merged);
      return merged;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  return {
    entries,
    habitsConfig,
    loading,
    error,
    saveEntry,
    deleteEntry,
    saveConfig,
  };
}

export { useHabits };
