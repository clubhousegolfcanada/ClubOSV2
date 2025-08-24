-- Database Schema Backup
-- Generated: 2025-08-24T12:23:52.894Z

-- Table: Users
CREATE TABLE IF NOT EXISTS "Users" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "email" character varying(255) NOT NULL,
  "password" character varying(255) NOT NULL,
  "name" character varying(255),
  "role" character varying(50) NOT NULL DEFAULT 'support'::character varying,
  "phone" character varying(50),
  "createdAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  "lastLogin" timestamp without time zone,
  "isActive" boolean DEFAULT true,
  "last_login" timestamp without time zone,
  PRIMARY KEY ("id")
);

-- Table: access_logs
CREATE TABLE IF NOT EXISTS "access_logs" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "user_id" uuid,
  "user_email" character varying(255),
  "action" character varying(100) NOT NULL,
  "resource" character varying(255),
  "ip_address" character varying(45),
  "user_agent" text,
  "success" boolean DEFAULT true,
  "error_message" text,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "createdAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

-- Table: achievement_preferences
CREATE TABLE IF NOT EXISTS "achievement_preferences" (
  "user_id" uuid NOT NULL,
  "show_achievements" boolean DEFAULT true,
  "featured_achievements" ARRAY DEFAULT '{}'::uuid[],
  "display_order" character varying(20) DEFAULT 'recent'::character varying,
  "hide_achievements" ARRAY DEFAULT '{}'::uuid[],
  "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("user_id")
);

-- Table: achievements
CREATE TABLE IF NOT EXISTS "achievements" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "code" character varying(50) NOT NULL,
  "name" character varying(100) NOT NULL,
  "description" text,
  "icon" character varying(10),
  "badge_url" character varying(255),
  "points" integer DEFAULT 0,
  "is_active" boolean DEFAULT true,
  "auto_award" boolean DEFAULT false,
  "auto_criteria" jsonb,
  "display_order" integer DEFAULT 0,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "category" character varying(50) DEFAULT 'custom'::character varying,
  "rarity" character varying(50) DEFAULT 'special'::character varying,
  PRIMARY KEY ("id")
);

-- Table: admin_actions
CREATE TABLE IF NOT EXISTS "admin_actions" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "admin_id" uuid NOT NULL,
  "action_type" character varying(50) NOT NULL,
  "target_user_id" uuid,
  "details" jsonb,
  "ip_address" character varying(45),
  "user_agent" text,
  "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

-- Table: ai_automation_actions
CREATE TABLE IF NOT EXISTS "ai_automation_actions" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "feature_key" character varying(50),
  "conversation_id" uuid,
  "action_type" character varying(50) NOT NULL,
  "action_data" jsonb DEFAULT '{}'::jsonb,
  "executed_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  "success" boolean DEFAULT true,
  "error_message" text,
  "response_text" text,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  PRIMARY KEY ("id")
);

-- Table: ai_automation_features
CREATE TABLE IF NOT EXISTS "ai_automation_features" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "feature_key" character varying(100) NOT NULL,
  "feature_name" character varying(255) NOT NULL,
  "description" text,
  "category" character varying(50) NOT NULL,
  "enabled" boolean DEFAULT false,
  "config" jsonb DEFAULT '{}'::jsonb,
  "required_permissions" ARRAY,
  "created_at" timestamp without time zone DEFAULT now(),
  "updated_at" timestamp without time zone DEFAULT now(),
  "allow_follow_up" boolean DEFAULT true,
  PRIMARY KEY ("id")
);

-- Table: ai_automation_response_tracking
CREATE TABLE IF NOT EXISTS "ai_automation_response_tracking" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "conversation_id" uuid,
  "feature_key" character varying(50),
  "response_count" integer DEFAULT 1,
  "last_response_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

-- Table: ai_automation_rules
CREATE TABLE IF NOT EXISTS "ai_automation_rules" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "feature_id" uuid,
  "rule_type" character varying(50),
  "rule_data" jsonb NOT NULL,
  "priority" integer DEFAULT 100,
  "enabled" boolean DEFAULT true,
  "created_at" timestamp without time zone DEFAULT now(),
  "updated_at" timestamp without time zone DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: ai_automation_usage
CREATE TABLE IF NOT EXISTS "ai_automation_usage" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "feature_id" uuid,
  "conversation_id" uuid,
  "trigger_type" character varying(50),
  "input_data" jsonb,
  "output_data" jsonb,
  "success" boolean DEFAULT true,
  "error_message" text,
  "execution_time_ms" integer,
  "user_confirmed" boolean DEFAULT false,
  "created_at" timestamp without time zone DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: ai_prompt_template_history
CREATE TABLE IF NOT EXISTS "ai_prompt_template_history" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "template_id" uuid,
  "old_template" text,
  "new_template" text,
  "changed_by" uuid,
  "changed_at" timestamp without time zone DEFAULT now(),
  "change_reason" text,
  PRIMARY KEY ("id")
);

-- Table: ai_prompt_templates
CREATE TABLE IF NOT EXISTS "ai_prompt_templates" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "name" character varying(255) NOT NULL,
  "description" text,
  "template" text NOT NULL,
  "category" character varying(50) NOT NULL,
  "is_active" boolean DEFAULT true,
  "created_by" uuid,
  "updated_by" uuid,
  "created_at" timestamp without time zone DEFAULT now(),
  "updated_at" timestamp without time zone DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: assistant_knowledge
CREATE TABLE IF NOT EXISTS "assistant_knowledge" (
  "id" integer NOT NULL DEFAULT nextval('assistant_knowledge_id_seq'::regclass),
  "assistant_id" character varying(255) NOT NULL,
  "route" character varying(255) NOT NULL,
  "knowledge" jsonb NOT NULL,
  "version" character varying(50) DEFAULT '1.0'::character varying,
  "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

-- Table: auth_logs
CREATE TABLE IF NOT EXISTS "auth_logs" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "user_id" uuid,
  "action" character varying(50) NOT NULL,
  "ip_address" character varying(45),
  "user_agent" text,
  "success" boolean DEFAULT true,
  "error_message" text,
  "createdAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

-- Table: badge_progress
CREATE TABLE IF NOT EXISTS "badge_progress" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "badge_id" uuid NOT NULL,
  "current_value" numeric DEFAULT 0,
  "target_value" numeric NOT NULL,
  "progress_percentage" integer DEFAULT 0,
  "progress_data" jsonb DEFAULT '{}'::jsonb,
  "is_complete" boolean DEFAULT false,
  "started_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "completed_at" timestamp with time zone,
  PRIMARY KEY ("id")
);

