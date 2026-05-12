-- Add node_type column to tasks table
-- Values: 'category' | 'subcategory' | 'project' | 'subproject' | 'task' | NULL (treated as 'task')
-- All existing project-bucket tasks remain NULL; their effective type is inferred from bucket in the UI.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS node_type text DEFAULT NULL;
