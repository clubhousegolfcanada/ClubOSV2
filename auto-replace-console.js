const fs = require('fs');
const path = require('path');

let totalReplaced = 0;
let filesModified = 0;
const filesToSkip = ['logger.ts', 'logger.js']; // Don't modify logger itself

function replaceInFile(filePath) {
  // Skip logger files
  if (filesToSkip.some(skip => filePath.includes(skip))) {
    console.log(`⏭️  Skipping: ${filePath} (logger file)`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;
  let replacements = 0;
  
  // Check if logger is already imported
  const hasLoggerImport = content.includes("import logger") || 
                          content.includes("import { logger }") ||
                          content.includes('from "@/services/logger"') ||
                          content.includes("from '@/services/logger'");
  
  // Count console statements
  const logCount = (content.match(/console\.log\(/g) || []).length;
  const errorCount = (content.match(/console\.error\(/g) || []).length;
  const warnCount = (content.match(/console\.warn\(/g) || []).length;
  
  if (logCount + errorCount + warnCount === 0) {
    return;
  }

  // Add import if not present and console statements exist
  if (!hasLoggerImport && (logCount + errorCount + warnCount > 0)) {
    // Check if file already has imports
    const hasImports = content.includes('import ');
    if (hasImports) {
      // Add after the last import
      const lines = content.split('\n');
      let lastImportIndex = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('import ')) {
          lastImportIndex = i;
        }
      }
      if (lastImportIndex !== -1) {
        lines.splice(lastImportIndex + 1, 0, "import logger from '@/services/logger';");
        content = lines.join('\n');
      }
    } else {
      // Add at the beginning
      content = "import logger from '@/services/logger';\n\n" + content;
    }
  }
  
  // Replace console.log with logger.debug
  if (logCount > 0) {
    content = content.replace(/console\.log\(/g, 'logger.debug(');
    replacements += logCount;
  }
  
  // Replace console.error with logger.error
  if (errorCount > 0) {
    content = content.replace(/console\.error\(/g, 'logger.error(');
    replacements += errorCount;
  }
  
  // Replace console.warn with logger.warn
  if (warnCount > 0) {
    content = content.replace(/console\.warn\(/g, 'logger.warn(');
    replacements += warnCount;
  }
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ Updated: ${path.relative('ClubOSV1-frontend', filePath)} (${replacements} replacements)`);
    totalReplaced += replacements;
    filesModified++;
  }
}

// Process all TypeScript files
const processDirectory = (dir) => {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    // Skip node_modules and .next directories
    if (stat.isDirectory() && !file.includes('node_modules') && !file.includes('.next')) {
      processDirectory(fullPath);
    } else if ((file.endsWith('.ts') || file.endsWith('.tsx')) && !file.includes('.test.') && !file.includes('.spec.')) {
      replaceInFile(fullPath);
    }
  });
};

console.log('🔄 Starting console statement replacement...\n');
processDirectory('ClubOSV1-frontend/src');
console.log('\n📊 Summary:');
console.log(`   Files modified: ${filesModified}`);
console.log(`   Total replacements: ${totalReplaced}`);
console.log('\n✅ Complete! Now review the changes and test the application.');