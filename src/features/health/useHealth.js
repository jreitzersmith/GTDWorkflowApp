// src/features/health/useHealth.js
// State management hook for the Health panel (FR#187).
// CRUD for health_items (medications, supplements, appointments, documents).

import { useState, useEffect, useCallback } from 'react';
import { fetchHealthItems, upsertHealthItem, deleteHealthItem } from '../../api/supabase.js';

function genHealthId() {
  return 'h' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/**
 * @param {{ supabaseReady: boolean, userId: string|null }} opts
 */
function useHealth({ supabaseReady, userId }) {
  const [healthItems, setHealthItems]     = useState([]);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthError, setHealthError]     = useState(null);

  useEffect(() => {
    if (!supabaseReady) return;
    setHealthLoading(true);
    fetchHealthItems()
      .then(rows => setHealthItems(rows))
      .catch(err  => setHealthError(err.message))
      .finally(()  => setHealthLoading(false));
  }, [supabaseReady]);

  const addHealthItem = useCallback(async (fields) => {
    const item = {
      id:         genHealthId(),
      user_id:    userId,
      type:       fields.type || 'medication',
      name:       fields.name,
      dose:       fields.dose || null,
      frequency:  fields.frequency || null,
      status:     fields.status || 'active',
      start_date: fields.startDate || null,
      end_date:   fields.endDate || null,
      notes:      fields.notes || null,
      drive_file_id:   fields.driveFileId || null,
      drive_file_name: fields.driveFileName || null,
      appointment_date: fields.appointmentDate || null,
      provider:   fields.provider || null,
    };
    setHealthItems(prev => [item, ...prev]);
    try {
      const saved = await upsertHealthItem(item);
      setHealthItems(prev => prev.map(i => i.id === item.id ? saved : i));
      return saved.id;
    } catch (err) {
      setHealthItems(prev => prev.filter(i => i.id !== item.id));
      setHealthError(err.message);
    }
  }, [userId]);

  const updateHealthItem = useCallback(async (id, fields) => {
    const prev = healthItems.find(i => i.id === id);
    if (!prev) return;
    const updated = { ...prev, ...fields, updated_at: new Date().toISOString() };
    setHealthItems(items => items.map(i => i.id === id ? updated : i));
    try {
      await upsertHealthItem(updated);
    } catch (err) {
      setHealthItems(items => items.map(i => i.id === id ? prev : i));
      setHealthError(err.message);
    }
  }, [healthItems]);

  const removeHealthItem = useCallback(async (id) => {
    const prev = healthItems.find(i => i.id === id);
    setHealthItems(items => items.filter(i => i.id !== id));
    try {
      await deleteHealthItem(id);
    } catch (err) {
      setHealthItems(items => [prev, ...items]);
      setHealthError(err.message);
    }
  }, [healthItems]);

  return {
    healthItems, healthLoading, healthError,
    addHealthItem, updateHealthItem, removeHealthItem,
  };
}

export { useHealth };
