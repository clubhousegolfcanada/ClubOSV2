#!/bin/bash

# Railway PostgreSQL setup script for user_settings table
# This script creates the user_settings table in your Railway PostgreSQL database

echo "Setting up user_settings table in Railway PostgreSQL..."

# Get the DATABASE_URL from your Railway environment
# You should have this in your .env file or Railway environment variables
DATABASE_URL="${DATABASE_URL}"

if [ -z "$DATABASE_URL" ]; then
  echo "Error: DATABASE_URL not found. Please set it in your environment."
  echo "You can find it in your Railway project's PostgreSQL plugin variables."
  exit 1
fi

# Create the SQL command
SQL_COMMAND="
-- User Settings table for storing user-specific preferences
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  setting_key VARCHAR(255) NOT NULL,
  setting_value TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, setting_key)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS \$\$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
\$\$ language 'plpgsql';

-- Apply trigger to user_settings
DROP TRIGGER IF EXISTS update_user_settings_updated_at ON user_settings;
CREATE TRIGGER update_user_settings_updated_at 
  BEFORE UPDATE ON user_settings 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();
"

# Execute the SQL
echo "Creating user_settings table..."
psql "$DATABASE_URL" -c "$SQL_COMMAND"

if [ $? -eq 0 ]; then
  echo "✅ Successfully created user_settings table!"
  
  # Verify the table was created
  echo -e "\nVerifying table structure..."
  psql "$DATABASE_URL" -c "\d user_settings"
  
  echo -e "\nSetup complete! The user_settings table is ready to use."
else
  echo "❌ Failed to create user_settings table. Please check your DATABASE_URL and try again."
  exit 1
fi
