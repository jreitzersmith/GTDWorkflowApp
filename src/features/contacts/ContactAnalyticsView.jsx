// src/features/contacts/ContactAnalyticsView.jsx
// Contact analytics tab — parallel of TaskAnalyticsView (FR#165–170).

import PropTypes from 'prop-types';
import { useState } from 'react';
import { COLORS } from '../../constants.jsx';
import {
  CONTACT_SECTION_DEFS, SectionManager,
  loadContactLayout, saveContactLayout, defaultContactLayout,
} from './contactAnalyticsConfig.jsx';
import {
  buildNetworkOverview, buildPromiseHealth, buildPromiseCompletionRate,
  buildInteractionRecency, buildGiftPipeline,
} from './contactAnalyticsUtils.js';

const CONTACT_COLOR   = '#4db6ac';
const PROMISE_MADE    = '#d4a84a';
const PROMISE_RECEIVED = '#5a8fd4';

// ── Shared card ───────────────────────────────────────────────────────────────

function SectionCard({ title, children, collapsed, onToggleCollapse }) {
  return (
    <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '16px 20px', marginBottom: 16 }}>
      <div
        onClick={onToggleCollapse}
        style={{ fontSize: 12, fontWeight: 600, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: collapsed ? 0 : 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
      >
        <span>{title}</span>
        <span style={{ fontSize: 10 }}>{collapsed ? '▶' : '▼'}</span>
      </div>
      {!collapsed && children}
    </div>
  );
}

SectionCard.propTypes = {
  title: PropTypes.string.isRequired, children: PropTypes.node.isRequired,
  collapsed: PropTypes.bool, onToggleCollapse: PropTypes.func.isRequired,
};

// ── Stat chip row ─────────────────────────────────────────────────────────────

function StatChips({ chips }) {
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
      {chips.map(({ label, value, color }) => (
        <div key={label} style={{ flex: '1 1 100px', textAlign: 'center', background: COLORS.surface2, borderRadius: 6, padding: '10px 8px' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: color || COLORS.text }}>{value}</div>
          <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>{label}</div>
        </div>
      ))}
    </div>
  );
}

// ── Horizontal bar chart (reusable) ──────────────────────────────────────────

function HBarChart({ rows, color = CONTACT_COLOR }) {
  const max = Math.max(1, ...rows.map(r => r.count));
  return (
    <div>
      {rows.map(r => (
        <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div style={{ width: 120, fontSize: 12, color: COLORS.text2, textAlign: 'right', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</div>
          <div style={{ flex: 1, height: 14, background: COLORS.surface2, borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: Math.round((r.count / max) * 100) + '%', height: '100%', background: color, borderRadius: 3, transition: 'width 0.3s' }} />
          </div>
          <div style={{ width: 28, fontSize: 12, color: COLORS.text, fontWeight: 500, textAlign: 'right', flexShrink: 0 }}>{r.count}</div>
        </div>
      ))}
    </div>
  );
}

// ── FR#166: Network Overview ──────────────────────────────────────────────────

function NetworkOverviewSection({ contacts }) {
  const d = buildNetworkOverview(contacts);
  if (d.total === 0) return <div style={{ fontSize: 13, color: COLORS.muted }}>No contacts yet.</div>;
  const pct = (n) => d.total > 0 ? Math.round((n / d.total) * 100) + '%' : '—';
  return (
    <div>
      <StatChips chips={[
        { label: 'contacts',   value: d.total },
        { label: 'have notes', value: pct(d.withNotes) },
        { label: 'have tags',  value: pct(d.withTags) },
        { label: 'have phone', value: pct(d.withPhone) },
      ]} />
      {d.byTag.length > 0 ? (
        <HBarChart rows={d.byTag.slice(0, 10).map(t => ({ label: t.tag, count: t.count }))} />
      ) : (
        <div style={{ fontSize: 12, color: COLORS.muted }}>No relationship tags assigned yet.</div>
      )}
      {d.byTag.length > 10 && <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 6 }}>+{d.byTag.length - 10} more tags</div>}
    </div>
  );
}

// ── FR#167: Promise Health ────────────────────────────────────────────────────

