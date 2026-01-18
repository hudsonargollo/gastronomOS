-- Migration: Fix Locations Table Structure
-- Add missing columns to locations table

-- Add manager_id column
ALTER TABLE locations ADD COLUMN manager_id TEXT REFERENCES users(id);

-- Add active column
ALTER TABLE locations ADD COLUMN active INTEGER NOT NULL DEFAULT 1;

-- Add updated_at column
ALTER TABLE locations ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;

-- Create additional indexes for locations
CREATE INDEX IF NOT EXISTS location_manager_idx ON locations(manager_id);
CREATE INDEX IF NOT EXISTS location_active_idx ON locations(active);
CREATE INDEX IF NOT EXISTS location_updated_at_idx ON locations(updated_at);

-- Update existing data to set default values for new columns
UPDATE locations SET updated_at = created_at WHERE updated_at = 0;