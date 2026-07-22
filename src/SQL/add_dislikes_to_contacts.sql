-- FR#142: Add dislikes JSONB column to contacts table
-- Mirrors likes_preferences; stores things to avoid per contact
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS dislikes JSONB DEFAULT '[]'::jsonb;
