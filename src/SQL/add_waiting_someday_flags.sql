-- FR#84: Replace bucket-based waiting/someday model with boolean flags.
-- Tasks keep their primary bucket (next/project/etc.) and are flagged instead.
-- The waiting/someday/deferred sidebar views become filter views.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_waiting_for BOOLEAN DEFAULT FALSE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_someday BOOLEAN DEFAULT FALSE;
