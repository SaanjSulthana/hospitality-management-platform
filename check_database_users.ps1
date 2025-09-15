# Script to check database users
Write-Host "🔍 Checking database for users and organizations..." -ForegroundColor Green

try {
    # Get database connection string
    $connString = encore db conn-uri hospitality
    Write-Host "Database connection: $connString" -ForegroundColor Cyan
    
    # Try to connect and query using psql
    $query = @"
SELECT 'Organizations:' as info;
SELECT id, name, subdomain_prefix FROM organizations;
SELECT 'Users:' as info;
SELECT id, email, role, display_name, org_id FROM users;
SELECT 'Admin User:' as info;
SELECT id, email, role, display_name FROM users WHERE email = 'admin@example.com';
SELECT 'User Count:' as info;
SELECT COUNT(*) as total_users FROM users;
"@
    
    # Execute query
    $result = $query | psql $connString
    Write-Host $result -ForegroundColor White
    
} catch {
    Write-Host "❌ Failed to check database: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Trying alternative method..." -ForegroundColor Yellow
    
    # Alternative: Use encore db shell with commands
    try {
        Write-Host "Using Encore database shell..." -ForegroundColor Cyan
        $commands = @(
            "SELECT 'Organizations:' as info;",
            "SELECT id, name, subdomain_prefix FROM organizations;",
            "SELECT 'Users:' as info;",
            "SELECT id, email, role, display_name, org_id FROM users;",
            "SELECT 'Admin User:' as info;",
            "SELECT id, email, role, display_name FROM users WHERE email = 'admin@example.com';",
            "SELECT 'User Count:' as info;",
            "SELECT COUNT(*) as total_users FROM users;"
        )
        
        foreach ($cmd in $commands) {
            Write-Host "Executing: $cmd" -ForegroundColor Yellow
            echo $cmd | encore db shell hospitality
        }
    } catch {
        Write-Host "❌ Alternative method also failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}




