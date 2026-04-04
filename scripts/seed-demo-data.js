#!/usr/bin/env node

/**
 * Seed Demo Data Script
 * Creates a demo tenant and user for testing
 */

const API_BASE_URL = process.env.API_BASE_URL || 'https://api.gastronomos.clubemkt.digital/api/v1';

async function seedDemoData() {
  console.log('🌱 Seeding demo data...\n');

  try {
    // Register demo tenant and user
    console.log('Creating demo tenant and user...');
    const registerResponse = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'demo@gastronomos.com',
        password: 'demo123',
        tenantName: 'Demo Restaurant',
        tenantSlug: 'demo-restaurant',
      }),
    });

    if (!registerResponse.ok) {
      const error = await registerResponse.json();
      if (error.message && error.message.includes('already exists')) {
        console.log('✓ Demo account already exists');
        
        // Try to login to verify it works
        console.log('\nVerifying demo login...');
        const loginResponse = await fetch(`${API_BASE_URL}/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: 'demo@gastronomos.com',
            password: 'demo123',
          }),
        });

        if (loginResponse.ok) {
          const loginData = await loginResponse.json();
          console.log('✓ Demo login successful');
          console.log(`  User: ${loginData.user.email}`);
          console.log(`  Role: ${loginData.user.role}`);
          console.log(`  Tenant: ${loginData.user.tenant_id}`);
        } else {
          console.log('✗ Demo login failed');
          const loginError = await loginResponse.json();
          console.log(`  Error: ${loginError.message}`);
        }
      } else {
        throw new Error(error.message || 'Registration failed');
      }
    } else {
      const data = await registerResponse.json();
      console.log('✓ Demo tenant and user created successfully');
      console.log(`  Email: demo@gastronomos.com`);
      console.log(`  Password: demo123`);
      console.log(`  Tenant: ${data.tenant.name}`);
      console.log(`  User ID: ${data.user.id}`);
      console.log(`  Token: ${data.token.substring(0, 20)}...`);
    }

    console.log('\n✨ Demo data seeding complete!');
    console.log('\nYou can now login with:');
    console.log('  Email: demo@gastronomos.com');
    console.log('  Password: demo123');

  } catch (error) {
    console.error('\n❌ Error seeding demo data:', error.message);
    process.exit(1);
  }
}

// Run the seed script
seedDemoData();
