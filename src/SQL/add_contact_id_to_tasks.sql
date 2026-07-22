-- FR#149: Add contact_id UUID column to tasks table
-- Links a task back to the contact it was created from (promise/gift flow)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;
