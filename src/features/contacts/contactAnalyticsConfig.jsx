// src/features/contacts/contactAnalyticsConfig.jsx
// Mirror of ../tasks/analyticsConfig.jsx for the Contacts analytics tab (FR#165).
// Re-exports the generic SectionManager so the Configure UI is identical.

export { SectionManager } from '../tasks/analyticsConfig.jsx';

export const CONTACT_SECTION_DEFS = [
  { id: 'network_overview', label: 'Network overview' },
  { id: 'promise_health',   label: 'Promise health' },
  { id: 'promise_rate',     label: 'Promise completion rate' },
  { id: 'interaction',      label: 'Interaction recency' },
  { id: 'gift_pipeline',    label: 'Gift pipeline' },
];

const LS_KEY = 'gtd_contact_analytics_layout';

export function loadContactLayout() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

export function saveContactLayout(layout) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(layout)); } catch {}
}

export function defaultContactLayout() {
  return CONTACT_SECTION_DEFS.map(s => ({ id: s.id, visible: true, collapsed: false }));
}