function PromiseHealthSection({ contacts, onNavigate }) {
  const [threshold, setThreshold] = useState(30);
  const d = buildPromiseHealth(contacts, threshold);
  return (
    <div>
      <StatChips chips={[
        { label: 'open promises',  value: d.totalOpen },
        { label: `overdue (>${threshold}d)`, value: d.overdueCount, color: d.overdueCount > 0 ? '#e57373' : COLORS.muted },
        { label: 'closed',         value: d.totalClosed, color: '#4caf50' },
      ]} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, fontSize: 13, color: COLORS.text2 }}>
        Flagging promises older than
        <input
          type="number" min={7} max={365} value={threshold}
          onChange={e => setThreshold(Math.max(7, Math.min(365, parseInt(e.target.value) || 30)))}
          style={{ width: 52, fontSize: 13, padding: '2px 6px', borderRadius: 4, border: `1px solid ${COLORS.border}`, background: COLORS.surface2, color: COLORS.text, textAlign: 'center' }}
        />
        days as overdue
      </div>
      {d.totalOpen === 0 ? (
        <div style={{ fontSize: 13, color: '#4caf50' }}>No open promises.</div>
      ) : (
        d.byContact.slice(0, 8).map(entry => (
          <div key={entry.contactId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', borderBottom: `0.5px solid ${COLORS.border}` }}>
            <span
              onClick={() => onNavigate && onNavigate(entry.contactId)}
              style={{ flex: 1, fontSize: 13, color: COLORS.next, cursor: onNavigate ? 'pointer' : 'default', textDecoration: onNavigate ? 'underline' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >{entry.contactName}</span>
            <span style={{ fontSize: 11, padding: '1px 8px', borderRadius: 10, background: COLORS.surface2, color: COLORS.text2, flexShrink: 0 }}>{entry.openCount} open</span>
            <span style={{ fontSize: 11, color: COLORS.muted, flexShrink: 0 }}>{Math.round((new Date() - entry.oldest) / 86400000)}d</span>
          </div>
        ))
      )}
      {d.byContact.length > 8 && <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 6 }}>+{d.byContact.length - 8} more</div>}
    </div>
  );
}

// ── FR#168: Promise Completion Rate ──────────────────────────────────────────

function RateBar({ label, color, done, total, rate }) {
  if (total === 0) return null;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: 2, background: color, flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.text2 }}>{label}</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: COLORS.text }}>{done} of {total} done</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: rate >= 80 ? '#4caf50' : rate >= 50 ? COLORS.text : '#e57373', width: 38, textAlign: 'right' }}>{rate}%</span>
      </div>
      <div style={{ height: 14, borderRadius: 4, overflow: 'hidden', background: COLORS.surface2, display: 'flex' }}>
        <div style={{ width: rate + '%', background: '#4caf50', transition: 'width 0.3s' }} />
      </div>
    </div>
  );
}

function ContactList({ items, badge, color, onNavigate }) {
  if (!items.length) return null;
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 11, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, fontWeight: 600 }}>{badge}</div>
      {items.map(x => (
        <div key={x.contactId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0', borderBottom: `0.5px solid ${COLORS.border}` }}>
          <span onClick={() => onNavigate && onNavigate(x.contactId)} style={{ flex: 1, fontSize: 13, color: COLORS.next, cursor: onNavigate ? 'pointer' : 'default', textDecoration: onNavigate ? 'underline' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.contactName}</span>
          <span style={{ fontSize: 11, padding: '1px 8px', borderRadius: 10, background: color + '22', color, border: `1px solid ${color}44`, flexShrink: 0 }}>{x.open} open</span>
        </div>
      ))}
    </div>
  );
}

function PromiseRateSection({ contacts, onNavigate }) {
  const d = buildPromiseCompletionRate(contacts);
  if (d.madeTotal === 0 && d.receivedTotal === 0) {
    return <div style={{ fontSize: 13, color: COLORS.muted }}>No promises recorded yet.</div>;
  }
  return (
    <div>
      <RateBar label="Made (you committed)" color={PROMISE_MADE} done={d.madeDone} total={d.madeTotal} rate={d.madeRate ?? 0} />
      <RateBar label="Received (they committed)" color={PROMISE_RECEIVED} done={d.receivedDone} total={d.receivedTotal} rate={d.receivedRate ?? 0} />
      <ContactList items={d.topMadeOpen} badge="You owe" color={PROMISE_MADE} onNavigate={onNavigate} />
      <ContactList items={d.topReceivedOpen} badge="They owe you" color={PROMISE_RECEIVED} onNavigate={onNavigate} />
    </div>
  );
}

