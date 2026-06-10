# Wywolanie endpointu cron OnTime (uzywany przez Harmonogram zadan Windows).
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("morning", "process-deliveries", "catalog-zd-sync")]
  [string]$Job,

  [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot),

  [int]$Port = 3000,

  [switch]$Force
)

$envFile = Join-Path $ProjectRoot ".env"
if (-not (Test-Path $envFile)) {
  Write-Error "Brak pliku .env w $ProjectRoot"
  exit 1
}

$cronSecret = $null
foreach ($line in Get-Content $envFile -Encoding UTF8) {
  if ($line -match '^\s*CRON_SECRET=(.+)$') {
    $cronSecret = $Matches[1].Trim().Trim('"').Trim("'")
    break
  }
}

if (-not $cronSecret) {
  Write-Error "Brak CRON_SECRET w .env"
  exit 1
}

foreach ($line in Get-Content $envFile -Encoding UTF8) {
  if ($line -match '^\s*APP_PORT=(.+)$') {
    $parsed = $Matches[1].Trim().Trim('"').Trim("'")
    if ($parsed -match '^\d+$') { $Port = [int]$parsed }
    break
  }
}

$path = switch ($Job) {
  "morning" { "/api/cron/morning" }
  "process-deliveries" { "/api/cron/process-deliveries" }
  "catalog-zd-sync" { "/api/cron/catalog-zd-sync" }
}

$url = "http://127.0.0.1:$Port$path"
if ($Force -and $Job -eq "catalog-zd-sync") {
  $url += "?force=1"
}

$logDir = Join-Path $ProjectRoot "logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$logFile = Join-Path $logDir "cron-$Job.log"

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
try {
  $response = curl.exe -fsS -H "Authorization: Bearer $cronSecret" $url 2>&1
  $status = $LASTEXITCODE
  $message = if ($status -eq 0) { "OK" } else { "FAIL ($status): $response" }
  Add-Content -Path $logFile -Value "$timestamp $message"
  if ($status -ne 0) { exit $status }
} catch {
  Add-Content -Path $logFile -Value "$timestamp ERROR: $_"
  exit 1
}
