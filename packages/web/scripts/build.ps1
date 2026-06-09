param(
  [switch]$Clean
)

Write-Host "=== ColdFi - Web Production Build ==="
Write-Host ""

$ErrorActionPreference = "Stop"

Set-Location (Split-Path $PSScriptRoot -Parent)

if ($Clean -and (Test-Path "dist")) {
  Remove-Item -Recurse -Force "dist"
  Write-Host "Cleaned dist/"
}

Write-Host "Building for production..."
npx vite build

Write-Host ""
Write-Host "Build complete!"
Write-Host "Output: $((Get-Item "dist").FullName)"
Write-Host ""

Write-Host "Bundle sizes:"
Get-ChildItem "dist/assets/*.js","dist/assets/*.css" | ForEach-Object {
  $sizeKB = [math]::Round($_.Length / 1KB, 1)
  Write-Host "  $($_.Name): ${sizeKB}KB"
}
