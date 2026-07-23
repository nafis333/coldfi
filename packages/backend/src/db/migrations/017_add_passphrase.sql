-- Migration: 017_add_passphrase
-- Stores the raw group passphrase for member sharing & auto-rotation

ALTER TABLE groups ADD COLUMN IF NOT EXISTS passphrase TEXT;

-- Passphrase is nullable; members fetch it via the API to share with new joiners.
