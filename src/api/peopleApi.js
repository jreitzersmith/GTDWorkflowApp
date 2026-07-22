// Google People API v1 — contact search
// Requires the contacts.readonly scope.
// Follows the driveApi.js pattern: accepts { token, onTokenRefresh? }, throws on non-OK responses.

const PEOPLE_BASE = 'https://people.googleapis.com/v1';

async function peopleRequest(url, { token, method = 'GET', headers = {}, body } = {}, onTokenRefresh) {
  const doFetch = (t) => fetch(url, {
    method,
    headers: { Authorization: `Bearer ${t}`, ...headers },
    ...(body !== undefined ? { body } : {}),
  });
  let res = await doFetch(token);
  if (res.status === 401 && onTokenRefresh) {
    const newToken = await onTokenRefresh();
    if (newToken) res = await doFetch(newToken);
  }
  return res;
}

// Search the authenticated user's contacts by name or email.
// Returns an array of { resourceName, name, emails[], phones[] } objects.
async function peopleSearchContacts({ token, query, maxResults = 5, onTokenRefresh } = {}) {
  const params = new URLSearchParams({
    query,
    readMask: 'names,emailAddresses,phoneNumbers',
    pageSize: String(Math.min(maxResults, 30)),
  });
  const res = await peopleRequest(
    `${PEOPLE_BASE}/people:searchContacts?${params}`,
    { token },
    onTokenRefresh,
  );
  if (!res.ok) throw new Error(`Contacts search failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return (data.results || []).map(r => {
    const p = r.person || {};
    const name   = (p.names          || [])[0]?.displayName || '';
    const emails = (p.emailAddresses || []).map(e  => e.value).filter(Boolean);
    const phones = (p.phoneNumbers   || []).map(ph => ph.value).filter(Boolean);
    return { resourceName: p.resourceName || '', name, emails, phones };
  });
}

export { peopleSearchContacts };
