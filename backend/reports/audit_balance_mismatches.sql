-- Universal Audit Query for Balance Mismatches
-- Run this to see what's actually stored in the database for any property/organization

-- First, get all properties (or filter by specific criteria)
SELECT id, name, org_id 
FROM properties 
ORDER BY org_id, name;

-- Check daily_cash_balances for all properties (customize date range and filters as needed)
-- Replace the WHERE conditions below with your specific criteria:
-- - For specific property: AND p.id = 1
-- - For specific org: AND dcb.org_id = 2  
-- - For specific date range: AND dcb.balance_date >= '2025-10-01' AND dcb.balance_date <= '2025-10-31'
-- - For property name pattern: AND p.name LIKE '%varkala%'

SELECT 
  dcb.balance_date,
  dcb.org_id,
  dcb.property_id,
  p.name as property_name,
  dcb.opening_balance_cents / 100.0 as opening_balance_rupees,
  dcb.cash_received_cents / 100.0 as cash_received_rupees,
  dcb.bank_received_cents / 100.0 as bank_received_rupees,
  dcb.cash_expenses_cents / 100.0 as cash_expenses_rupees,
  dcb.bank_expenses_cents / 100.0 as bank_expenses_rupees,
  dcb.closing_balance_cents / 100.0 as closing_balance_rupees,
  dcb.calculated_closing_balance_cents / 100.0 as calculated_closing_rupees,
  dcb.balance_discrepancy_cents / 100.0 as discrepancy_rupees,
  dcb.is_opening_balance_auto_calculated,
  -- Check if next day's opening matches this day's closing
  next_day.opening_balance_cents / 100.0 as next_day_opening_rupees,
  (dcb.closing_balance_cents - COALESCE(next_day.opening_balance_cents, 0)) / 100.0 as cascade_error_rupees,
  dcb.created_at,
  dcb.updated_at
FROM daily_cash_balances dcb
LEFT JOIN properties p ON dcb.property_id = p.id
LEFT JOIN daily_cash_balances next_day 
  ON next_day.property_id = dcb.property_id 
  AND next_day.org_id = dcb.org_id
  AND next_day.balance_date = dcb.balance_date + INTERVAL '1 day'
WHERE 1=1  -- Add your filters here
  -- Example filters (uncomment and modify as needed):
  -- AND dcb.org_id = 2  -- Specific organization
  -- AND p.id = 1  -- Specific property
  -- AND p.name LIKE '%varkala%'  -- Property name pattern
  -- AND dcb.balance_date >= '2025-10-01'  -- Start date
  -- AND dcb.balance_date <= '2025-10-31'  -- End date
ORDER BY dcb.org_id, dcb.property_id, dcb.balance_date;

-- Check actual transactions for a specific date to verify data
-- Replace the date and property filters as needed:
-- - For specific property: AND property_id = 1
-- - For specific org: AND org_id = 2
-- - For specific date: AND occurred_at::date = '2025-10-15'

SELECT 
  'revenue' as type,
  org_id,
  property_id,
  occurred_at::date as transaction_date,
  amount_cents / 100.0 as amount_rupees,
  payment_mode,
  source as category,
  status,
  created_at
FROM revenues
WHERE 1=1  -- Add your filters here
  -- Example filters (uncomment and modify as needed):
  -- AND org_id = 2  -- Specific organization
  -- AND property_id = 1  -- Specific property
  -- AND occurred_at::date = '2025-10-15'  -- Specific date
  AND status = 'approved'
UNION ALL
SELECT 
  'expense' as type,
  org_id,
  property_id,
  expense_date::date as transaction_date,
  amount_cents / 100.0 as amount_rupees,
  payment_mode,
  category,
  status,
  created_at
FROM expenses
WHERE 1=1  -- Add your filters here
  -- Example filters (uncomment and modify as needed):
  -- AND org_id = 2  -- Specific organization
  -- AND property_id = 1  -- Specific property
  -- AND expense_date::date = '2025-10-15'  -- Specific date
  AND status = 'approved'
ORDER BY org_id, property_id, transaction_date, type;

-- Summary: Show problematic dates only (dates with balance mismatches)
-- This query shows only dates where closing balance doesn't match next day's opening balance
-- Customize the WHERE conditions as needed for your specific audit

SELECT 
  dcb.org_id,
  dcb.property_id,
  p.name as property_name,
  dcb.balance_date,
  dcb.closing_balance_cents / 100.0 as closing_balance,
  next_day.opening_balance_cents / 100.0 as next_day_opening,
  (dcb.closing_balance_cents - COALESCE(next_day.opening_balance_cents, 0)) / 100.0 as mismatch,
  CASE 
    WHEN dcb.closing_balance_cents != COALESCE(next_day.opening_balance_cents, 0) THEN '❌ MISMATCH'
    ELSE '✅ OK'
  END as status
FROM daily_cash_balances dcb
LEFT JOIN properties p ON dcb.property_id = p.id
LEFT JOIN daily_cash_balances next_day 
  ON next_day.property_id = dcb.property_id 
  AND next_day.org_id = dcb.org_id
  AND next_day.balance_date = dcb.balance_date + INTERVAL '1 day'
WHERE 1=1  -- Add your filters here
  -- Example filters (uncomment and modify as needed):
  -- AND dcb.org_id = 2  -- Specific organization
  -- AND p.id = 1  -- Specific property
  -- AND p.name LIKE '%varkala%'  -- Property name pattern
  -- AND dcb.balance_date >= '2025-10-01'  -- Start date
  -- AND dcb.balance_date <= '2025-10-31'  -- End date
  AND dcb.closing_balance_cents != COALESCE(next_day.opening_balance_cents, 0)  -- Only show mismatches
ORDER BY dcb.org_id, dcb.property_id, dcb.balance_date;

-- Quick summary by organization and property
SELECT 
  dcb.org_id,
  dcb.property_id,
  p.name as property_name,
  COUNT(*) as total_dates,
  COUNT(CASE WHEN dcb.closing_balance_cents != COALESCE(next_day.opening_balance_cents, 0) THEN 1 END) as mismatch_dates,
  ROUND(
    COUNT(CASE WHEN dcb.closing_balance_cents != COALESCE(next_day.opening_balance_cents, 0) THEN 1 END) * 100.0 / COUNT(*), 
    2
  ) as mismatch_percentage
FROM daily_cash_balances dcb
LEFT JOIN properties p ON dcb.property_id = p.id
LEFT JOIN daily_cash_balances next_day 
  ON next_day.property_id = dcb.property_id 
  AND next_day.org_id = dcb.org_id
  AND next_day.balance_date = dcb.balance_date + INTERVAL '1 day'
WHERE 1=1  -- Add your filters here
  -- Example filters (uncomment and modify as needed):
  -- AND dcb.org_id = 2  -- Specific organization
  -- AND dcb.balance_date >= '2025-10-01'  -- Start date
  -- AND dcb.balance_date <= '2025-10-31'  -- End date
GROUP BY dcb.org_id, dcb.property_id, p.name
ORDER BY dcb.org_id, mismatch_percentage DESC;

