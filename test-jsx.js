const fs = require('fs');
const path = require('path');

const filePath = './ClubOSV1-frontend/src/pages/operations.tsx';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

// Find unmatched JSX elements
let jsxStack = [];
let inString = false;
let stringDelimiter = '';

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const lineNum = i + 1;
  
  // Skip comment lines
  if (line.trim().startsWith('//') || line.trim().startsWith('/*')) continue;
  
  // Simple JSX detection (not perfect but should catch most issues)
  // Look for opening tags
  const openingMatches = line.match(/<([A-Za-z]+|>)/g);
  if (openingMatches) {
    openingMatches.forEach(match => {
      if (match === '<>') {
        jsxStack.push({ type: 'fragment', line: lineNum });
      } else if (match.match(/<[A-Z]/)) {
        const tagName = match.slice(1);
        // Check if it's not self-closing
        if (!line.includes(`<${tagName}`) || !line.includes('/>')) {
          jsxStack.push({ type: 'component', tag: tagName, line: lineNum });
        }
      }
    });
  }
  
  // Look for closing tags
  const closingMatches = line.match(/<\/([A-Za-z]+|>)/g);
  if (closingMatches) {
    closingMatches.forEach(match => {
      if (match === '</>') {
        const lastOpen = jsxStack.pop();
        if (!lastOpen || lastOpen.type !== 'fragment') {
          console.log(`Line ${lineNum}: Closing fragment without opening`);
        }
      } else {
        const tagName = match.slice(2, -1);
        const lastOpen = jsxStack.pop();
        if (!lastOpen || (lastOpen.type === 'component' && lastOpen.tag !== tagName)) {
          console.log(`Line ${lineNum}: Mismatched closing tag </${tagName}>`);
        }
      }
    });
  }
}

if (jsxStack.length > 0) {
  console.log('\nUnclosed elements:');
  jsxStack.forEach(item => {
    console.log(`- ${item.type} at line ${item.line}${item.tag ? ` (${item.tag})` : ''}`);
  });
}

// Find the main return statement
const returnMatch = content.match(/^\s*return\s*\(/m);
if (returnMatch) {
  const returnIndex = content.indexOf(returnMatch[0]);
  const beforeReturn = content.substring(0, returnIndex);
  const linesBefore = beforeReturn.split('\n').length;
  console.log(`\nMain return statement starts at line ${linesBefore + 1}`);
}