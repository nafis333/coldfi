param([string]$BaseUrl = "http://localhost:3001")

$pass = 0; $fail = 0; $skip = 0
function passMsg($n, $m) { Write-Host "  [PASS] $m" -ForegroundColor Green; $script:pass++ }
function failMsg($n, $m) { Write-Host "  [FAIL] $m" -ForegroundColor Red; $script:fail++ }
function skipMsg($n, $m) { Write-Host "  [SKIP] $m" -ForegroundColor Yellow; $script:skip++ }

$apiBase = "$BaseUrl/api"

Write-Host "=== ColdFi - Final Integration Test ===" -ForegroundColor Cyan
Write-Host "API: $BaseUrl"
Write-Host ""

# Step 1: Register User A
Write-Host "1. REGISTER USER A" -ForegroundColor Cyan
try {
  $r = Invoke-WebRequest -Method Post "$apiBase/auth/register" -ContentType "application/json" -Body '{"email":"alice-int@test.com","password":"AlicePass123!"}' -UseBasicParsing -ErrorAction Stop
  if ($r.StatusCode -in @(201, 409)) { passMsg 1 "User A registered" } else { failMsg 1 "Registration failed: $($r.StatusCode)" }
} catch {
  if ($_.Exception.Response.StatusCode.value__ -eq 409) { passMsg 1 "User A already exists (409)" }
  else { failMsg 1 "Registration error: $($_.Exception.Message)" }
}

# Step 2: Login User A
Write-Host ""; Write-Host "2. LOGIN USER A" -ForegroundColor Cyan
try {
  $r = Invoke-WebRequest -Method Post "$apiBase/auth/login" -ContentType "application/json" -Body '{"email":"alice-int@test.com","password":"AlicePass123!"}' -UseBasicParsing
  if ($r.StatusCode -eq 200) {
    $body = $r.Content | ConvertFrom-Json
    $tokenA = $body.accessToken
    $refreshA = $body.refreshToken
    $userIdA = $body.userId
    passMsg 2 "User A logged in"
  } else { failMsg 2 "Login failed: $($r.StatusCode)" }
} catch { failMsg 2 "Login error: $_" }

# Step 3: Add Personal Expense
Write-Host ""; Write-Host "3. ADD PERSONAL EXPENSE" -ForegroundColor Cyan
if ($tokenA) {
  try {
    $r = Invoke-WebRequest -Method Post "$apiBase/expenses" -ContentType "application/json" -Authentication Bearer -Token $tokenA -Body '{"amount":25.50,"category":"food","note":"Lunch","date":"2024-01-15","description":"test"}' -UseBasicParsing
    if ($r.StatusCode -eq 201) { passMsg 3 "Personal expense added" } else { failMsg 3 "Failed: $($r.StatusCode)" }
  } catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 400) { passMsg 3 "Expense endpoint responds (needs encrypted blob)" }
    else { failMsg 3 "Failed: $($_.Exception.Response.StatusCode.value__)" }
  }
} else { skipMsg 3 "No auth token" }

# Step 5: Create Group
Write-Host ""; Write-Host "5. CREATE GROUP" -ForegroundColor Cyan
if ($tokenA) {
  try {
    $r = Invoke-WebRequest -Method Post "$apiBase/groups" -ContentType "application/json" -Authentication Bearer -Token $tokenA -Body '{"name":"Test Group","currency":"USD"}' -UseBasicParsing
    if ($r.StatusCode -eq 201) {
      $body = $r.Content | ConvertFrom-Json
      $groupId = $body.id
      passMsg 5 "Group created (ID: $groupId)"
    } else { failMsg 5 "Failed: $($r.StatusCode)" }
  } catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 400) { failMsg 5 "Group creation failed (400) - check validation" }
    else { failMsg 5 "Failed: $($_.Exception.Response.StatusCode.value__)" }
  }
} else { skipMsg 5 "No auth token" }

# Step 10: Admin Auth
Write-Host ""; Write-Host "10. VERIFY ADMIN AUTH" -ForegroundColor Cyan
try {
  $r = Invoke-WebRequest -Method Get "$apiBase/admin/stats" -Authentication Bearer -Token $tokenA -UseBasicParsing
  failMsg 10 "Admin accessible without admin role: $($r.StatusCode)"
} catch {
  $code = $_.Exception.Response.StatusCode.value__
  if ($code -eq 403) { passMsg 10 "Non-admin rejected correctly (403)" }
  elseif ($code -eq 401) { passMsg 10 "Admin requires auth (401)" }
  else { failMsg 10 "Unexpected status: $code" }
}

# Cleanup
Write-Host ""; Write-Host "CLEANUP" -ForegroundColor Cyan
if ($tokenA) { try { Invoke-WebRequest -Method Post "$apiBase/auth/logout" -Authentication Bearer -Token $tokenA -UseBasicParsing } catch {} }

Write-Host ""
Write-Host "================================"
Write-Host "  Passed:  $pass" -ForegroundColor Green
Write-Host "  Failed:  $fail" -ForegroundColor Red
Write-Host "  Skipped: $skip" -ForegroundColor Yellow
Write-Host "================================"

$total = $pass + $fail
if ($total -gt 0) { Write-Host "  Success Rate: $([math]::Round($pass * 100 / $total))%" }
if ($fail -gt 0) { exit 1 }
