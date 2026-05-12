-- CQ: rename standalone_project_id -> uncategorized_project_id in user_settings
-- Deploy this migration BEFORE or simultaneously with the matching code deploy.
-- If the column rename runs after the code, setUncategorizedProjectId will not
-- be called on sync and the uncategorized project grouping will break until fixed.
ALTER TABLE public.user_settings
  RENAME COLUMN standalone_project_id TO uncategorized_project_id;
