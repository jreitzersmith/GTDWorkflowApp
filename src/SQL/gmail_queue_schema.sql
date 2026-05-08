-- ════════════════════════════════════════════════════════════════════════════
-- GTD Manager — Supabase Schema
-- File:    gmail_queue_schema.sql
-- Table:   public.gmail_queue
-- Purpose: Persistent queue of Gmail cleanup rules. Each row represents one
--          saved cleanup entry (a Gmail search query + label/archive action)
--          that the user can run on demand from the Email › Cleanup tab, or
--          that gets executed automatically. Status tracks whether the rule
--          has been run, and run_count records how many times.
--
-- Location in codebase:
--   • Field mappers:  src/api/supabase.js → queueEntryToRow() / rowToQueueEntry()
--   • Queue state:    src/features/email/useGmailState.js
--   • AI writes:      src/features/coach/useCallAI.js (gmail_queue_add tool handler)
--   • UI:             src/features/email/EmailCleanupPanel.jsx
--
-- Applied to: Supabase project tudmteqljgpocffalssz (GTDWorkflowManager)
-- Run via: Supabase SQL editor (manual migration)
-- Note: This schema was reconstructed from src/api/supabase.js → queueEntryToRow().
--       No original setup script exists for this table.
-- ════════════════════════════════════════════════════════════════════════════


-- ── Section 1: Table creation ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.gmail_queue (
  id            TEXT        PRIMARY KEY,
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label_name    TEXT        NOT NULL,
  label_id      TEXT,
  query         TEXT        NOT NULL,
  description   TEXT,
  archive       BOOLEAN     NOT NULL DEFAULT TRUE,
  create_filter BOOLEAN     NOT NULL DEFAULT TRUE,
  saved_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status        TEXT        NOT NULL DEFAULT 'pending',
  run_count     INTEGER
);


-- ── Section 2: Row Level Security ────────────────────────────────────────────

ALTER TABLE public.gmail_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own queue"   ON public.gmail_queue;
DROP POLICY IF EXISTS "Users can insert their own queue" ON public.gmail_queue;
DROP POLICY IF EXISTS "Users can update their own queue" ON public.gmail_queue;
DROP POLICY IF EXISTS "Users can delete their own queue" ON public.gmail_queue;

CREATE POLICY "Users can view their own queue"
  ON public.gmail_queue FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own queue"
  ON public.gmail_queue FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own queue"
  ON public.gmail_queue FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own queue"
  ON public.gmail_queue FOR DELETE
  USING (auth.uid() = user_id);


-- ── Section 3: Indexes ────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS gmail_queue_user_id_idx ON public.gmail_queue(user_id);
CREATE INDEX IF NOT EXISTS gmail_queue_status_idx  ON public.gmail_queue(status);