-- Table: badge_rules
CREATE TABLE IF NOT EXISTS "badge_rules" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "badge_id" uuid NOT NULL,
  "rule_type" character varying(50) NOT NULL,
  "trigger_event" character varying(100) NOT NULL,
  "evaluation_sql" text,
  "evaluation_function" character varying(200),
  "parameters" jsonb DEFAULT '{}'::jsonb,
  "is_active" boolean DEFAULT true,
  "check_frequency" character varying(20) DEFAULT 'on_event'::character varying,
  "last_checked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

-- Table: badges
CREATE TABLE IF NOT EXISTS "badges" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "key" character varying(100) NOT NULL,
  "name" character varying(200) NOT NULL,
  "description" text NOT NULL,
  "category" USER-DEFINED NOT NULL,
  "tier" USER-DEFINED NOT NULL DEFAULT 'common'::badge_tier,
  "icon_url" text,
  "icon_emoji" character varying(10),
  "display_order" integer DEFAULT 0,
  "requirements" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "is_active" boolean DEFAULT true,
  "is_secret" boolean DEFAULT false,
  "times_awarded" integer DEFAULT 0,
  "is_seasonal" boolean DEFAULT false,
  "season_id" uuid,
  "available_from" timestamp with time zone,
  "available_until" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

-- Table: booking_participants
CREATE TABLE IF NOT EXISTS "booking_participants" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "booking_share_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "status" character varying(20) DEFAULT 'confirmed'::character varying,
  "joined_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

-- Table: booking_rewards
CREATE TABLE IF NOT EXISTS "booking_rewards" (
  "id" integer NOT NULL DEFAULT nextval('booking_rewards_id_seq'::regclass),
  "user_id" uuid NOT NULL,
  "hubspot_deal_id" character varying(255) NOT NULL,
  "booking_date" timestamp without time zone NOT NULL,
  "reward_date" timestamp without time zone NOT NULL,
  "location" character varying(100),
  "box_number" character varying(50),
  "cc_awarded" integer DEFAULT 25,
  "status" character varying(20) DEFAULT 'pending'::character varying,
  "awarded_at" timestamp without time zone,
  "error_message" text,
  "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

-- Table: booking_shares
CREATE TABLE IF NOT EXISTS "booking_shares" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "booking_id" character varying(200) NOT NULL,
  "shared_by" uuid NOT NULL,
  "booking_date" timestamp with time zone NOT NULL,
  "bay_number" character varying(20),
  "duration_minutes" integer,
  "location" character varying(100),
  "visibility" character varying(20) DEFAULT 'friends'::character varying,
  "team_id" uuid,
  "event_id" uuid,
  "max_participants" integer DEFAULT 4,
  "allow_join_requests" boolean DEFAULT true,
  "tags" ARRAY,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "expires_at" timestamp with time zone,
  PRIMARY KEY ("id")
);

-- Table: bookings
CREATE TABLE IF NOT EXISTS "bookings" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "simulator_id" character varying(255) NOT NULL,
  "start_time" timestamp without time zone NOT NULL,
  "duration" integer NOT NULL,
  "type" character varying(50) NOT NULL,
  "recurring_days" ARRAY,
  "status" character varying(50) NOT NULL DEFAULT 'confirmed'::character varying,
  "createdAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  "cancelled_at" timestamp without time zone,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  PRIMARY KEY ("id")
);

-- Table: cc_transactions
CREATE TABLE IF NOT EXISTS "cc_transactions" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "type" character varying(50) NOT NULL,
  "amount" numeric NOT NULL,
  "balance_before" numeric NOT NULL,
  "balance_after" numeric NOT NULL,
  "challenge_id" uuid,
  "season_id" uuid,
  "description" text,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

-- Table: challenge_audit
CREATE TABLE IF NOT EXISTS "challenge_audit" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "challenge_id" uuid NOT NULL,
  "event_type" character varying(100) NOT NULL,
  "user_id" uuid,
  "old_status" USER-DEFINED,
  "new_status" USER-DEFINED,
  "event_data" jsonb DEFAULT '{}'::jsonb,
  "ip_address" inet,
  "user_agent" text,
  "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

-- Table: challenge_disputes
CREATE TABLE IF NOT EXISTS "challenge_disputes" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "challenge_id" uuid NOT NULL,
  "filed_by" uuid NOT NULL,
  "filed_against" uuid,
  "filed_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "dispute_type" character varying(50) NOT NULL,
  "description" text NOT NULL,
  "evidence" jsonb DEFAULT '[]'::jsonb,
  "status" character varying(20) DEFAULT 'pending'::character varying,
  "reviewed_by" uuid,
  "reviewed_at" timestamp with time zone,
  "resolution" character varying(20),
  "resolution_notes" text,
  "cc_adjustments" jsonb DEFAULT '{}'::jsonb,
  "sanctions_applied" jsonb DEFAULT '{}'::jsonb,
  "priority" character varying(20) DEFAULT 'normal'::character varying,
  PRIMARY KEY ("id")
);

-- Table: challenge_no_shows
CREATE TABLE IF NOT EXISTS "challenge_no_shows" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "challenge_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "role" character varying(20) NOT NULL,
  "expected_by" timestamp with time zone NOT NULL,
  "cc_forfeited" numeric DEFAULT 0,
  "credibility_penalty" integer DEFAULT 0,
  "is_repeat_offender" boolean DEFAULT false,
  "no_show_count" integer DEFAULT 1,
  "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

-- Table: challenge_plays
CREATE TABLE IF NOT EXISTS "challenge_plays" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "challenge_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "played_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "bay_number" character varying(20),
  "location" character varying(100),
  "trackman_round_id" character varying(200),
  "trackman_session_id" character varying(200),
  "score" numeric,
  "trackman_data" jsonb,
  "booking_id" character varying(200),
  "booking_verified" boolean DEFAULT false,
  "settings_match" boolean DEFAULT false,
  "is_valid" boolean DEFAULT false,
  "validation_errors" ARRAY,
  "ip_address" inet,
  "user_agent" text,
  PRIMARY KEY ("id")
);

-- Table: challenge_results
CREATE TABLE IF NOT EXISTS "challenge_results" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "challenge_id" uuid NOT NULL,
  "winner_user_id" uuid NOT NULL,
  "loser_user_id" uuid NOT NULL,
  "is_tie" boolean DEFAULT false,
  "winner_score" numeric,
  "loser_score" numeric,
  "score_difference" numeric,
  "base_pot" numeric NOT NULL,
  "rank_gap_bonus" numeric DEFAULT 0,
  "champion_bonus" numeric DEFAULT 0,
  "legend_bonus" numeric DEFAULT 0,
  "total_bonus" numeric DEFAULT 0,
  "final_payout" numeric NOT NULL,
  "winner_rank" USER-DEFINED,
  "loser_rank" USER-DEFINED,
  "rank_gap" integer DEFAULT 0,
  "loser_was_champion" boolean DEFAULT false,
  "winner_trackman_round_id" character varying(200),
  "loser_trackman_round_id" character varying(200),
  "winner_trackman_data" jsonb,
  "loser_trackman_data" jsonb,
  "resolution_type" character varying(50) NOT NULL,
  "resolved_by" uuid,
  "resolution_notes" text,
  "resolved_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

