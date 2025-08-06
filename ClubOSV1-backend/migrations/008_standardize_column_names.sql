-- Migration: Standardize column names to snake_case
-- This migration renames columns from camelCase to snake_case for consistency

-- Users table
ALTER TABLE users 
  RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE users 
  RENAME COLUMN "updatedAt" TO updated_at;
ALTER TABLE users 
  RENAME COLUMN "lastLogin" TO last_login;
ALTER TABLE users 
  RENAME COLUMN "isActive" TO is_active;

-- Tickets table
ALTER TABLE tickets 
  RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE tickets 
  RENAME COLUMN "updatedAt" TO updated_at;

-- Feedback table
ALTER TABLE feedback 
  RENAME COLUMN "userId" TO user_id;
ALTER TABLE feedback 
  RENAME COLUMN "userEmail" TO user_email;
ALTER TABLE feedback 
  RENAME COLUMN "requestDescription" TO request_description;
ALTER TABLE feedback 
  RENAME COLUMN "isUseful" TO is_useful;
ALTER TABLE feedback 
  RENAME COLUMN "feedbackType" TO feedback_type;
ALTER TABLE feedback 
  RENAME COLUMN "feedbackSource" TO feedback_source;
ALTER TABLE feedback 
  RENAME COLUMN "slackThreadTs" TO slack_thread_ts;
ALTER TABLE feedback 
  RENAME COLUMN "slackUserName" TO slack_user_name;
ALTER TABLE feedback 
  RENAME COLUMN "slackUserId" TO slack_user_id;
ALTER TABLE feedback 
  RENAME COLUMN "slackChannel" TO slack_channel;
ALTER TABLE feedback 
  RENAME COLUMN "originalRequestId" TO original_request_id;
ALTER TABLE feedback 
  RENAME COLUMN "createdAt" TO created_at;

-- User_sessions table
ALTER TABLE user_sessions 
  RENAME COLUMN "userId" TO user_id;
ALTER TABLE user_sessions 
  RENAME COLUMN "expiresAt" TO expires_at;
ALTER TABLE user_sessions 
  RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE user_sessions 
  RENAME COLUMN "ipAddress" TO ip_address;
ALTER TABLE user_sessions 
  RENAME COLUMN "userAgent" TO user_agent;

-- Auth_logs table  
ALTER TABLE auth_logs 
  RENAME COLUMN "userId" TO user_id;
ALTER TABLE auth_logs 
  RENAME COLUMN "ipAddress" TO ip_address;
ALTER TABLE auth_logs 
  RENAME COLUMN "userAgent" TO user_agent;
ALTER TABLE auth_logs 
  RENAME COLUMN "createdAt" TO created_at;

-- Weekly_templates table
ALTER TABLE weekly_templates 
  RENAME COLUMN "hourlySlots" TO hourly_slots;
ALTER TABLE weekly_templates 
  RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE weekly_templates 
  RENAME COLUMN "updatedAt" TO updated_at;

-- Simulator_overrides table
ALTER TABLE simulator_overrides 
  RENAME COLUMN "overrideData" TO override_data;
ALTER TABLE simulator_overrides 
  RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE simulator_overrides 
  RENAME COLUMN "updatedAt" TO updated_at;

-- Booking_requests table
ALTER TABLE booking_requests 
  RENAME COLUMN "userId" TO user_id;
ALTER TABLE booking_requests 
  RENAME COLUMN "simulatorId" TO simulator_id;
ALTER TABLE booking_requests 
  RENAME COLUMN "preferredStartTime" TO preferred_start_time;
ALTER TABLE booking_requests 
  RENAME COLUMN "assignedStartTime" TO assigned_start_time;
ALTER TABLE booking_requests 
  RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE booking_requests 
  RENAME COLUMN "updatedAt" TO updated_at;

-- Bookings table
ALTER TABLE bookings 
  RENAME COLUMN "userId" TO user_id;
ALTER TABLE bookings 
  RENAME COLUMN "simulatorId" TO simulator_id;
ALTER TABLE bookings 
  RENAME COLUMN "startTime" TO start_time;
ALTER TABLE bookings 
  RENAME COLUMN "recurringDays" TO recurring_days;
