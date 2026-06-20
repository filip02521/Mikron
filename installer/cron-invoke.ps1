# Wywolanie endpointu cron OnTime (Harmonogram zadan Windows / reczny test).
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("morning", "process-deliveries", "catalog-zd-sync", "zd-eta-sync", "morning-sync")]
  [string]$Job,

  [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot),

  [int]$Port = 3000,

  [switch]$Force
)

function Read-EnvValue {
  param(
    [string[]]$Files,
    [string]$Key
  )

  foreach ($file in $Files) {
    if (-not (Test-Path $file)) { continue }
    foreach ($line in Get-Content $file -Encoding UTF8) {
      if ($line -match "^\s*$([regex]::Escape($Key))=(.+)$") {
        return $Matches[1].Trim().Trim('"').Trim("'")
      }
    }
  }
  return $null
}

$envLocal = Join-Path $ProjectRoot ".env.local"
$envFile = Join-Path $ProjectRoot ".env"
$envSources = @($envLocal, $envFile)

$cronSecret = Read-EnvValue -Files $envSources -Key "CRON_SECRET"
if (-not $cronSecret -or $cronSecret -eq "change-me-in-production" -or $cronSecret -eq "dev-local-cron-secret") {
  Write-Error "Ustaw silny CRON_SECRET w .env.local (nie change-me-in-production)."
  exit 1
}

$portRaw = Read-EnvValue -Files $envSources -Key "APP_PORT"
if (-not $portRaw) {
  $portRaw = Read-EnvValue -Files $envSources -Key "PORT"
}
if ($portRaw -and $portRaw -match '^\d+$') {
  $Port = [int]$portRaw
}

$path = switch ($Job) {
  "morning" { "/api/cron/morning" }
  "process-deliveries" { "/api/cron/process-deliveries" }
  "catalog-zd-sync" { "/api/cron/catalog-zd-sync" }
  "zd-eta-sync" { "/api/cron/zd-eta-sync" }
  "morning-sync" { "/api/cron/morning-sync" }
}

$url = "http://127.0.0.1:$Port$path"
if ($Force) {
  $url += "?force=1"
}

$logDir = Join-Path $ProjectRoot "logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$logFile = Join-Path $logDir "cron-$Job.log"

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
try {
  $response = curl.exe -fsS -H "Authorization: Bearer $cronSecret" $url 2>&1
  $status = $LASTEXITCODE
  $message = if ($status -eq 0) { "OK $response" } else { "FAIL ($status): $response" }
  Add-Content -Path $logFile -Value "$timestamp $message"
  if ($status -ne 0) { exit $status }
  Write-Host $message
} catch {
  Add-Content -Path $logFile -Value "$timestamp ERROR: $_"
  Write-Error $_
  exit 1
}