-- Table: challenge_settings_catalog
CREATE TABLE IF NOT EXISTS "challenge_settings_catalog" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "name" character varying(100) NOT NULL,
  "category" character varying(50) NOT NULL,
  "course_id" character varying(100) NOT NULL,
  "course_name" character varying(200) NOT NULL,
  "tee_type" character varying(50),
  "wind_speed" character varying(50),
  "wind_direction" character varying(50),
  "pin_position" character varying(50),
  "game_mode" character varying(100),
  "scoring_type" character varying(50) NOT NULL,
  "holes" integer DEFAULT 18,
  "time_limit_minutes" integer,
  "settings_json" jsonb DEFAULT '{}'::jsonb,
  "times_used" integer DEFAULT 0,
  "last_used_at" timestamp with time zone,
  "is_active" boolean DEFAULT true,
  "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

-- Table: challenge_winner_selections
CREATE TABLE IF NOT EXISTS "challenge_winner_selections" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "challenge_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "selected_winner_id" uuid NOT NULL,
  "selected_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

-- Table: challenges
CREATE TABLE IF NOT EXISTS "challenges" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "creator_id" uuid NOT NULL,
  "acceptor_id" uuid,
  "settings_catalog_id" uuid,
  "course_id" character varying(100) NOT NULL,
  "course_name" character varying(200) NOT NULL,
  "tee_type" character varying(50),
  "wind_speed" character varying(50),
  "wind_direction" character varying(50),
  "pin_position" character varying(50),
  "game_mode" character varying(100),
  "scoring_type" character varying(50) NOT NULL,
  "holes" integer DEFAULT 18,
  "trackman_settings" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "wager_amount" numeric NOT NULL,
  "creator_stake_amount" numeric,
  "acceptor_stake_amount" numeric,
  "total_pot" numeric,
  "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "sent_at" timestamp with time zone,
  "accepted_at" timestamp with time zone,
  "expires_at" timestamp with time zone NOT NULL,
  "expiry_days" integer NOT NULL,
  "creator_played_at" timestamp with time zone,
  "acceptor_played_at" timestamp with time zone,
  "resolved_at" timestamp with time zone,
  "status" USER-DEFINED NOT NULL DEFAULT 'draft'::challenge_status,
  "creator_note" text,
  "acceptor_note" text,
  "winner_user_id" uuid,
  "creator_score" numeric,
  "acceptor_score" numeric,
  "rank_gap_bonus" numeric DEFAULT 0,
  "champion_bonus" numeric DEFAULT 0,
  "total_bonus" numeric DEFAULT 0,
  "final_payout" numeric,
  "season_id" uuid,
  "is_rematch" boolean DEFAULT false,
  "previous_challenge_id" uuid,
  "decline_count" integer DEFAULT 0,
  "decline_reasons" ARRAY,
  "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

-- Table: champion_markers
CREATE TABLE IF NOT EXISTS "champion_markers" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "event_id" uuid,
  "event_name" character varying(200) NOT NULL,
  "event_type" character varying(50) NOT NULL,
  "year" integer NOT NULL,
  "position" integer NOT NULL DEFAULT 1,
  "marker_name" character varying(50) NOT NULL,
  "display_text" character varying(200),
  "icon_url" text,
  "is_active" boolean DEFAULT true,
  "expires_at" timestamp with time zone,
  "bonus_multiplier" numeric DEFAULT 0.20,
  "awarded_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

-- Table: checklist_submissions
CREATE TABLE IF NOT EXISTS "checklist_submissions" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "category" character varying(50) NOT NULL,
  "type" character varying(50) NOT NULL,
  "location" character varying(100) NOT NULL,
  "completed_tasks" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "total_tasks" integer NOT NULL,
  "completion_time" timestamp with time zone NOT NULL DEFAULT now(),
  "created_at" timestamp with time zone DEFAULT now(),
  "comments" text,
  "ticket_created" boolean DEFAULT false,
  "ticket_id" uuid,
  PRIMARY KEY ("id")
);

-- Table: checklist_task_customizations
CREATE TABLE IF NOT EXISTS "checklist_task_customizations" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "category" character varying(50) NOT NULL,
  "type" character varying(50) NOT NULL,
  "task_id" character varying(100) NOT NULL,
  "custom_label" text NOT NULL,
  "is_active" boolean DEFAULT true,
  "created_at" timestamp without time zone DEFAULT now(),
  "updated_at" timestamp without time zone DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: clubhouse_announcements
CREATE TABLE IF NOT EXISTS "clubhouse_announcements" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "clubhouse_id" uuid,
  "title" character varying(200) NOT NULL,
  "content" text NOT NULL,
  "announcement_type" character varying(50),
  "priority" character varying(20) DEFAULT 'normal'::character varying,
  "is_active" boolean DEFAULT true,
  "show_in_app" boolean DEFAULT true,
  "show_on_website" boolean DEFAULT false,
  "target_locations" ARRAY,
  "start_date" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "end_date" timestamp with time zone,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

-- Table: clubhouse_locations
CREATE TABLE IF NOT EXISTS "clubhouse_locations" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "name" character varying(100) NOT NULL,
  "display_name" character varying(200) NOT NULL,
  "address_line1" character varying(200) NOT NULL,
  "address_line2" character varying(200),
  "city" character varying(100) NOT NULL,
  "province" character varying(50) NOT NULL,
  "postal_code" character varying(20) NOT NULL,
  "country" character varying(2) DEFAULT 'CA'::character varying,
  "phone" character varying(20),
  "email" character varying(100),
  "latitude" numeric,
  "longitude" numeric,
  "timezone" character varying(50) DEFAULT 'America/Halifax'::character varying,
  "total_bays" integer NOT NULL,
  "trackman_bays" integer DEFAULT 0,
  "regular_bays" integer DEFAULT 0,
  "operating_hours" jsonb DEFAULT '{}'::jsonb,
  "has_bar" boolean DEFAULT false,
  "has_food" boolean DEFAULT false,
  "has_lessons" boolean DEFAULT false,
  "has_leagues" boolean DEFAULT false,
  "has_events" boolean DEFAULT false,
  "is_active" boolean DEFAULT true,
  "is_featured" boolean DEFAULT false,
  "hero_image_url" text,
  "logo_url" text,
  "gallery_urls" ARRAY,
  "skedda_venue_id" character varying(100),
  "skedda_space_ids" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

