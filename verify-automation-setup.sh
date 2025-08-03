#!/bin/bash

echo "🔍 Verifying Gift Card Automation Setup"
echo "======================================="

# Check if migrations exist
echo -e "\n1️⃣ Checking database migrations..."
if [ -f "ClubOSV1-backend/src/database/migrations/031_add_automation_response_limits.sql" ]; then
    echo "✅ Response limits migration exists"
else
    echo "❌ Response limits migration missing!"
fi

if [ -f "ClubOSV1-backend/src/database/migrations/032_remove_extra_automations.sql" ]; then
    echo "✅ Cleanup migration exists"
else
    echo "❌ Cleanup migration missing!"
fi

# Check key files
echo -e "\n2️⃣ Checking key service files..."
files=(
    "ClubOSV1-backend/src/services/aiAutomationService.ts"
    "ClubOSV1-backend/src/services/aiAutomationPatterns.ts"
    "ClubOSV1-backend/src/routes/ai-automations.ts"
    "ClubOSV1-backend/src/routes/openphone.ts"
)

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file exists"
    else
        echo "❌ $file missing!"
    fi
done

# Check imports
echo -e "\n3️⃣ Checking critical imports..."
if grep -q "aiAutomationService" "ClubOSV1-backend/src/routes/openphone.ts"; then
    echo "✅ OpenPhone webhook imports aiAutomationService"
else
    echo "❌ OpenPhone webhook missing aiAutomationService import!"
fi

if grep -q "calculateConfidence" "ClubOSV1-backend/src/services/aiAutomationService.ts"; then
    echo "✅ aiAutomationService imports pattern matching"
else
    echo "❌ aiAutomationService missing pattern matching import!"
fi

# Check webhook integration
echo -e "\n4️⃣ Checking webhook integration..."
if grep -q "automationResponse.*await.*aiAutomationService.processMessage" "ClubOSV1-backend/src/routes/openphone.ts"; then
    echo "✅ Webhook calls processMessage"
else
    echo "❌ Webhook not calling processMessage!"
fi

if grep -q "automationResponse.handled.*automationResponse.response" "ClubOSV1-backend/src/routes/openphone.ts"; then
    echo "✅ Webhook sends automated responses"
else
    echo "❌ Webhook not sending automated responses!"
fi

# Check UI integration
echo -e "\n5️⃣ Checking UI integration..."
if grep -q "maxResponses" "ClubOSV1-frontend/src/pages/operations.tsx"; then
    echo "✅ UI has maxResponses field"
else
    echo "❌ UI missing maxResponses field!"
fi

if grep -q "responseSource.*hardcoded.*database" "ClubOSV1-frontend/src/pages/operations.tsx"; then
    echo "✅ UI has response source toggle"
else
    echo "❌ UI missing response source toggle!"
fi

echo -e "\n✅ Verification complete!"