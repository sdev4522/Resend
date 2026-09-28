-- Migration: 011_create_public_api_tables.sql
-- Create production tables for WACRM Developer Public REST API platform (v1)

-- 1. API Keys table
CREATE TABLE IF NOT EXISTS `api_keys` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `uid` VARCHAR(999) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `key_prefix` VARCHAR(32) NOT NULL,
  `key_hash` VARCHAR(128) NOT NULL,
  `status` ENUM('active', 'revoked', 'expired') NOT NULL DEFAULT 'active',
  `scopes` LONGTEXT NOT NULL,
  `rate_limit_policy` LONGTEXT DEFAULT NULL,
  `default_connection_id` VARCHAR(64) DEFAULT NULL,
  `expires_at` DATETIME DEFAULT NULL,
  `last_used_at` DATETIME DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `revoked_at` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_key_hash` (`key_hash`),
  KEY `idx_uid` (`uid`(255)),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. API Key Allowed Connections table
CREATE TABLE IF NOT EXISTS `api_key_connections` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `api_key_id` INT NOT NULL,
  `connection_public_id` VARCHAR(64) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_api_key_conn` (`api_key_id`, `connection_public_id`),
  KEY `idx_conn_pub_id` (`connection_public_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Public Connection Mapping table (maps internal instance / meta_api records to stable wa_... IDs)
CREATE TABLE IF NOT EXISTS `api_connections` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `public_id` VARCHAR(64) NOT NULL,
  `uid` VARCHAR(999) NOT NULL,
  `provider` ENUM('qr', 'meta') NOT NULL,
  `provider_ref` VARCHAR(255) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `phone_number` VARCHAR(64) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_public_id` (`public_id`),
  KEY `idx_uid_provider` (`uid`(255), `provider`),
  UNIQUE KEY `idx_provider_ref` (`provider`, `provider_ref`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Idempotency Keys table
CREATE TABLE IF NOT EXISTS `api_idempotency_keys` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `uid` VARCHAR(999) NOT NULL,
  `api_key_id` INT NOT NULL,
  `idempotency_key` VARCHAR(255) NOT NULL,
  `request_path` VARCHAR(255) NOT NULL,
  `request_hash` VARCHAR(128) NOT NULL,
  `response_status` INT NOT NULL,
  `response_body` LONGTEXT NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_uid_idem` (`uid`(255), `idempotency_key`),
  KEY `idx_expires_at` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Rate Limits table (Multi-process safe sliding window)
CREATE TABLE IF NOT EXISTS `api_rate_limits` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `bucket_key` VARCHAR(255) NOT NULL,
  `window_start` BIGINT NOT NULL,
  `request_count` INT NOT NULL DEFAULT 1,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_bucket_key` (`bucket_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Usage Events table
CREATE TABLE IF NOT EXISTS `api_usage_events` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `uid` VARCHAR(999) NOT NULL,
  `api_key_id` INT DEFAULT NULL,
  `connection_public_id` VARCHAR(64) DEFAULT NULL,
  `endpoint` VARCHAR(128) NOT NULL,
  `method` VARCHAR(16) NOT NULL,
  `status_code` INT NOT NULL,
  `message_id` VARCHAR(128) DEFAULT NULL,
  `message_status` VARCHAR(32) DEFAULT NULL,
  `duration_ms` INT DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_uid_created` (`uid`(255), `created_at`),
  KEY `idx_key_created` (`api_key_id`, `created_at`),
  KEY `idx_message_id` (`message_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