// ── FR#169: Interaction Recency ───────────────────────────────────────────────

function InteractionRecencySection({ contacts, onNavigate }) {
  const [threshold, setThreshold] = useState(30);
  const d = buildInteractionRecency(contacts, threshold);

  if (!d.hasAnyHistory) {
    return (
      <div style={{ fontSize: 13, color: COLORS.muted, lineHeight: 1.6 }}>
        No email interactions recorded yet. Email history will appear here once contacts are linked to emails — see the email linking settings in Settings &gt; Contacts.
      </div>
    );
  }

  return (
    <div>
      <StatChips chips={[
        { label: 'active (7d)',    value: d.recentlyActive.length, color: '#4caf50' },
        { label: `at risk (>${threshold}d)`, value: d.atRisk.length, color: d.atRisk.length > 0 ? '#e57373' : COLORS.muted },
        { label: 'no history',    value: d.noHistory.length },
      ]} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, fontSize: 13, color: COLORS.text2 }}>
        Flagging contacts not reached in
        <input
          type="number" min={7} max={365} value={threshold}
          onChange={e => setThreshold(Math.max(7, Math.min(365, parseInt(e.target.value) || 30)))}
          style={{ width: 52, fontSize: 13, padding: '2px 6px', borderRadius: 4, border: `1px solid ${COLORS.border}`, background: COLORS.surface2, color: COLORS.text, textAlign: 'center' }}
        />
        days
      </div>
      {d.atRisk.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, fontWeight: 600 }}>At risk</div>
          {d.atRisk.slice(0, 8).map(c => (
            <div key={c.contactId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', borderBottom: `0.5px solid ${COLORS.border}` }}>
              <span onClick={() => onNavigate && onNavigate(c.contactId)} style={{ flex: 1, fontSize: 13, color: COLORS.next, cursor: onNavigate ? 'pointer' : 'default', textDecoration: onNavigate ? 'underline' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.contactName}</span>
              <span style={{ fontSize: 11, color: COLORS.muted, flexShrink: 0 }}>{c.daysSince}d ago</span>
              <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: COLORS.surface2, color: COLORS.text2, flexShrink: 0 }}>{c.emailCount} emails</span>
            </div>
          ))}
          {d.atRisk.length > 8 && <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 6 }}>+{d.atRisk.length - 8} more</div>}
        </div>
      )}
      {d.topByVolume.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, fontWeight: 600 }}>Most contacted</div>
          <HBarChart rows={d.topByVolume.map(c => ({ label: c.contactName, count: c.emailCount }))} color={CONTACT_COLOR} />
        </div>
      )}
    </div>
  );
}

// ── FR#170: Gift Pipeline ─────────────────────────────────────────────────────

