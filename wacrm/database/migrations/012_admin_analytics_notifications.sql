-- Migration 012: Admin Analytics, God Mode, and Notification Infrastructure

-- 1. Add is_blocked to user table if not exists
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns 
  WHERE table_schema = DATABASE() AND table_name = 'user' AND column_name = 'is_blocked'
);
SET @sql = IF(@col_exists = 0, 'ALTER TABLE `user` ADD COLUMN `is_blocked` TINYINT(1) NOT NULL DEFAULT 0 AFTER `tokenVersion`, ADD INDEX `idx_user_is_blocked` (`is_blocked`)', 'SELECT "Column is_blocked already exists"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. In-App Notifications table
CREATE TABLE IF NOT EXISTS `in_app_notifications` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `uid` VARCHAR(255) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `message` TEXT NOT NULL,
  `type` VARCHAR(50) NOT NULL DEFAULT 'INFO',
  `action_url` VARCHAR(500) NULL,
  `is_read` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_in_app_notif_user` (`uid`, `is_read`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Email Templates table
CREATE TABLE IF NOT EXISTS `mail_templates` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL UNIQUE,
  `subject` VARCHAR(255) NOT NULL,
  `body` TEXT NOT NULL,
  `variables` VARCHAR(500) NOT NULL DEFAULT '{{name}}, {{email}}',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed default mail templates if empty
INSERT IGNORE INTO `mail_templates` (`name`, `subject`, `body`, `variables`) VALUES
('welcome', 'Welcome to {{app_name}}!', '<p>Hello {{name}},</p><p>Welcome to <strong>{{app_name}}</strong>! Your account has been successfully created with the {{plan}} plan.</p><p>Get started by connecting your WhatsApp number in the dashboard.</p><br><p>Best regards,<br>{{app_name}} Team</p>', '{{name}}, {{email}}, {{plan}}, {{app_name}}'),
('password_reset', 'Reset Your Password - {{app_name}}', '<p>Hello {{name}},</p><p>We received a request to reset your password. Click the link below to set a new password:</p><p><a href="{{reset_link}}" style="padding:10px 20px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;display:inline-block;">Reset Password</a></p><p>If you did not request this, you can safely ignore this email.</p>', '{{name}}, {{email}}, {{reset_link}}, {{app_name}}'),
('payment_success', 'Payment Received - {{app_name}}', '<p>Hello {{name}},</p><p>Thank you for your payment of <strong>{{amount}}</strong> for the <strong>{{plan}}</strong> plan.</p><p>Your subscription is now active.</p><br><p>Best regards,<br>{{app_name}} Team</p>', '{{name}}, {{email}}, {{plan}}, {{amount}}, {{app_name}}');

-- 4. Notification Broadcast History (for Admin tracking)
CREATE TABLE IF NOT EXISTS `notification_broadcast_history` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `admin_uid` VARCHAR(255) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `message` TEXT NOT NULL,
  `channels` VARCHAR(100) NOT NULL,
  `audience_type` VARCHAR(50) NOT NULL,
  `recipient_count` INT NOT NULL DEFAULT 0,
  `sent_count` INT NOT NULL DEFAULT 0,
  `failed_count` INT NOT NULL DEFAULT 0,
  `status` VARCHAR(50) NOT NULL DEFAULT 'SENT',
  `details` JSON NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_broadcast_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Lightweight Admin Audit Log
CREATE TABLE IF NOT EXISTS `admin_audit_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `admin_uid` VARCHAR(255) NOT NULL,
  `action` VARCHAR(100) NOT NULL,
  `target_type` VARCHAR(50) NOT NULL,
  `target_id` VARCHAR(255) NULL,
  `details` JSON NULL,
  `ip_address` VARCHAR(100) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_audit_action_time` (`action`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
