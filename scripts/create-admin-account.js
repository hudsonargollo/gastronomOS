#!/usr/bin/env node

/**
 * Script to create an admin account for Pontal Stock
 * Usage: node scripts/create-admin-account.js
 */

const API_URL = process.env.API_URL || 'https://gastronomos.hudsonargollo2.workers.dev';
const ADMIN_EMAIL = 'admin@pontal.com';
const ADMIN_PASSWORD = 'Pontal1773#';
const TENANT_SLUG = 'pontal-carapitangui';

async function createAdminAccount() {
  try {
    console.log('Creating admin account...');
    console.log(`API URL: ${API_URL}`);
    console.log(`Email: ${ADMIN_EMAIL}`);
    console.log(`Tenant: ${TENANT_SLUG}`);
    console.log('');

    const response = await fetch(`${API_URL}/api/v1/auth/create-admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        tenantSlug: TENANT_SLUG,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Failed to create admin account');
      console.error(`Status: ${response.status}`);
      console.error('Response:', JSON.stringify(data, null, 2));
      process.exit(1);
    }

    console.log('✅ Admin account created successfully!');
    console.log('');
    console.log('Login credentials:');
    console.log(`  Email: ${ADMIN_EMAIL}`);
    console.log(`  Password: ${ADMIN_PASSWORD}`);
    console.log(`  Tenant: ${TENANT_SLUG}`);
    console.log('');
    console.log('User details:');
    console.log(`  ID: ${data.user.id}`);
    console.log(`  Role: ${data.user.role}`);
    console.log(`  Tenant ID: ${data.user.tenantId}`);
    console.log('');
    console.log('Token (first 50 chars):');
    console.log(`  ${data.token.substring(0, 50)}...`);
    console.log('');
    console.log('You can now login at: https://pontalstock.clubemkt.digital');

  } catch (error) {
    console.error('❌ Error creating admin account:');
    console.error(error.message);
    process.exit(1);
  }
}

createAdminAccount();
