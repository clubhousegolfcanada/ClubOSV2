#!/bin/bash

echo "🔧 Running authentication diagnostics..."
echo ""
echo "Please run these commands in your browser console (F12):"
echo ""
echo "1. Check if you're logged in:"
echo "   localStorage.getItem('clubos_token')"
echo ""
echo "2. Check user data:"
echo "   localStorage.getItem('clubos_user')"
echo ""
echo "3. Test the feedback endpoint directly:"
echo "   fetch('https://clubosv2-production.up.railway.app/api/feedback', {"
echo "     method: 'POST',"
echo "     headers: {"
echo "       'Content-Type': 'application/json',"
echo "       'Authorization': 'Bearer ' + localStorage.getItem('clubos_token')"
echo "     },"
echo "     body: JSON.stringify({"
echo "       timestamp: new Date().toISOString(),"
echo "       requestDescription: 'Test',"
echo "       location: 'Test',"
echo "       route: 'Auto',"
echo "       response: 'Test',"
echo "       confidence: 0.8,"
echo "       isUseful: false,"
echo "       feedbackType: 'not_useful'"
echo "     })"
echo "   }).then(r => r.json()).then(console.log).catch(console.error)"
echo ""
echo "If you get a 401 error, you need to log in again."
echo "If the token is null or undefined, you need to log in."
