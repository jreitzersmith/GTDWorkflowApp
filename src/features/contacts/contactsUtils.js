// src/features/contacts/contactsUtils.js
// Pure mapper functions between Google People API objects, our internal contact
// shape, and Supabase row format. No side effects — independently testable.
//
// Internal contact shape:
// {
//   id, googleResourceName, googleEtag,
//   displayName, givenName, familyName,
//   emails:    [{value, type, primary}],
//   phones:    [{value, type, primary}],
//   addresses: [{streetAddress, city, state, postalCode, country, type}],
//   company, jobTitle, photoUrl,
//   relationshipTags: string[],
//   notes: string,
//   likesPreferences: [{id, category, value}],
//   giftIdeas:        [{id, text, given, givenDate, addedDate}],
//   promises:         [{id, text, direction, taskId, done, createdDate}],
//   createdAt, updatedAt,
// }

import { genId } from '../calendar/calendarApi.js';

// ── Google People API → internal ──────────────────────────────────────────────

function googlePersonToContact(person) {
  const primaryName  = person.names?.[0]        || {};
  const primaryPhoto = person.photos?.[0]       || {};
  const primaryOrg   = person.organizations?.[0] || {};

  const emails = (person.emailAddresses || []).map(e => ({
    value:   e.value   || '',
    type:    e.type    || 'home',
    primary: !!e.metadata?.primary,
  }));

  const phones = (person.phoneNumbers || []).map(p => ({
    value:   p.value   || '',
    type:    p.type    || 'mobile',
    primary: !!p.metadata?.primary,
  }));

  const addresses = (person.addresses || []).map(a => ({
    streetAddress: a.streetAddress || '',
    city:          a.city          || '',
    state:         a.region        || '',
    postalCode:    a.postalCode    || '',
    country:       a.country       || '',
    type:          a.type          || 'home',
  }));

  return {
    id:                   null, // set from Supabase after upsert
    googleResourceName:   person.resourceName || null,
    googleEtag:           person.etag         || null,
    displayName:          primaryName.displayName  || '',
    givenName:            primaryName.givenName    || '',
    familyName:           primaryName.familyName   || '',
    emails,
    phones,
    addresses,
    company:              primaryOrg.name  || '',
    jobTitle:             primaryOrg.title || '',
    photoUrl:             primaryPhoto.url || null,
    // Custom fields — preserved from existing DB row, not overwritten by sync
    relationshipTags: [],
    notes:            '',
    likesPreferences: [],
    giftIdeas:        [],
    promises:         [],
    createdAt:  null,
    updatedAt:  null,
  };
}

// ── Internal → Google People API patch payload ────────────────────────────────

function contactToGooglePatch(contact) {
  const payload = {};
  const fieldMask = [];

  if (contact.givenName !== undefined || contact.familyName !== undefined || contact.displayName !== undefined) {
    payload.names = [{
      givenName:   contact.givenName   || '',
      familyName:  contact.familyName  || '',
      displayName: contact.displayName || '',
    }];
    fieldMask.push('names');
  }

  if (contact.emails !== undefined) {
    payload.emailAddresses = contact.emails.map(e => ({
      value:    e.value,
      type:     e.type    || 'home',
      metadata: e.primary ? { primary: true } : {},
    }));
    fieldMask.push('emailAddresses');
  }

  if (contact.phones !== undefined) {
    payload.phoneNumbers = contact.phones.map(p => ({
      value:    p.value,
      type:     p.type    || 'mobile',
      metadata: p.primary ? { primary: true } : {},
    }));
    fieldMask.push('phoneNumbers');
  }

  if (contact.addresses !== undefined) {
    payload.addresses = contact.addresses.map(a => ({
      streetAddress: a.streetAddress || '',
      city:          a.city          || '',
      region:        a.state         || '',
      postalCode:    a.postalCode    || '',
      country:       a.country       || '',
      type:          a.type          || 'home',
    }));
    fieldMask.push('addresses');
  }

  if (contact.company !== undefined || contact.jobTitle !== undefined) {
    payload.organizations = [{
      name:  contact.company  || '',
      title: contact.jobTitle || '',
    }];
    fieldMask.push('organizations');
  }

  return { payload, fieldMask };
}

// ── Internal → Supabase row ───────────────────────────────────────────────────

