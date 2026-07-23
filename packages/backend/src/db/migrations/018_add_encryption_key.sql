ALTER TABLE groups ADD COLUMN IF NOT EXISTS encryption_key TEXT;
UPDATE groups SET encryption_key = encode(gen_random_bytes(32), 'hex') WHERE encryption_key IS NULL;
ALTER TABLE groups ALTER COLUMN encryption_key SET NOT NULL;
