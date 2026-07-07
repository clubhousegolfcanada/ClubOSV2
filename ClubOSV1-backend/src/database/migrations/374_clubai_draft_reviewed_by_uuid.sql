-- Migration: Fix clubai_draft_responses.reviewed_by type
-- Date: 2026-07-06
-- Purpose: reviewed_by was INTEGER, but users.id is UUID. Every approve/edit/reject
--          UPDATE (SET reviewed_by = <uuid>) threw "invalid input syntax for type integer"
--          AFTER the SMS had already been sent, causing retries to double-text customers.
--          The column has only ever held NULL (all writes failed), so the cast is safe.
-- Idempotent: only alters when the column is still INTEGER.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clubai_draft_responses'
      AND column_name = 'reviewed_by'
      AND data_type = 'integer'
  ) THEN
    ALTER TABLE clubai_draft_responses
      ALTER COLUMN reviewed_by TYPE UUID USING reviewed_by::text::uuid;
  END IF;
END $$;
