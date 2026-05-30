// src/features/contacts/ContactDetail.jsx
// Detail panel for a selected contact. Editable standard fields write back to
// Google via updateStandardFields. Custom enrichment fields write to Supabase only.

import { useState, useCallback } from 'react';
import { COLORS } from '../../constants.jsx';
import { Avatar } from './ContactsPanel.jsx';
import { contactInitials, contactPrimaryEmail, makePromise, makeLike, makeGiftIdea } from './contactsUtils.js';

const CONTACT_COLOR   = '#4db6ac';
const PROMISE_MADE    = '#d4a84a';
const PROMISE_RECEIVED = '#5a8fd4';

const PRESET_TAGS = ['family', 'close friend', 'colleague', 'mentor', 'client', 'neighbor', 'acquaintance'];
const LIKE_CATEGORIES = ['Food', 'Hobbies', 'Music', 'Sport', 'Film/TV', 'Books', 'Travel', 'Other'];
const DISLIKE_CATEGORIES = ['Food', 'Hobbies', 'Music', 'Sport', 'Film/TV', 'Books', 'Travel', 'Behaviour', 'Other'];

function ContactDetail({
  contact,
  allContactTags,
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
  allContacts,
  mergeOrphanIntoContact,
  deleteOrphanContact,
  contactRelationshipTags,
  contactLikesCategories,
}) {
  const initials = contactInitials(contact);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* ── Sticky header ── */}
      <ContactHeader
        contact={contact}
        initials={initials}
        onSaveStandard={(fields) => updateStandardFields(contact.id, fields)}
      />

      {/* ── Scrollable body ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 0 24px' }}>
        {!contact.googleResourceName && (
          <OrphanBanner
            contact={contact}
            allContacts={allContacts || []}
            onMerge={(targetId) => mergeOrphanIntoContact && mergeOrphanIntoContact(contact.id, targetId)}
            onDelete={() => deleteOrphanContact && deleteOrphanContact(contact.id)}
          />
        )}
        <StandardFieldsSection
          contact={contact}
          onSave={(fields) => updateStandardFields(contact.id, fields)}
        />
        <Divider />
        <RelationshipTagsSection
          tags={contact.relationshipTags || []}
          allContactTags={allContactTags || []}
          customTags={contactRelationshipTags || []}
          onChange={(tags) => updateCustomFields(contact.id, { relationshipTags: tags })}
        />
        <Divider />
        <NotesSection
          notes={contact.notes || ''}
          onSave={(notes) => updateCustomFields(contact.id, { notes })}
        />
        <Divider />
        <LikesSection
          likes={contact.likesPreferences || []}
          onAdd={({ category, value }) => addLike(contact.id, { category, value })}
          onDelete={(id) => deleteLike(contact.id, id)}
          extraCategories={contactLikesCategories || []}
        />
        <Divider />
        <DislikesSection
          dislikes={contact.dislikes || []}
          onAdd={({ category, value }) => addDislike(contact.id, { category, value })}
          onDelete={(id) => deleteDislike(contact.id, id)}
          extraCategories={contactLikesCategories || []}
        />
        <Divider />
        <GiftIdeasSection
          gifts={contact.giftIdeas || []}
          tasks={tasks}
          onAdd={({ text }) => addGiftIdea(contact.id, { text })}
          onToggleGiven={(id) => toggleGiftGiven(contact.id, id)}
          onDelete={(id) => deleteGiftIdea(contact.id, id)}
          onLinkTask={(giftId, taskId) => linkGiftToTask && linkGiftToTask(contact.id, giftId, taskId)}
          onNavigateToTask={onNavigateToTask}
          createInboxTask={createInboxTask}
          contactDisplayName={contact.displayName}
          markTaskDone={markTaskDone}
          contactId={contact.id}
        />
        <Divider />
        <PromisesSection
          promises={contact.promises || []}
          tasks={tasks}
          onAdd={({ text, direction }) => addPromise(contact.id, { text, direction })}
          onToggleDone={(id) => {
            const p = (contact.promises || []).find(p => p.id === id);
            if (p && !p.done && p.taskId && markTaskDone) markTaskDone(p.taskId);
            togglePromiseDone(contact.id, id);
          }}
          onLinkTask={(promiseId, taskId) => linkPromiseToTask(contact.id, promiseId, taskId)}
          onDelete={(id) => deletePromise(contact.id, id)}
          createInboxTask={createInboxTask}
          contactId={contact.id}
          onNavigateToTask={onNavigateToTask}
          contactDisplayName={contact.displayName}
        />
        <ContactIdentityFooter contact={contact} />
      </div>
    </div>
  );
}

// ── Contact header ────────────────────────────────────────────────────────────

function ContactHeader({ contact, initials, onSaveStandard }) {
  const [editingName, setEditingName]    = useState(false);
  const [givenName,   setGivenName]      = useState(contact.givenName);
  const [familyName,  setFamilyName]     = useState(contact.familyName);
  const [company,     setCompany]        = useState(contact.company    || '');
  const [jobTitle,    setJobTitle]       = useState(contact.jobTitle   || '');

  // Reset local state if the contact changes (different contact selected)
  const contactId = contact.id;
  const [lastContactId, setLastContactId] = useState(contactId);
  if (contactId !== lastContactId) {
    setGivenName(contact.givenName);
    setFamilyName(contact.familyName);
    setCompany(contact.company || '');
    setJobTitle(contact.jobTitle || '');
    setLastContactId(contactId);
    setEditingName(false);
  }

  const saveNameFields = () => {
    const displayName = [givenName, familyName].filter(Boolean).join(' ');
    onSaveStandard({ givenName, familyName, displayName });
    setEditingName(false);
  };

  return (
    <div style={{ padding: '16px 20px 12px', borderBottom: `1px solid ${COLORS.border}`, display: 'flex', alignItems: 'flex-start', gap: 14, background: COLORS.surface }}>
      <Avatar initials={initials} photoUrl={contact.photoUrl} size={52} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {editingName ? (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
            <input
              autoFocus
              value={givenName}
              onChange={e => setGivenName(e.target.value)}
              placeholder="First"
              style={{ flex: 1, padding: '4px 8px', background: COLORS.surface2, border: `1px solid ${CONTACT_COLOR}`, borderRadius: 5, color: COLORS.text, fontSize: 14, outline: 'none' }}
              onKeyDown={e => { if (e.key === 'Enter') saveNameFields(); if (e.key === 'Escape') setEditingName(false); }}
            />
            <input
              value={familyName}
              onChange={e => setFamilyName(e.target.value)}
              placeholder="Last"
              style={{ flex: 1, padding: '4px 8px', background: COLORS.surface2, border: `1px solid ${CONTACT_COLOR}`, borderRadius: 5, color: COLORS.text, fontSize: 14, outline: 'none' }}
              onKeyDown={e => { if (e.key === 'Enter') saveNameFields(); if (e.key === 'Escape') setEditingName(false); }}
            />
            <button onClick={saveNameFields} style={{ padding: '4px 10px', background: CONTACT_COLOR + '22', color: CONTACT_COLOR, border: `1px solid ${CONTACT_COLOR}44`, borderRadius: 5, cursor: 'pointer', fontSize: 12 }}>Save</button>
            <button onClick={() => setEditingName(false)} style={{ padding: '4px 8px', background: 'transparent', color: COLORS.muted, border: `1px solid ${COLORS.border}`, borderRadius: 5, cursor: 'pointer', fontSize: 12 }}>✕</button>
          </div>
        ) : (
          <div
            onClick={() => setEditingName(true)}
            title="Click to edit name"
            style={{ fontSize: 17, fontWeight: 500, color: COLORS.text, cursor: 'pointer', marginBottom: 2 }}
          >
            {contact.displayName || '(no name)'} <span style={{ fontSize: 11, color: COLORS.muted }}>✎</span>
          </div>
        )}
        <InlineTextField value={company}  placeholder="Company"   onChange={setCompany}  onBlur={() => onSaveStandard({ company })}  style={{ fontSize: 12, color: COLORS.text2 }} />
        <InlineTextField value={jobTitle} placeholder="Job title"  onChange={setJobTitle} onBlur={() => onSaveStandard({ jobTitle })} style={{ fontSize: 12, color: COLORS.muted, marginTop: 1 }} />
      </div>
    </div>
  );
}

// ── Standard fields ───────────────────────────────────────────────────────────

function StandardFieldsSection({ contact, onSave }) {
  const [open, setOpen] = useState(false);

  return (
    <Section
      title="Contact Info"
      open={open}
      onToggle={() => setOpen(v => !v)}
    >
      <FieldListEditor
        label="Emails"
        items={contact.emails || []}
        fieldKey="value"
        placeholder="email address"
        onSave={emails => onSave({ emails })}
      />
      <FieldListEditor
        label="Phones"
        items={contact.phones || []}
        fieldKey="value"
        placeholder="phone number"
        onSave={phones => onSave({ phones })}
        style={{ marginTop: 10 }}
      />
      <FieldListEditor
        label="Addresses"
        items={contact.addresses || []}
        fieldKey="streetAddress"
        placeholder="street address"
        onSave={addresses => onSave({ addresses })}
        style={{ marginTop: 10 }}
      />
    </Section>
  );
}

// ── Relationship tags ─────────────────────────────────────────────────────────

function RelationshipTagsSection({ tags, allContactTags, customTags, onChange }) {
  const [newTag, setNewTag] = useState('');

  const addTag = (tag) => {
    const t = tag.trim().toLowerCase();
    if (!t || tags.includes(t)) return;
    onChange([...tags, t]);
    setNewTag('');
  };

  const removeTag = (tag) => onChange(tags.filter(t => t !== tag));

  return (
    <Section title="Relationship Tags" defaultOpen>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
        {tags.map(tag => (
          <span key={tag} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 10, background: CONTACT_COLOR + '22', color: CONTACT_COLOR, display: 'flex', alignItems: 'center', gap: 4 }}>
            {tag}
            <span onClick={() => removeTag(tag)} style={{ cursor: 'pointer', opacity: 0.7, fontSize: 10 }}>✕</span>
          </span>
        ))}
        {tags.length === 0 && <span style={{ fontSize: 12, color: COLORS.muted }}>No tags yet</span>}
      </div>
      {/* Suggestion chips: presets + any custom tags used on other contacts */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
        {[...new Set([...PRESET_TAGS, ...(customTags || []), ...allContactTags])]
          .filter(t => !tags.includes(t))
          .map(t => (
            <span key={t} onClick={() => addTag(t)} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: COLORS.surface2, color: COLORS.text2, border: `1px solid ${COLORS.border}`, cursor: 'pointer' }}>
              + {t}
            </span>
          ))
        }
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          value={newTag}
          onChange={e => setNewTag(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addTag(newTag); }}
          placeholder="Custom tag…"
          style={{ flex: 1, padding: '5px 9px', background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 5, color: COLORS.text, fontSize: 12, outline: 'none' }}
        />
        <AddButton onClick={() => addTag(newTag)} />
      </div>
    </Section>
  );
}

