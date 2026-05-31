import { describe, it, expect } from 'vitest';
import {
  buildNetworkOverview,
  buildPromiseHealth,
  buildPromiseCompletionRate,
  buildInteractionRecency,
  buildGiftPipeline,
} from './contactAnalyticsUtils.js';

// ── Fixture helpers ───────────────────────────────────────────────────────────

const makeContact = (overrides = {}) => ({
  id: overrides.id || 'c1',
  displayName: overrides.displayName || 'Alice',
  givenName: overrides.givenName || 'Alice',
  emails: overrides.emails || [{ value: 'alice@example.com', primary: true }],
  phones: overrides.phones || [],
  notes: overrides.notes || '',
  relationshipTags: overrides.relationshipTags || [],
  promises: overrides.promises || [],
  giftIdeas: overrides.giftIdeas || [],
  emailHistory: overrides.emailHistory || [],
  ...overrides,
});

const makePromise = (overrides = {}) => ({
  id: overrides.id || 'p1',
  text: overrides.text || 'Call back',
  direction: overrides.direction || 'made',
  done: overrides.done ?? false,
  createdDate: overrides.createdDate || new Date(Date.now() - 10 * 86400000).toISOString(), // 10 days ago
});

// ── buildNetworkOverview ──────────────────────────────────────────────────────

describe('buildNetworkOverview', () => {
  it('returns zeros for empty contacts', () => {
    const r = buildNetworkOverview([]);
    expect(r.total).toBe(0);
    expect(r.byTag).toEqual([]);
    expect(r.withNotes).toBe(0);
  });

  it('counts tags correctly across contacts', () => {
    const contacts = [
      makeContact({ id: 'c1', relationshipTags: ['Family', 'Colleague'] }),
      makeContact({ id: 'c2', relationshipTags: ['Family'] }),
      makeContact({ id: 'c3', relationshipTags: [] }),
    ];
    const r = buildNetworkOverview(contacts);
    expect(r.total).toBe(3);
    expect(r.byTag).toEqual([{ tag: 'Family', count: 2 }, { tag: 'Colleague', count: 1 }]);
  });

  it('counts enrichment coverage accurately', () => {
    const contacts = [
      makeContact({ id: 'c1', notes: 'some notes', phones: [{ value: '555-1234' }] }),
      makeContact({ id: 'c2', notes: '' }),
    ];
    const r = buildNetworkOverview(contacts);
    expect(r.withNotes).toBe(1);
    expect(r.withPhone).toBe(1);
    expect(r.withEmail).toBe(2); // both have default email
  });
});

// ── buildPromiseHealth ────────────────────────────────────────────────────────

describe('buildPromiseHealth', () => {
  it('returns zeros for contacts with no promises', () => {
    const r = buildPromiseHealth([makeContact()]);
    expect(r.totalOpen).toBe(0);
    expect(r.totalClosed).toBe(0);
    expect(r.overdueCount).toBe(0);
  });

  it('separates open and closed promises', () => {
    const contacts = [
      makeContact({
        promises: [
          makePromise({ id: 'p1', done: false }),
          makePromise({ id: 'p2', done: true }),
        ],
      }),
    ];
    const r = buildPromiseHealth(contacts);
    expect(r.totalOpen).toBe(1);
    expect(r.totalClosed).toBe(1);
  });

  it('flags promises older than threshold as overdue', () => {
    const oldDate = new Date(Date.now() - 40 * 86400000).toISOString(); // 40 days ago
    const contacts = [
      makeContact({ promises: [makePromise({ done: false, createdDate: oldDate })] }),
    ];
    const r = buildPromiseHealth(contacts, 30);
    expect(r.overdueCount).toBe(1);
  });

  it('does not flag recently created open promises as overdue', () => {
    const contacts = [
      makeContact({ promises: [makePromise({ done: false })] }), // 10 days ago
    ];
    const r = buildPromiseHealth(contacts, 30);
    expect(r.overdueCount).toBe(0);
  });
});

// ── buildPromiseCompletionRate ────────────────────────────────────────────────

