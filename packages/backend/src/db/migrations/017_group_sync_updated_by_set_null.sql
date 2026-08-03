-- Make group_sync.updated_by nullable and SET NULL on user delete.
-- Deleting a user must not cascade-delete the group blob (it destroys the group's data).
ALTER TABLE group_sync DROP CONSTRAINT IF EXISTS group_sync_updated_by_fkey;
ALTER TABLE group_sync ALTER COLUMN updated_by DROP NOT NULL;
ALTER TABLE group_sync
  ADD CONSTRAINT group_sync_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
