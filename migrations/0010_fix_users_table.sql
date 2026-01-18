-- Migration: Fix Users Table Structure
-- Add missing columns to users table

-- Add first_name column
ALTER TABLE users ADD COLUMN first_name TEXT NOT NULL DEFAULT '';

-- Add last_name column
ALTER TABLE users ADD COLUMN last_name TEXT NOT NULL DEFAULT '';

-- Add active column
ALTER TABLE users ADD COLUMN active INTEGER NOT NULL DEFAULT 1;

-- Add last_login_at column
ALTER TABLE users ADD COLUMN last_login_at INTEGER;

-- Create additional indexes for users
CREATE INDEX IF NOT EXISTS user_active_idx ON users(active);
CREATE INDEX IF NOT EXISTS user_last_login_idx ON users(last_login_at);

-- Update existing data to set default values for new columns
UPDATE users SET first_name = 'Unknown', last_name = 'User' WHERE first_name = '' OR first_name IS NULL;