function GiftPipelineSection({ contacts, onNavigate }) {
  const d = buildGiftPipeline(contacts);

  if (d.ungivenCount === 0 && d.givenTotal === 0) {
    return <div style={{ fontSize: 13, color: COLORS.muted }}>No gift ideas recorded yet.</div>;
  }
  if (d.ungivenCount === 0) {
    return <div style={{ fontSize: 13, color: '#4caf50' }}>All {d.givenTotal} gift idea{d.givenTotal !== 1 ? 's' : ''} have been given.</div>;
  }

  return (
    <div>
      <StatChips chips={[
        { label: 'ungiven ideas',    value: d.ungivenCount },
        { label: 'contacts',         value: d.contactsWithGifts },
        { label: 'given (all time)', value: d.givenTotal, color: '#4caf50' },
      ]} />
      {d.grouped.slice(0, 10).map((entry, idx) => (
        <div key={entry.contactId} style={{ paddingBottom: 10, marginBottom: 10, borderBottom: idx < d.grouped.length - 1 ? `1px solid ${COLORS.border}` : 'none' }}>
          <div
            onClick={() => onNavigate && onNavigate(entry.contactId)}
            style={{ fontSize: 13, fontWeight: 600, color: COLORS.next, cursor: onNavigate ? 'pointer' : 'default', textDecoration: onNavigate ? 'underline' : 'none', marginBottom: 5 }}
          >
            {entry.contactName}
          </div>
          {entry.ideas.slice(0, 3).map(idea => (
            <div key={idea.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0 3px 12px' }}>
              <span style={{ flex: 1, fontSize: 12, color: COLORS.text }}>{idea.text}</span>
              {idea.addedDate && <span style={{ fontSize: 10, color: COLORS.muted, flexShrink: 0 }}>Added {new Date(idea.addedDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
            </div>
          ))}
          {entry.ideas.length > 3 && <div style={{ fontSize: 11, color: COLORS.muted, paddingLeft: 12 }}>+{entry.ideas.length - 3} more</div>}
        </div>
      ))}
      {d.grouped.length > 10 && <div style={{ fontSize: 11, color: COLORS.muted }}>+{d.grouped.length - 10} more contacts</div>}
    </div>
  );
}

// ── Main export: ContactAnalyticsView ─────────────────────────────────────────

function ContactAnalyticsView({ contacts, onNavigateToContact }) {
  const [configOpen, setConfigOpen] = useState(false);
  const [layout, setLayout] = useState(() => {
    const saved = loadContactLayout();
    if (!saved) return defaultContactLayout();
    const savedIds = new Set(saved.map(s => s.id));
    const merged = [...saved];
    CONTACT_SECTION_DEFS.forEach(def => { if (!savedIds.has(def.id)) merged.push({ id: def.id, visible: true, collapsed: false }); });
    return merged;
  });

  function handleLayoutChange(next) { setLayout(next); saveContactLayout(next); }
  function toggleCollapse(id) { handleLayoutChange(layout.map(s => s.id === id ? { ...s, collapsed: !s.collapsed } : s)); }

  const enrichedCount = (contacts || []).filter(c =>
    (c.notes || '').trim() || (c.promises || []).length || (c.giftIdeas || []).length || (c.relationshipTags || []).length
  ).length;

  const sectionContents = {
    network_overview: { title: 'Network overview',          node: <NetworkOverviewSection contacts={contacts || []} /> },
    promise_health:   { title: 'Promise health',            node: <PromiseHealthSection contacts={contacts || []} onNavigate={onNavigateToContact} /> },
    promise_rate:     { title: 'Promise completion rate',   node: <PromiseRateSection contacts={contacts || []} onNavigate={onNavigateToContact} /> },
    interaction:      { title: 'Interaction recency',       node: <InteractionRecencySection contacts={contacts || []} onNavigate={onNavigateToContact} /> },
    gift_pipeline:    { title: 'Gift pipeline',             node: <GiftPipelineSection contacts={contacts || []} onNavigate={onNavigateToContact} /> },
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', background: COLORS.bg }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 600, color: COLORS.text, marginBottom: 4 }}>Contact Analytics</div>
            <div style={{ fontSize: 13, color: COLORS.muted }}>
              {(contacts || []).length} contact{(contacts || []).length !== 1 ? 's' : ''} · {enrichedCount} with enrichment data
            </div>
          </div>
          <button
            onClick={() => setConfigOpen(o => !o)}
            style={{ fontSize: 12, padding: '4px 10px', background: configOpen ? COLORS.surface2 : 'none', border: `1px solid ${COLORS.border}`, borderRadius: 6, color: COLORS.text2, cursor: 'pointer', marginTop: 2, flexShrink: 0 }}
          >
            {configOpen ? 'Done' : 'Configure'}
          </button>
        </div>
        {configOpen && <SectionManager layout={layout} onChange={handleLayoutChange} sectionDefs={CONTACT_SECTION_DEFS} />}
        {layout.filter(s => s.visible).map(s => {
          const sec = sectionContents[s.id];
          if (!sec) return null;
          return (
            <SectionCard key={s.id} title={sec.title} collapsed={s.collapsed} onToggleCollapse={() => toggleCollapse(s.id)}>
              {sec.node}
            </SectionCard>
          );
        })}
      </div>
    </div>
  );
}

ContactAnalyticsView.propTypes = {
  contacts:            PropTypes.array.isRequired,
  onNavigateToContact: PropTypes.func,
};

export { ContactAnalyticsView };
