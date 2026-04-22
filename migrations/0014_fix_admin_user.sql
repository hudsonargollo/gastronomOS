-- Delete the old admin user with incorrect password hash
DELETE FROM users WHERE email = 'admin@pontal.com' AND tenant_id = 'pontal-carapitangui-id';

-- The admin user will be recreated via the bootstrap endpoint with the correct password hash
