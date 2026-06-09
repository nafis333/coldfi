param()

$ErrorActionPreference = "Stop"

$projectDir = Split-Path $PSScriptRoot -Parent
$rootDir = Split-Path $projectDir -Parent

Set-Location $rootDir

Write-Host "=== ColdFi - Docker Deployment ==="
Write-Host ""

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Write-Host "ERROR: Docker not found." -ForegroundColor Red
  exit 1
}

if (-not (Test-Path ".env")) {
  Write-Host "ERROR: .env file not found in project root." -ForegroundColor Red
  Write-Host "Create it with required variables: DB_PASSWORD, JWT_SECRET, VAPID_* keys"
  exit 1
}

Write-Host "Building images..."
docker-compose build

Write-Host ""
Write-Host "Starting services..."
docker-compose up -d

Write-Host ""
Write-Host "Deployment complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Services:"
Write-Host "  Web:      http://localhost:80"
Write-Host "  API:      http://localhost:3001"
Write-Host "  Postgres: localhost:5432"
Write-Host "  Redis:    localhost:6379"
Write-Host ""
Write-Host "Check logs:"
Write-Host "  docker-compose logs -f web"
Write-Host "  docker-compose logs -f backend"
Write-Host ""
Write-Host "Stop:"
Write-Host "  docker-compose down"
