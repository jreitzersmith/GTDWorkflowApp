// src/api/contactsApi.js
// Google People API wrapper for the Contacts feature (FR#132).
// All functions accept the current access token and return plain JS objects.
// 401 responses signal to the caller that a token refresh is needed.

const PEOPLE_BASE = 'https://people.googleapis.com/v1';

const PERSON_FIELDS = [
  'names',
  'emailAddresses',
  'phoneNumbers',
  'addresses',
  'organizations',
  'photos',
].join(',');

// ── List ──────────────────────────────────────────────────────────────────────

/**
 * Fetch one page of Google Contacts.
 * @param {string} token  - valid Google access token
 * @param {string|null} pageToken - pagination cursor from a prior call
 * @returns {{ connections: object[], nextPageToken: string|null, totalItems: number }}
 */
async function listGoogleContacts(token, pageToken = null) {
  const params = new URLSearchParams({
    personFields: PERSON_FIELDS,
    pageSize: '200',
    sortOrder: 'LAST_MODIFIED_DESCENDING',
  });
  if (pageToken) params.set('pageToken', pageToken);

  const res = await fetch(
    `${PEOPLE_BASE}/people/me/connections?${params}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (res.status === 401) return { needsReauth: true };
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`People API listContacts ${res.status}: ${err?.error?.message || res.statusText}`);
  }

  const data = await res.json();
  return {
    connections:   data.connections   || [],
    nextPageToken: data.nextPageToken || null,
    totalItems:    data.totalPeople   || 0,
  };
}

/**
 * Fetch ALL Google Contacts by following nextPageToken until exhausted.
 * @param {string} token
 * @returns {object[]} flat array of People API Person objects
 */
async function listAllGoogleContacts(token) {
  const all = [];
  let pageToken = null;

  do {
    const page = await listGoogleContacts(token, pageToken);
    if (page.needsReauth) return { needsReauth: true };
    all.push(...page.connections);
    pageToken = page.nextPageToken;
  } while (pageToken);

  return all;
}

// ── Update ────────────────────────────────────────────────────────────────────

/**
 * Write standard field changes back to a Google Contact.
 * Uses etag for conflict detection — throws on 412 (conflict) so callers can re-fetch.
 *
 * @param {string} token
 * @param {string} resourceName  - e.g. "people/c1234567890"
 * @param {string} etag          - current etag from the stored contact
 * @param {object} updatePayload - People API person object with only the fields to update
 * @param {string[]} updatePersonFields - field mask matching the payload keys
 * @returns {object} updated Person object from Google
 */
async function updateGoogleContact(token, resourceName, etag, updatePayload, updatePersonFields) {
  const params = new URLSearchParams({
    updatePersonFields: updatePersonFields.join(','),
  });

  const res = await fetch(
    `${PEOPLE_BASE}/${resourceName}:updateContact?${params}`,
    {
      method:  'PATCH',
      headers: {
        Authorization:  `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ etag, ...updatePayload }),
    }
  );

  if (res.status === 401) return { needsReauth: true };
  if (res.status === 412) throw new Error('CONTACT_CONFLICT');
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`People API updateContact ${res.status}: ${err?.error?.message || res.statusText}`);
  }

  return res.json();
}

export { listGoogleContacts, listAllGoogleContacts, updateGoogleContact };
