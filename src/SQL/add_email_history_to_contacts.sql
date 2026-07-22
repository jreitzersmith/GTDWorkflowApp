-- FR#159 — Add email_history JSONB column to contacts table
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS email_history JSONB NOT NULL DEFAULT '[]';
