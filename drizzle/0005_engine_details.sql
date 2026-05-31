DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname
    INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'shift'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) = 'CHECK ((end_time > start_time))'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE shift DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE shift
  ADD COLUMN IF NOT EXISTS buffer_min int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overbooking_pct int NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'shift'::regclass
      AND conname = 'shift_time_not_equal_chk'
  ) THEN
    ALTER TABLE shift
      ADD CONSTRAINT shift_time_not_equal_chk CHECK (end_time <> start_time);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'shift'::regclass
      AND conname = 'shift_buffer_chk'
  ) THEN
    ALTER TABLE shift
      ADD CONSTRAINT shift_buffer_chk CHECK (buffer_min >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'shift'::regclass
      AND conname = 'shift_overbooking_chk'
  ) THEN
    ALTER TABLE shift
      ADD CONSTRAINT shift_overbooking_chk CHECK (overbooking_pct BETWEEN 0 AND 100);
  END IF;
END $$;
