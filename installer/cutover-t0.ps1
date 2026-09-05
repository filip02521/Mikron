# Runbook T0 — cutover Supabase → lokalny PostgreSQL (Windows).
# Preferuj: npm run cutover:export / import / storage (scripts/cutover/run-dry-run.ts)
param(
  [string]$ProjectRoot = "",
  [string]$CutoverDir = "D:\OnTime\cutover",
  [string]$SupabaseDbUrl = "",
  [switch]$SkipStorage
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not $ProjectRoot) {
  $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

Write-Host "=== Cutover T0 ===" -ForegroundColor Cyan
Write-Host "STOP OnTime"
Stop-Service OnTime -ErrorAction SilentlyContinue

if (-not (Test-Path $CutoverDir)) {
  New-Item -ItemType Directory -Path $CutoverDir -Force | Out-Null
}

Copy-Item (Join-Path $ProjectRoot ".env") (Join-Path $ProjectRoot ".env.supabase-backup") -Force

if (-not $SupabaseDbUrl) {
  $SupabaseDbUrl = $env:SUPABASE_DB_URL
}
if (-not $SupabaseDbUrl) {
  throw "Ustaw -SupabaseDbUrl lub env SUPABASE_DB_URL (pooler :5432)"
}

Push-Location $ProjectRoot
try {
  $env:SUPABASE_DB_URL = $SupabaseDbUrl
  Write-Host "Export (npm run cutover:export)"
  npm run cutover:export
  if ($LASTEXITCODE -ne 0) { throw "cutover:export failed" }

  Write-Host "Import (npm run cutover:import)"
  npm run cutover:import
  if ($LASTEXITCODE -ne 0) { throw "cutover:import failed" }

  if (-not $SkipStorage) {
    Write-Host "Storage (npm run cutover:storage)"
    npm run cutover:storage
    if ($LASTEXITCODE -ne 0) { throw "cutover:storage failed" }
  }

  Write-Host "Verify login + sanity"
  npm run cutover:verify-login
  npm run cutover:sanity
  npm run verify:deploy:postgres

  Write-Host "OK — zaktualizuj .env (DATABASE_URL, bez SUPABASE_*), npm run build, Start-Service OnTime"
}
finally {
  Pop-Location
}
