-- FR#132 — contacts table
-- Run via Supabase Management API (project ref: tudmteqljgpocffalssz)

CREATE TABLE IF NOT EXISTS contacts (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  google_resource_name TEXT UNIQUE,          -- "people/c123" — null for manual contacts
  google_etag          TEXT,                  -- conflict guard on writes back to Google
  display_name         TEXT,
  given_name           TEXT,
  family_name          TEXT,
  emails               JSONB DEFAULT '[]',    -- [{value, type, primary}]
  phones               JSONB DEFAULT '[]',    -- [{value, type, primary}]
  addresses            JSONB DEFAULT '[]',    -- [{streetAddress, city, state, postalCode, country, type}]
  company              TEXT,
  job_title            TEXT,
  photo_url            TEXT,
  relationship_tags    TEXT[]  DEFAULT '{}',
  notes                TEXT    DEFAULT '',
  likes_preferences    JSONB   DEFAULT '[]',  -- [{id, category, value}]
  gift_ideas           JSONB   DEFAULT '[]',  -- [{id, text, given, givenDate, addedDate}]
  promises             JSONB   DEFAULT '[]',  -- [{id, text, direction, taskId, done, createdDate}]
  created_at           TIMESTAMPTZ DEFAULT now(),
  updated_at           TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contacts_user_id_idx       ON contacts(user_id);
CREATE INDEX IF NOT EXISTS contacts_resource_name_idx ON contacts(google_resource_name);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY contacts_owner ON contacts
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