// ── Notes ─────────────────────────────────────────────────────────────────────

function NotesSection({ notes, onSave }) {
  const [value, setValue] = useState(notes);
  const [lastNotes, setLastNotes] = useState(notes);
  if (notes !== lastNotes) { setValue(notes); setLastNotes(notes); }

  return (
    <Section title="Notes" defaultOpen>
      <textarea
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={() => onSave(value)}
        placeholder="Notes about this person…"
        rows={4}
        style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 6, color: COLORS.text, fontSize: 13, resize: 'vertical', outline: 'none', fontFamily: 'inherit' }}
      />
    </Section>
  );
}

// ── Likes / preferences ───────────────────────────────────────────────────────

function LikesSection({ likes, onAdd, onDelete, extraCategories }) {
  const [category, setCategory] = useState('');
  const [value,    setValue]    = useState('');

  const submit = () => {
    const v = value.trim();
    if (!v) return;
    onAdd({ category: category || 'Other', value: v });
    setValue('');
  };

  return (
    <Section title="Personal Likes & Preferences">
      {likes.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 10 }}>
          {likes.map(like => (
            <div key={like.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', background: COLORS.surface2, borderRadius: 5 }}>
              {like.category && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: COLORS.surface3, color: COLORS.text2 }}>{like.category}</span>}
              <span style={{ flex: 1, fontSize: 13, color: COLORS.text }}>{like.value}</span>
              <span onClick={() => onDelete(like.id)} style={{ cursor: 'pointer', color: COLORS.muted, fontSize: 12 }}>✕</span>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6 }}>
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          style={{ padding: '5px 8px', background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 5, color: COLORS.text2, fontSize: 12, outline: 'none' }}
        >
          <option value="">Category</option>
          {[...new Set([...LIKE_CATEGORIES, ...(extraCategories || [])])].sort().map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit(); }}
          placeholder="e.g. Thai food, hiking…"
          style={{ flex: 1, padding: '5px 9px', background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 5, color: COLORS.text, fontSize: 12, outline: 'none' }}
        />
        <AddButton onClick={submit} />
      </div>
    </Section>
  );
}

