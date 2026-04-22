#!/usr/bin/env node

/**
 * Direct Admin Account Creation Script
 * Creates an admin account by directly inserting into the database
 */

const crypto = require('crypto');

// Generate a simple hash for the password (in production, use bcrypt)
function simpleHash(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function createAdminDirect() {
  try {
    console.log('Creating admin account directly via API...\n');

    // First, let's try to get the tenant to see if it exists
    console.log('Step 1: Checking if tenant exists...');
    const tenantCheckResponse = await fetch(
      'https://gastronomos.hudsonargollo2.workers.dev/api/v1/bootstrap',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@pontal.com',
          password: 'Pontal1773#',
          tenantName: 'Pontal Stock',
          tenantSlug: 'pontal-carapitangui',
        }),
      }
    );

    const tenantData = await tenantCheckResponse.json();
    console.log('Response:', JSON.stringify(tenantData, null, 2));

    if (tenantCheckResponse.ok) {
      console.log('\n✅ Admin account created successfully!');
      console.log('\nLogin credentials:');
      console.log('  Email: admin@pontal.com');
      console.log('  Password: Pontal1773#');
      console.log('  Tenant: pontal-carapitangui');
      console.log('\nToken (first 50 chars):');
      console.log(`  ${tenantData.token.substring(0, 50)}...`);
    } else {
      console.log('\n❌ Failed to create admin account');
      console.log('Status:', tenantCheckResponse.status);
      console.log('Error:', tenantData);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createAdminDirect();
