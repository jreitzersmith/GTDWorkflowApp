-- Migrate orphan next-action tasks to be children of each user's uncategorized project.
-- Run once after deploying the project-first-tasks feature branch.
-- Safe to re-run: the WHERE clause excludes tasks that already have a parent.

UPDATE public.tasks t
SET parent_id = us.uncategorized_project_id
FROM public.user_settings us
WHERE t.user_id          = us.user_id
  AND t.bucket           = 'next'
  AND t.parent_id        IS NULL
  AND us.uncategorized_project_id IS NOT NULL;