// ── Dislikes & things to avoid ───────────────────────────────────────────────

function DislikesSection({ dislikes, onAdd, onDelete, extraCategories }) {
  const [category, setCategory] = useState('');
  const [value,    setValue]    = useState('');

  const submit = () => {
    const v = value.trim();
    if (!v) return;
    onAdd({ category: category || 'Other', value: v });
    setValue('');
  };

  return (
    <Section title="Dislikes & Things to Avoid">
      {dislikes.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 10 }}>
          {dislikes.map(d => (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', background: COLORS.surface2, borderRadius: 5 }}>
              {d.category && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: COLORS.surface3, color: COLORS.text2 }}>{d.category}</span>}
              <span style={{ flex: 1, fontSize: 13, color: COLORS.text }}>{d.value}</span>
              <span onClick={() => onDelete(d.id)} style={{ cursor: 'pointer', color: COLORS.muted, fontSize: 12 }}>✕</span>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6 }}>
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          style={{ padding: '5px 8px', background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 5, color: COLORS.text2, fontSize: 12, outline: 'none' }}
        >
          <option value="">Category</option>
          {[...new Set([...DISLIKE_CATEGORIES, ...(extraCategories || [])])].sort().map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit(); }}
          placeholder="e.g. spicy food, crowds…"
          style={{ flex: 1, padding: '5px 9px', background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 5, color: COLORS.text, fontSize: 12, outline: 'none' }}
        />
        <AddButton onClick={submit} />
      </div>
    </Section>
  );
}

