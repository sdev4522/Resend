-- Migration 015: Terms and Privacy Policy Consent Timestamp
-- Purpose: Records affirmative user consent to Terms of Service and Privacy Policy during signup.

ALTER TABLE user ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMP NULL DEFAULT NULL;

-- Rollback instructions:
-- ALTER TABLE user DROP COLUMN terms_accepted_at;
