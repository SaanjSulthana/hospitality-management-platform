# PowerShell script to replace v1Path() calls with literal /v1 paths
# Encore requires string literals for API paths

$replacements = @{
    'v1Path("/tasks")' = '"/v1/tasks"'
    'v1Path("/tasks/:id")' = '"/v1/tasks/:id"'
    'v1Path("/tasks/:id/assign")' = '"/v1/tasks/:id/assign"'
    'v1Path("/tasks/:id/status")' = '"/v1/tasks/:id/status"'
    'v1Path("/tasks/:id/hours")' = '"/v1/tasks/:id/hours"'
    'v1Path("/tasks/attachments")' = '"/v1/tasks/attachments"'
    
    'v1Path("/users")' = '"/v1/users"'
    'v1Path("/users/:id")' = '"/v1/users/:id"'
    'v1Path("/users/assign-properties")' = '"/v1/users/assign-properties"'
    'v1Path("/users/properties")' = '"/v1/users/properties"'
    'v1Path("/users/activity")' = '"/v1/users/activity"'
    'v1Path("/users/fix-schema")' = '"/v1/users/fix-schema"'
    
    'v1Path("/properties")' = '"/v1/properties"'
    'v1Path("/properties/:id")' = '"/v1/properties/:id"'
    'v1Path("/properties/:id/occupancy")' = '"/v1/properties/:id/occupancy"'
    
    'v1Path("/finance/revenues")' = '"/v1/finance/revenues"'
    'v1Path("/finance/revenues/:id")' = '"/v1/finance/revenues/:id"'
    'v1Path("/finance/revenues/:id/approve")' = '"/v1/finance/revenues/:id/approve"'
    'v1Path("/finance/expenses")' = '"/v1/finance/expenses"'
    'v1Path("/finance/expenses/:id")' = '"/v1/finance/expenses/:id"'
    'v1Path("/finance/expenses/:id/approve")' = '"/v1/finance/expenses/:id/approve"'
    'v1Path("/finance/summary")' = '"/v1/finance/summary"'
    'v1Path("/finance/realtime/subscribe")' = '"/v1/finance/realtime/subscribe"'
    
    'v1Path("/guest-checkin/create")' = '"/v1/guest-checkin/create"'
    'v1Path("/guest-checkin/list")' = '"/v1/guest-checkin/list"'
    'v1Path("/guest-checkin/:id")' = '"/v1/guest-checkin/:id"'
    'v1Path("/guest-checkin/:checkInId/documents")' = '"/v1/guest-checkin/:checkInId/documents"'
    'v1Path("/guest-checkin/documents/upload")' = '"/v1/guest-checkin/documents/upload"'
    'v1Path("/guest-checkin/documents/:documentId")' = '"/v1/guest-checkin/documents/:documentId"'
    'v1Path("/guest-checkin/documents/:documentId/view")' = '"/v1/guest-checkin/documents/:documentId/view"'
    'v1Path("/guest-checkin/documents/:documentId/thumbnail")' = '"/v1/guest-checkin/documents/:documentId/thumbnail"'
    'v1Path("/guest-checkin/documents/:documentId/download")' = '"/v1/guest-checkin/documents/:documentId/download"'
    'v1Path("/guest-checkin/documents/:documentId/verify")' = '"/v1/guest-checkin/documents/:documentId/verify"'
    'v1Path("/guest-checkin/documents/:documentId/retry-extraction")' = '"/v1/guest-checkin/documents/:documentId/retry-extraction"'
    'v1Path("/guest-checkin/audit-events/subscribe")' = '"/v1/guest-checkin/audit-events/subscribe"'
    
    'v1Path("/reports/export/daily-pdf")' = '"/v1/reports/export/daily-pdf"'
    'v1Path("/reports/export/daily-excel")' = '"/v1/reports/export/daily-excel"'
    'v1Path("/reports/export/monthly-pdf")' = '"/v1/reports/export/monthly-pdf"'
    'v1Path("/reports/export/monthly-excel")' = '"/v1/reports/export/monthly-excel"'
    'v1Path("/reports/realtime/poll")' = '"/v1/reports/realtime/poll"'
    
    'v1Path("/staff/export/leave")' = '"/v1/staff/export/leave"'
    'v1Path("/staff/export/attendance")' = '"/v1/staff/export/attendance"'
    'v1Path("/staff/export/salary")' = '"/v1/staff/export/salary"'
    
    'v1Path("/system/health")' = '"/v1/system/health"'
    'v1Path("/system/ready")' = '"/v1/system/ready"'
    'v1Path("/system/live")' = '"/v1/system/live"'
    'v1Path("/system/cache/status")' = '"/v1/system/cache/status"'
    'v1Path("/system/config/health")' = '"/v1/system/config/health"'
    'v1Path("/system/config/validate")' = '"/v1/system/config/validate"'
    'v1Path("/system/config/environment")' = '"/v1/system/config/environment"'
    'v1Path("/system/config/test-database")' = '"/v1/system/config/test-database"'
    'v1Path("/system/database/replicas/status")' = '"/v1/system/database/replicas/status"'
    'v1Path("/system/database/replicas/health")' = '"/v1/system/database/replicas/health"'
    'v1Path("/system/database/replicas/lag")' = '"/v1/system/database/replicas/lag"'
    'v1Path("/system/database/connection-pool/stats")' = '"/v1/system/database/connection-pool/stats"'
    'v1Path("/system/monitoring/dashboard")' = '"/v1/system/monitoring/dashboard"'
    'v1Path("/system/monitoring/unified/metrics")' = '"/v1/system/monitoring/unified/metrics"'
    'v1Path("/system/monitoring/unified/health")' = '"/v1/system/monitoring/unified/health"'
    'v1Path("/system/telemetry/client")' = '"/v1/system/telemetry/client"'
    'v1Path("/system/alerts/active")' = '"/v1/system/alerts/active"'
    'v1Path("/system/alerts/history")' = '"/v1/system/alerts/history"'
    'v1Path("/system/alerts/:alertId/acknowledge")' = '"/v1/system/alerts/:alertId/acknowledge"'
    'v1Path("/system/alerts/:alertId/clear")' = '"/v1/system/alerts/:alertId/clear"'
    'v1Path("/system/alerts/stats")' = '"/v1/system/alerts/stats"'
    'v1Path("/system/metrics/all")' = '"/v1/system/metrics/all"'
    'v1Path("/system/metrics/:name")' = '"/v1/system/metrics/:name"'
    'v1Path("/system/metrics/aggregated")' = '"/v1/system/metrics/aggregated"'
}

$files = Get-ChildItem -Path "backend" -Recurse -Filter "*.ts" | Where-Object { $_.FullName -notlike "*node_modules*" }

$totalReplacements = 0

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $originalContent = $content
    
    foreach ($key in $replacements.Keys) {
        if ($content -match [regex]::Escape($key)) {
            $content = $content -replace [regex]::Escape($key), $replacements[$key]
            $totalReplacements++
        }
    }
    
    if ($content -ne $originalContent) {
        Set-Content -Path $file.FullName -Value $content -NoNewline
        Write-Host "Updated: $($file.FullName)"
    }
}

Write-Host "`nTotal replacements made: $totalReplacements"
Write-Host "Script completed successfully!"

