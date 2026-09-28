-- Migration 013: Email Verification and User Email Verification Timestamp
-- Purpose: Adds server-authoritative email verification tracking and separate verification code/token table.

-- 1. Add email_verified_at column to user table if not already present
ALTER TABLE user ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP NULL DEFAULT NULL;

-- 2. Backfill existing user accounts so existing logins are not disrupted
UPDATE user SET email_verified_at = CURRENT_TIMESTAMP WHERE email_verified_at IS NULL;

-- 3. Create email_verification table for secure OTP/token handling
CREATE TABLE IF NOT EXISTS email_verification (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uid VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email_verification_token (token_hash),
  INDEX idx_email_verification_uid (uid),
  INDEX idx_email_verification_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Rollback instructions:
-- ALTER TABLE user DROP COLUMN email_verified_at;
-- DROP TABLE IF EXISTS email_verification;
