-- Remove status and approval fields from revenues table
ALTER TABLE revenues DROP CONSTRAINT IF EXISTS fk_revenues_approved_by_user_id;
ALTER TABLE revenues DROP COLUMN IF EXISTS approved_at;
ALTER TABLE revenues DROP COLUMN IF EXISTS approved_by_user_id;
ALTER TABLE revenues DROP COLUMN IF EXISTS status;
