-- Add home location columns to users if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='users' AND column_name='home_latitude'
  ) THEN
    ALTER TABLE users ADD COLUMN home_latitude DECIMAL(10,8);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='users' AND column_name='home_longitude'
  ) THEN
    ALTER TABLE users ADD COLUMN home_longitude DECIMAL(11,8);
  END IF;
END $$;