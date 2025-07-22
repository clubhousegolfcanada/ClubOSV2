#!/bin/bash

# Test user creation
cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1

echo "Testing user creation functionality..."
echo "=================================="

# Make sure we have axios installed
if ! npm list axios > /dev/null 2>&1; then
    echo "Installing axios..."
    npm install axios
fi

# Run the test
node test-scripts/test-user-creation.js
