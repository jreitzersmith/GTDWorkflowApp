-- FR#110: Add defer_count to track how many times a task has been deferred
-- Safe to run multiple times (IF NOT EXISTS guard on the column check via default behaviour)
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS defer_count integer NOT NULL DEFAULT 0;
