-- 003_add_citizens_admins_tables.sql

-- Create citizens and admins tables referencing users
CREATE TABLE IF NOT EXISTS citizens (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name VARCHAR(150),
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admins (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name VARCHAR(150),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Backfill existing users into respective tables if not already present
INSERT INTO admins (user_id, display_name)
SELECT u.id, COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), u.email)
FROM users u
LEFT JOIN admins a ON a.user_id = u.id
WHERE u.role = 'admin' AND a.user_id IS NULL;

INSERT INTO citizens (user_id, display_name)
SELECT u.id, COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), u.email)
FROM users u
LEFT JOIN citizens c ON c.user_id = u.id
WHERE u.role = 'citizen' AND c.user_id IS NULL;