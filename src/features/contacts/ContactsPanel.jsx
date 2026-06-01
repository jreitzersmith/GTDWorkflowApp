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
  contactRelationshipTags,
  setContactRelationshipTags,
  contactLikesCategories,
  // FR#164: Drive attachments + FR#160: email history
  addDriveAttachment,
  removeDriveAttachment,
  googleToken,
  driveEnabled,
  // FR#173: favorites
  toggleFavorite,
  // FR#176: inbox sender indicator
  inboxSenderEmails,
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
          {/* FR#173: Favorites section */}
          {(() => {
            const favs = contacts.filter(ct => ct.isFavorite);
            if (!favs.length) return null;
            return (
              <div>
                <div style={{ padding: '6px 12px 3px', fontSize: 10, fontWeight: 600, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: '0.07em', borderBottom: `1px solid ${COLORS.border}` }}>
                  Favorites ({favs.length})
                </div>
                {favs.map(contact => (
                  <ContactRow
                    key={'fav-' + contact.id}
                    contact={contact}
                    selected={contact.id === selectedContactId}
                    onClick={() => setSelectedContactId(contact.id === selectedContactId ? null : contact.id)}
                    toggleFavorite={toggleFavorite}
                    inboxSenderEmails={inboxSenderEmails}
                  />
                ))}
                <div style={{ height: 1, background: COLORS.border, margin: '4px 0' }} />
              </div>
            );
          })()}
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
                toggleFavorite={toggleFavorite}
                inboxSenderEmails={inboxSenderEmails}
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
            contactRelationshipTags={contactRelationshipTags}
            setContactRelationshipTags={setContactRelationshipTags}
            contactLikesCategories={contactLikesCategories}
            addDriveAttachment={addDriveAttachment}
            removeDriveAttachment={removeDriveAttachment}
            googleToken={googleToken}
            driveEnabled={driveEnabled}
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

function ContactRow({ contact, selected, onClick, toggleFavorite, inboxSenderEmails }) {
  const [hovered, setHovered] = useState(false);
  const initials    = contactInitials(contact);
  const email       = contactPrimaryEmail(contact);
  const emailCount  = (contact.emailHistory || []).length;
  const openPromises = (contact.promises || []).filter(p => !p.done).length;
  const giftCount   = (contact.giftIdeas  || []).filter(g => !g.given).length;
  const linkedTasks = (contact.promises || []).filter(p => p.taskId).length;
  const lastEmail   = emailCount > 0
    ? [...(contact.emailHistory || [])].sort((a, b) => new Date(b.date) - new Date(a.date))[0]
    : null;
  const primaryEmail  = contactPrimaryEmail(contact).toLowerCase();
  const hasInboxEmail = primaryEmail && (inboxSenderEmails || new Set()).has(primaryEmail);
  const showHoverDetail = hovered && !selected && (openPromises > 0 || giftCount > 0 || linkedTasks > 0 || lastEmail);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', flexDirection: 'column', padding: '9px 12px',
        cursor: 'pointer',
        background: selected ? COLORS.surface3 : hovered ? COLORS.surface2 : 'transparent',
        borderLeft: `3px solid ${selected ? CONTACT_COLOR : 'transparent'}`,
        borderBottom: `1px solid ${COLORS.border}`,
        transition: 'background 0.1s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
        {/* Right-side badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          {emailCount > 0 && (
            <span title={`${emailCount} linked email${emailCount !== 1 ? 's' : ''}`} style={{ fontSize: 10, padding: '1px 5px', borderRadius: 8, background: '#5a8fd422', color: '#5a8fd4' }}>
              ✉ {emailCount}
            </span>
          )}
          {hasInboxEmail && (
            <span title="Email in inbox" style={{ fontSize: 9, padding: '1px 5px', borderRadius: 8, background: COLORS.inboxBg, color: COLORS.inbox, fontWeight: 500 }}>📬</span>
          )}
          <span
              onClick={e => { e.stopPropagation(); toggleFavorite && toggleFavorite(contact.id); }}
              title={contact.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              style={{ fontSize: 14, cursor: 'pointer', color: contact.isFavorite ? '#f0c040' : COLORS.text2, lineHeight: 1, userSelect: 'none', opacity: contact.isFavorite ? 1 : 0.5 }}
            >
              {contact.isFavorite ? '★' : '☆'}
            </span>
        </div>
      </div>
      {/* FR#171: hover enrichment expansion */}
      {showHoverDetail && (
        <div style={{ display: 'flex', gap: 8, marginTop: 5, paddingLeft: 44, flexWrap: 'wrap' }}>
          {openPromises > 0 && (
            <span style={{ fontSize: 10, color: COLORS.text2 }}>{openPromises} open promise{openPromises !== 1 ? 's' : ''}</span>
          )}
          {giftCount > 0 && (
            <span style={{ fontSize: 10, color: COLORS.text2 }}>{giftCount} gift idea{giftCount !== 1 ? 's' : ''}</span>
          )}
          {linkedTasks > 0 && (
            <span style={{ fontSize: 10, color: COLORS.text2 }}>{linkedTasks} linked task{linkedTasks !== 1 ? 's' : ''}</span>
          )}
          {lastEmail && (
            <span style={{ fontSize: 10, color: COLORS.muted }}>
              Last email {new Date(lastEmail.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          )}
        </div>
      )}
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
