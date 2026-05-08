-- ════════════════════════════════════════════════════════════════════════════
-- GTD Manager — Supabase Schema
-- File:    user_settings_schema.sql
-- Table:   public.user_settings
-- Purpose: Per-user app configuration. Stores the user's custom effort labels
--          and location tags (shown in task metadata dropdowns), plus
--          AI calibration overrides used to tune effort suggestions.
--          One row per authenticated user; upserted on every settings save.
--
-- Location in codebase:
--   • Read/write:   src/features/settings/useAppSettings.js
--   • Effort list:  src/features/tasks/TaskDetailPanel.jsx (effort dropdown)
--   • Location list: src/features/tasks/TaskDetailPanel.jsx (location multi-select)
--   • Calibration:  src/features/tasks/taskUtils.jsx → buildCalibrationContext()
--
-- Applied to: Supabase project tudmteqljgpocffalssz (GTDWorkflowManager)
-- Run via: Supabase SQL editor (manual migration)
-- ════════════════════════════════════════════════════════════════════════════


-- ── Section 1: Table creation ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id               UUID    PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  locations             JSONB   NOT NULL DEFAULT '["Home","Work","Phone","Computer"]'::jsonb,
  efforts               JSONB   NOT NULL DEFAULT '["2 min","5 min","10 min","30 min","1 hour","2 hours","6 hours","1 day","3 days","1 week","1 month"]'::jsonb,
  calibration_overrides JSONB   NOT NULL DEFAULT '{}'::jsonb,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ── Section 2: Row Level Security ────────────────────────────────────────────

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own settings"
  ON public.user_settings
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