ALTER TABLE bookings 
  RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE bookings 
  RENAME COLUMN "updatedAt" TO updated_at;
ALTER TABLE bookings 
  RENAME COLUMN "cancelledAt" TO cancelled_at;

-- Notifications table
ALTER TABLE notifications 
  RENAME COLUMN "userId" TO user_id;
ALTER TABLE notifications 
  RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE notifications 
  RENAME COLUMN "readAt" TO read_at;

-- Slack_feedback table
ALTER TABLE slack_feedback 
  RENAME COLUMN "userId" TO user_id;
ALTER TABLE slack_feedback 
  RENAME COLUMN "userEmail" TO user_email;
ALTER TABLE slack_feedback 
  RENAME COLUMN "messageTs" TO message_ts;
ALTER TABLE slack_feedback 
  RENAME COLUMN "channelId" TO channel_id;
ALTER TABLE slack_feedback 
  RENAME COLUMN "slackUserId" TO slack_user_id;
ALTER TABLE slack_feedback 
  RENAME COLUMN "createdAt" TO created_at;

-- Push_subscriptions table
ALTER TABLE push_subscriptions 
  RENAME COLUMN "userId" TO user_id;
ALTER TABLE push_subscriptions 
  RENAME COLUMN "authKey" TO auth_key;
ALTER TABLE push_subscriptions 
  RENAME COLUMN "p256dhKey" TO p256dh_key;
ALTER TABLE push_subscriptions 
  RENAME COLUMN "userAgent" TO user_agent;
ALTER TABLE push_subscriptions 
  RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE push_subscriptions 
  RENAME COLUMN "lastUsed" TO last_used;

-- System_events table
ALTER TABLE system_events 
  RENAME COLUMN "eventType" TO event_type;
ALTER TABLE system_events 
  RENAME COLUMN "eventData" TO event_data;
ALTER TABLE system_events 
  RENAME COLUMN "userId" TO user_id;
ALTER TABLE system_events 
  RENAME COLUMN "createdAt" TO created_at;

-- Golfsim_bookings table (if exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'golfsim_bookings') THEN
    ALTER TABLE golfsim_bookings 
      RENAME COLUMN "memberNumber" TO member_number;
    ALTER TABLE golfsim_bookings 
      RENAME COLUMN "memberEmail" TO member_email;
    ALTER TABLE golfsim_bookings 
      RENAME COLUMN "sessionDate" TO session_date;
    ALTER TABLE golfsim_bookings 
      RENAME COLUMN "sessionTime" TO session_time;
    ALTER TABLE golfsim_bookings 
      RENAME COLUMN "dayOfWeek" TO day_of_week;
    ALTER TABLE golfsim_bookings 
      RENAME COLUMN "createdAt" TO created_at;
    ALTER TABLE golfsim_bookings 
      RENAME COLUMN "updatedAt" TO updated_at;
  END IF;
END $$;

-- Requests table (if exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'requests') THEN
    ALTER TABLE requests 
      RENAME COLUMN "userId" TO user_id;
    ALTER TABLE requests 
      RENAME COLUMN "userEmail" TO user_email;
    ALTER TABLE requests 
      RENAME COLUMN "requestDescription" TO request_description;
    ALTER TABLE requests 
      RENAME COLUMN "responseConfidence" TO response_confidence;
    ALTER TABLE requests 
      RENAME COLUMN "createdAt" TO created_at;
  END IF;
END $$;

-- SOPs table (if exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'sops') THEN
    ALTER TABLE sops 
      RENAME COLUMN "fullContent" TO full_content;
    ALTER TABLE sops 
      RENAME COLUMN "fullText" TO full_text;
    ALTER TABLE sops 
      RENAME COLUMN "contentSummary" TO content_summary;
    ALTER TABLE sops 
      RENAME COLUMN "lastUpdated" TO last_updated;
    ALTER TABLE sops 
      RENAME COLUMN "isActive" TO is_active;
    ALTER TABLE sops 
      RENAME COLUMN "createdAt" TO created_at;
    ALTER TABLE sops 
      RENAME COLUMN "updatedAt" TO updated_at;
  END IF;
END $$;

-- Add migration record
INSERT INTO schema_migrations (version, executed_at) 
VALUES ('008_standardize_column_names', NOW());