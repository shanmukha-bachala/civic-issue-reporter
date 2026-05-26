-- Add work area columns to users if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='users' AND column_name='work_latitude'
  ) THEN
    ALTER TABLE users ADD COLUMN work_latitude DECIMAL(10,8);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='users' AND column_name='work_longitude'
  ) THEN
    ALTER TABLE users ADD COLUMN work_longitude DECIMAL(11,8);
  END IF;
END $$;