-- Create Demo Tenant and User in Production Database
-- Run this with: npx wrangler d1 execute gastronomos-prod --env production --file=create-demo-account-db.sql

-- Step 1: Create demo tenant (if not exists)
INSERT OR IGNORE INTO tenants (id, name, slug, settings, created_at, updated_at)
VALUES (
  'demo-tenant-' || lower(hex(randomblob(16))),
  'Demo Restaurant',
  'demo-restaurant',
  '{}',
  datetime('now'),
  datetime('now')
);

-- Step 2: Get the tenant ID
-- Note: We'll need to run this in two steps or use a transaction

-- For now, let's just show what needs to be done:
-- 1. First, check if tenant exists:
SELECT id, name, slug FROM tenants WHERE slug = 'demo-restaurant';

-- 2. Then create user with that tenant_id (replace 'TENANT_ID_HERE' with actual ID from step 1):
-- INSERT OR IGNORE INTO users (id, tenant_id, email, password_hash, role, created_at, updated_at)
-- VALUES (
--   'demo-user-' || lower(hex(randomblob(16))),
--   'TENANT_ID_HERE',
--   'demo@gastronomos.com',
--   '$2a$10$...',  -- This needs to be a bcrypt hash of 'demo123456'
--   'ADMIN',
--   datetime('now'),
--   datetime('now')
-- );
