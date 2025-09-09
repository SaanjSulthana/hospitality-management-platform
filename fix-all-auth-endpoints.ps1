# PowerShell script to fix ALL auth endpoints in Encore.js backend
$backendPath = "backend"

Write-Host "=== FIXING ALL AUTH ENDPOINT SIGNATURES ==="

# Get all TypeScript files that contain the old signature pattern
$files = Get-ChildItem -Path $backendPath -Recurse -Filter "*.ts" | Where-Object { 
    $content = Get-Content $_.FullName -Raw
    $content -match "async \(req, authData\) =>" -and $content -notmatch "getAuthData\(\)"
}

Write-Host "Found $($files.Count) files to update"

$successCount = 0
$errorCount = 0

foreach ($file in $files) {
    Write-Host "Processing: $($file.Name)"
    
    try {
        $content = Get-Content $file.FullName -Raw
        $originalContent = $content
        
        # Fix import statements - remove auth and getAuthData imports, add getAuthData from ~encore/auth
        $content = $content -replace 'import \{ ([^}]*), auth, ([^}]*) \} from "\.\./auth/middleware";', 'import { getAuthData } from "~encore/auth";`nimport { $1, $2 } from "../auth/middleware";'
        $content = $content -replace 'import \{ ([^}]*), getAuthData, ([^}]*) \} from "\.\./auth/middleware";', 'import { getAuthData } from "~encore/auth";`nimport { $1, $2 } from "../auth/middleware";'
        $content = $content -replace 'import \{ auth, ([^}]*) \} from "\.\./auth/middleware";', 'import { getAuthData } from "~encore/auth";`nimport { $1 } from "../auth/middleware";'
        $content = $content -replace 'import \{ ([^}]*), auth \} from "\.\./auth/middleware";', 'import { getAuthData } from "~encore/auth";`nimport { $1 } from "../auth/middleware";'
        $content = $content -replace 'import \{ auth \} from "\.\./auth/middleware";', 'import { getAuthData } from "~encore/auth";'
        
        # Fix function signatures
        $content = $content -replace 'async \(req, authData\) =>', 'async (req) =>'
        
        # Add getAuthData() call at the beginning of each function
        $content = $content -replace 'async \(req\) => \{\s*if \(!authData\)', 'async (req) => {`n    const authData = getAuthData();`n    if (!authData)'
        
        # Handle cases where there's other code before the authData check
        $content = $content -replace 'async \(req\) => \{\s*try \{\s*if \(!authData\)', 'async (req) => {`n    try {`n      const authData = getAuthData();`n      if (!authData)'
        $content = $content -replace 'async \(req\) => \{\s*try \{\s*const authData = getAuthData\(\);', 'async (req) => {`n    try {`n      const authData = getAuthData();'
        
        # Handle cases with immediate authData usage
        $content = $content -replace 'async \(req\) => \{\s*requireRole', 'async (req) => {`n    const authData = getAuthData();`n    if (!authData) {`n      throw APIError.unauthenticated("Authentication required");`n    }`n    requireRole'
        
        # Save the file only if content changed
        if ($content -ne $originalContent) {
            Set-Content -Path $file.FullName -Value $content -Encoding UTF8
            Write-Host "  ✓ Updated successfully" -ForegroundColor Green
            $successCount++
        } else {
            Write-Host "  - No changes needed" -ForegroundColor Yellow
        }
    }
    catch {
        Write-Host "  ✗ Error: $($_.Exception.Message)" -ForegroundColor Red
        $errorCount++
    }
}

Write-Host ""
Write-Host "=== SUMMARY ===" -ForegroundColor Cyan
Write-Host "Successfully updated: $successCount files" -ForegroundColor Green
Write-Host "Errors: $errorCount files" -ForegroundColor Red
Write-Host "Total processed: $($files.Count) files"
Write-Host ""
Write-Host "Running TypeScript check..."
