-- Check if booking_rewards table exists
SELECT table_name FROM information_schema.tables WHERE table_name = 'booking_rewards';

-- Check customer_profiles structure for CC storage
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'customer_profiles' 
AND column_name IN ('cc_balance', 'total_cc_earned', 'total_cc_spent');

-- Check cc_transactions structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'cc_transactions' 
AND column_name IN ('user_id', 'type', 'amount', 'balance_before', 'balance_after');
