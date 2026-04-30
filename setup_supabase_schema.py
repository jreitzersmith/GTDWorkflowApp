"""
One-time script to create the tasks table, enable RLS, and add indexes
in the GTDWorkflowManager Supabase project.
Run once, then delete or keep for reference.
"""
import urllib.request
import urllib.error
import json
import os

# Load from environment or hardcode for one-time use
MGMT_TOKEN = "sbp_REDACTED"
PROJECT_REF = "tudmteqljgpocffalssz"
URL = f"https://api.supabase.com/v1/projects/{PROJECT_REF}/database/query"

SQL = """
-- ── Tasks table ───────────────────────────────────────────────────────────────
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

-- ── Row Level Security ────────────────────────────────────────────────────────
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

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS tasks_user_id_idx ON public.tasks(user_id);
CREATE INDEX IF NOT EXISTS tasks_bucket_idx  ON public.tasks(bucket);
CREATE INDEX IF NOT EXISTS tasks_parent_idx  ON public.tasks(parent_id);
"""

payload = json.dumps({"query": SQL}).encode("utf-8")
req = urllib.request.Request(
    URL,
    data=payload,
    headers={
        "Authorization": f"Bearer {MGMT_TOKEN}",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
    },
    method="POST",
)

try:
    with urllib.request.urlopen(req) as resp:
        body = resp.read().decode("utf-8")
        print(f"SUCCESS ({resp.status})")
        print(body[:500] if body else "(empty response)")
except urllib.error.HTTPError as e:
    body = e.read().decode("utf-8")
    print(f"FAILED HTTP {e.code}: {body}")
except Exception as ex:
    print(f"ERROR: {ex}")
