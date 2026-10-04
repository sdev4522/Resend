-- Migration: 014_reconcile_free_trial_plan.sql
-- Reconciles Free Trial plan semantics to 14-day ₹0/$0 genuine trial with is_trial = 1.

UPDATE plan 
SET title = 'Free Trial', 
    price = 0, 
    price_strike = NULL, 
    is_trial = 1, 
    plan_duration_in_days = '14', 
    short_description = '14-Day Free Trial — Full access to test WhatsApp inbox, automation, and campaigns.' 
WHERE id = 17 OR LOWER(title) LIKE '%trial%';

UPDATE plan_prices 
SET amount = 0.00, 
    strike_amount = NULL, 
    billing_period_days = 14 
WHERE plan_id = 17;

INSERT IGNORE INTO plan_prices (plan_id, currency_code, amount, strike_amount, billing_period_days, is_active) 
VALUES 
  (17, 'USD', 0.00, NULL, 14, 1),
  (17, 'INR', 0.00, NULL, 14, 1),
  (17, 'EUR', 0.00, NULL, 14, 1),
  (17, 'GBP', 0.00, NULL, 14, 1),
  (17, 'AED', 0.00, NULL, 14, 1);
