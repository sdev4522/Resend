-- Migration: 009_create_coupon_table.sql
-- Create coupon table and seed default discount coupons

CREATE TABLE IF NOT EXISTS coupon (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  type ENUM('percentage', 'fixed') NOT NULL DEFAULT 'percentage',
  value DECIMAL(10, 2) NOT NULL,
  min_amount DECIMAL(10, 2) DEFAULT 0,
  max_discount DECIMAL(10, 2) DEFAULT NULL,
  is_active TINYINT(1) DEFAULT 1,
  expires_at TIMESTAMP NULL DEFAULT NULL,
  usage_limit INT DEFAULT NULL,
  used_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO coupon (code, type, value, min_amount, max_discount, is_active, expires_at)
VALUES 
('WELCOME10', 'percentage', 10.00, 0.00, 50.00, 1, DATE_ADD(NOW(), INTERVAL 1 YEAR)),
('FLAT50', 'fixed', 50.00, 100.00, NULL, 1, DATE_ADD(NOW(), INTERVAL 1 YEAR)),
('WACRM10', 'percentage', 10.00, 0.00, 100.00, 1, DATE_ADD(NOW(), INTERVAL 1 YEAR))
ON DUPLICATE KEY UPDATE is_active = 1;
