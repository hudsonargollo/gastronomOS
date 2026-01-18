#!/usr/bin/env node

/**
 * Script to help developers set up JWT secrets for different environments
 * Usage: node scripts/setup-secrets.js [environment]
 */

const crypto = require('crypto');
const { execSync } = require('child_process');

function generateSecureSecret(length = 64) {
  return crypto.randomBytes(length).toString('base64url');
}

function setupSecret(environment = 'development') {
  console.log(`Setting up JWT secret for ${environment} environment...`);
  
  // Generate a secure secret
  const secret = generateSecureSecret(environment === 'production' ? 64 : 32);
  
  console.log(`Generated secret length: ${secret.length} characters`);
  console.log(`Secret preview: ${secret.substring(0, 8)}...${secret.substring(secret.length - 8)}`);
  
  // Construct wrangler command
  const envFlag = environment !== 'development' ? ` --env ${environment}` : '';
  const command = `wrangler secret put JWT_SECRET${envFlag}`;
  
  console.log(`\nTo set this secret, run:`);
  console.log(`echo "${secret}" | ${command}`);
  console.log(`\nOr run the command and paste the secret when prompted:`);
  console.log(command);
  
  return secret;
}

// Parse command line arguments
const environment = process.argv[2] || 'development';

if (!['development', 'staging', 'production'].includes(environment)) {
  console.error('Invalid environment. Use: development, staging, or production');
  process.exit(1);
}

try {
  setupSecret(environment);
} catch (error) {
  console.error('Error setting up secret:', error.message);
  process.exit(1);
}