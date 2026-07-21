-- Drop recovery columns (Option C simplified: no recovery phrases/keys)
ALTER TABLE users DROP COLUMN IF EXISTS recovery_key_hash;
ALTER TABLE users DROP COLUMN IF EXISTS encrypted_recovery_key;
-- Rename encrypted_pek for clarity (stores client-side password-wrapped PEK)
-- Kept as encrypted_pek for backward compatibility
