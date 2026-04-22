#!/usr/bin/env node

/**
 * Generate bcrypt hash for admin password
 * This script generates a proper bcrypt hash that works with bcrypt-ts
 */

const bcrypt = require('bcryptjs');

const password = 'Pontal1773#';
const rounds = 10;

// Generate hash synchronously for simplicity
const hash = bcrypt.hashSync(password, rounds);

console.log('Password:', password);
console.log('Bcrypt Hash:', hash);
console.log('\nUse this hash in the migration:');
console.log(`UPDATE users SET password_hash = '${hash}' WHERE email = 'admin@pontal.com' AND tenant_id = 'pontal-carapitangui-id';`);
