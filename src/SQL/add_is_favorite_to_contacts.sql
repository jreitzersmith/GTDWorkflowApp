-- FR#173 — Add is_favorite BOOLEAN column to contacts table
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN NOT NULL DEFAULT false;
