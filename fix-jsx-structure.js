const fs = require('fs');

const filePath = './ClubOSV1-frontend/src/pages/operations.tsx';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

// Find the renderCleaningContent function
let startLine = -1;
let endLine = -1;
let braceCount = 0;
let inFunction = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  if (line.includes('const renderCleaningContent = () => {')) {
    startLine = i;
    inFunction = true;
    braceCount = 1;
    continue;
  }
  
  if (inFunction) {
    // Count braces
    for (let char of line) {
      if (char === '{') braceCount++;
      if (char === '}') braceCount--;
    }
    
    // Check if function ended
    if (braceCount === 0 && line.trim().endsWith('};')) {
      endLine = i;
      break;
    }
  }
}

console.log(`Found renderCleaningContent from line ${startLine + 1} to ${endLine + 1}`);

// Remove the function
if (startLine !== -1 && endLine !== -1) {
  lines.splice(startLine, endLine - startLine + 1);
  
  // Write back
  fs.writeFileSync(filePath, lines.join('\n'));
  console.log('Function removed successfully');
} else {
  console.log('Function not found');
}