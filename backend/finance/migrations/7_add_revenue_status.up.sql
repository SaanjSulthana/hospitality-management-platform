-- Add status and approval fields to revenues table to match expenses
ALTER TABLE revenues ADD COLUMN status VARCHAR(20) DEFAULT 'pending' NOT NULL;
ALTER TABLE revenues ADD COLUMN approved_by_user_id INTEGER;
ALTER TABLE revenues ADD COLUMN approved_at TIMESTAMP;

-- Add foreign key constraint for approved_by_user_id
ALTER TABLE revenues ADD CONSTRAINT fk_revenues_approved_by_user_id FOREIGN KEY (approved_by_user_id) REFERENCES users(id);

-- Update existing revenues to 'pending' status
UPDATE revenues SET status = 'pending' WHERE status IS NULL;
