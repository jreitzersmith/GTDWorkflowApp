-- FR#25: Gmail rules persistence
-- Adds gmail_rules JSONB column to user_settings to persist Gmail labels
-- and filters cache across devices. Applied 2026-05-15.
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS gmail_rules jsonb DEFAULT NULL;
