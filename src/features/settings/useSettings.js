import { useCallback } from 'react';
import { effortToMinutes } from '../tasks/taskUtils.jsx';

/**
 * Owns all user-configurable settings mutations: locations, efforts,
 * calibration overrides, and data export/import.
 *
 * @param {{
 *   tasks: Array, setTasks: Function,
 *   locations: Array, setLocations: Function,
 *   efforts: Array, setEfforts: Function,
 *   setCalibrationOverrides: Function,
 * }} params
 */
function useSettings({
  tasks, setTasks,
  locations, setLocations,
  efforts, setEfforts,
  setCalibrationOverrides,
}) {
  // ── Locations ────────────────────────────────────────────────────────────

  const addLocation = useCallback((name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setLocations(prev => prev.includes(trimmed) ? prev : [...prev, trimmed].sort((a, b) => a.localeCompare(b)));
  }, [setLocations]);

  const renameLocation = useCallback((oldName, newName) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return;
    setLocations(prev => prev.map(l => l === oldName ? trimmed : l).sort((a, b) => a.localeCompare(b)));
    setTasks(prev => prev.map(t => ({
      ...t,
      location: (t.location || []).map(l => l === oldName ? trimmed : l),
    })));
  }, [setLocations, setTasks]);

  const removeLocation = useCallback((name, replaceName) => {
    setLocations(prev => prev.filter(l => l !== name));
    setTasks(prev => prev.map(t => {
      const loc = t.location || [];
      if (!loc.includes(name)) return t;
      const next = loc.filter(l => l !== name);
      if (replaceName && !next.includes(replaceName)) next.push(replaceName);
      return { ...t, location: next };
    }));
  }, [setLocations, setTasks]);

  // ── Efforts ──────────────────────────────────────────────────────────────

  const addEffort = useCallback((name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setEfforts(prev => {
      if (prev.includes(trimmed)) return prev;
      return [...prev, trimmed].sort((a, b) => effortToMinutes(a) - effortToMinutes(b));
    });
  }, [setEfforts]);

  const renameEffort = useCallback((oldName, newName) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return;
    setEfforts(prev => prev.map(e => e === oldName ? trimmed : e));
    setTasks(prev => prev.map(t => ({
      ...t,
      effort:       t.effort       === oldName ? trimmed : t.effort,
      actualEffort: t.actualEffort === oldName ? trimmed : t.actualEffort,
    })));
  }, [setEfforts, setTasks]);

  const removeEffort = useCallback((name) => {
    setEfforts(prev => prev.filter(e => e !== name));
    setTasks(prev => prev.map(t => ({
      ...t,
      effort:       t.effort       === name ? null : t.effort,
      actualEffort: t.actualEffort === name ? null : t.actualEffort,
    })));
  }, [setEfforts, setTasks]);

  // ── Calibration overrides ────────────────────────────────────────────────

  const setCalibrationOverride = useCallback((label, overrideLabel) => {
    setCalibrationOverrides(prev => ({ ...prev, [label]: overrideLabel || null }));
  }, [setCalibrationOverrides]);

  const clearCalibrationOverride = useCallback((label) => {
    setCalibrationOverrides(prev => {
      const next = { ...prev };
      delete next[label];
      return next;
    });
  }, [setCalibrationOverrides]);

  // ── Data I/O ─────────────────────────────────────────────────────────────

  const handleExport = useCallback(() => {
    const data = { version: 1, exportedAt: new Date().toISOString(), tasks, locations, efforts };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gtd-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [tasks, locations, efforts]);

  const handleImport = useCallback((data, mode = 'replace') => {
    if (!data || !Array.isArray(data.tasks)) {
      alert('Invalid backup file — expected a tasks array.');
      return;
    }
    if (mode === 'replace') {
      if (!window.confirm(`Replace all ${tasks.length} current tasks with ${data.tasks.length} imported tasks?`)) return;
      setTasks(data.tasks);
      if (Array.isArray(data.locations)) setLocations([...data.locations].sort((a, b) => a.localeCompare(b)));
      if (Array.isArray(data.efforts)) setEfforts(data.efforts);
    } else {
      const existingIds = new Set(tasks.map(t => t.id));
      const incoming = data.tasks.filter(t => !existingIds.has(t.id));
      if (!incoming.length) {
        alert('Nothing to merge — all tasks in this backup already exist.');
        return;
      }
      setTasks(prev => [...incoming, ...prev]);
      if (Array.isArray(data.locations))
        setLocations(prev => [...new Set([...prev, ...data.locations])].sort((a, b) => a.localeCompare(b)));
      if (Array.isArray(data.efforts))
        setEfforts(prev => { const s = new Set(prev); return [...prev, ...data.efforts.filter(e => !s.has(e))]; });
      alert(`Merged ${incoming.length} new task${incoming.length !== 1 ? 's' : ''}.`);
    }
  }, [tasks, setTasks, setLocations, setEfforts]);

  return {
    addLocation, renameLocation, removeLocation,
    addEffort, renameEffort, removeEffort,
    setCalibrationOverride, clearCalibrationOverride,
    handleExport, handleImport,
  };
}

export { useSettings };
