-- FR#164 — Add drive_attachments JSONB column to contacts table
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS drive_attachments JSONB NOT NULL DEFAULT '[]';
