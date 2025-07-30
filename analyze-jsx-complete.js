const fs = require('fs');

const filePath = './ClubOSV1-frontend/src/pages/operations.tsx';
const content = fs.readFileSync(filePath, 'utf8');

// Remove all multi-line comments first to avoid confusion
const cleanedContent = content.replace(/\/\*[\s\S]*?\*\//g, '');

// Find the Operations function
const operationsMatch = cleanedContent.match(/export default function Operations\(\)\s*{/);
if (!operationsMatch) {
  console.error('Could not find Operations function');
  process.exit(1);
}

const startIndex = operationsMatch.index + operationsMatch[0].length;

// Track braces to find the end of the function
let braceCount = 1;
let i = startIndex;
let inString = false;
let stringChar = '';
let inJSX = false;

while (i < cleanedContent.length && braceCount > 0) {
  const char = cleanedContent[i];
  const nextChar = cleanedContent[i + 1];
  
  // Handle string literals
  if (!inString && (char === '"' || char === "'" || char === '`')) {
    inString = true;
    stringChar = char;
  } else if (inString && char === stringChar && cleanedContent[i - 1] !== '\\') {
    inString = false;
  }
  
  if (!inString) {
    if (char === '{') braceCount++;
    if (char === '}') braceCount--;
  }
  
  i++;
}

const functionBody = cleanedContent.substring(startIndex, i - 1);

// Find all return statements
const returnMatches = [...functionBody.matchAll(/return\s*\(/g)];
console.log(`Found ${returnMatches.length} return statements`);

// Check for nested component definitions
const nestedComponents = [...functionBody.matchAll(/const\s+\w+\s*=\s*\([^)]*\)\s*=>\s*{/g)];
console.log(`Found ${nestedComponents.length} arrow function components inside Operations`);

// Find the main return statement (should be the last one)
const mainReturnIndex = functionBody.lastIndexOf('return (');
if (mainReturnIndex === -1) {
  console.error('Could not find main return statement');
  process.exit(1);
}

console.log(`Main return statement at position ${mainReturnIndex}`);

// Extract everything before the main return
const beforeReturn = functionBody.substring(0, mainReturnIndex);

// Count opening and closing JSX fragments in the main return
const afterReturn = functionBody.substring(mainReturnIndex);
const openFragments = (afterReturn.match(/<>/g) || []).length;
const closeFragments = (afterReturn.match(/<\/>/g) || []).length;

console.log(`In main return: ${openFragments} opening fragments, ${closeFragments} closing fragments`);

if (openFragments !== closeFragments) {
  console.log('Fragment mismatch detected in main return!');
  console.log(`Difference: ${openFragments - closeFragments} unclosed fragments`);
}