describe('buildPromiseCompletionRate', () => {
  it('returns null rates when no promises exist', () => {
    const r = buildPromiseCompletionRate([makeContact()]);
    expect(r.madeRate).toBeNull();
    expect(r.receivedRate).toBeNull();
  });

  it('computes made rate correctly', () => {
    const contacts = [
      makeContact({
        promises: [
          makePromise({ direction: 'made', done: true }),
          makePromise({ direction: 'made', done: true }),
          makePromise({ direction: 'made', done: false }),
        ],
      }),
    ];
    const r = buildPromiseCompletionRate(contacts);
    expect(r.madeTotal).toBe(3);
    expect(r.madeRate).toBe(67); // Math.round(2/3*100)
  });

  it('separates made and received correctly', () => {
    const contacts = [
      makeContact({
        promises: [
          makePromise({ direction: 'made',     done: false }),
          makePromise({ direction: 'received', done: true }),
        ],
      }),
    ];
    const r = buildPromiseCompletionRate(contacts);
    expect(r.madeOpen).toBe(1);
    expect(r.madeDone).toBe(0);
    expect(r.receivedDone).toBe(1);
    expect(r.receivedOpen).toBe(0);
  });
});

// ── buildInteractionRecency ───────────────────────────────────────────────────

describe('buildInteractionRecency', () => {
  it('returns hasAnyHistory false when no contacts have email history', () => {
    const r = buildInteractionRecency([makeContact()]);
    expect(r.hasAnyHistory).toBe(false);
    expect(r.noHistory).toHaveLength(1);
  });

  it('correctly identifies at-risk contacts', () => {
    const oldDate = new Date(Date.now() - 45 * 86400000).toISOString();
    const recentDate = new Date(Date.now() - 3 * 86400000).toISOString();
    const contacts = [
      makeContact({ id: 'c1', emailHistory: [{ id: 'e1', messageId: 'm1', date: oldDate }] }),
      makeContact({ id: 'c2', emailHistory: [{ id: 'e2', messageId: 'm2', date: recentDate }] }),
    ];
    const r = buildInteractionRecency(contacts, 30);
    expect(r.atRisk).toHaveLength(1);
    expect(r.atRisk[0].contactId).toBe('c1');
    expect(r.recentlyActive).toHaveLength(1);
    expect(r.recentlyActive[0].contactId).toBe('c2');
  });

  it('counts email volume correctly', () => {
    const date = new Date().toISOString();
    const contacts = [
      makeContact({
        emailHistory: [
          { id: 'e1', messageId: 'm1', date },
          { id: 'e2', messageId: 'm2', date },
          { id: 'e3', messageId: 'm3', date },
        ],
      }),
    ];
    const r = buildInteractionRecency(contacts);
    expect(r.topByVolume[0].emailCount).toBe(3);
  });
});

// ── buildGiftPipeline ─────────────────────────────────────────────────────────

describe('buildGiftPipeline', () => {
  it('returns zeros for no gift ideas', () => {
    const r = buildGiftPipeline([makeContact()]);
    expect(r.ungivenCount).toBe(0);
    expect(r.givenTotal).toBe(0);
    expect(r.grouped).toHaveLength(0);
  });

  it('separates given and ungiven correctly', () => {
    const contacts = [
      makeContact({
        giftIdeas: [
          { id: 'g1', text: 'Book', given: false },
          { id: 'g2', text: 'Wine', given: true },
        ],
      }),
    ];
    const r = buildGiftPipeline(contacts);
    expect(r.ungivenCount).toBe(1);
    expect(r.givenTotal).toBe(1);
    expect(r.grouped).toHaveLength(1);
    expect(r.grouped[0].ideas[0].text).toBe('Book');
  });

  it('groups multiple ungiven gifts per contact', () => {
    const contacts = [
      makeContact({ id: 'c1', giftIdeas: [{ id: 'g1', text: 'A', given: false }, { id: 'g2', text: 'B', given: false }] }),
      makeContact({ id: 'c2', giftIdeas: [{ id: 'g3', text: 'C', given: false }] }),
    ];
    const r = buildGiftPipeline(contacts);
    expect(r.ungivenCount).toBe(3);
    expect(r.grouped[0].ideas).toHaveLength(2); // c1 has most — sorted first
    expect(r.grouped[1].ideas).toHaveLength(1);
  });
});
