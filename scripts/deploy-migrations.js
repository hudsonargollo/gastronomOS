#!/usr/bin/env node

/**
 * Deployment script for database migrations
 * This script applies migrations to the D1 database
 */

const { execSync } = require('child_process');

function runCommand(command, description) {
  console.log(`\n🔄 ${description}...`);
  try {
    execSync(command, { stdio: 'inherit' });
    console.log(`✅ ${description} completed successfully`);
  } catch (error) {
    console.error(`❌ ${description} failed:`, error.message);
    process.exit(1);
  }
}

function main() {
  console.log('🚀 Starting database migration deployment...');
  
  // Generate new migrations if schema has changed
  runCommand('npm run db:generate', 'Generating migrations');
  
  // Apply migrations to production database
  runCommand('npm run db:migrate', 'Applying migrations to production');
  
  console.log('\n🎉 Database migration deployment completed successfully!');
}

// Run the deployment if this script is executed directly
if (require.main === module) {
  main();
}