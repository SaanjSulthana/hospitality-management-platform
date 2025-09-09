# PowerShell script to setup database tables for finance approval system

Write-Host "Setting up database tables for finance approval system..."

# Connect to database and run SQL commands
$sqlCommands = @"
-- Check if notifications table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'notifications'
) as notifications_exists;

-- Check if daily_approvals table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'daily_approvals'
) as daily_approvals_exists;

-- Create notifications table if it doesn't exist
CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  org_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  payload_json JSONB DEFAULT '{}',
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for notifications
CREATE INDEX IF NOT EXISTS idx_notifications_org_user ON notifications(org_id, user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_read_at ON notifications(read_at);

-- Create daily_approvals table if it doesn't exist
CREATE TABLE IF NOT EXISTS daily_approvals (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL,
  manager_user_id INTEGER NOT NULL,
  approval_date DATE NOT NULL,
  approved_by_admin_id INTEGER NOT NULL,
  approved_at TIMESTAMP NOT NULL DEFAULT NOW(),
  notes TEXT,
  
  CONSTRAINT fk_daily_approvals_org_id FOREIGN KEY (org_id) REFERENCES organizations(id),
  CONSTRAINT fk_daily_approvals_manager_user_id FOREIGN KEY (manager_user_id) REFERENCES users(id),
  CONSTRAINT fk_daily_approvals_approved_by_admin_id FOREIGN KEY (approved_by_admin_id) REFERENCES users(id),
  
  -- Ensure one approval per manager per day
  UNIQUE(org_id, manager_user_id, approval_date)
);

-- Create indexes for daily_approvals
CREATE INDEX IF NOT EXISTS idx_daily_approvals_manager_date ON daily_approvals(org_id, manager_user_id, approval_date);
CREATE INDEX IF NOT EXISTS idx_daily_approvals_date ON daily_approvals(org_id, approval_date);

-- Verify tables were created
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('notifications', 'daily_approvals')
ORDER BY table_name;
"@

# Write SQL to temporary file
$tempFile = [System.IO.Path]::GetTempFileName() + ".sql"
$sqlCommands | Out-File -FilePath $tempFile -Encoding UTF8

Write-Host "Created temporary SQL file: $tempFile"
Write-Host "Running database setup..."

try {
    # Run the SQL commands
    encore db shell hospitality --write < $tempFile
    Write-Host "Database setup completed successfully!"
} catch {
    Write-Host "Error running database setup: $_"
} finally {
    # Clean up temporary file
    if (Test-Path $tempFile) {
        Remove-Item $tempFile
        Write-Host "Cleaned up temporary file"
    }
}

Write-Host "Database setup script completed."
