-- Migration 016: Add Google Authentication Support
-- Purpose: Supports Google OAuth / OpenID Connect authentication with secure secret isolation and user identity linking.

ALTER TABLE web_public ADD COLUMN IF NOT EXISTS google_client_id VARCHAR(999) DEFAULT NULL;
ALTER TABLE web_public ADD COLUMN IF NOT EXISTS google_login_active INT(11) DEFAULT 1;

-- Google Client Secret isolated in private configuration table (never exposed in web_public)
ALTER TABLE web_private ADD COLUMN IF NOT EXISTS google_client_secret TEXT DEFAULT NULL;

-- Safe identity mapping column for Google Subject ID
ALTER TABLE user ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) DEFAULT NULL;

-- Rollback instructions:
-- ALTER TABLE user DROP COLUMN google_id;
-- ALTER TABLE web_private DROP COLUMN google_client_secret;
-- ALTER TABLE web_public DROP COLUMN google_client_id;
-- ALTER TABLE web_public DROP COLUMN google_login_active;
