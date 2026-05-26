-- Add email_status column to issues to track simulated email sending
ALTER TABLE issues
  ADD COLUMN IF NOT EXISTS email_status TEXT;