function contactToDb(contact) {
  return {
    ...(contact.id                 && { id:                   contact.id }),
    google_resource_name:  contact.googleResourceName ?? null,
    google_etag:           contact.googleEtag         ?? null,
    display_name:          contact.displayName        ?? '',
    given_name:            contact.givenName          ?? '',
    family_name:           contact.familyName         ?? '',
    emails:                contact.emails             ?? [],
    phones:                contact.phones             ?? [],
    addresses:             contact.addresses          ?? [],
    company:               contact.company            ?? '',
    job_title:             contact.jobTitle           ?? '',
    photo_url:             contact.photoUrl           ?? null,
    // Enrichment fields: only include if explicitly present in the input object.
    // contactToDb is called with partial objects for single-field saves (e.g.
    // { likesPreferences: [...] }); using ?? here would emit [] / '' defaults for
    // absent enrichment keys, causing updateContactCustomFields to wipe all other
    // enrichment with every individual save. (Issue#37 / GH#176)
    ...('relationshipTags' in contact ? { relationship_tags: contact.relationshipTags } : {}),
    ...('notes'            in contact ? { notes:             contact.notes }            : {}),
    ...('likesPreferences' in contact ? { likes_preferences: contact.likesPreferences } : {}),
    ...('giftIdeas'        in contact ? { gift_ideas:        contact.giftIdeas }        : {}),
    ...('promises'         in contact ? { promises:          contact.promises }          : {}),
    ...('dislikes'         in contact ? { dislikes:          contact.dislikes }          : {}),
  };
}

// ── Supabase row → internal ───────────────────────────────────────────────────

function dbToContact(row) {
  return {
    id:                   row.id,
    googleResourceName:   row.google_resource_name,
    googleEtag:           row.google_etag,
    displayName:          row.display_name      || '',
    givenName:            row.given_name        || '',
    familyName:           row.family_name       || '',
    emails:               row.emails            || [],
    phones:               row.phones            || [],
    addresses:            row.addresses         || [],
    company:              row.company           || '',
    jobTitle:             row.job_title         || '',
    photoUrl:             row.photo_url         || null,
    relationshipTags:     row.relationship_tags || [],
    notes:                row.notes             || '',
    likesPreferences:     row.likes_preferences || [],
    giftIdeas:            row.gift_ideas        || [],
    promises:             row.promises          || [],
    dislikes:             row.dislikes          || [],
    createdAt:            row.created_at,
    updatedAt:            row.updated_at,
  };
}

// ── Promise helpers ───────────────────────────────────────────────────────────

function makePromise({ text, direction }) {
  return {
    id:          genId(),
    text:        text      || '',
    direction:   direction || 'made',  // 'made' | 'received'
    taskId:      null,
    done:        false,
    createdDate: new Date().toISOString(),
  };
}

function makeLike({ category, value }) {
  return { id: genId(), category: category || '', value: value || '' };
}

function makeDislike({ category, value }) {
  return { id: genId(), category: category || '', value: value || '', addedDate: new Date().toISOString() };
}

function makeGiftIdea({ text }) {
  return {
    id:        genId(),
    text:      text || '',
    given:     false,
    givenDate: null,
    addedDate: new Date().toISOString(),
    taskId:    null,
  };
}

// ── Display helpers ───────────────────────────────────────────────────────────

function contactInitials(contact) {
  const first = contact.givenName?.[0]  || '';
  const last  = contact.familyName?.[0] || '';
  return (first + last).toUpperCase() || contact.displayName?.[0]?.toUpperCase() || '?';
}

function contactPrimaryEmail(contact) {
  return contact.emails?.find(e => e.primary)?.value
      || contact.emails?.[0]?.value
      || '';
}

function contactPrimaryPhone(contact) {
  return contact.phones?.find(p => p.primary)?.value
      || contact.phones?.[0]?.value
      || '';
}

// Converts free-text tag input to PascalCase ("close friend" → "CloseFriend").
// Applied on save for new tags/categories to keep the namespace consistent.
const toContactTagCase = (str) => str.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');

export {
  googlePersonToContact,
  contactToGooglePatch,
  contactToDb,
  dbToContact,
  makePromise,
  makeLike,
  makeDislike,
  makeGiftIdea,
  contactInitials,
  contactPrimaryEmail,
  contactPrimaryPhone,
  toContactTagCase,
};