-- Table: contact_sync
CREATE TABLE IF NOT EXISTS "contact_sync" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "contact_hash" character varying(64) NOT NULL,
  "contact_type" character varying(10) NOT NULL,
  "contact_name" character varying(255),
  "matched_user_id" uuid,
  "match_confidence" double precision DEFAULT 1.0,
  "friendship_status" character varying(20),
  "synced_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  "source" character varying(50),
  PRIMARY KEY ("id")
);

-- Table: conversation_sessions
CREATE TABLE IF NOT EXISTS "conversation_sessions" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "session_id" character varying(255) NOT NULL,
  "user_id" uuid,
  "started_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  "last_activity" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  "context" jsonb,
  "active" boolean DEFAULT true,
  PRIMARY KEY ("id")
);

-- Table: customer_interactions
CREATE TABLE IF NOT EXISTS "customer_interactions" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "user_id" uuid,
  "user_email" character varying(255),
  "request_text" text NOT NULL,
  "response_text" text,
  "route" character varying(50),
  "confidence" numeric,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "createdAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  "suggested_priority" character varying(20),
  "session_id" character varying(255),
  PRIMARY KEY ("id")
);

-- Table: customer_profiles
CREATE TABLE IF NOT EXISTS "customer_profiles" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "display_name" character varying(100),
  "bio" text,
  "avatar_url" text,
  "handicap" numeric,
  "home_location" character varying(100),
  "profile_visibility" character varying(20) DEFAULT 'friends'::character varying,
  "show_bookings" boolean DEFAULT true,
  "show_stats" boolean DEFAULT true,
  "show_friends" boolean DEFAULT false,
  "max_friends" integer DEFAULT 250,
  "max_teams" integer DEFAULT 5,
  "preferred_tee_time" character varying(20),
  "preferred_bay_type" character varying(20),
  "notification_preferences" jsonb DEFAULT '{}'::jsonb,
  "total_rounds" integer DEFAULT 0,
  "average_score" numeric,
  "best_score" integer,
  "favorite_course" character varying(100),
  "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "last_active_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "cc_balance" numeric DEFAULT 0,
  "credibility_score" integer DEFAULT 100,
  "current_rank" USER-DEFINED DEFAULT 'house'::rank_tier,
  "highest_rank_achieved" USER-DEFINED DEFAULT 'house'::rank_tier,
  "total_challenges_played" integer DEFAULT 0,
  "total_challenges_won" integer DEFAULT 0,
  "total_cc_earned" numeric DEFAULT 0,
  "total_cc_spent" numeric DEFAULT 0,
  "challenge_win_rate" numeric DEFAULT 0,
  "last_challenge_at" timestamp with time zone,
  "challenge_streak" integer DEFAULT 0,
  "max_win_streak" integer DEFAULT 0,
  "max_loss_streak" integer DEFAULT 0,
  "previous_rank" integer,
  "rank_last_updated" timestamp without time zone,
  "achievement_count" integer DEFAULT 0,
  "achievement_points" integer DEFAULT 0,
  "rarest_achievement" uuid,
  "latest_achievement_at" timestamp with time zone,
  PRIMARY KEY ("id")
);

-- Table: door_access_log
CREATE TABLE IF NOT EXISTS "door_access_log" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "location" character varying(100),
  "door_name" character varying(255),
  "door_id" character varying(255),
  "action" character varying(50),
  "user_id" character varying(255),
  "username" character varying(255),
  "duration" integer,
  "success" boolean DEFAULT false,
  "created_at" timestamp without time zone DEFAULT now(),
  "metadata" jsonb DEFAULT '{}'::jsonb,
  PRIMARY KEY ("id")
);

-- Table: event_participants
CREATE TABLE IF NOT EXISTS "event_participants" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "event_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "team_id" uuid,
  "registered_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "registration_status" character varying(20) DEFAULT 'registered'::character varying,
  "check_in_time" timestamp with time zone,
  "total_score" integer,
  "handicap_applied" numeric,
  "final_position" integer,
  "prize_amount" numeric,
  "round_scores" jsonb DEFAULT '[]'::jsonb,
  PRIMARY KEY ("id")
);

-- Table: events
CREATE TABLE IF NOT EXISTS "events" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "name" character varying(200) NOT NULL,
  "description" text,
  "event_type" character varying(50) NOT NULL,
  "start_date" timestamp with time zone NOT NULL,
  "end_date" timestamp with time zone NOT NULL,
  "location" character varying(100) NOT NULL,
  "bay_assignments" ARRAY,
  "max_participants" integer DEFAULT 16,
  "min_participants" integer DEFAULT 2,
  "registration_deadline" timestamp with time zone,
  "is_public" boolean DEFAULT true,
  "requires_approval" boolean DEFAULT false,
  "entry_fee" numeric,
  "prize_pool" numeric,
  "scoring_format" character varying(50),
  "rounds" integer DEFAULT 1,
  "holes_per_round" integer DEFAULT 18,
  "handicap_enabled" boolean DEFAULT true,
  "created_by" uuid NOT NULL,
  "is_official" boolean DEFAULT false,
  "team_id" uuid,
  "trackman_event_id" character varying(100),
  "auto_scoring" boolean DEFAULT false,
  "status" character varying(20) DEFAULT 'draft'::character varying,
  "winner_user_id" uuid,
  "winner_team_id" uuid,
  "final_scores" jsonb,
  "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "completed_at" timestamp with time zone,
  PRIMARY KEY ("id")
);

-- Table: extracted_knowledge
CREATE TABLE IF NOT EXISTS "extracted_knowledge" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "source_id" uuid,
  "source_type" character varying(20),
  "category" character varying(50),
  "problem" text NOT NULL,
  "solution" text NOT NULL,
  "confidence" double precision,
  "applied_to_sop" boolean DEFAULT false,
  "sop_file" character varying(255),
  "created_at" timestamp without time zone DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: feedback
CREATE TABLE IF NOT EXISTS "feedback" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "timestamp" timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "user_id" uuid,
  "user_email" character varying(255),
  "request_description" text NOT NULL,
  "location" character varying(255),
  "route" character varying(50),
  "response" text,
  "confidence" numeric,
  "is_useful" boolean NOT NULL DEFAULT false,
  "feedback_type" character varying(50),
  "feedback_source" character varying(50) DEFAULT 'user'::character varying,
  "slack_thread_ts" character varying(255),
  "slack_user_name" character varying(255),
  "slack_user_id" character varying(255),
  "slack_channel" character varying(255),
  "original_request_id" uuid,
  "createdAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

