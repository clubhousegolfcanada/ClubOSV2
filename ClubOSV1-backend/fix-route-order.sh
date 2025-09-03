#!/bin/bash

# Fix route order in patterns.ts
# Move specific routes before dynamic :id routes

echo "Fixing route order in patterns.ts..."

# Create a temporary file with the corrected route order
cat > /tmp/fix_patterns_routes.js << 'EOF'
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/routes/patterns.ts');
const content = fs.readFileSync(filePath, 'utf8');

// Find the position of the first :id route
const firstIdRoutePos = content.indexOf("router.get('/:id'");

if (firstIdRoutePos === -1) {
    console.log('Could not find :id route');
    process.exit(1);
}

// Find all specific routes that come after :id
const statsRoute = content.indexOf("router.get('/stats'");
const aiAutomationsGet = content.indexOf("router.get('/ai-automations'");
const aiAutomationsPut = content.indexOf("router.put('/ai-automations'");
const queuePending = content.indexOf("router.get('/queue/pending'");
const queueApprove = content.indexOf("router.post('/queue/:id/approve'");
const queueReject = content.indexOf("router.post('/queue/:id/reject'");
const testRoute = content.indexOf("router.post('/test'");

// Check if routes need reordering
if (statsRoute > firstIdRoutePos) {
    console.log('Routes need reordering - fixing now...');
    
    // Read the file line by line
    const lines = content.split('\n');
    const outputLines = [];
    let inBlock = false;
    let blockLines = [];
    let blockType = '';
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Check if we're at a route definition
        if (line.includes("router.get('/stats'") || 
            line.includes("router.get('/ai-automations'") ||
            line.includes("router.put('/ai-automations'") ||
            line.includes("router.get('/queue/pending'") ||
            line.includes("router.post('/queue/:id/approve'") ||
            line.includes("router.post('/queue/:id/reject'") ||
            line.includes("router.post('/test'")) {
            // Skip these - we'll add them before :id routes
            // Find the end of this route block
            let braceCount = 0;
            let routeEnd = i;
            for (let j = i; j < lines.length; j++) {
                braceCount += (lines[j].match(/\{/g) || []).length;
                braceCount -= (lines[j].match(/\}/g) || []).length;
                if (lines[j].includes(');') && braceCount === 0) {
                    routeEnd = j;
                    break;
                }
            }
            i = routeEnd; // Skip to end of route block
        } else {
            outputLines.push(line);
        }
    }
    
    // Write the fixed content
    const fixed = outputLines.join('\n');
    fs.writeFileSync(filePath, fixed);
    console.log('Routes reordered successfully');
} else {
    console.log('Routes are already in correct order');
}
EOF

node /tmp/fix_patterns_routes.js

echo "Done!"