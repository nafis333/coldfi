$issues = 0
function passMsg($m) { Write-Host "  [PASS] $m" -ForegroundColor Green }
function failMsg($m) { Write-Host "  [FAIL] $m" -ForegroundColor Red; $script:issues++ }
function warnMsg($m) { Write-Host "  [WARN] $m" -ForegroundColor Yellow }

$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

Write-Host "=== Code Security Check ===" -ForegroundColor Cyan
Write-Host ""

# 1. Hardcoded secrets
Write-Host "1. Checking for hardcoded secrets..." -ForegroundColor Cyan
$secretPatterns = @("password\s*[=:]\s*['""][^'""]+", "secret\s*[=:]\s*['""][^'""]+", "api[_-]?key\s*[=:]\s*['""]", "AWS_ACCESS_KEY", "AWS_SECRET_KEY")
$found = $false
foreach ($pat in $secretPatterns) {
  $matches = Select-String -Path "packages/**/*.ts","packages/**/*.js","packages/**/*.json" -Pattern $pat -SimpleMatch:$false -Exclude "node_modules" | Where-Object { $_.Path -notmatch "node_modules|\.env\.example|CHANGE_ME|test" } | Select-Object -First 5
  if ($matches) { warnMsg "Possible hardcoded secret matching: $pat"; $found = $true }
}
if (-not $found) { passMsg "No obvious hardcoded secrets" }

# 2. SQL injection
Write-Host ""
Write-Host "2. Checking for SQL injection risks..." -ForegroundColor Cyan
$sqlMatches = Select-String -Path "packages/backend/src/**/*.ts" -Pattern "query\(\s*\`|query\(\s*['""].*\\$\{" -Exclude "node_modules","*.test.*" | Select-Object -First 10
if ($sqlMatches) { warnMsg "Template literals in SQL queries (verify parameterization)"; $sqlMatches | ForEach-Object { Write-Host "      $($_.Path):$($_.LineNumber)" } }
else { passMsg "No template literal SQL queries found" }

$paramCount = (Select-String -Path "packages/backend/src/**/*.ts" -Pattern "query\(\s*['""].*\\$\d|query\(\s*['""].*:" -Exclude "node_modules").Count
if ($paramCount -gt 0) { passMsg "Parameterized queries found ($paramCount instances)" }

# 3. eval()
Write-Host ""
Write-Host "3. Checking for dangerous functions..." -ForegroundColor Cyan
$evalMatches = Select-String -Path "packages/**/*.ts","packages/**/*.js" -Pattern "\beval\s*\(" -Exclude "node_modules","*.test.*" | Select-Object -First 5
if ($evalMatches) { failMsg "eval() usage found (potential code injection)"; $evalMatches | ForEach-Object { Write-Host "      $($_.Path):$($_.LineNumber)" } }
else { passMsg "No eval() usage found" }

# 4. Sensitive data in logs
Write-Host ""
Write-Host "4. Checking for sensitive data in logs..." -ForegroundColor Cyan
$logMatches = Select-String -Path "packages/**/*.ts" -Pattern "console\.(log|error|warn)\(.*password|console\.(log|error|warn)\(.*token|console\.(log|error|warn)\(.*secret" -Exclude "node_modules","*.test.*" | Select-Object -First 5
if ($logMatches) { warnMsg "Sensitive data may be logged"; $logMatches | ForEach-Object { Write-Host "      $($_.Path):$($_.LineNumber)" } }
else { passMsg "No sensitive data logging found" }

# 5. .env files committed
Write-Host ""
Write-Host "5. Checking for committed .env files..." -ForegroundColor Cyan
$envFiles = Get-ChildItem -Recurse -Filter ".env" -Exclude "node_modules",".git" -ErrorAction SilentlyContinue
if ($envFiles) { failMsg ".env files found (should be in .gitignore)"; $envFiles | ForEach-Object { Write-Host "      $($_.FullName)" } }
else { passMsg "No .env files committed" }

# 6. .gitignore
Write-Host ""
Write-Host "6. Checking .gitignore..." -ForegroundColor Cyan
if (Test-Path ".gitignore") {
  $content = Get-Content ".gitignore" -Raw
  foreach ($pat in @(".env", "node_modules", "*.key", "*.pem")) {
    if ($content -match [regex]::Escape($pat)) { passMsg ".gitignore includes: $pat" }
    else { warnMsg ".gitignore missing: $pat" }
  }
} else { warnMsg ".gitignore not found" }

Write-Host ""
Write-Host "================================"
Write-Host "  Issues: $issues" -ForegroundColor $(if ($issues -gt 0) { "Red" } else { "Green" })
Write-Host "================================"

if ($issues -gt 0) { exit 1 }
Write-Host "  No critical code security issues found" -ForegroundColor Green
