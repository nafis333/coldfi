param([string]$BaseUrl = "http://localhost:3001")

$errors = 0
function check($name, $url, $expected = 200) {
  try {
    $r = Invoke-WebRequest -Method Get $url -UseBasicParsing -ErrorAction Stop
    if ($r.StatusCode -eq $expected) { Write-Host "  [PASS] $name ($($r.StatusCode))" -ForegroundColor Green }
    else { Write-Host "  [FAIL] $name (expected $expected, got $($r.StatusCode))" -ForegroundColor Red; $script:errors++ }
  } catch {
    Write-Host "  [FAIL] $name (expected $expected, got error)" -ForegroundColor Red; $script:errors++
  }
}

Write-Host "=== Smoke Test ===" -ForegroundColor Cyan
Write-Host ""

Write-Host "Core Services:" -ForegroundColor Cyan
check "Health endpoint" "$BaseUrl/health"
check "Health live" "$BaseUrl/health/live"
check "Health enhanced" "$BaseUrl/health/enhanced"
check "Metrics endpoint" "$BaseUrl/metrics"

Write-Host ""
Write-Host "Auth Endpoints:" -ForegroundColor Cyan
try {
  $r = Invoke-WebRequest -Method Post "$BaseUrl/api/auth/register" -ContentType "application/json" -Body '{}' -UseBasicParsing -ErrorAction Stop
  if ($r.StatusCode -eq 400) { Write-Host "  [PASS] Register (no body) (400)" -ForegroundColor Green }
  else { Write-Host "  [FAIL] Register (no body) ($($r.StatusCode))" -ForegroundColor Red; $errors++ }
} catch {
  if ($_.Exception.Response.StatusCode.value__ -eq 400) { Write-Host "  [PASS] Register (no body) (400)" -ForegroundColor Green }
  else { Write-Host "  [FAIL] Register (no body) ($($_.Exception.Response.StatusCode.value__))" -ForegroundColor Red; $errors++ }
}

try {
  $r = Invoke-WebRequest -Method Post "$BaseUrl/api/auth/login" -ContentType "application/json" -Body '{}' -UseBasicParsing -ErrorAction Stop
  if ($r.StatusCode -eq 400) { Write-Host "  [PASS] Login (no body) (400)" -ForegroundColor Green }
  else { Write-Host "  [FAIL] Login (no body) ($($r.StatusCode))" -ForegroundColor Red; $errors++ }
} catch {
  if ($_.Exception.Response.StatusCode.value__ -eq 400) { Write-Host "  [PASS] Login (no body) (400)" -ForegroundColor Green }
  else { Write-Host "  [FAIL] Login (no body) ($($_.Exception.Response.StatusCode.value__))" -ForegroundColor Red; $errors++ }
}

Write-Host ""
Write-Host "Protected Endpoints:" -ForegroundColor Cyan
check "Expenses (no auth)" "$BaseUrl/api/expenses" 401
check "Groups (no auth)" "$BaseUrl/api/groups" 401
check "Admin (no auth)" "$BaseUrl/api/admin/stats" 401

Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
if ($errors -gt 0) { Write-Host "  $errors smoke tests failed!" -ForegroundColor Red; exit 1 }
Write-Host "  All smoke tests passed!" -ForegroundColor Green
