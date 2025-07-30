const fs = require('fs');

function analyzeJSXStructure(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  // Track JSX elements and fragments
  const stack = [];
  const issues = [];
  
  // Patterns to detect
  const openFragmentPattern = /<>/g;
  const closeFragmentPattern = /<\/>/g;
  const selfClosingPattern = /<\w+[^>]*\/>/g;
  const openTagPattern = /<(\w+)(\s[^>]*)?>/g;
  const closeTagPattern = /<\/(\w+)>/g;
  
  lines.forEach((line, index) => {
    const lineNum = index + 1;
    
    // Skip commented lines
    if (line.trim().startsWith('//') || line.trim().startsWith('/*') || line.trim().startsWith('*')) {
      return;
    }
    
    // Check for JSX fragments
    const openFragments = (line.match(openFragmentPattern) || []).length;
    const closeFragments = (line.match(closeFragmentPattern) || []).length;
    
    // Track fragment opens
    for (let i = 0; i < openFragments; i++) {
      stack.push({ type: 'fragment', line: lineNum, content: line.trim() });
    }
    
    // Track fragment closes
    for (let i = 0; i < closeFragments; i++) {
      if (stack.length === 0 || stack[stack.length - 1].type !== 'fragment') {
        issues.push(`Line ${lineNum}: Closing fragment </> without matching opening <>`);
      } else {
        stack.pop();
      }
    }
    
    // Remove self-closing tags from analysis
    const lineWithoutSelfClosing = line.replace(selfClosingPattern, '');
    
    // Check for regular JSX tags
    let match;
    const openTags = [];
    while ((match = openTagPattern.exec(lineWithoutSelfClosing)) !== null) {
      openTags.push(match[1]);
    }
    
    openTags.forEach(tag => {
      stack.push({ type: 'tag', tag, line: lineNum, content: line.trim() });
    });
    
    // Check for closing tags
    const closeTags = [];
    while ((match = closeTagPattern.exec(lineWithoutSelfClosing)) !== null) {
      closeTags.push(match[1]);
    }
    
    closeTags.forEach(tag => {
      if (stack.length === 0) {
        issues.push(`Line ${lineNum}: Closing tag </${tag}> without opening tag`);
      } else {
        const lastOpen = stack[stack.length - 1];
        if (lastOpen.type === 'tag' && lastOpen.tag === tag) {
          stack.pop();
        } else {
          issues.push(`Line ${lineNum}: Mismatched closing tag </${tag}>, expected ${lastOpen.type === 'fragment' ? '</>' : `</${lastOpen.tag}>`}`);
        }
      }
    });
  });
  
  // Report unclosed elements
  if (stack.length > 0) {
    console.log('\nUnclosed elements:');
    stack.forEach(item => {
      console.log(`- ${item.type === 'fragment' ? 'Fragment' : `Tag <${item.tag}>`} opened at line ${item.line}: ${item.content}`);
    });
  }
  
  // Report issues
  if (issues.length > 0) {
    console.log('\nIssues found:');
    issues.forEach(issue => console.log(`- ${issue}`));
  }
  
  // Check specific line 1099
  console.log('\nLine 1099 context:');
  for (let i = 1095; i <= 1105; i++) {
    if (lines[i - 1]) {
      console.log(`${i}: ${lines[i - 1]}`);
    }
  }
  
  console.log(`\nTotal unclosed elements: ${stack.length}`);
  console.log(`Total issues: ${issues.length}`);
}

analyzeJSXStructure('./ClubOSV1-frontend/src/pages/operations.tsx');