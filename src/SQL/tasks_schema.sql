-- ════════════════════════════════════════════════════════════════════════════
-- GTD Manager — Supabase Schema
-- File:    tasks_schema.sql
-- Table:   public.tasks
-- Purpose: Primary task storage. Stores all GTD tasks for every authenticated
--          user. RLS policies ensure each user can only read/write their own
--          rows. Indexes optimize the most common query patterns (by user,
--          bucket, and parent task).
--
-- Location in codebase:
--   • Field mappers:  src/api/supabase.js → taskToDb() (JS→DB) / dbToTask() (DB→JS)
--   • Sync hook:      src/hooks/useSupabaseSync.js
--   • Auth hook:      src/hooks/useSupabaseAuth.js
--
-- Applied to: Supabase project tudmteqljgpocffalssz (GTDWorkflowManager)
-- Originally run via: src/SQL/setup_supabase_schema.py (one-time, Supabase Management API)
-- ════════════════════════════════════════════════════════════════════════════


-- ── Section 1: Initial table creation ────────────────────────────────────────
-- Run once at project setup via setup_supabase_schema.py

CREATE TABLE IF NOT EXISTS public.tasks (
  id             TEXT        PRIMARY KEY,
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text           TEXT        NOT NULL,
  bucket         TEXT        NOT NULL DEFAULT 'inbox',
  done           BOOLEAN     NOT NULL DEFAULT FALSE,
  created        BIGINT      NOT NULL,
  priority       JSONB       NOT NULL DEFAULT '[]',
  location       JSONB       NOT NULL DEFAULT '[]',
  due_date       TEXT,
  effort         TEXT,
  actual_effort  TEXT,
  defer_until    TEXT,
  notes          TEXT,
  recurrence     JSONB,
  parent_id      TEXT,
  child_ids      JSONB       NOT NULL DEFAULT '[]',
  sort_order     INTEGER     NOT NULL DEFAULT 0,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ── Section 2: Row Level Security ────────────────────────────────────────────

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own tasks"   ON public.tasks;
DROP POLICY IF EXISTS "Users can insert their own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can update their own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can delete their own tasks" ON public.tasks;

CREATE POLICY "Users can view their own tasks"
  ON public.tasks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tasks"
  ON public.tasks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tasks"
  ON public.tasks FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tasks"
  ON public.tasks FOR DELETE
  USING (auth.uid() = user_id);


-- ── Section 3: Indexes ────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS tasks_user_id_idx ON public.tasks(user_id);
CREATE INDEX IF NOT EXISTS tasks_bucket_idx  ON public.tasks(bucket);
CREATE INDEX IF NOT EXISTS tasks_parent_idx  ON public.tasks(parent_id);


-- ── Section 4: Migrations (run manually in Supabase SQL editor) ───────────────
-- These columns were added after initial setup. Run each ALTER once if upgrading
-- an existing project; safe to skip on a fresh install (add to Section 1 instead).

-- Added with Google Calendar feature (2026-05-04): stores HH:MM time for calendar events
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS due_time TEXT;

-- Added with project categories feature (FR#23, 2026-05-09): user-defined task categories
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS category TEXT;
