#!/usr/bin/env node

/**
 * Deployment script for GastronomOS Authentication Service
 * 
 * This script handles deployment to different environments with proper
 * secret management and database migration.
 * 
 * Usage:
 *   npm run deploy:dev
 *   npm run deploy:staging  
 *   npm run deploy:prod
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Environment configurations
const ENVIRONMENTS = {
  development: {
    name: 'development',
    dbName: 'gastronomos-dev',
    requiredSecrets: ['JWT_SECRET'],
    optionalSecrets: ['ADMIN_API_KEY'],
  },
  staging: {
    name: 'staging',
    dbName: 'gastronomos-staging',
    requiredSecrets: ['JWT_SECRET'],
    optionalSecrets: ['ADMIN_API_KEY', 'DATABASE_ENCRYPTION_KEY'],
  },
  production: {
    name: 'production',
    dbName: 'gastronomos-prod',
    requiredSecrets: ['JWT_SECRET'],
    optionalSecrets: ['ADMIN_API_KEY', 'DATABASE_ENCRYPTION_KEY'],
  },
};

class DeploymentManager {
  constructor(environment) {
    this.env = environment;
    this.config = ENVIRONMENTS[environment];
    
    if (!this.config) {
      throw new Error(`Unknown environment: ${environment}`);
    }
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : '✅';
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  async checkPrerequisites() {
    this.log('Checking deployment prerequisites...');

    // Check if wrangler is installed
    try {
      execSync('wrangler --version', { stdio: 'pipe' });
      this.log('Wrangler CLI is available');
    } catch (error) {
      throw new Error('Wrangler CLI is not installed. Run: npm install -g wrangler');
    }

    // Check if user is authenticated
    try {
      execSync('wrangler whoami', { stdio: 'pipe' });
      this.log('Wrangler authentication verified');
    } catch (error) {
      throw new Error('Not authenticated with Wrangler. Run: wrangler login');
    }

    // Check if TypeScript builds successfully
    try {
      this.log('Building TypeScript...');
      execSync('npm run build', { stdio: 'inherit' });
      this.log('TypeScript build successful');
    } catch (error) {
      throw new Error('TypeScript build failed. Fix build errors before deploying.');
    }
  }

  async checkSecrets() {
    this.log('Checking required secrets...');

    for (const secret of this.config.requiredSecrets) {
      try {
        // Note: wrangler secret list doesn't show secret values for security
        // We'll just warn the user to ensure secrets are set
        this.log(`Ensure secret '${secret}' is set for ${this.env} environment`, 'warn');
      } catch (error) {
        this.log(`Failed to verify secret '${secret}': ${error.message}`, 'error');
      }
    }

    this.log('Secret verification complete (manual verification required)');
  }

  async runMigrations() {
    this.log('Running database migrations...');

    try {
      // Run migrations for the specific environment
      const migrationCommand = `wrangler d1 migrations apply ${this.config.dbName} --env ${this.env}`;
      this.log(`Executing: ${migrationCommand}`);
      
      execSync(migrationCommand, { stdio: 'inherit' });
      this.log('Database migrations completed successfully');
    } catch (error) {
      throw new Error(`Migration failed: ${error.message}`);
    }
  }

  async deployWorker() {
    this.log(`Deploying to ${this.env} environment...`);

    try {
      const deployCommand = `wrangler deploy --env ${this.env}`;
      this.log(`Executing: ${deployCommand}`);
      
      execSync(deployCommand, { stdio: 'inherit' });
      this.log(`Deployment to ${this.env} completed successfully`);
    } catch (error) {
      throw new Error(`Deployment failed: ${error.message}`);
    }
  }

  async runHealthCheck() {
    this.log('Running post-deployment health check...');

    // In a real deployment, you would make HTTP requests to verify the service
    // For now, we'll just log that this step should be implemented
    this.log('Health check should be implemented to verify deployment', 'warn');
    this.log('Manual verification recommended: check worker logs and test endpoints');
  }

  async deploy() {
    try {
      this.log(`Starting deployment to ${this.env} environment`);
      
      await this.checkPrerequisites();
      await this.checkSecrets();
      await this.runMigrations();
      await this.deployWorker();
      await this.runHealthCheck();
      
      this.log(`🎉 Deployment to ${this.env} completed successfully!`);
      
      // Print useful post-deployment information
      this.printPostDeploymentInfo();
      
    } catch (error) {
      this.log(`Deployment failed: ${error.message}`, 'error');
      process.exit(1);
    }
  }

  printPostDeploymentInfo() {
    console.log('\n📋 Post-Deployment Checklist:');
    console.log('1. Verify worker is responding at the deployed URL');
    console.log('2. Test authentication endpoints');
    console.log('3. Check worker logs for any errors');
    console.log('4. Verify database connectivity');
    console.log('5. Test tenant isolation');
    
    console.log('\n🔧 Useful Commands:');
    console.log(`- View logs: wrangler tail --env ${this.env}`);
    console.log(`- Check secrets: wrangler secret list --env ${this.env}`);
    console.log(`- Database console: wrangler d1 execute ${this.config.dbName} --command "SELECT COUNT(*) FROM tenants" --env ${this.env}`);
  }
}

// Secret management utilities
class SecretManager {
  static generateJWTSecret() {
    // Generate a cryptographically secure random string for JWT signing
    const crypto = require('crypto');
    return crypto.randomBytes(64).toString('hex');
  }

  static async setSecret(secretName, environment, value) {
    try {
      const command = `wrangler secret put ${secretName} --env ${environment}`;
      console.log(`Setting secret ${secretName} for ${environment}...`);
      
      // Note: This would require interactive input for the secret value
      // In practice, secrets should be set manually or via CI/CD pipeline
      execSync(command, { stdio: 'inherit', input: value });
      
      console.log(`✅ Secret ${secretName} set successfully`);
    } catch (error) {
      console.error(`❌ Failed to set secret ${secretName}: ${error.message}`);
    }
  }

  static printSecretSetupInstructions(environment) {
    const config = ENVIRONMENTS[environment];
    if (!config) {
      console.error(`Unknown environment: ${environment}`);
      return;
    }

    console.log(`\n🔐 Secret Setup Instructions for ${environment}:`);
    console.log('Run these commands to set up required secrets:\n');

    config.requiredSecrets.forEach(secret => {
      console.log(`wrangler secret put ${secret} --env ${environment}`);
    });

    if (config.optionalSecrets.length > 0) {
      console.log('\nOptional secrets:');
      config.optionalSecrets.forEach(secret => {
        console.log(`wrangler secret put ${secret} --env ${environment}`);
      });
    }

    console.log('\n💡 Tips:');
    console.log('- JWT_SECRET should be at least 64 characters for production');
    console.log('- Use different secrets for each environment');
    console.log('- Store secrets securely in your password manager');
    console.log(`- Generate JWT secret: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const environment = args[1];

  switch (command) {
    case 'deploy':
      if (!environment || !ENVIRONMENTS[environment]) {
        console.error('Usage: node deploy.js deploy <environment>');
        console.error('Available environments:', Object.keys(ENVIRONMENTS).join(', '));
        process.exit(1);
      }
      
      const deployer = new DeploymentManager(environment);
      await deployer.deploy();
      break;

    case 'secrets':
      if (!environment || !ENVIRONMENTS[environment]) {
        console.error('Usage: node deploy.js secrets <environment>');
        console.error('Available environments:', Object.keys(ENVIRONMENTS).join(', '));
        process.exit(1);
      }
      
      SecretManager.printSecretSetupInstructions(environment);
      break;

    case 'generate-jwt-secret':
      console.log('Generated JWT Secret:');
      console.log(SecretManager.generateJWTSecret());
      console.log('\n⚠️  Store this secret securely and use it with: wrangler secret put JWT_SECRET');
      break;

    default:
      console.log('GastronomOS Authentication Service Deployment Tool\n');
      console.log('Available commands:');
      console.log('  deploy <environment>     - Deploy to specified environment');
      console.log('  secrets <environment>    - Show secret setup instructions');
      console.log('  generate-jwt-secret      - Generate a secure JWT secret');
      console.log('\nEnvironments:', Object.keys(ENVIRONMENTS).join(', '));
      break;
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the main function
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Deployment script failed:', error.message);
    process.exit(1);
  });
}

module.exports = { DeploymentManager, SecretManager };