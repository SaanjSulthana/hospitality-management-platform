# PowerShell script to fix auth endpoints in Encore.js backend
$backendPath = "backend"

# Get all TypeScript files that contain getAuthData()
$files = Get-ChildItem -Path $backendPath -Recurse -Filter "*.ts" | Where-Object { 
    (Get-Content $_.FullName -Raw) -match "getAuthData\(\)" 
}

Write-Host "Found $($files.Count) files to update"

foreach ($file in $files) {
    Write-Host "Processing: $($file.FullName)"
    
    $content = Get-Content $file.FullName -Raw
    
    # Skip if already updated (contains "async (req, authData) =>")
    if ($content -match "async \(req, authData\) =>") {
        Write-Host "  Already updated, skipping"
        continue
    }
    
    # Fix import statements
    $content = $content -replace 'import \{ ([^}]*), getAuthData \} from "\.\.\/auth\/middleware";', 'import { $1 } from "../auth/middleware";'
    $content = $content -replace 'import \{ ([^}]*), getAuthData \} from "\.\/middleware";', 'import { $1 } from "./middleware";'
    
    # Fix API handler signatures
    $content = $content -replace 'async \(req\) => \{\s*const authData = getAuthData\(\);\s*if \(!authData\) \{\s*throw APIError\.unauthenticated\("Authentication required"\);\s*\}', 'async (req, authData) => {
    if (!authData) {
      throw APIError.unauthenticated("Authentication required");
    }'
    
    # Write the updated content back
    Set-Content -Path $file.FullName -Value $content -Encoding UTF8
    Write-Host "  Updated successfully"
}

Write-Host "All files processed!"
