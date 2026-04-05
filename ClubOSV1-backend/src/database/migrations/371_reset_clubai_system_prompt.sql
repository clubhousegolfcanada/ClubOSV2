-- Reset ClubAI system prompt cache so it reloads from the fixed file.
-- The DB-cached version had "You CANNOT reset TrackMan remotely" which
-- contradicted the restart_trackman tool, causing GPT to skip the tool call.
DELETE FROM pattern_learning_config WHERE config_key = 'clubai_system_prompt';
