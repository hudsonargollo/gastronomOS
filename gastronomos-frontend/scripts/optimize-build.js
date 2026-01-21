#!/usr/bin/env node

/**
 * Build Optimization Script
 * Analyzes and optimizes the production build
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Colors for console output
const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  log(`\n${colors.bold}=== ${title} ===${colors.reset}`, 'blue');
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function analyzeBundle() {
  logSection('Bundle Analysis');
  
  const buildDir = path.join(__dirname, '../.next');
  
  if (!fs.existsSync(buildDir)) {
    log('Build directory not found. Running build first...', 'yellow');
    try {
      execSync('npm run build', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
    } catch (error) {
      log('Build failed!', 'red');
      process.exit(1);
    }
  }

  // Analyze static files
  const staticDir = path.join(buildDir, 'static');
  if (fs.existsSync(staticDir)) {
    analyzeStaticFiles(staticDir);
  }

  // Analyze pages
  const pagesDir = path.join(buildDir, 'server/pages');
  if (fs.existsSync(pagesDir)) {
    analyzePages(pagesDir);
  }
}

function analyzeStaticFiles(staticDir) {
  log('\n📦 Static Files Analysis:', 'blue');
  
  const chunks = [];
  
  function walkDir(dir, prefix = '') {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        walkDir(filePath, `${prefix}${file}/`);
      } else if (file.endsWith('.js') || file.endsWith('.css')) {
        const size = stat.size;
        chunks.push({
          name: `${prefix}${file}`,
          size,
          type: file.endsWith('.js') ? 'JavaScript' : 'CSS',
        });
      }
    }
  }
  
  walkDir(staticDir);
  
  // Sort by size (largest first)
  chunks.sort((a, b) => b.size - a.size);
  
  let totalSize = 0;
  let jsSize = 0;
  let cssSize = 0;
  
  log('\nLargest chunks:');
  chunks.slice(0, 10).forEach(chunk => {
    const sizeStr = formatBytes(chunk.size);
    const color = chunk.size > 500000 ? 'red' : chunk.size > 250000 ? 'yellow' : 'green';
    log(`  ${chunk.name}: ${sizeStr}`, color);
    
    totalSize += chunk.size;
    if (chunk.type === 'JavaScript') jsSize += chunk.size;
    else cssSize += chunk.size;
  });
  
  log(`\nTotal analyzed: ${formatBytes(totalSize)}`, 'bold');
  log(`JavaScript: ${formatBytes(jsSize)}`, 'blue');
  log(`CSS: ${formatBytes(cssSize)}`, 'blue');
  
  // Check for optimization opportunities
  const largeChunks = chunks.filter(c => c.size > 500000);
  if (largeChunks.length > 0) {
    log('\n⚠️  Large chunks detected (>500KB):', 'yellow');
    largeChunks.forEach(chunk => {
      log(`  - ${chunk.name}: ${formatBytes(chunk.size)}`, 'yellow');
    });
    log('Consider code splitting or lazy loading for these chunks.', 'yellow');
  }
}

function analyzePages(pagesDir) {
  log('\n📄 Pages Analysis:', 'blue');
  
  const pages = [];
  
  function walkPages(dir, prefix = '') {
    if (!fs.existsSync(dir)) return;
    
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        walkPages(filePath, `${prefix}${file}/`);
      } else if (file.endsWith('.js') || file.endsWith('.html')) {
        const size = stat.size;
        pages.push({
          name: `${prefix}${file}`,
          size,
        });
      }
    }
  }
  
  walkPages(pagesDir);
  
  if (pages.length > 0) {
    pages.sort((a, b) => b.size - a.size);
    
    log('\nPage sizes:');
    pages.slice(0, 10).forEach(page => {
      const sizeStr = formatBytes(page.size);
      const color = page.size > 100000 ? 'yellow' : 'green';
      log(`  ${page.name}: ${sizeStr}`, color);
    });
  }
}

function checkPerformanceMetrics() {
  logSection('Performance Metrics Check');
  
  // Check if performance monitoring is enabled
  const perfMonitorPath = path.join(__dirname, '../src/lib/performance-monitoring.ts');
  if (fs.existsSync(perfMonitorPath)) {
    log('✅ Performance monitoring system is available', 'green');
  } else {
    log('❌ Performance monitoring system not found', 'red');
  }
  
  // Check for optimization features
  const nextConfigPath = path.join(__dirname, '../next.config.ts');
  if (fs.existsSync(nextConfigPath)) {
    const config = fs.readFileSync(nextConfigPath, 'utf8');
    
    const optimizations = [
      { name: 'Bundle splitting', check: 'splitChunks' },
      { name: 'Image optimization', check: 'images:' },
      { name: 'Compression', check: 'compress: true' },
      { name: 'Package optimization', check: 'optimizePackageImports' },
    ];
    
    log('\nNext.js optimizations:');
    optimizations.forEach(opt => {
      const enabled = config.includes(opt.check);
      const status = enabled ? '✅' : '❌';
      const color = enabled ? 'green' : 'red';
      log(`  ${status} ${opt.name}`, color);
    });
  }
}

function generateOptimizationReport() {
  logSection('Optimization Recommendations');
  
  const recommendations = [
    {
      category: 'Bundle Optimization',
      items: [
        'Enable tree shaking for unused code elimination',
        'Implement dynamic imports for large components',
        'Use Next.js built-in bundle analyzer',
        'Optimize third-party library imports',
      ],
    },
    {
      category: 'Performance Monitoring',
      items: [
        'Enable Core Web Vitals tracking',
        'Implement real-time performance monitoring',
        'Set up performance budgets',
        'Monitor bundle size changes in CI/CD',
      ],
    },
    {
      category: 'Loading Optimization',
      items: [
        'Implement progressive loading strategies',
        'Use service workers for caching',
        'Optimize critical rendering path',
        'Implement resource hints (preload, prefetch)',
      ],
    },
    {
      category: 'Runtime Optimization',
      items: [
        'Implement virtual scrolling for large lists',
        'Use React.memo for expensive components',
        'Optimize animation performance',
        'Implement efficient state management',
      ],
    },
  ];
  
  recommendations.forEach(category => {
    log(`\n${category.category}:`, 'bold');
    category.items.forEach(item => {
      log(`  • ${item}`, 'blue');
    });
  });
}

function runAccessibilityCheck() {
  logSection('Accessibility Check');
  
  try {
    // Check if accessibility tests exist
    const a11yTestPath = path.join(__dirname, '../src/test/accessibility');
    if (fs.existsSync(a11yTestPath)) {
      log('✅ Accessibility tests found', 'green');
      
      // Run accessibility tests
      log('Running accessibility tests...', 'blue');
      try {
        execSync('npx vitest run src/test/accessibility --reporter=basic', {
          stdio: 'pipe',
          cwd: path.join(__dirname, '..'),
        });
        log('✅ Accessibility tests passed', 'green');
      } catch (error) {
        log('⚠️  Some accessibility tests failed - check test output', 'yellow');
      }
    } else {
      log('❌ No accessibility tests found', 'red');
    }
  } catch (error) {
    log('❌ Accessibility check failed', 'red');
  }
}

function main() {
  log(`${colors.bold}🚀 Build Optimization Analysis${colors.reset}`, 'blue');
  log('Analyzing production build for optimization opportunities...\n');
  
  try {
    analyzeBundle();
    checkPerformanceMetrics();
    runAccessibilityCheck();
    generateOptimizationReport();
    
    log('\n✅ Analysis complete!', 'green');
    log('Review the recommendations above to improve your application performance.', 'blue');
    
  } catch (error) {
    log(`\n❌ Analysis failed: ${error.message}`, 'red');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  analyzeBundle,
  checkPerformanceMetrics,
  generateOptimizationReport,
};