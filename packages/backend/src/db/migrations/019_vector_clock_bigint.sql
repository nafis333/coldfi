-- 019_vector_clock_bigint.sql
-- Client sends Date.now() (~1.7e12) as the vector clock, which overflows INTEGER (max ~2.1e9).
-- Widen the column to BIGINT so saves stop failing with error 22003.

ALTER TABLE personal_data
  ALTER COLUMN vector_clock TYPE BIGINT;
