-- Add review_node_types column to user_settings
-- Controls which nodeType values appear in the Project Review queue
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS review_node_types jsonb;