// ── Gift ideas ────────────────────────────────────────────────────────────────

function GiftIdeasSection({ gifts, tasks, onAdd, onToggleGiven, onDelete, onLinkTask, onNavigateToTask, createInboxTask, contactDisplayName, markTaskDone, contactId }) {
  const [text, setText] = useState('');
  const [giftPicker, setGiftPicker] = useState(null); // giftId being linked

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    onAdd({ text: t });
    setText('');
  };

  return (
    <Section title="Gift Ideas">
      {gifts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 10 }}>
          {gifts.map(gift => {
            const linkedTask = gift.taskId && tasks ? tasks.find(t => t.id === gift.taskId) : null;
            return (
              <div key={gift.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', background: COLORS.surface2, borderRadius: 5 }}>
                  <input
                    type="checkbox"
                    checked={gift.given}
                    onChange={() => {
                      if (!gift.given && gift.taskId && markTaskDone) markTaskDone(gift.taskId);
                      onToggleGiven(gift.id);
                    }}
                    title="Mark as given"
                    style={{ cursor: 'pointer', accentColor: CONTACT_COLOR }}
                  />
                  <span style={{ flex: 1, fontSize: 13, color: gift.given ? COLORS.muted : COLORS.text, textDecoration: gift.given ? 'line-through' : 'none' }}>
                    {gift.text}
                  </span>
                  {gift.given && gift.givenDate && (
                    <span style={{ fontSize: 10, color: COLORS.muted }}>
                      given {new Date(gift.givenDate).toLocaleDateString()}
                    </span>
                  )}
                  {linkedTask ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      <span
                        onClick={() => onNavigateToTask && onNavigateToTask(linkedTask.id)}
                        title={linkedTask.text}
                        style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: COLORS.project + '22', color: COLORS.project, cursor: 'pointer', textDecoration: 'underline' }}
                      >
                        → {linkedTask.text.slice(0, 20)}{linkedTask.text.length > 20 ? '…' : ''}
                      </span>
                      <span
                        onClick={() => onLinkTask && onLinkTask(gift.id, null)}
                        title="Remove task link"
                        style={{ cursor: 'pointer', color: COLORS.muted, fontSize: 10, lineHeight: 1 }}
                      >✕</span>
                    </span>
                  ) : (
                    <span
                      onClick={() => setGiftPicker(gift.id)}
                      style={{ fontSize: 10, color: COLORS.muted, cursor: 'pointer', textDecoration: 'underline' }}
                    >link task</span>
                  )}
                  <span onClick={() => onDelete(gift.id)} style={{ cursor: 'pointer', color: COLORS.muted, fontSize: 12 }}>✕</span>
                </div>
                {giftPicker === gift.id && (
                  <GiftTaskPicker
                    tasks={tasks}
                    gift={gift}
                    onLink={(taskId) => { onLinkTask && onLinkTask(gift.id, taskId); setGiftPicker(null); }}
                    onClose={() => setGiftPicker(null)}
                    createInboxTask={createInboxTask}
                    contactDisplayName={contactDisplayName}
                    contactId={contactId}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit(); }}
          placeholder="Gift idea…"
          style={{ flex: 1, padding: '5px 9px', background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 5, color: COLORS.text, fontSize: 12, outline: 'none' }}
        />
        <AddButton onClick={submit} />
      </div>
    </Section>
  );
}

