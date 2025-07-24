#!/bin/bash

# Quick fix to add better error logging and authentication check

echo "🔍 Adding authentication diagnostics to feedback..."

# Create a simple test file to check if authentication is working
cat > test-auth.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>ClubOS Auth Test</title>
</head>
<body>
    <h1>ClubOS Authentication Test</h1>
    <button onclick="checkAuth()">Check Authentication</button>
    <button onclick="testFeedbackAPI()">Test Feedback API</button>
    <pre id="output"></pre>

    <script>
        const API_URL = 'https://clubosv2-production.up.railway.app/api';
        
        function log(message) {
            document.getElementById('output').textContent += message + '\n';
        }

        function checkAuth() {
            log('=== Checking Authentication ===');
            const token = localStorage.getItem('clubos_token');
            const user = localStorage.getItem('clubos_user');
            
            log('Token exists: ' + !!token);
            if (token) {
                log('Token (first 20 chars): ' + token.substring(0, 20) + '...');
                
                try {
                    const parts = token.split('.');
                    if (parts.length === 3) {
                        const payload = JSON.parse(atob(parts[1]));
                        log('Token payload: ' + JSON.stringify(payload, null, 2));
                        const expDate = new Date(payload.exp * 1000);
                        log('Token expires: ' + expDate);
                        log('Is expired: ' + (expDate < new Date()));
                    }
                } catch (e) {
                    log('Could not decode token: ' + e.message);
                }
            }
            
            if (user) {
                log('User data: ' + user);
            }
        }

        async function testFeedbackAPI() {
            log('\n=== Testing Feedback API ===');
            const token = localStorage.getItem('clubos_token');
            
            if (!token) {
                log('ERROR: No token found. Please log in first.');
                return;
            }

            const feedbackData = {
                timestamp: new Date().toISOString(),
                requestDescription: 'Test feedback request',
                location: 'Test location',
                route: 'Auto',
                response: 'Test response',
                confidence: 0.8,
                isUseful: false,
                feedbackType: 'not_useful'
            };

            try {
                log('Sending feedback to: ' + API_URL + '/feedback');
                log('Feedback data: ' + JSON.stringify(feedbackData, null, 2));
                
                const response = await fetch(API_URL + '/feedback', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify(feedbackData)
                });

                log('Response status: ' + response.status);
                log('Response headers:');
                response.headers.forEach((value, key) => {
                    log('  ' + key + ': ' + value);
                });

                const data = await response.json();
                log('Response data: ' + JSON.stringify(data, null, 2));
            } catch (error) {
                log('ERROR: ' + error.message);
            }
        }
    </script>
</body>
</html>
EOF

echo "✅ Created test-auth.html"
echo ""
echo "To test authentication:"
echo "1. Open test-auth.html in your browser"
echo "2. Click 'Check Authentication' to see your current auth status"
echo "3. Click 'Test Feedback API' to test the feedback endpoint directly"
echo ""
echo "This will help us identify if the issue is:"
echo "- Missing/expired token"
echo "- CORS issues"
echo "- API endpoint problems"