-- Table: friend_activities
CREATE TABLE IF NOT EXISTS "friend_activities" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "friend_id" uuid NOT NULL,
  "activity_type" character varying(50) NOT NULL,
  "activity_data" jsonb DEFAULT '{}'::jsonb,
  "wager_id" uuid,
  "booking_id" character varying(200),
  "event_id" uuid,
  "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

-- Table: friend_group_members
CREATE TABLE IF NOT EXISTS "friend_group_members" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "group_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "role" character varying(20) DEFAULT 'member'::character varying,
  "joined_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  "invited_by" uuid,
  "wagers_participated" integer DEFAULT 0,
  "total_wagered" numeric DEFAULT 0,
  "total_won" numeric DEFAULT 0,
  PRIMARY KEY ("id")
);

-- Table: friend_groups
CREATE TABLE IF NOT EXISTS "friend_groups" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "owner_id" uuid NOT NULL,
  "name" character varying(100) NOT NULL,
  "description" text,
  "is_public" boolean DEFAULT false,
  "max_members" integer DEFAULT 10,
  "allow_wagers" boolean DEFAULT true,
  "default_wager_amount" numeric DEFAULT 10,
  "total_wagers" integer DEFAULT 0,
  "total_wagered" numeric DEFAULT 0,
  "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

-- Table: friend_invitations
CREATE TABLE IF NOT EXISTS "friend_invitations" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "inviter_id" uuid NOT NULL,
  "invitee_email" character varying(255),
  "invitee_phone" character varying(50),
  "invitee_name" character varying(255),
  "invitation_code" character varying(20) DEFAULT "substring"(md5((random())::text), 1, 8),
  "status" character varying(20) DEFAULT 'pending'::character varying,
  "message" text,
  "sent_via" character varying(20),
  "sent_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  "reminder_sent_at" timestamp without time zone,
  "accepted_at" timestamp without time zone,
  "accepted_user_id" uuid,
  "expires_at" timestamp without time zone DEFAULT (CURRENT_TIMESTAMP + '30 days'::interval),
  "metadata" jsonb DEFAULT '{}'::jsonb,
  PRIMARY KEY ("id")
);

-- Table: friend_notification_preferences
CREATE TABLE IF NOT EXISTS "friend_notification_preferences" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "friend_requests" boolean DEFAULT true,
  "friend_accepts" boolean DEFAULT true,
  "friend_suggestions" boolean DEFAULT false,
  "wager_invites" boolean DEFAULT true,
  "friend_bookings" boolean DEFAULT true,
  "friend_achievements" boolean DEFAULT false,
  "push_enabled" boolean DEFAULT true,
  "email_enabled" boolean DEFAULT true,
  "sms_enabled" boolean DEFAULT false,
  "quiet_hours_enabled" boolean DEFAULT false,
  "quiet_hours_start" time without time zone,
  "quiet_hours_end" time without time zone,
  "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

-- Table: friend_suggestions
CREATE TABLE IF NOT EXISTS "friend_suggestions" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "suggested_user_id" uuid NOT NULL,
  "reason" character varying(50),
  "mutual_friends_count" integer DEFAULT 0,
  "mutual_friends_list" ARRAY,
  "shared_events_count" integer DEFAULT 0,
  "shared_bookings_count" integer DEFAULT 0,
  "relevance_score" double precision DEFAULT 0,
  "dismissed" boolean DEFAULT false,
  "dismissed_at" timestamp without time zone,
  "sent_request" boolean DEFAULT false,
  "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

-- Table: friendships
CREATE TABLE IF NOT EXISTS "friendships" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "friend_id" uuid NOT NULL,
  "status" character varying(20) NOT NULL DEFAULT 'pending'::character varying,
  "requested_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "accepted_at" timestamp with time zone,
  "blocked_at" timestamp with time zone,
  "blocked_by" uuid,
  "invitation_method" character varying(20) DEFAULT 'in_app'::character varying,
  "invitation_message" text,
  "mutual_friends_count" integer DEFAULT 0,
  "friendship_source" character varying(50),
  "clubcoin_wagers_count" integer DEFAULT 0,
  "clubcoin_wagers_total" numeric DEFAULT 0,
  "last_wager_date" timestamp without time zone,
  PRIMARY KEY ("id")
);

-- Table: hubspot_cache
CREATE TABLE IF NOT EXISTS "hubspot_cache" (
  "phone_number" character varying(20) NOT NULL,
  "customer_name" character varying(255),
  "company" character varying(255),
  "email" character varying(255),
  "hubspot_contact_id" character varying(255),
  "updated_at" timestamp without time zone DEFAULT now(),
  PRIMARY KEY ("phone_number")
);

-- Table: hubspot_contact_cache
CREATE TABLE IF NOT EXISTS "hubspot_contact_cache" (
  "phone_number" character varying(50) NOT NULL,
  "contact_id" character varying(255),
  "full_name" character varying(255),
  "email" character varying(255),
  "company" character varying(255),
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  "last_synced_at" timestamp without time zone,
  PRIMARY KEY ("phone_number")
);

-- Table: knowledge_audit_log
CREATE TABLE IF NOT EXISTS "knowledge_audit_log" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "timestamp" timestamp without time zone DEFAULT now(),
  "action" character varying(50) NOT NULL,
  "category" character varying(100),
  "key" text,
  "new_value" text,
  "previous_value" text,
  "user_id" uuid,
  "user_name" character varying(255),
  "assistant_target" character varying(50),
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "slack_notified" boolean DEFAULT false,
  PRIMARY KEY ("id")
);

-- Table: knowledge_base
CREATE TABLE IF NOT EXISTS "knowledge_base" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "category" character varying(50) NOT NULL,
  "subcategory" character varying(50),
  "issue" character varying(255) NOT NULL,
  "symptoms" ARRAY,
  "solutions" ARRAY,
  "priority" character varying(20),
  "time_estimate" character varying(50),
  "customer_script" text,
  "escalation_path" text,
  "metadata" jsonb,
  "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

-- Table: knowledge_captures
CREATE TABLE IF NOT EXISTS "knowledge_captures" (
  "id" character varying(255) NOT NULL,
  "source" character varying(50) NOT NULL,
  "query" text NOT NULL,
  "response" text NOT NULL,
  "assistant" character varying(50) NOT NULL,
  "confidence" double precision NOT NULL DEFAULT 0.5,
  "verified" boolean DEFAULT false,
  "created_at" timestamp without time zone DEFAULT now(),
  "verified_by" character varying(255),
  "metadata" jsonb DEFAULT '{}'::jsonb,
  PRIMARY KEY ("id")
);

-- Table: knowledge_extraction_log
CREATE TABLE IF NOT EXISTS "knowledge_extraction_log" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "conversation_id" character varying(255),
  "extraction_type" character varying(50),
  "extracted_data" jsonb,
  "confidence" double precision,
  "action_taken" character varying(50),
  "knowledge_id" uuid,
  "pattern_id" uuid,
  "skip_reason" text,
  "processing_time_ms" integer,
  "created_at" timestamp without time zone DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: knowledge_patterns
