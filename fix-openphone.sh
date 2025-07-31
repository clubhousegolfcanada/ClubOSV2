#!/bin/bash

# OpenPhone Column Fix Script
# This script fixes the column type issue in the openphone_conversations table

echo "OpenPhone Column Fix Script"
echo "=========================="
echo ""

# Connection details from Railway
DATABASE_URL="postgresql://postgres:FnlIdpRyrGXKyzhLEdxTCxuVXJcOyxeI@yamanote.proxy.rlwy.net:31482/railway"

echo "Connecting to Railway database..."
echo ""

# Execute the SQL fix
psql "$DATABASE_URL" << EOF
-- Fix column types
ALTER TABLE openphone_conversations 
ALTER COLUMN conversation_id TYPE VARCHAR(255),
ALTER COLUMN phone_number TYPE VARCHAR(20),
ALTER COLUMN customer_name TYPE VARCHAR(255),
ALTER COLUMN employee_name TYPE VARCHAR(255);

-- Show results
SELECT 
    column_name,
    data_type,
    character_maximum_length
FROM information_schema.columns
WHERE table_name = 'openphone_conversations'
AND column_name IN ('conversation_id', 'phone_number', 'customer_name', 'employee_name');
EOF

echo ""
echo "Column fix complete!"
echo ""
echo "You can now test by sending a message through OpenPhone."