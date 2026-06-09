param()

$ErrorActionPreference = "Stop"
$errors = 0
$warnings = 0

function Check-Pass($msg) { Write-Host "  [PASS] $msg" }
function Check-Fail($msg) { Write-Host "  [FAIL] $msg"; $script:errors++ }
function Check-Warn($msg) { Write-Host "  [WARN] $msg"; $script:warnings++ }

Write-Host "=== ColdFi - Build Verification ==="
Write-Host ""

$projectDir = Split-Path $PSScriptRoot -Parent
Set-Location $projectDir

# 1. Check dist exists
Write-Host "1. Checking build output..."
if (Test-Path "dist") {
  Check-Pass "dist/ directory exists"
} else {
  Check-Fail "dist/ directory not found - run: npm run build"
}

# 2. Check HTML entry point
if (Test-Path "dist/index.html") {
  Check-Pass "index.html exists"
} else {
  Check-Fail "index.html not found"
}

# 3. Check JS bundles
$jsCount = (Get-ChildItem "dist/assets/*.js" -ErrorAction SilentlyContinue).Count
if ($jsCount -gt 0) {
  Check-Pass "JavaScript bundles: $jsCount files"
} else {
  Check-Fail "No JavaScript bundles found"
}

# 4. Check CSS bundle
$cssCount = (Get-ChildItem "dist/assets/*.css" -ErrorAction SilentlyContinue).Count
if ($cssCount -gt 0) {
  Check-Pass "CSS bundles: $cssCount files"
} else {
  Check-Warn "No CSS bundles found"
}

# 5. Check chunk splitting
Write-Host ""
Write-Host "2. Checking chunk splitting..."
$vendorChunks = Get-ChildItem "dist/assets/vendor-*.js" -ErrorAction SilentlyContinue
if ($vendorChunks.Count -gt 0) {
  Check-Pass "Vendor chunk exists (react, react-dom)"
} else {
  Check-Warn "No vendor chunk - check manualChunks config"
}

$chartChunks = Get-ChildItem "dist/assets/charts-*.js" -ErrorAction SilentlyContinue
if ($chartChunks.Count -gt 0) {
  Check-Pass "Charts chunk exists"
}

$stateChunks = Get-ChildItem "dist/assets/state-*.js" -ErrorAction SilentlyContinue
if ($stateChunks.Count -gt 0) {
  Check-Pass "State management chunk exists"
}

# 6. Check source maps
Write-Host ""
Write-Host "3. Checking source maps..."
$sourceMaps = Get-ChildItem "dist/assets/*.js.map" -ErrorAction SilentlyContinue
if ($sourceMaps.Count -gt 0) {
  Check-Warn "Source maps present ($($sourceMaps.Count) files) - not suitable for production"
} else {
  Check-Pass "No source maps in production build"
}

# 7. Check index.html references
Write-Host ""
Write-Host "4. Checking index.html..."
$html = Get-Content "dist/index.html" -Raw
if ($html -match 'type="module"') {
  Check-Pass "Scripts use module type"
} else {
  Check-Warn "No module scripts found"
}

if ($html -match '/assets/') {
  Check-Pass "Assets referenced correctly"
} else {
  Check-Fail "No asset references in index.html"
}

# 8. Bundle size check
Write-Host ""
Write-Host "5. Checking bundle sizes..."
Get-ChildItem "dist/assets/*.js" | ForEach-Object {
  $sizeKB = [math]::Round($_.Length / 1KB)
  if ($sizeKB -gt 500) {
    Check-Warn "$($_.Name): ${sizeKB}KB (exceeds 500KB limit)"
  } else {
    Check-Pass "$($_.Name): ${sizeKB}KB"
  }
}

Write-Host ""
Write-Host "================================"
Write-Host "  Errors:   $errors"
Write-Host "  Warnings: $warnings"
Write-Host "================================"

if ($errors -gt 0) { exit 1 }
