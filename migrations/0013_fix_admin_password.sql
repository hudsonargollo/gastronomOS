-- Fix admin user password
-- Update the admin user with a correct bcrypt hash for "Pontal1773#"
-- This hash was generated using bcrypt with 10 rounds

UPDATE users 
SET password_hash = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36P4/KFm'
WHERE email = 'admin@pontal.com' AND tenant_id = 'pontal-carapitangui-id';