CREATE TABLE IF NOT EXISTS "knowledge_patterns" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "pattern" character varying(255) NOT NULL,
  "pattern_type" character varying(50),
  "occurrence_count" integer DEFAULT 1,
  "current_best_solution" text,
  "current_best_confidence" double precision DEFAULT 0.5,
  "current_best_source" uuid,
  "alternatives" jsonb DEFAULT '[]'::jsonb,
  "first_seen" timestamp without time zone DEFAULT now(),
  "last_seen" timestamp without time zone DEFAULT now(),
  "created_at" timestamp without time zone DEFAULT now(),
  "updated_at" timestamp without time zone DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: knowledge_store
CREATE TABLE IF NOT EXISTS "knowledge_store" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "key" character varying(255) NOT NULL,
  "value" jsonb NOT NULL,
  "confidence" double precision DEFAULT 0.5,
  "verification_status" character varying(20) DEFAULT 'learned'::character varying,
  "source_count" integer DEFAULT 1,
  "replaces" ARRAY,
  "superseded_by" uuid,
  "usage_count" integer DEFAULT 0,
  "success_count" integer DEFAULT 0,
  "failure_count" integer DEFAULT 0,
  "search_vector" tsvector,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp without time zone DEFAULT now(),
  "updated_at" timestamp without time zone DEFAULT now(),
  "created_by" uuid,
  "last_accessed" timestamp without time zone,
  "expires_at" timestamp without time zone,
  "category" character varying(100),
  "source_type" character varying(50) DEFAULT 'manual'::character varying,
  "source_id" character varying(255),
  "source_table" character varying(100),
  PRIMARY KEY ("id")
);

-- Table: learning_metrics
CREATE TABLE IF NOT EXISTS "learning_metrics" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "metric_type" character varying(50) NOT NULL,
  "assistant" character varying(50),
  "value" double precision NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp without time zone DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: message_suggestions
CREATE TABLE IF NOT EXISTS "message_suggestions" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "conversation_id" character varying(255) NOT NULL,
  "phone_number_hash" character varying(64) NOT NULL,
  "message_id" character varying(255) NOT NULL,
  "suggested_text" text NOT NULL,
  "suggested_text_encrypted" text NOT NULL,
  "confidence" double precision NOT NULL,
  "context" text,
  "created_by" uuid NOT NULL,
  "approved" boolean DEFAULT false,
  "approved_by" uuid,
  "approved_at" timestamp without time zone,
  "sent" boolean DEFAULT false,
  "sent_at" timestamp without time zone,
  "created_at" timestamp without time zone DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: migration_history
CREATE TABLE IF NOT EXISTS "migration_history" (
  "id" integer NOT NULL DEFAULT nextval('migration_history_id_seq'::regclass),
  "version" character varying(50) NOT NULL,
  "name" character varying(255) NOT NULL,
  "applied_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  "checksum" character varying(64),
  "execution_time_ms" integer,
  "applied_by" character varying(255),
  PRIMARY KEY ("id")
);

-- Table: migration_locks
CREATE TABLE IF NOT EXISTS "migration_locks" (
  "id" integer NOT NULL DEFAULT 1,
  "locked_at" timestamp without time zone,
  "locked_by" character varying(255),
  PRIMARY KEY ("id")
);

-- Table: migrations
CREATE TABLE IF NOT EXISTS "migrations" (
  "id" integer NOT NULL DEFAULT nextval('migrations_id_seq'::regclass),
  "filename" character varying(255) NOT NULL,
  "executed_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

-- Table: notification_history
CREATE TABLE IF NOT EXISTS "notification_history" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "user_id" uuid,
  "subscription_id" uuid,
  "type" character varying(50) NOT NULL,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "data" jsonb,
  "status" character varying(20) DEFAULT 'pending'::character varying,
  "error" text,
  "sent_at" timestamp without time zone DEFAULT now(),
  "clicked_at" timestamp without time zone,
  PRIMARY KEY ("id")
);

-- Table: notification_preferences
CREATE TABLE IF NOT EXISTS "notification_preferences" (
  "user_id" uuid NOT NULL,
  "messages_enabled" boolean DEFAULT true,
  "tickets_enabled" boolean DEFAULT true,
  "system_enabled" boolean DEFAULT true,
  "quiet_hours_enabled" boolean DEFAULT false,
  "quiet_hours_start" time without time zone DEFAULT '22:00:00'::time without time zone,
  "quiet_hours_end" time without time zone DEFAULT '08:00:00'::time without time zone,
  "created_at" timestamp without time zone DEFAULT now(),
  "updated_at" timestamp without time zone DEFAULT now(),
  PRIMARY KEY ("user_id")
);

-- Table: openphone_conversations
CREATE TABLE IF NOT EXISTS "openphone_conversations" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "phone_number" character varying(20),
  "customer_name" character varying(255),
  "employee_name" character varying(255),
  "messages" jsonb NOT NULL,
  "created_at" timestamp without time zone DEFAULT now(),
  "processed" boolean DEFAULT false,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "conversation_id" character varying(255),
  "updated_at" timestamp without time zone DEFAULT now(),
  "unread_count" integer DEFAULT 0,
  "last_read_at" timestamp with time zone,
  "knowledge_extracted" boolean DEFAULT false,
  "extraction_result" jsonb,
  "knowledge_id" uuid,
  PRIMARY KEY ("id")
);

-- Table: public_requests
CREATE TABLE IF NOT EXISTS "public_requests" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "source" character varying(50) NOT NULL,
  "source_id" character varying(255),
  "customer_info" jsonb DEFAULT '{}'::jsonb,
  "request_text" text NOT NULL,
  "response_text" text,
  "route" character varying(50),
  "confidence" double precision,
  "assistant_used" character varying(50),
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

-- Table: push_subscriptions
CREATE TABLE IF NOT EXISTS "push_subscriptions" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "endpoint" text NOT NULL,
  "p256dh" text NOT NULL,
  "auth" text NOT NULL,
  "user_agent" text,
  "created_at" timestamp without time zone DEFAULT now(),
  "last_used_at" timestamp without time zone DEFAULT now(),
  "failed_attempts" integer DEFAULT 0,
  "is_active" boolean DEFAULT true,
  PRIMARY KEY ("id")
);

