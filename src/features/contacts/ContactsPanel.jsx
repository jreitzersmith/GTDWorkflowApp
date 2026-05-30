// src/features/contacts/ContactsPanel.jsx
// Main contacts tool panel — contact list with search/tag-filter on the left,
// ContactDetail on the right. Mirrors the two-column layout of CalendarManagementView.

import { useState, useMemo } from 'react';
import { COLORS } from '../../constants.jsx';
import { ContactDetail } from './ContactDetail.jsx';
import { contactInitials, contactPrimaryEmail } from './contactsUtils.js';

const CONTACT_COLOR = '#4db6ac';

function ContactsPanel({
  contacts,
  selectedContactId,
  setSelectedContactId,
  contactsLoading,
  contactsSyncing,
  contactsError,
  lastSyncedAt,
  contactsEnabled,
  syncContacts,
  updateStandardFields,
  updateCustomFields,
  addPromise,
  togglePromiseDone,
  linkPromiseToTask,
  deletePromise,
  addLike,
  deleteLike,
  addDislike,
  deleteDislike,
  addGiftIdea,
  toggleGiftGiven,
  deleteGiftIdea,
  tasks,
  createInboxTask,
  onNavigateToTask,
  markTaskDone,
  linkGiftToTask,
  mergeOrphanIntoContact,
  deleteOrphanContact,
  onOpenSettings,
}) {
  const [searchText,      setSearchText]      = useState('');
  const [activeTagFilter, setActiveTagFilter] = useState(null);

  // Collect all unique tags across all contacts for the filter chips
  const allTags = useMemo(() => {
    const tagSet = new Set();
    contacts.forEach(c => (c.relationshipTags || []).forEach(t => tagSet.add(t)));
    return [...tagSet].sort();
  }, [contacts]);

  // Filter contacts by search text and active tag
  const filteredContacts = useMemo(() => {
    const q = searchText.toLowerCase();
    return contacts.filter(c => {
      const matchesSearch = !q
        || c.displayName.toLowerCase().includes(q)
        || contactPrimaryEmail(c).toLowerCase().includes(q)
        || (c.company || '').toLowerCase().includes(q);
      const matchesTag = !activeTagFilter
        || (c.relationshipTags || []).includes(activeTagFilter);
      return matchesSearch && matchesTag;
    });
  }, [contacts, searchText, activeTagFilter]);

  const selectedContact = contacts.find(c => c.id === selectedContactId) || null;

  const lastSyncLabel = lastSyncedAt
    ? `Last synced ${new Date(lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : 'Not synced yet';

  if (!contactsEnabled) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.muted, flexDirection: 'column', gap: 12 }}>
        <span style={{ fontSize: 32 }}>👤</span>
        <div style={{ fontSize: 14, color: COLORS.text2 }}>Contacts not connected</div>
        <div style={{ fontSize: 12, color: COLORS.muted, textAlign: 'center', maxWidth: 280 }}>
          Enable Google Contacts in Settings → Google Services to sync and manage contacts.
        </div>
        <button
          onClick={onOpenSettings}
          style={{ marginTop: 4, padding: '6px 16px', background: CONTACT_COLOR + '22', color: CONTACT_COLOR, border: `1px solid ${CONTACT_COLOR}44`, borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
        >
          Open Settings
        </button>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      {/* ── Left column: contact list ── */}
      <div style={{ width: 280, flexShrink: 0, borderRight: `1px solid ${COLORS.border}`, display: 'flex', flexDirection: 'column', background: COLORS.surface }}>

        {/* Header */}
        <div style={{ padding: '12px 14px 8px', borderBottom: `1px solid ${COLORS.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>Contacts</span>
            <button
              onClick={syncContacts}
              disabled={contactsSyncing}
              title={lastSyncLabel}
              style={{
                fontSize: 11, padding: '3px 9px', borderRadius: 5, cursor: contactsSyncing ? 'default' : 'pointer',
                background: contactsSyncing ? COLORS.surface2 : CONTACT_COLOR + '22',
                color: contactsSyncing ? COLORS.muted : CONTACT_COLOR,
                border: `1px solid ${contactsSyncing ? COLORS.border : CONTACT_COLOR + '55'}`,
              }}
            >
              {contactsSyncing ? '↻ Syncing…' : '↻ Sync'}
            </button>
          </div>

          {/* Search */}
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Search contacts…"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: searchText ? '6px 28px 6px 10px' : '6px 10px',
                background: COLORS.surface2, border: `1px solid ${COLORS.border}`,
                borderRadius: 6, color: COLORS.text, fontSize: 13, outline: 'none',
              }}
            />
            {searchText && (
              <span
                onClick={() => setSearchText('')}
                title="Clear search"
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: COLORS.muted, fontSize: 12, lineHeight: 1, userSelect: 'none' }}
              >✕</span>
            )}
          </div>
        </div>

        {/* Tag filter chips */}
        {allTags.length > 0 && (
          <div style={{ padding: '6px 10px 4px', borderBottom: `1px solid ${COLORS.border}`, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            <TagChip label="All" active={!activeTagFilter} onClick={() => setActiveTagFilter(null)} />
            {allTags.map(tag => (
              <TagChip key={tag} label={tag} active={activeTagFilter === tag} onClick={() => setActiveTagFilter(activeTagFilter === tag ? null : tag)} />
            ))}
          </div>
        )}

        {/* Status / error */}
        {contactsError && (
          <div style={{ padding: '6px 12px', background: '#3a1a1a', color: '#d46060', fontSize: 12, borderBottom: `1px solid ${COLORS.border}` }}>
            {contactsError}
          </div>
        )}

        {/* Contact list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {contactsLoading && contacts.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: COLORS.muted, fontSize: 13 }}>Loading…</div>
          ) : filteredContacts.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: COLORS.muted, fontSize: 13 }}>
              {contacts.length === 0 ? 'No contacts synced yet' : 'No contacts match'}
            </div>
          ) : (
            filteredContacts.map(contact => (
              <ContactRow
                key={contact.id}
                contact={contact}
                selected={contact.id === selectedContactId}
                onClick={() => setSelectedContactId(contact.id === selectedContactId ? null : contact.id)}
              />
            ))
          )}
        </div>

        {/* Footer count */}
        <div style={{ padding: '6px 12px', borderTop: `1px solid ${COLORS.border}`, fontSize: 11, color: COLORS.muted }}>
          {filteredContacts.length} of {contacts.length} contact{contacts.length !== 1 ? 's' : ''}
          {lastSyncedAt && <span style={{ float: 'right' }}>{lastSyncLabel}</span>}
        </div>
      </div>

      {/* ── Right area: detail ── */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {selectedContact ? (
          <ContactDetail
            contact={selectedContact}
            allContactTags={allTags}
            updateStandardFields={updateStandardFields}
            updateCustomFields={updateCustomFields}
            addPromise={addPromise}
            togglePromiseDone={togglePromiseDone}
            linkPromiseToTask={linkPromiseToTask}
            deletePromise={deletePromise}
            addLike={addLike}
            deleteLike={deleteLike}
            addDislike={addDislike}
            deleteDislike={deleteDislike}
            addGiftIdea={addGiftIdea}
            toggleGiftGiven={toggleGiftGiven}
            deleteGiftIdea={deleteGiftIdea}
            tasks={tasks}
            createInboxTask={createInboxTask}
            onNavigateToTask={onNavigateToTask}
            markTaskDone={markTaskDone}
            linkGiftToTask={linkGiftToTask}
            allContacts={contacts}
            mergeOrphanIntoContact={mergeOrphanIntoContact}
            deleteOrphanContact={deleteOrphanContact}
          />
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.muted, flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 28 }}>👤</span>
            <span style={{ fontSize: 13 }}>Select a contact to view details</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ContactRow({ contact, selected, onClick }) {
  const initials = contactInitials(contact);
  const email    = contactPrimaryEmail(contact);

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
        cursor: 'pointer',
        background: selected ? COLORS.surface3 : 'transparent',
        borderLeft: `3px solid ${selected ? CONTACT_COLOR : 'transparent'}`,
        borderBottom: `1px solid ${COLORS.border}`,
      }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = COLORS.surface2; }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent'; }}
    >
      <Avatar initials={initials} photoUrl={contact.photoUrl} size={34} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: COLORS.text, fontWeight: selected ? 500 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {!contact.googleResourceName && (
            <span title="Orphaned record — no Google contact linked" style={{ color: '#d4a84a', marginRight: 4, fontSize: 11 }}>⚠</span>
          )}
          {contact.displayName || '(no name)'}
        </div>
        {email && (
          <div style={{ fontSize: 11, color: COLORS.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {email}
          </div>
        )}
        {contact.relationshipTags?.length > 0 && (
          <div style={{ display: 'flex', gap: 3, marginTop: 2, flexWrap: 'wrap' }}>
            {contact.relationshipTags.slice(0, 3).map(tag => (
              <span key={tag} style={{ fontSize: 9, padding: '1px 5px', borderRadius: 8, background: CONTACT_COLOR + '22', color: CONTACT_COLOR }}>
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Avatar({ initials, photoUrl, size }) {
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={initials}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
        onError={e => { e.target.style.display = 'none'; }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: CONTACT_COLOR + '33', color: CONTACT_COLOR,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 600,
    }}>
      {initials}
    </div>
  );
}

function TagChip({ label, active, onClick }) {
  return (
    <span
      onClick={onClick}
      style={{
        fontSize: 10, padding: '2px 7px', borderRadius: 10, cursor: 'pointer',
        background: active ? CONTACT_COLOR + '33' : COLORS.surface2,
        color: active ? CONTACT_COLOR : COLORS.text2,
        border: `1px solid ${active ? CONTACT_COLOR + '66' : COLORS.border}`,
      }}
    >
      {label}
    </span>
  );
}

export { ContactsPanel, Avatar, TagChip };
