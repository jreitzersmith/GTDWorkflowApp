// src/features/contacts/contactAnalyticsUtils.js
// Pure utility functions for ContactAnalyticsView sections (FR#166–170).
// All functions are side-effect-free and testable in isolation.

// ── FR#166: Network Overview ──────────────────────────────────────────────────

export function buildNetworkOverview(contacts) {
  const total = contacts.length;

  const tagCounts = {};
  contacts.forEach(c => {
    (c.relationshipTags || []).forEach(tag => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });
  const byTag = Object.entries(tagCounts)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);

  const withNotes    = contacts.filter(c => (c.notes || '').trim()).length;
  const withPhone    = contacts.filter(c => (c.phones || []).length > 0).length;
  const withEmail    = contacts.filter(c => (c.emails || []).length > 0).length;
  const withTags     = contacts.filter(c => (c.relationshipTags || []).length > 0).length;
  const withPromises = contacts.filter(c => (c.promises || []).length > 0).length;
  const withGifts    = contacts.filter(c => (c.giftIdeas || []).length > 0).length;

  return { total, byTag, withNotes, withPhone, withEmail, withTags, withPromises, withGifts };
}

// ── FR#167: Promise Health ────────────────────────────────────────────────────

export function buildPromiseHealth(contacts, thresholdDays = 30) {
  const now = new Date();
  const allPromises = [];

  contacts.forEach(c => {
    (c.promises || []).forEach(p => {
      allPromises.push({ contactId: c.id, contactName: c.displayName || c.givenName || '', promise: p });
    });
  });

  const open   = allPromises.filter(x => !x.promise.done);
  const closed = allPromises.filter(x => x.promise.done);

  const overdue = open.filter(x => {
    const created = new Date(x.promise.createdDate);
    return (now - created) / 86400000 > thresholdDays;
  });

  const sorted = [...open].sort((a, b) => new Date(a.promise.createdDate) - new Date(b.promise.createdDate));

  const byContactMap = {};
  open.forEach(x => {
    if (!byContactMap[x.contactId]) {
      byContactMap[x.contactId] = { contactId: x.contactId, contactName: x.contactName, openCount: 0, oldest: null };
    }
    byContactMap[x.contactId].openCount++;
    const d = new Date(x.promise.createdDate);
    if (!byContactMap[x.contactId].oldest || d < byContactMap[x.contactId].oldest) {
      byContactMap[x.contactId].oldest = d;
    }
  });
  const byContact = Object.values(byContactMap).sort((a, b) => a.oldest - b.oldest);

  return {
    totalOpen:    open.length,
    totalClosed:  closed.length,
    overdueCount: overdue.length,
    openList:     sorted.slice(0, 20),
    byContact,
    thresholdDays,
  };
}

// ── FR#168: Promise Completion Rate ──────────────────────────────────────────

export function buildPromiseCompletionRate(contacts) {
  let madeDone = 0, madeOpen = 0, receivedDone = 0, receivedOpen = 0;
  const contactMade = {}, contactReceived = {};

  contacts.forEach(c => {
    (c.promises || []).forEach(p => {
      const isMade = p.direction === 'made';
      const bucket = isMade ? contactMade : contactReceived;
      if (!bucket[c.id]) bucket[c.id] = { contactId: c.id, contactName: c.displayName || c.givenName || '', open: 0, done: 0 };
      if (p.done) { bucket[c.id].done++; isMade ? madeDone++ : receivedDone++; }
      else         { bucket[c.id].open++; isMade ? madeOpen++ : receivedOpen++; }
    });
  });

  const madeTotal     = madeDone + madeOpen;
  const receivedTotal = receivedDone + receivedOpen;

  return {
    madeDone, madeOpen, madeTotal,
    receivedDone, receivedOpen, receivedTotal,
    madeRate:     madeTotal > 0     ? Math.round((madeDone / madeTotal) * 100) : null,
    receivedRate: receivedTotal > 0 ? Math.round((receivedDone / receivedTotal) * 100) : null,
    topMadeOpen:     Object.values(contactMade).filter(x => x.open > 0).sort((a, b) => b.open - a.open).slice(0, 5),
    topReceivedOpen: Object.values(contactReceived).filter(x => x.open > 0).sort((a, b) => b.open - a.open).slice(0, 5),
  };
}

// ── FR#169: Interaction Recency ───────────────────────────────────────────────

export function buildInteractionRecency(contacts, thresholdDays = 30) {
  const now = new Date();

  const withHistory = contacts.map(c => {
    const history = c.emailHistory || [];
    if (!history.length) return { contactId: c.id, contactName: c.displayName || c.givenName || '', hasHistory: false, daysSince: null, emailCount: 0, lastDate: null };
    const sorted = [...history].sort((a, b) => new Date(b.date) - new Date(a.date));
    const last   = sorted[0];
    const daysSince = Math.floor((now - new Date(last.date)) / 86400000);
    return { contactId: c.id, contactName: c.displayName || c.givenName || '', hasHistory: true, daysSince, emailCount: history.length, lastDate: last.date };
  });

  const hasAnyHistory   = withHistory.some(c => c.hasHistory);
  const atRisk          = withHistory.filter(c => c.hasHistory && c.daysSince > thresholdDays).sort((a, b) => b.daysSince - a.daysSince);
  const noHistory       = withHistory.filter(c => !c.hasHistory);
  const recentlyActive  = withHistory.filter(c => c.hasHistory && c.daysSince <= 7).sort((a, b) => a.daysSince - b.daysSince);
  const topByVolume     = withHistory.filter(c => c.hasHistory).sort((a, b) => b.emailCount - a.emailCount).slice(0, 8);

  return { hasAnyHistory, atRisk, noHistory, recentlyActive, topByVolume, thresholdDays, totalContacts: contacts.length };
}

// ── FR#170: Gift Pipeline ─────────────────────────────────────────────────────

export function buildGiftPipeline(contacts) {
  const ungiven = [];
  let givenTotal = 0;

  contacts.forEach(c => {
    (c.giftIdeas || []).forEach(g => {
      if (g.given) { givenTotal++; }
      else { ungiven.push({ contactId: c.id, contactName: c.displayName || c.givenName || '', idea: g }); }
    });
  });

  const byContactMap = {};
  ungiven.forEach(x => {
    if (!byContactMap[x.contactId]) byContactMap[x.contactId] = { contactId: x.contactId, contactName: x.contactName, ideas: [] };
    byContactMap[x.contactId].ideas.push(x.idea);
  });
  const grouped = Object.values(byContactMap).sort((a, b) => b.ideas.length - a.ideas.length);

  return { ungivenCount: ungiven.length, givenTotal, grouped, contactsWithGifts: grouped.length };
}