-- Table: rank_assignments
CREATE TABLE IF NOT EXISTS "rank_assignments" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "season_id" uuid NOT NULL,
  "rank_tier" USER-DEFINED NOT NULL DEFAULT 'house'::rank_tier,
  "percentile" numeric NOT NULL,
  "cc_earned" numeric DEFAULT 0,
  "challenges_played" integer DEFAULT 0,
  "challenges_won" integer DEFAULT 0,
  "win_rate" numeric DEFAULT 0,
  "rank_gap_bonuses" numeric DEFAULT 0,
  "champion_bonuses" numeric DEFAULT 0,
  "total_bonuses" numeric DEFAULT 0,
  "season_rank" integer,
  "location_rank" integer,
  "tournament_override" boolean DEFAULT false,
  "override_reason" text,
  "assigned_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "calculated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

-- Table: rank_history
CREATE TABLE IF NOT EXISTS "rank_history" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "old_rank" integer,
  "new_rank" integer,
  "changed_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  "reason" character varying(100),
  PRIMARY KEY ("id")
);

-- Table: remote_action_history
CREATE TABLE IF NOT EXISTS "remote_action_history" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "action_type" character varying(50) NOT NULL,
  "location" character varying(100),
  "device_id" character varying(255),
  "user_id" uuid,
  "success" boolean DEFAULT false,
  "error_message" text,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

-- Table: request_logs
CREATE TABLE IF NOT EXISTS "request_logs" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "method" character varying(10) NOT NULL,
  "path" character varying(500) NOT NULL,
  "status_code" integer,
  "response_time" integer,
  "user_id" uuid,
  "ip_address" character varying(45),
  "user_agent" text,
  "error" text,
  "createdAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

-- Table: schema_migrations
CREATE TABLE IF NOT EXISTS "schema_migrations" (
  "version" character varying(255) NOT NULL,
  "name" character varying(255) NOT NULL,
  "executed_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  "checksum" character varying(64),
  "execution_time_ms" integer,
  "success" boolean DEFAULT true,
  "error_message" text,
  "rollback_sql" text,
  PRIMARY KEY ("version")
);

-- Table: scoreboards
CREATE TABLE IF NOT EXISTS "scoreboards" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "event_id" uuid,
  "team_id" uuid,
  "season" character varying(50),
  "standings" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "scoring_system" character varying(50),
  "include_handicap" boolean DEFAULT true,
  "min_rounds_required" integer DEFAULT 1,
  "last_updated" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "locked" boolean DEFAULT false,
  "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

-- Table: seasonal_cc_earnings
CREATE TABLE IF NOT EXISTS "seasonal_cc_earnings" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "season_id" uuid NOT NULL,
  "cc_from_wins" numeric DEFAULT 0,
  "cc_from_bonuses" numeric DEFAULT 0,
  "cc_from_achievements" numeric DEFAULT 0,
  "cc_lost" numeric DEFAULT 0,
  "cc_net" numeric DEFAULT 0,
  "challenges_created" integer DEFAULT 0,
  "challenges_accepted" integer DEFAULT 0,
  "challenges_completed" integer DEFAULT 0,
  "no_shows" integer DEFAULT 0,
  "disputes_filed" integer DEFAULT 0,
  "last_updated" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

-- Table: seasons
CREATE TABLE IF NOT EXISTS "seasons" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "name" character varying(100) NOT NULL,
  "start_date" timestamp with time zone NOT NULL,
  "end_date" timestamp with time zone NOT NULL,
  "duration_type" character varying(20) NOT NULL,
  "status" character varying(20) DEFAULT 'upcoming'::character varying,
  "rank_cut_lines" jsonb NOT NULL DEFAULT '{"pro": 0.15, "gold": 0.35, "bronze": 0.90, "legend": 0.01, "silver": 0.65, "amateur": 1.0, "champion": 0.05}'::jsonb,
  "total_players" integer DEFAULT 0,
  "total_challenges" integer DEFAULT 0,
  "total_cc_circulated" numeric DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "completed_at" timestamp with time zone,
  "is_active" boolean DEFAULT false,
  PRIMARY KEY ("id")
);

-- Table: slack_messages
CREATE TABLE IF NOT EXISTS "slack_messages" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "user_id" uuid,
  "request_id" uuid,
  "slack_thread_ts" character varying(255),
  "slack_channel" character varying(255) NOT NULL,
  "slack_message_ts" character varying(255),
  "original_message" text NOT NULL,
  "request_description" text,
  "location" character varying(255),
  "route" character varying(50),
  "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

-- Table: slack_replies
CREATE TABLE IF NOT EXISTS "slack_replies" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "thread_ts" character varying(255) NOT NULL,
  "user_name" character varying(255),
  "user_id" character varying(255) NOT NULL,
  "text" text NOT NULL,
  "timestamp" timestamp without time zone NOT NULL,
  "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

-- Table: slack_thread_resolutions
CREATE TABLE IF NOT EXISTS "slack_thread_resolutions" (
  "thread_ts" character varying(255) NOT NULL,
  "original_query" text NOT NULL,
  "final_resolution" text,
  "was_helpful" boolean,
  "resolver" character varying(255),
  "resolved_at" timestamp without time zone,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp without time zone DEFAULT now(),
  PRIMARY KEY ("thread_ts")
);

-- Table: sop_drafts
CREATE TABLE IF NOT EXISTS "sop_drafts" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "assistant" character varying(50) NOT NULL,
  "title" character varying(255) NOT NULL,
  "content" text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "status" character varying(50) DEFAULT 'draft'::character varying,
  "created_at" timestamp without time zone DEFAULT now(),
  "published_at" timestamp without time zone,
  PRIMARY KEY ("id")
);

-- Table: sop_embeddings
CREATE TABLE IF NOT EXISTS "sop_embeddings" (
  "id" character varying(255) NOT NULL,
  "assistant" character varying(50) NOT NULL,
  "title" character varying(255) NOT NULL,
  "content" text NOT NULL,
  "embedding" text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp without time zone DEFAULT now(),
  "updated_at" timestamp without time zone DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: sop_metrics
CREATE TABLE IF NOT EXISTS "sop_metrics" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "date" date DEFAULT CURRENT_DATE,
  "total_requests" integer DEFAULT 0,
  "sop_used" integer DEFAULT 0,
  "assistant_used" integer DEFAULT 0,
  "sop_avg_confidence" double precision,
  "sop_avg_response_time_ms" double precision,
  "assistant_avg_response_time_ms" double precision,
  PRIMARY KEY ("id")
);

-- Table: sop_shadow_comparisons
CREATE TABLE IF NOT EXISTS "sop_shadow_comparisons" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "query" text NOT NULL,
  "route" character varying(50) NOT NULL,
  "assistant_response" text,
  "sop_response" text,
  "sop_confidence" double precision,
  "assistant_time_ms" integer,
  "sop_time_ms" integer,
  "created_at" timestamp without time zone DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: sop_update_log
