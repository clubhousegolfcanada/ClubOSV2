#!/usr/bin/env node

/**
 * Script to replace console.log statements with logger service calls
 * 
 * Usage: node scripts/replace-console-logs.js [--dry-run]
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

const isDryRun = process.argv.includes('--dry-run');

// Patterns to replace
const replacements = [
  // Basic console.log
  {
    pattern: /console\.log\(/g,
    replacement: 'logger.debug(',
    importNeeded: true
  },
  // Console.warn
  {
    pattern: /console\.warn\(/g,
    replacement: 'logger.warn(',
    importNeeded: true
  },
  // Console.error (keep as logger.error)
  {
    pattern: /console\.error\(/g,
    replacement: 'logger.error(',
    importNeeded: true
  },
  // Debug logs that should be removed in production
  {
    pattern: /console\.log\(\s*['"`]\[.*?Debug.*?\]['"`]/gi,
    replacement: 'logger.debug(',
    importNeeded: true
  },
  // Axios interceptor logs
  {
    pattern: /console\.log\(\s*['"`]\[Axios.*?\]['"`]/gi,
    replacement: '// logger.debug(',
    importNeeded: false
  }
];

// Files to skip
const skipFiles = [
  'logger.ts',
  'logger.js',
  '.test.',
  '.spec.',
  'node_modules',
  'dist',
  'build',
  '.next'
];

// Find all TypeScript/JavaScript files
const files = glob.sync('ClubOSV1-frontend/src/**/*.{ts,tsx,js,jsx}', {
  ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.next/**']
});

console.log(`Found ${files.length} files to process`);

let totalReplacements = 0;
let filesModified = 0;

files.forEach(file => {
  // Skip if file matches skip patterns
  if (skipFiles.some(skip => file.includes(skip))) {
    return;
  }

  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;
  let hasChanges = false;
  let needsImport = false;

  // Apply replacements
  replacements.forEach(({ pattern, replacement, importNeeded }) => {
    const matches = content.match(pattern);
    if (matches) {
      content = content.replace(pattern, replacement);
      hasChanges = true;
      totalReplacements += matches.length;
      if (importNeeded) {
        needsImport = true;
      }
    }
  });

  // Add import if needed
  if (needsImport && hasChanges && !content.includes("from '@/services/logger'") && !content.includes("from '../services/logger'")) {
    // Check if file already has imports
    const hasImports = content.match(/^import .* from/m);
    
    if (hasImports) {
      // Add after last import
      const importRegex = /^((?:import .* from .*;\n)*)/m;
      content = content.replace(importRegex, (match) => {
        return match + "import logger from '@/services/logger';\n";
      });
    } else {
      // Add at the beginning
      content = "import logger from '@/services/logger';\n\n" + content;
    }
  }

  // Write changes
  if (hasChanges) {
    if (isDryRun) {
      console.log(`Would modify: ${file}`);
      // Show first few changes
      const diff = originalContent.split('\n').slice(0, 50).join('\n');
      console.log('Preview:', diff.substring(0, 200) + '...\n');
    } else {
      fs.writeFileSync(file, content);
      console.log(`Modified: ${file}`);
    }
    filesModified++;
  }
});

console.log('\nSummary:');
console.log(`Files modified: ${filesModified}`);
console.log(`Total replacements: ${totalReplacements}`);

if (isDryRun) {
  console.log('\nThis was a dry run. Run without --dry-run to apply changes.');
} else {
  console.log('\nDone! Remember to:');
  console.log('1. Review the changes');
  console.log('2. Test the application');
  console.log('3. Commit the changes');
}