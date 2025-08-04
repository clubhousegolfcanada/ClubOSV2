#!/bin/bash

echo "🔍 Checking Gift Card Knowledge in Database..."
echo "=========================================="

# Check knowledge_audit_log for gift card entries
echo -e "\n1. Checking knowledge_audit_log table for gift card entries:"
railway run psql -c "SELECT id, category, key, new_value, assistant_target, created_at FROM knowledge_audit_log WHERE LOWER(new_value) LIKE '%gift%card%' OR LOWER(category) LIKE '%gift%' OR LOWER(key) LIKE '%gift%' ORDER BY created_at DESC LIMIT 5;"

# Check if gift_cards automation is enabled
echo -e "\n2. Checking if gift_cards automation is enabled:"
railway run psql -c "SELECT feature_key, feature_name, enabled, config FROM ai_automation_features WHERE feature_key = 'gift_cards';"

# Test the assistant knowledge search
echo -e "\n3. Testing knowledge search for 'gift cards':"
railway run psql -c "SELECT * FROM knowledge_audit_log WHERE LOWER(new_value) LIKE '%gift%card%' OR LOWER(new_value) LIKE '%giftcard%' ORDER BY created_at DESC LIMIT 1;"

# Check recent OpenPhone messages
echo -e "\n4. Checking recent OpenPhone conversations for gift card mentions:"
railway run psql -c "SELECT id, phone_number, messages::text, created_at FROM openphone_conversations WHERE messages::text ILIKE '%gift%card%' OR messages::text ILIKE '%giftcard%' ORDER BY created_at DESC LIMIT 3;"

# Check AI automation usage
echo -e "\n5. Checking recent AI automation usage:"
railway run psql -c "SELECT feature_id, trigger_type, success, error_message, created_at FROM ai_automation_usage WHERE feature_id IN (SELECT id FROM ai_automation_features WHERE feature_key = 'gift_cards') ORDER BY created_at DESC LIMIT 5;"

echo -e "\n✅ Knowledge audit complete!"