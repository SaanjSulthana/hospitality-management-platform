-- Clear all daily cash balance records for properties 1 and 2
DELETE FROM daily_cash_balances 
WHERE property_id IN (1, 2);

-- Clear any cached report data for these properties
DELETE FROM report_cache 
WHERE cache_key LIKE '%property_1%' OR cache_key LIKE '%property_2%';

-- Show the results
SELECT 'Daily cash balances cleared' as status;
SELECT 'Report cache cleared' as status;
