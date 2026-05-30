-- FR#140/141: Add contact relationship tags and likes/preferences categories to user_settings
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS contact_relationship_tags JSONB DEFAULT '[]'::jsonb;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS contact_likes_categories  JSONB DEFAULT '[]'::jsonb;
