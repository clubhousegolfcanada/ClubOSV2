#!/bin/bash

# ============================================
# ACTIVATE PATTERN LEARNING - PRODUCTION READY
# Date: 2025-09-08
# ============================================

echo "========================================="
echo "ACTIVATING PATTERN LEARNING SYSTEM"
echo "========================================="
echo ""
echo "This script will:"
echo "1. Enable pattern learning in SHADOW MODE (safe)"
echo "2. Keep all patterns INACTIVE by default"
echo "3. Start learning from OpenPhone conversations"
echo "4. Populate patterns in V3-PLS page for review"
echo ""
echo "Safety features:"
echo "✅ Shadow mode ON - no auto-execution"
echo "✅ All patterns start inactive"
echo "✅ 95% confidence + 20 executions required"
echo "✅ Manual activation required for each pattern"
echo ""

# Run the SQL to enable pattern learning
railway run psql '$DATABASE_URL' < scripts/enable-pattern-learning.sql

echo ""
echo "========================================="
echo "ACTIVATION COMPLETE!"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Patterns will now be learned from operator responses"
echo "2. Check V3-PLS page at: https://clubos-frontend.vercel.app/operations"
echo "3. Monitor with: railway run psql '\$DATABASE_URL' < scripts/monitor-pattern-learning.sql"
echo ""
echo "To verify status:"
echo "railway run psql '\$DATABASE_URL' -c \"SELECT config_key, config_value FROM pattern_learning_config WHERE config_key IN ('enabled', 'shadow_mode');\""
echo ""
echo "To disable if needed:"
echo "railway run psql '\$DATABASE_URL' -c \"UPDATE pattern_learning_config SET config_value = 'false' WHERE config_key = 'enabled';\""
echo ""