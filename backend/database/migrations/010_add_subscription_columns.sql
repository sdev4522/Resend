-- Migration: 010_add_subscription_columns.sql
-- Add Razorpay subscription and webhook settings

ALTER TABLE web_private ADD COLUMN IF NOT EXISTS rz_webhook_secret TEXT DEFAULT NULL;

ALTER TABLE user 
  ADD COLUMN IF NOT EXISTS subscription_id VARCHAR(255) DEFAULT NULL, 
  ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT NULL;
