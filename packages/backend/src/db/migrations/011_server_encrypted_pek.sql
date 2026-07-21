-- Add server-encrypted PEK column for password reset data preservation
ALTER TABLE users ADD COLUMN IF NOT EXISTS server_encrypted_pek text;
