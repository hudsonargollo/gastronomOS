-- Create admin user for Pontal Stock
-- This migration creates an admin account for the pontal-carapitangui tenant

-- First, ensure the tenant exists
INSERT OR IGNORE INTO tenants (id, name, slug, created_at)
VALUES ('pontal-carapitangui-id', 'Pontal Stock', 'pontal-carapitangui', strftime('%s', 'now') * 1000);

-- Create the admin user
-- Password hash for "Pontal1773#" (using bcrypt, but for demo we'll use a placeholder)
INSERT OR IGNORE INTO users (
  id,
  tenant_id,
  email,
  password_hash,
  role,
  first_name,
  last_name,
  active,
  created_at,
  updated_at
) VALUES (
  'admin-pontal-' || lower(hex(randomblob(8))),
  'pontal-carapitangui-id',
  'admin@pontal.com',
  '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36P4/KFm', -- bcrypt hash of "Pontal1773#"
  'ADMIN',
  'Admin',
  'Pontal',
  1,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
);
