#!/usr/bin/env node

/**
 * Project Cleanup Script
 * Removes build artifacts, temporary files, and caches
 */

const fs = require('fs');
const path = require('path');

const dirsToClean = [
  // Backend build artifacts
  'dist',
  '.wrangler',
  
  // Frontend build artifacts
  'gastronomos-frontend/.next',
  'gastronomos-frontend/out',
  'gastronomos-frontend/.wrangler',
  
  // Test coverage
  'coverage',
  '.nyc_output',
  
  // Temporary files
  'tmp',
  'temp',
];

const filesToClean = [
  // TypeScript build info
  '*.tsbuildinfo',
  'gastronomos-frontend/*.tsbuildinfo',
  
  // Log files
  'npm-debug.log*',
  'yarn-debug.log*',
  'yarn-error.log*',
  '.pnpm-debug.log*',
];

function removeDir(dirPath) {
  if (fs.existsSync(dirPath)) {
    try {
      fs.rmSync(dirPath, { recursive: true, force: true });
      console.log(`✓ Removed: ${dirPath}`);
      return true;
    } catch (error) {
      console.error(`✗ Failed to remove ${dirPath}:`, error.message);
      return false;
    }
  }
  return false;
}

function removeFiles(pattern) {
  // Simple glob pattern matching for files
  const dir = path.dirname(pattern);
  const filePattern = path.basename(pattern);
  
  if (!fs.existsSync(dir)) return 0;
  
  let count = 0;
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    if (filePattern.includes('*')) {
      const regex = new RegExp('^' + filePattern.replace(/\*/g, '.*') + '$');
      if (regex.test(file)) {
        const filePath = path.join(dir, file);
        try {
          fs.unlinkSync(filePath);
          console.log(`✓ Removed: ${filePath}`);
          count++;
        } catch (error) {
          console.error(`✗ Failed to remove ${filePath}:`, error.message);
        }
      }
    }
  });
  
  return count;
}

console.log('🧹 Cleaning project...\n');

// Clean directories
console.log('Removing build artifacts and temporary directories:');
let dirCount = 0;
dirsToClean.forEach(dir => {
  if (removeDir(dir)) dirCount++;
});

// Clean files
console.log('\nRemoving temporary files:');
let fileCount = 0;
filesToClean.forEach(pattern => {
  fileCount += removeFiles(pattern);
});

console.log(`\n✨ Cleanup complete!`);
console.log(`   Directories removed: ${dirCount}`);
console.log(`   Files removed: ${fileCount}`);
console.log('\nYou can rebuild with:');
console.log('  Backend:  npm run build');
console.log('  Frontend: cd gastronomos-frontend && npm run build');