function GiftTaskPicker({ tasks, gift, onLink, onClose, createInboxTask, contactDisplayName, contactId }) {
  const [query, setQuery] = useState('');
  const INACTIVE_BUCKETS = new Set(['done', 'inboxHistory']);
  const activeTasks = (tasks || []).filter(t =>
    !t.done && !INACTIVE_BUCKETS.has(t.bucket) && (
      !query || t.text.toLowerCase().includes(query.toLowerCase())
    )
  ).slice(0, 12);

  const handleCreateNew = () => {
    const title = contactDisplayName ? gift.text + ' — ' + contactDisplayName : gift.text;
    const newId = createInboxTask && createInboxTask(title, { contactId });
    if (newId) onLink(newId);
  };

  return (
    <div style={{ marginTop: 4, padding: 8, background: COLORS.surface3, borderRadius: 6, border: `1px solid ${COLORS.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: COLORS.text2 }}>Link to a task</span>
        <span onClick={onClose} style={{ cursor: 'pointer', color: COLORS.muted, fontSize: 11 }}>✕</span>
      </div>
      <input
        autoFocus
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search tasks…"
        style={{ width: '100%', boxSizing: 'border-box', padding: '4px 8px', marginBottom: 6, background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 5, color: COLORS.text, fontSize: 12, outline: 'none' }}
      />
      <div style={{ maxHeight: 140, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {activeTasks.map(task => (
          <div
            key={task.id}
            onClick={() => onLink(task.id)}
            style={{ padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 12, color: COLORS.text, background: 'transparent' }}
            onMouseEnter={e => e.currentTarget.style.background = COLORS.surface2}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            {task.text}
          </div>
        ))}
        {activeTasks.length === 0 && !query && (
          <div style={{ fontSize: 12, color: COLORS.muted, padding: '4px 8px' }}>No active tasks</div>
        )}
      </div>
      <button
        onClick={handleCreateNew}
        style={{ marginTop: 6, width: '100%', padding: '5px 8px', background: CONTACT_COLOR + '22', color: CONTACT_COLOR, border: `1px solid ${CONTACT_COLOR}44`, borderRadius: 5, cursor: 'pointer', fontSize: 12 }}
      >
        + Create new Inbox task
      </button>
    </div>
  );
}

// ── Promises ──────────────────────────────────────────────────────────────────

function PromisesSection({ promises, tasks, onAdd, onToggleDone, onLinkTask, onDelete, createInboxTask, contactId, onNavigateToTask, contactDisplayName }) {
  const [text,      setText]      = useState('');
  const [direction, setDirection] = useState('made');
  const [taskPicker, setTaskPicker] = useState(null); // promiseId being linked

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    onAdd({ text: t, direction });
    setText('');
  };

  return (
    <Section title="Promises & Commitments">
      {promises.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          {promises.map(promise => (
            <PromiseRow
              key={promise.id}
              promise={promise}
              tasks={tasks}
              onToggleDone={() => onToggleDone(promise.id)}
              onDelete={() => onDelete(promise.id)}
              onLinkTask={(taskId) => { onLinkTask(promise.id, taskId); setTaskPicker(null); }}
              showPicker={taskPicker === promise.id}
              onOpenPicker={() => setTaskPicker(promise.id)}
              onClosePicker={() => setTaskPicker(null)}
              createInboxTask={createInboxTask}
              onNavigateToTask={onNavigateToTask}
              contactDisplayName={contactDisplayName}
              contactId={contactId}
            />
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6 }}>
        <select
          value={direction}
          onChange={e => setDirection(e.target.value)}
          style={{ padding: '5px 8px', background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 5, color: direction === 'made' ? PROMISE_MADE : PROMISE_RECEIVED, fontSize: 12, outline: 'none' }}
        >
          <option value="made">I promised</option>
          <option value="received">They promised</option>
        </select>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit(); }}
          placeholder="What was promised…"
          style={{ flex: 1, padding: '5px 9px', background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 5, color: COLORS.text, fontSize: 12, outline: 'none' }}
        />
        <AddButton onClick={submit} />
      </div>
    </Section>
  );
}

function PromiseRow({ promise, tasks, onToggleDone, onDelete, onLinkTask, showPicker, onOpenPicker, onClosePicker, createInboxTask, onNavigateToTask, contactDisplayName, contactId }) {
  const linkedTask = promise.taskId ? tasks.find(t => t.id === promise.taskId) : null;

  return (
    <div style={{ padding: '7px 10px', background: COLORS.surface2, borderRadius: 6, borderLeft: `3px solid ${promise.direction === 'made' ? PROMISE_MADE : PROMISE_RECEIVED}` }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <input
          type="checkbox"
          checked={promise.done}
          onChange={onToggleDone}
          style={{ marginTop: 2, cursor: 'pointer', accentColor: CONTACT_COLOR }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, color: promise.done ? COLORS.muted : COLORS.text, textDecoration: promise.done ? 'line-through' : 'none' }}>
            {promise.text}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: (promise.direction === 'made' ? PROMISE_MADE : PROMISE_RECEIVED) + '22', color: promise.direction === 'made' ? PROMISE_MADE : PROMISE_RECEIVED }}>
              {promise.direction === 'made' ? 'I promised' : 'They promised'}
            </span>
            {promise.createdDate && (
              <span style={{ fontSize: 10, color: COLORS.muted }}>
                {new Date(promise.createdDate).toLocaleDateString()}
              </span>
            )}
            {linkedTask ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <span
                  onClick={() => onNavigateToTask && onNavigateToTask(linkedTask.id)}
                  title={linkedTask.text}
                  style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: COLORS.project + '22', color: COLORS.project, cursor: 'pointer', textDecoration: 'underline' }}
                >
                  → {linkedTask.text.slice(0, 30)}{linkedTask.text.length > 30 ? '…' : ''}
                </span>
                <span
                  onClick={() => onLinkTask(null)}
                  title="Remove task link"
                  style={{ cursor: 'pointer', color: COLORS.muted, fontSize: 10, lineHeight: 1 }}
                >✕</span>
              </span>
            ) : (
              <span onClick={onOpenPicker} style={{ fontSize: 10, color: COLORS.muted, cursor: 'pointer', textDecoration: 'underline' }}>
                link task
              </span>
            )}
          </div>
        </div>
        <span onClick={onDelete} style={{ cursor: 'pointer', color: COLORS.muted, fontSize: 12, flexShrink: 0 }}>✕</span>
      </div>

      {/* Task picker dropdown */}
      {showPicker && (
        <TaskLinkPicker
          tasks={tasks}
          promise={promise}
          onLink={onLinkTask}
          onClose={onClosePicker}
          createInboxTask={createInboxTask}
          contactDisplayName={contactDisplayName}
          contactId={contactId}
        />
      )}
    </div>
  );
}

function TaskLinkPicker({ tasks, promise, onLink, onClose, createInboxTask, contactDisplayName, contactId }) {
  const [query, setQuery] = useState('');
  const INACTIVE_BUCKETS = new Set(['done', 'inboxHistory']);
  const activeTasks = tasks.filter(t =>
    !t.done && !INACTIVE_BUCKETS.has(t.bucket) && (
      !query || t.text.toLowerCase().includes(query.toLowerCase())
    )
  ).slice(0, 12);

  const handleCreateNew = () => {
    const baseText = promise.text.replace(/^to\s+/i, '');
    const title = contactDisplayName ? `${baseText} — Promised to ${contactDisplayName}` : baseText;
    const newId = createInboxTask(title, { contactId });
    if (newId) onLink(newId);
  };

  return (
    <div style={{ marginTop: 8, padding: 8, background: COLORS.surface3, borderRadius: 6, border: `1px solid ${COLORS.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: COLORS.text2 }}>Link to a task</span>
        <span onClick={onClose} style={{ cursor: 'pointer', color: COLORS.muted, fontSize: 11 }}>✕</span>
      </div>
      <input
        autoFocus
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search tasks…"
        style={{ width: '100%', boxSizing: 'border-box', padding: '4px 8px', marginBottom: 6, background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 5, color: COLORS.text, fontSize: 12, outline: 'none' }}
      />
      <div style={{ maxHeight: 140, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {activeTasks.map(task => (
          <div
            key={task.id}
            onClick={() => onLink(task.id)}
            style={{ padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 12, color: COLORS.text, background: 'transparent' }}
            onMouseEnter={e => e.currentTarget.style.background = COLORS.surface2}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            {task.text}
          </div>
        ))}
        {activeTasks.length === 0 && !query && (
          <div style={{ fontSize: 12, color: COLORS.muted, padding: '4px 8px' }}>No active tasks</div>
        )}
      </div>
      <button
        onClick={handleCreateNew}
        style={{ marginTop: 6, width: '100%', padding: '5px 8px', background: CONTACT_COLOR + '22', color: CONTACT_COLOR, border: `1px solid ${CONTACT_COLOR}44`, borderRadius: 5, cursor: 'pointer', fontSize: 12 }}
      >
        + Create new Inbox task from promise
      </button>
    </div>
  );
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function Section({ title, children, defaultOpen = false, open: controlledOpen, onToggle }) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const toggle = onToggle || (() => setInternalOpen(v => !v));

  return (
    <div style={{ padding: '0 20px' }}>
      <div
        onClick={toggle}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0 6px', cursor: 'pointer', borderBottom: `1px solid ${COLORS.border}`, marginBottom: 10 }}
      >
        <span style={{ fontSize: 11, fontWeight: 600, color: COLORS.text2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{title}</span>
        <span style={{ fontSize: 11, color: COLORS.muted }}>{isOpen ? '▾' : '▸'}</span>
      </div>
      {isOpen && <div style={{ paddingBottom: 4 }}>{children}</div>}
    </div>
  );
}

function FieldListEditor({ label, items, fieldKey, placeholder, onSave, style: extraStyle }) {
  const save = (idx, value) => {
    const updated = items.map((item, i) => i === idx ? { ...item, [fieldKey]: value } : item);
    onSave(updated);
  };
  const remove = (idx) => { onSave(items.filter((_, i) => i !== idx)); };
  const addNew = () => { onSave([...items, { [fieldKey]: '', type: 'home', primary: items.length === 0 }]); };

  return (
    <div style={extraStyle}>
      <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 4 }}>{label}</div>
      {items.map((item, idx) => (
        <div key={idx} style={{ display: 'flex', gap: 5, marginBottom: 4, alignItems: 'center' }}>
          <input
            defaultValue={item[fieldKey]}
            onBlur={e => save(idx, e.target.value)}
            placeholder={placeholder}
            style={{ flex: 1, padding: '4px 8px', background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 5, color: COLORS.text, fontSize: 12, outline: 'none' }}
          />
          <span onClick={() => remove(idx)} style={{ cursor: 'pointer', color: COLORS.muted, fontSize: 12, padding: '0 4px' }}>✕</span>
        </div>
      ))}
      <button
        onClick={addNew}
        style={{ fontSize: 11, color: COLORS.muted, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        + add {label.toLowerCase().slice(0, -1)}
      </button>
    </div>
  );
}

function InlineTextField({ value, placeholder, onChange, onBlur, style: extraStyle }) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
      style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: '2px 4px', background: 'transparent', border: 'none', borderBottom: `1px solid transparent`, color: COLORS.text2, fontSize: 13, outline: 'none', ...extraStyle }}
      onFocus={e => { e.target.style.borderBottomColor = CONTACT_COLOR; }}
      onBlurCapture={e => { e.target.style.borderBottomColor = 'transparent'; }}
    />
  );
}

function AddButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      style={{ padding: '5px 12px', background: CONTACT_COLOR + '22', color: CONTACT_COLOR, border: `1px solid ${CONTACT_COLOR}44`, borderRadius: 5, cursor: 'pointer', fontSize: 12, flexShrink: 0 }}
    >
      Add
    </button>
  );
}

