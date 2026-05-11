-- Migration: add processed boolean and due_time text to tasks table
-- Applied: 2026-05-11

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS processed boolean DEFAULT false;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_time text;
