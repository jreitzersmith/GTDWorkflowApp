-- CQ#11: rename processed → reviewed
ALTER TABLE tasks RENAME COLUMN processed TO reviewed;
