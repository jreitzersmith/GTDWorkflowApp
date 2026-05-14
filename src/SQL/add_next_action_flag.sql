-- FR#87: Next Actions as a filter view (flag-based, same pattern as isWaitingFor/isSomeday)
-- Run steps in order; each is idempotent / safe to re-run.

-- Step 1: Add column
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_next_action BOOLEAN NOT NULL DEFAULT FALSE;

-- Step 2: Flag all existing next-bucket tasks
UPDATE tasks SET is_next_action = TRUE WHERE bucket = 'next';

-- Step 3: Assign orphaned next tasks to the user's uncategorized project
UPDATE tasks t
SET parent_id = us.uncategorized_project_id
FROM user_settings us
WHERE t.user_id = us.user_id
  AND t.bucket = 'next'
  AND t.parent_id IS NULL
  AND us.uncategorized_project_id IS NOT NULL;

-- Step 4: Add newly-parented task IDs to the uncategorized project's child_ids array
WITH grouped AS (
  SELECT us.uncategorized_project_id,
         jsonb_agg(t.id::text ORDER BY t.created) AS new_ids
  FROM tasks t
  JOIN user_settings us ON t.user_id = us.user_id
  WHERE t.bucket = 'next'
    AND t.parent_id = us.uncategorized_project_id
  GROUP BY us.uncategorized_project_id
)
UPDATE tasks p
SET child_ids = COALESCE(p.child_ids, '[]'::jsonb) || g.new_ids
FROM grouped g
WHERE p.id = g.uncategorized_project_id;

-- Step 5: Move all next-bucket tasks to the project bucket
UPDATE tasks SET bucket = 'project' WHERE bucket = 'next';
