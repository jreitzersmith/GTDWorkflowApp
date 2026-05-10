-- ════════════════════════════════════════════════════════════════════════════
-- GTD Manager — Migration: add drive_attachments column
-- FR#39 [GH#35] — Drive file picker for tasks
-- Apply via Supabase SQL editor or psql against project tudmteqljgpocffalssz
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS drive_attachments JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Each element: { id: string, name: string, mimeType: string, url: string }
-- Stored and read by taskToDb / dbToTask in src/api/supabase.js
