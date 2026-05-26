-- Add email_summary column to issues to store summarized email description
ALTER TABLE issues
  ADD COLUMN IF NOT EXISTS email_summary TEXT;