function OrphanBanner({ contact, allContacts, onMerge, onDelete }) {
  const [targetId, setTargetId] = useState('');
  const candidates = allContacts.filter(c => c.id !== contact.id && c.googleResourceName);

  const hasEnrichment = (
    (contact.relationshipTags || []).length > 0 ||
    (contact.notes || '').trim() !== '' ||
    (contact.likesPreferences || []).length > 0 ||
    (contact.giftIdeas || []).length > 0 ||
    (contact.promises || []).length > 0
  );

  return (
    <div style={{ margin: '12px 20px', padding: '10px 14px', borderRadius: 8, background: '#d4a84a22', border: '1px solid #d4a84a66' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#d4a84a', marginBottom: 6 }}>
        Orphaned record — no Google contact linked
      </div>
      <div style={{ fontSize: 12, color: COLORS.text2, marginBottom: hasEnrichment ? 10 : 0 }}>
        {hasEnrichment
          ? 'This record has enrichment data (tags, notes, gifts, or promises) but no Google contact. Merge it into a real contact or delete it.'
          : 'This record is blank — it can be safely deleted.'}
      </div>
      {hasEnrichment && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
          <select
            value={targetId}
            onChange={e => setTargetId(e.target.value)}
            style={{ flex: 1, minWidth: 140, padding: '4px 8px', background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 5, color: COLORS.text, fontSize: 12, outline: 'none' }}
          >
            <option value="">Merge into…</option>
            {candidates.map(c => (
              <option key={c.id} value={c.id}>{c.displayName || c.givenName || c.id.slice(0, 8)}</option>
            ))}
          </select>
          <button
            onClick={() => targetId && onMerge(targetId)}
            disabled={!targetId}
            style={{ padding: '4px 12px', borderRadius: 5, border: '1px solid #d4a84a66', background: '#d4a84a22', color: '#d4a84a', fontSize: 12, cursor: targetId ? 'pointer' : 'default', opacity: targetId ? 1 : 0.5 }}
          >
            Merge
          </button>
        </div>
      )}
      <button
        onClick={onDelete}
        style={{ padding: '4px 12px', borderRadius: 5, border: `1px solid ${COLORS.border}`, background: 'transparent', color: COLORS.muted, fontSize: 12, cursor: 'pointer' }}
      >
        Delete orphan
      </button>
    </div>
  );
}

function ContactIdentityFooter({ contact }) {
  const shortId = contact.id ? contact.id.slice(0, 8) + '...' : '—';
  const resourceName = contact.googleResourceName || null;
  return (
    <div style={{ padding: '16px 20px 8px', borderTop: `1px solid ${COLORS.border}`, marginTop: 12 }}>
      <div style={{ fontSize: 10, color: COLORS.muted, lineHeight: 1.6, fontFamily: 'monospace' }}>
        <span style={{ color: COLORS.text2, fontFamily: 'inherit' }}>ID: </span>{contact.id || '—'}
      </div>
      {resourceName && (
        <div style={{ fontSize: 10, color: COLORS.muted, lineHeight: 1.6, fontFamily: 'monospace' }}>
          <span style={{ color: COLORS.text2, fontFamily: 'inherit' }}>Google: </span>{resourceName}
        </div>
      )}
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: COLORS.border, margin: '6px 20px' }} />;
}

export { ContactDetail };
