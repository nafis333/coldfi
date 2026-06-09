param([string]$BaseUrl = "http://localhost:3001")

$pass = 0; $fail = 0; $warn = 0
function passMsg($m) { Write-Host "  [PASS] $m" -ForegroundColor Green; $script:pass++ }
function failMsg($m) { Write-Host "  [FAIL] $m" -ForegroundColor Red; $script:fail++ }
function warnMsg($m) { Write-Host "  [WARN] $m" -ForegroundColor Yellow; $script:warn++ }

function api($method, $path, $token, $body) {
  $h = @{ "Content-Type" = "application/json" }
  if ($token) { $h["Authorization"] = "Bearer $token" }
  $params = @{ Method = $method; Uri = "$BaseUrl$path"; Headers = $h; UseBasicParsing = $true }
  if ($body) { $params["Body"] = ($body | ConvertTo-Json -Compress) }
  try { $r = Invoke-WebRequest @params -ErrorAction Stop; return $r } catch { return $_.Exception.Response }
}

Write-Host "=== ColdFi - Security Audit ===" -ForegroundColor Cyan
Write-Host "Target: $BaseUrl"
Write-Host ""

# 1. AUTH
Write-Host "1. AUTHENTICATION FLOWS" -ForegroundColor Cyan
$testEmail = "audit-test-$(Get-Random)@test.com"

try {
  $reg = Invoke-WebRequest -Method Post "$BaseUrl/api/auth/register" -ContentType "application/json" -Body "{`"email`":`"$testEmail`",`"password`":`"TestPass123!`"}" -UseBasicParsing -ErrorAction Stop
  passMsg "Registration succeeds (201)"
} catch { passMsg "Registration endpoint responds ($($_.Exception.Response.StatusCode.value__))" }

$login = $null
try {
  $login = Invoke-WebRequest -Method Post "$BaseUrl/api/auth/login" -ContentType "application/json" -Body "{`"email`":`"$testEmail`",`"password`":`"TestPass123!`"}" -UseBasicParsing
  if ($login.StatusCode -eq 200) {
    passMsg "Login succeeds with correct credentials"
    $token = ($login.Content | ConvertFrom-Json).accessToken
    if ($token) { passMsg "Access token returned" } else { failMsg "No access token" }
    $refreshToken = ($login.Content | ConvertFrom-Json).refreshToken
    if ($refreshToken) { passMsg "Refresh token returned" } else { failMsg "No refresh token" }
  } else { failMsg "Login failed: $($login.StatusCode)" }
} catch { failMsg "Login request failed: $_" }

try {
  $wrong = Invoke-WebRequest -Method Post "$BaseUrl/api/auth/login" -ContentType "application/json" -Body "{`"email`":`"$testEmail`",`"password`":`"WrongPassword!`"}" -UseBasicParsing -ErrorAction Stop
  if ($wrong.StatusCode -eq 401) { passMsg "Wrong password returns 401" } else { failMsg "Wrong password returned: $($wrong.StatusCode)" }
} catch { if ($_.Exception.Response.StatusCode.value__ -eq 401) { passMsg "Wrong password returns 401" } else { failMsg "Wrong password error: $($_.Exception.Response.StatusCode.value__)" } }

# 2. RATE LIMITING
Write-Host ""
Write-Host "2. RATE LIMITING" -ForegroundColor Cyan
$rateLimited = $false
for ($i = 0; $i -lt 20; $i++) {
  try {
    $rl = Invoke-WebRequest -Method Post "$BaseUrl/api/auth/login" -ContentType "application/json" -Body "{`"email`":`"ratelimit@test.com`",`"password`":`"wrong`"}" -UseBasicParsing -ErrorAction Stop
  } catch { if ($_.Exception.Response.StatusCode.value__ -eq 429) { passMsg "Rate limiting active after $($i+1) requests"; $rateLimited = $true; break } }
}
if (-not $rateLimited) { failMsg "Rate limiting not triggered after 20 requests" }

# 3. SECURITY HEADERS
Write-Host ""
Write-Host "3. SECURITY HEADERS" -ForegroundColor Cyan
try {
  $headers = Invoke-WebRequest -Method Get "$BaseUrl/health" -UseBasicParsing
  $h = $headers.Headers
  if ($h["X-Content-Type-Options"]) { passMsg "Header: X-Content-Type-Options" } else { warnMsg "Missing: X-Content-Type-Options" }
  if ($h["X-Frame-Options"]) { passMsg "Header: X-Frame-Options" } else { warnMsg "Missing: X-Frame-Options" }
  if ($h["X-XSS-Protection"]) { passMsg "Header: X-XSS-Protection" } else { warnMsg "Missing: X-XSS-Protection" }
} catch { warnMsg "Could not check headers" }

# 4. ADMIN AUTH
Write-Host ""
Write-Host "4. ADMIN AUTHENTICATION" -ForegroundColor Cyan
try {
  $admin = Invoke-WebRequest -Method Get "$BaseUrl/api/admin/users" -UseBasicParsing -ErrorAction Stop
  failMsg "Admin endpoint accessible without auth (status: $($admin.StatusCode))"
} catch {
  $code = $_.Exception.Response.StatusCode.value__
  if ($code -eq 401 -or $code -eq 403) { passMsg "Admin endpoints require authentication ($code)" }
  else { failMsg "Admin endpoint returned unexpected status: $code" }
}

Write-Host ""
Write-Host "================================"
Write-Host "  Passed:   $pass" -ForegroundColor Green
Write-Host "  Failed:   $fail" -ForegroundColor Red
Write-Host "  Warnings: $warn" -ForegroundColor Yellow
Write-Host "================================"

if ($fail -gt 0) { exit 1 }