CREATE TABLE IF NOT EXISTS "sop_update_log" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "document_id" character varying(255) NOT NULL,
  "reason" text NOT NULL,
  "sources" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "applied_at" timestamp without time zone NOT NULL,
  "backup_path" text,
  "created_at" timestamp without time zone DEFAULT now(),
  PRIMARY KEY ("id")
);

-- Table: sop_update_queue
CREATE TABLE IF NOT EXISTS "sop_update_queue" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "document_id" character varying(255) NOT NULL,
  "original_content" text NOT NULL,
  "suggested_content" text NOT NULL,
  "reason" text NOT NULL,
  "confidence" double precision NOT NULL,
  "sources" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "status" character varying(50) DEFAULT 'pending_review'::character varying,
  "created_at" timestamp without time zone DEFAULT now(),
  "reviewed_at" timestamp without time zone,
  "review_notes" text,
  PRIMARY KEY ("id")
);

-- Table: stakes
CREATE TABLE IF NOT EXISTS "stakes" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "challenge_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "role" character varying(20) NOT NULL,
  "amount" numeric NOT NULL,
  "percentage" numeric NOT NULL,
  "is_locked" boolean DEFAULT false,
  "locked_at" timestamp with time zone,
  "is_refunded" boolean DEFAULT false,
  "refunded_at" timestamp with time zone,
  "refund_reason" text,
  "lock_transaction_id" uuid,
  "refund_transaction_id" uuid,
  "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

-- Table: system_config
CREATE TABLE IF NOT EXISTS "system_config" (
  "key" character varying(255) NOT NULL,
  "value" jsonb NOT NULL,
  "description" text,
  "updatedAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("key")
);

-- Table: system_settings
CREATE TABLE IF NOT EXISTS "system_settings" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "key" character varying(100) NOT NULL,
  "value" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "description" text,
  "category" character varying(50),
  "updated_by" uuid,
  "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

-- Table: team_members
CREATE TABLE IF NOT EXISTS "team_members" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "team_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "role" character varying(20) DEFAULT 'member'::character varying,
  "joined_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "invited_by" uuid,
  "rounds_played" integer DEFAULT 0,
  "average_score" numeric,
  PRIMARY KEY ("id")
);

-- Table: teams
CREATE TABLE IF NOT EXISTS "teams" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "name" character varying(100) NOT NULL,
  "description" text,
  "team_type" character varying(50) NOT NULL,
  "is_public" boolean DEFAULT false,
  "max_members" integer DEFAULT 16,
  "join_code" character varying(20),
  "created_by" uuid NOT NULL,
  "captain_id" uuid,
  "total_rounds" integer DEFAULT 0,
  "wins" integer DEFAULT 0,
  "losses" integer DEFAULT 0,
  "logo_url" text,
  "primary_color" character varying(7),
  "secondary_color" character varying(7),
  "home_location" character varying(100),
  "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "archived_at" timestamp with time zone,
  PRIMARY KEY ("id")
);

-- Table: ticket_comments
CREATE TABLE IF NOT EXISTS "ticket_comments" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "ticket_id" uuid NOT NULL,
  "text" text NOT NULL,
  "created_by_id" uuid NOT NULL,
  "created_by_name" character varying(255) NOT NULL,
  "created_by_email" character varying(255) NOT NULL,
  "created_by_phone" character varying(50),
  "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

-- Table: tickets
CREATE TABLE IF NOT EXISTS "tickets" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "title" character varying(255) NOT NULL,
  "description" text NOT NULL,
  "category" character varying(50) NOT NULL,
  "status" character varying(50) NOT NULL DEFAULT 'open'::character varying,
  "priority" character varying(50) NOT NULL,
  "location" character varying(255),
  "created_by_id" uuid NOT NULL,
  "created_by_name" character varying(255) NOT NULL,
  "created_by_email" character varying(255) NOT NULL,
  "created_by_phone" character varying(50),
  "assigned_to_id" uuid,
  "assigned_to_name" character varying(255),
  "assigned_to_email" character varying(255),
  "createdAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  "resolved_at" timestamp without time zone,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  PRIMARY KEY ("id")
);

-- Table: usage_logs
CREATE TABLE IF NOT EXISTS "usage_logs" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "user_id" uuid,
  "endpoint" character varying(255) NOT NULL,
  "method" character varying(10),
  "status_code" integer,
  "response_time_ms" integer,
  "ip_address" character varying(45),
  "user_agent" text,
  "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

-- Table: user_achievements
CREATE TABLE IF NOT EXISTS "user_achievements" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "achievement_id" uuid NOT NULL,
  "awarded_by" uuid,
  "awarded_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "reason" text,
  "tournament_id" character varying(100),
  "display_priority" integer DEFAULT 0,
  "is_featured" boolean DEFAULT false,
  "expires_at" timestamp with time zone,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  PRIMARY KEY ("id")
);

-- Table: user_badges
CREATE TABLE IF NOT EXISTS "user_badges" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "badge_id" uuid NOT NULL,
  "earned_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  "season_id" uuid,
  "progress" jsonb DEFAULT '{}'::jsonb,
  "progress_percentage" integer DEFAULT 100,
  "trigger_type" character varying(100),
  "trigger_id" uuid,
  "trigger_data" jsonb DEFAULT '{}'::jsonb,
  "is_featured" boolean DEFAULT false,
  "display_order" integer,
  PRIMARY KEY ("id")
);

-- Table: user_blocks
CREATE TABLE IF NOT EXISTS "user_blocks" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "blocked_user_id" uuid NOT NULL,
  "reason" character varying(100),
  "notes" text,
  "blocked_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  "hide_from_suggestions" boolean DEFAULT true,
  "block_messages" boolean DEFAULT true,
  "block_wagers" boolean DEFAULT true,
  PRIMARY KEY ("id")
);

-- Table: user_clubhouses
CREATE TABLE IF NOT EXISTS "user_clubhouses" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "clubhouse_id" uuid NOT NULL,
  "is_primary" boolean DEFAULT false,
  "is_favorite" boolean DEFAULT false,
  "first_visit_date" date,
  "last_visit_date" date,
  "total_visits" integer DEFAULT 0,
  "total_hours_played" numeric DEFAULT 0,
  "preferred_bay_numbers" ARRAY,
  "preferred_time_slots" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

-- Table: user_settings
CREATE TABLE IF NOT EXISTS "user_settings" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "setting_key" character varying(255) NOT NULL,
  "setting_value" text,
  "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

-- Table: users
CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "email" character varying(255) NOT NULL,
  "password" character varying(255) NOT NULL,
  "name" character varying(255),
  "role" character varying(50) NOT NULL DEFAULT 'support'::character varying,
  "phone" character varying(50),
  "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  "last_login" timestamp without time zone,
  "is_active" boolean DEFAULT true,
  PRIMARY KEY ("id")
);
