// src/features/contacts/useContacts.js
// State management hook for the Contacts feature (FR#132).
//
// Responsibilities:
//   - Load contacts from Supabase on mount (fast, offline-capable)
//   - Sync from Google Contacts in the background (when contactsEnabled)
//   - Write standard field changes back to Google + Supabase (two-way)
//   - Write custom field changes to Supabase only
//   - Promise → GTD task linking

import { useState, useEffect, useCallback, useRef } from 'react';
import { listAllGoogleContacts, updateGoogleContact } from '../../api/contactsApi.js';
import {
  fetchContacts,
  upsertContact,
  updateContactCustomFields,
  updateContactStandardFields,
  deleteContact,
} from '../../api/supabase.js';
import {
  googlePersonToContact,
  contactToGooglePatch,
  contactToDb,
  dbToContact,
  makePromise,
  makeLike,
  makeGiftIdea,
} from './contactsUtils.js';

/**
 * @param {object} opts
 * @param {string|null}  opts.googleToken
 * @param {boolean}      opts.contactsEnabled
 * @param {boolean}      opts.supabaseReady
 * @param {function}     opts.refreshGoogleToken
 * @param {function|null} opts.createTask  - creates a task, returns new task id
 */
function useContacts({ googleToken, contactsEnabled, supabaseReady, refreshGoogleToken, userId, createTask }) {
  const [contacts,         setContacts]         = useState([]);
  const [selectedContactId, setSelectedContactId] = useState(null);
  const [contactsLoading,  setContactsLoading]  = useState(false);
  const [contactsSyncing,  setContactsSyncing]  = useState(false);
  const [contactsError,    setContactsError]    = useState(null);
  const [lastSyncedAt,     setLastSyncedAt]     = useState(null);

  // Guard against running two syncs simultaneously
  const syncInProgressRef = useRef(false);

  // ── Load from Supabase on mount ─────────────────────────────────────────────
  useEffect(() => {
    if (!supabaseReady) return;
    setContactsLoading(true);
    fetchContacts()
      .then(rows => setContacts(rows.map(dbToContact)))
      .catch(err  => setContactsError(err.message))
      .finally(()  => setContactsLoading(false));
  }, [supabaseReady]);

  // ── Auto-sync from Google when token + contacts scope become available ──────
  useEffect(() => {
    if (!googleToken || !contactsEnabled || !supabaseReady || !userId) return;
    syncContacts();
  }, [googleToken, contactsEnabled, supabaseReady, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync ────────────────────────────────────────────────────────────────────

  /**
   * Fetch all contacts from Google, upsert standard fields to Supabase,
   * then merge back into state (preserving custom field values from Supabase).
   */
  const syncContacts = useCallback(async () => {
    if (!googleToken || !contactsEnabled || !userId || syncInProgressRef.current) return;
    syncInProgressRef.current = true;
    setContactsSyncing(true);
    setContactsError(null);

    try {
      let token = googleToken;
      let persons = await listAllGoogleContacts(token);

      if (persons?.needsReauth) {
        token = await refreshGoogleToken();
        if (!token) throw new Error('Google session expired — please reconnect.');
        persons = await listAllGoogleContacts(token);
        if (persons?.needsReauth) throw new Error('Google session expired — please reconnect.');
      }

      // Upsert each Google contact (standard fields only) and collect updated rows
      const upserted = await Promise.all(
        persons.map(async person => {
          const contact = googlePersonToContact(person);
          // Only sync standard Google fields — never overwrite custom enrichment
          // (relationship_tags, notes, etc.). Omitting those columns from the
          // payload means ON CONFLICT DO UPDATE SET will not touch them.
          const standardRow = {
            user_id:              userId,
            google_resource_name: contact.googleResourceName,
            google_etag:          contact.googleEtag,
            display_name:         contact.displayName,
            given_name:           contact.givenName,
            family_name:          contact.familyName,
            emails:               contact.emails,
            phones:               contact.phones,
            addresses:            contact.addresses,
            company:              contact.company,
            job_title:            contact.jobTitle,
            photo_url:            contact.photoUrl,
          };
          const saved = await upsertContact(standardRow);
          return dbToContact(saved);
        })
      );

      // Reload everything from Supabase to get the merged custom fields
      const allRows = await fetchContacts();
      const allContacts = allRows.map(dbToContact);

      // Auto-sweep: delete rows that have no Google resource name AND no enrichment
      // (fully blank orphans that accumulated from previous sync issues)
      const syncedResourceNames = new Set(persons.map(p => p.resourceName).filter(Boolean));
      const emptyOrphans = allContacts.filter(c =>
        !c.googleResourceName &&
        c.relationshipTags.length === 0 &&
        !c.notes.trim() &&
        c.likesPreferences.length === 0 &&
        c.giftIdeas.length === 0 &&
        c.promises.length === 0
      );
      await Promise.all(emptyOrphans.map(c => deleteContact(c.id).catch(() => null)));

      const survivingIds = new Set(emptyOrphans.map(c => c.id));
      setContacts(allContacts.filter(c => !survivingIds.has(c.id)));
      setLastSyncedAt(new Date().toISOString());
    } catch (err) {
      setContactsError(err.message);
    } finally {
      setContactsSyncing(false);
      syncInProgressRef.current = false;
    }
  }, [googleToken, contactsEnabled, refreshGoogleToken, userId]);

  // ── Standard field updates (two-way) ────────────────────────────────────────

  /**
   * Update a contact's standard fields.
   * Optimistically updates state, PATCHes Google, then syncs result to Supabase.
   * Reverts state on error.
   *
   * @param {string} contactId  - internal UUID
   * @param {object} fields     - partial contact shape (standard fields only)
   */
  const updateStandardFields = useCallback(async (contactId, fields) => {
    const prev = contacts.find(c => c.id === contactId);
    if (!prev) return;

    // Optimistic update
    const updated = { ...prev, ...fields };
    setContacts(cs => cs.map(c => c.id === contactId ? updated : c));

    try {
      // Write to Google if connected
      if (googleToken && contactsEnabled && prev.googleResourceName) {
        const { payload, fieldMask } = contactToGooglePatch(fields);
        if (fieldMask.length > 0) {
          let token = googleToken;
          let result = await updateGoogleContact(token, prev.googleResourceName, prev.googleEtag, payload, fieldMask);

          if (result?.needsReauth) {
            token = await refreshGoogleToken();
            if (token) result = await updateGoogleContact(token, prev.googleResourceName, prev.googleEtag, payload, fieldMask);
          }

          if (result && !result.needsReauth) {
            // Update our stored etag with the one returned by Google
            const newEtag = result.etag || prev.googleEtag;
            fields = { ...fields, googleEtag: newEtag };
          }
        }
      }

      // Persist to Supabase
      const { googleEtag: etag, ...stdFields } = fields;
      const dbFields = contactToDb({ ...fields, ...(etag ? { googleEtag: etag } : {}) });
      await updateContactStandardFields(contactId, dbFields);

      // Refresh etag in state
      if (fields.googleEtag) {
        setContacts(cs => cs.map(c => c.id === contactId ? { ...c, googleEtag: fields.googleEtag } : c));
      }
    } catch (err) {
      if (err.message === 'CONTACT_CONFLICT') {
        // etag conflict — re-fetch this contact from Google and update
        setContactsError('Contact was modified externally — refreshing…');
        await syncContacts();
      } else {
        // Revert optimistic update
        setContacts(cs => cs.map(c => c.id === contactId ? prev : c));
        setContactsError(err.message);
      }
    }
  }, [contacts, googleToken, contactsEnabled, refreshGoogleToken, syncContacts]);

  // ── Custom field updates (Supabase only) ────────────────────────────────────

  /**
   * Update a contact's custom enrichment fields.
   * Optimistically updates state, persists to Supabase.
   *
   * @param {string} contactId
   * @param {object} fields - subset of: relationshipTags, notes, likesPreferences,
   *                          giftIdeas, promises
   */
  const updateCustomFields = useCallback(async (contactId, fields) => {
    const prev = contacts.find(c => c.id === contactId);
    if (!prev) return;

    // Optimistic update
    setContacts(cs => cs.map(c => c.id === contactId ? { ...c, ...fields } : c));

    try {
      const dbFields = contactToDb(fields);
      await updateContactCustomFields(contactId, dbFields);
    } catch (err) {
      // Revert
      setContacts(cs => cs.map(c => c.id === contactId ? prev : c));
      setContactsError(err.message);
      throw err; // re-throw so callers can abort dependent operations
    }
  }, [contacts]);

  // ── Promise helpers ──────────────────────────────────────────────────────────

  const addPromise = useCallback((contactId, { text, direction }) => {
    const contact = contacts.find(c => c.id === contactId);
    if (!contact) return;
    const newPromise = makePromise({ text, direction });
    // FR#134: "they promised" → auto-create a Waiting For task linked to this promise
    if (direction === 'received' && createTask) {
      const contactName = contact.displayName || contact.givenName || 'Contact';
      const taskTitle = text + ' — ' + contactName;
      const taskId = createTask(taskTitle, { isWaitingFor: true });
      if (taskId) newPromise.taskId = taskId;
    }
    const promises   = [...(contact.promises || []), newPromise];
    return updateCustomFields(contactId, { promises });
  }, [contacts, updateCustomFields, createTask]);

  const togglePromiseDone = useCallback((contactId, promiseId) => {
    const contact = contacts.find(c => c.id === contactId);
    if (!contact) return;
    const promises = contact.promises.map(p =>
      p.id === promiseId ? { ...p, done: !p.done } : p
    );
    return updateCustomFields(contactId, { promises });
  }, [contacts, updateCustomFields]);

  const linkPromiseToTask = useCallback((contactId, promiseId, taskId) => {
    const contact = contacts.find(c => c.id === contactId);
    if (!contact) return;
    const promises = contact.promises.map(p =>
      p.id === promiseId ? { ...p, taskId } : p
    );
    return updateCustomFields(contactId, { promises });
  }, [contacts, updateCustomFields]);

  const deletePromise = useCallback((contactId, promiseId) => {
    const contact = contacts.find(c => c.id === contactId);
    if (!contact) return;
    const promises = contact.promises.filter(p => p.id !== promiseId);
    return updateCustomFields(contactId, { promises });
  }, [contacts, updateCustomFields]);

  // ── Like / preference helpers ────────────────────────────────────────────────

  const addLike = useCallback((contactId, { category, value }) => {
    const contact = contacts.find(c => c.id === contactId);
    if (!contact) return;
    const likesPreferences = [...(contact.likesPreferences || []), makeLike({ category, value })];
    return updateCustomFields(contactId, { likesPreferences });
  }, [contacts, updateCustomFields]);

  const deleteLike = useCallback((contactId, likeId) => {
    const contact = contacts.find(c => c.id === contactId);
    if (!contact) return;
    const likesPreferences = contact.likesPreferences.filter(l => l.id !== likeId);
    return updateCustomFields(contactId, { likesPreferences });
  }, [contacts, updateCustomFields]);

  // ── Gift idea helpers ────────────────────────────────────────────────────────

  const addGiftIdea = useCallback((contactId, { text }) => {
    const contact = contacts.find(c => c.id === contactId);
    if (!contact) return;
    const giftIdeas = [...(contact.giftIdeas || []), makeGiftIdea({ text })];
    return updateCustomFields(contactId, { giftIdeas });
  }, [contacts, updateCustomFields]);

  const toggleGiftGiven = useCallback((contactId, giftId) => {
    const contact = contacts.find(c => c.id === contactId);
    if (!contact) return;
    const giftIdeas = contact.giftIdeas.map(g =>
      g.id === giftId
        ? { ...g, given: !g.given, givenDate: !g.given ? new Date().toISOString() : null }
        : g
    );
    return updateCustomFields(contactId, { giftIdeas });
  }, [contacts, updateCustomFields]);

  const deleteGiftIdea = useCallback((contactId, giftId) => {
    const contact = contacts.find(c => c.id === contactId);
    if (!contact) return;
    const giftIdeas = contact.giftIdeas.filter(g => g.id !== giftId);
    return updateCustomFields(contactId, { giftIdeas });
  }, [contacts, updateCustomFields]);

  // Issue#35: merge enrichment from an orphaned record into a real contact, then delete orphan
  const mergeOrphanIntoContact = useCallback(async (orphanId, targetId) => {
    const orphan = contacts.find(c => c.id === orphanId);
    const target = contacts.find(c => c.id === targetId);
    if (!orphan || !target) return;

    const mergedTags     = [...new Set([...target.relationshipTags, ...orphan.relationshipTags])];
    const mergedNotes    = [target.notes, orphan.notes].filter(s => s && s.trim()).join('\n\n');
    const mergedLikes    = [...target.likesPreferences, ...orphan.likesPreferences];
    const mergedGifts    = [...target.giftIdeas,        ...orphan.giftIdeas];
    const mergedPromises = [...target.promises,          ...orphan.promises];

    try {
      await updateCustomFields(targetId, {
        relationshipTags: mergedTags,
        notes:            mergedNotes,
        likesPreferences: mergedLikes,
        giftIdeas:        mergedGifts,
        promises:         mergedPromises,
      });
    } catch {
      // updateCustomFields already reverted state and set error banner;
      // abort here — orphan is preserved, nothing is lost
      return;
    }

    await deleteContact(orphanId).catch(() => null);
    setContacts(cs => cs.filter(c => c.id !== orphanId));
    if (selectedContactId === orphanId) setSelectedContactId(targetId);
  }, [contacts, updateCustomFields, selectedContactId, setSelectedContactId]);

  // Issue#35: delete an orphaned record (discarding any enrichment it holds)
  const deleteOrphanContact = useCallback(async (orphanId) => {
    await deleteContact(orphanId).catch(() => null);
    setContacts(cs => cs.filter(c => c.id !== orphanId));
    if (selectedContactId === orphanId) setSelectedContactId(null);
  }, [selectedContactId, setSelectedContactId]);

  // FR#133: link/unlink a gift idea to an existing task
  const linkGiftToTask = useCallback((contactId, giftId, taskId) => {
    const contact = contacts.find(c => c.id === contactId);
    if (!contact) return;
    const giftIdeas = contact.giftIdeas.map(g =>
      g.id === giftId ? { ...g, taskId } : g
    );
    return updateCustomFields(contactId, { giftIdeas });
  }, [contacts, updateCustomFields]);

  return {
    // State
    contacts,
    selectedContactId,
    setSelectedContactId,
    contactsLoading,
    contactsSyncing,
    contactsError,
    lastSyncedAt,
    // Sync
    syncContacts,
    // Standard fields
    updateStandardFields,
    // Custom fields (direct)
    updateCustomFields,
    // Promises
    addPromise,
    togglePromiseDone,
    linkPromiseToTask,
    deletePromise,
    // Likes
    addLike,
    deleteLike,
    // Gifts
    addGiftIdea,
    toggleGiftGiven,
    deleteGiftIdea,
    linkGiftToTask,
    // Orphan management
    mergeOrphanIntoContact,
    deleteOrphanContact,
  };
}

export { useContacts };
