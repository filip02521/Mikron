# Codzienny backup PostgreSQL OnTime (Task Scheduler — zalecane 04:30).
# Rotacja: 7 plikow nazwanych dniem tygodnia — kolejny tydzien nadpisuje ten sam dzien.
# Domyslnie: <repo>/backups
# Haslo: z DATABASE_MIGRATE_URL w .env (albo PGPASSWORD w srodowisku).
# Przykład:
#   .\installer\backup-postgres.ps1
#   .\installer\backup-postgres.ps1 -DbName ontime -BackupDir D:\inne\backups
param(
  [string]$DbName = "",
  [string]$BackupDir = "",
  [string]$PgUser = "",
  [string]$PgHost = "",
  [int]$PgPort = 0,
  [string]$EnvFile = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not $BackupDir) {
  $BackupDir = Join-Path $projectRoot "backups"
}
if (-not $EnvFile) {
  $EnvFile = Join-Path $projectRoot ".env"
}

function Get-DotEnvValue([string]$Path, [string]$Key) {
  if (-not (Test-Path $Path)) { return $null }
  $line = Get-Content $Path | Where-Object { $_ -match "^\s*$([regex]::Escape($Key))\s*=" } | Select-Object -First 1
  if (-not $line) { return $null }
  return ($line -replace "^\s*$([regex]::Escape($Key))\s*=\s*", "").Trim().Trim('"').Trim("'")
}

function ConvertFrom-PostgresUrl([string]$Url) {
  # postgresql://user:pass@host:port/db
  if ($Url -notmatch '^postgres(ql)?://([^:/?#]+):([^@/]+)@([^:/?#]+)(?::(\d+))?/([^?/#]+)') {
    throw "Niepoprawny URL bazy (oczekiwano postgresql://user:pass@host:port/db)"
  }
  return [pscustomobject]@{
    User     = [uri]::UnescapeDataString($Matches[2])
    Password = [uri]::UnescapeDataString($Matches[3])
    Host     = $Matches[4]
    Port     = if ($Matches[5]) { [int]$Matches[5] } else { 5432 }
    Database = [uri]::UnescapeDataString($Matches[6])
  }
}

if (-not (Test-Path $BackupDir)) {
  New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

# Preferuj migratora (wlasciciel schematu) — ma prawa do pelnego dumpa
$connUrl = Get-DotEnvValue $EnvFile "DATABASE_MIGRATE_URL"
if (-not $connUrl) {
  $connUrl = Get-DotEnvValue $EnvFile "DATABASE_URL"
}
if (-not $connUrl -and -not $env:PGPASSWORD) {
  throw "Brak DATABASE_MIGRATE_URL / DATABASE_URL w $EnvFile oraz PGPASSWORD"
}

if ($connUrl) {
  $conn = ConvertFrom-PostgresUrl $connUrl
  if (-not $PgUser) { $PgUser = $conn.User }
  if (-not $PgHost) { $PgHost = $conn.Host }
  if ($PgPort -le 0) { $PgPort = $conn.Port }
  if (-not $DbName) { $DbName = $conn.Database }
  if (-not $env:PGPASSWORD) {
    $env:PGPASSWORD = $conn.Password
  }
} else {
  if (-not $PgUser) { $PgUser = "ontime_migrator" }
  if (-not $PgHost) { $PgHost = "127.0.0.1" }
  if ($PgPort -le 0) { $PgPort = 5432 }
  if (-not $DbName) { $DbName = "ontime" }
}

$pgDump = Get-Command pg_dump -ErrorAction SilentlyContinue
if ($pgDump) {
  $pgDumpPath = $pgDump.Source
} else {
  # Preferuj najnowsza zainstalowana wersje EDB (tu: 18)
  $pgDumpPath = $null
  $pgRoot = "C:\Program Files\PostgreSQL"
  if (Test-Path $pgRoot) {
    $pgDumpPath = Get-ChildItem $pgRoot -Directory |
      Where-Object { $_.Name -match '^\d+' } |
      Sort-Object { [int]($_.Name -replace '\D.*$', '') } -Descending |
      ForEach-Object { Join-Path $_.FullName "bin\pg_dump.exe" } |
      Where-Object { Test-Path $_ } |
      Select-Object -First 1
  }
  if (-not $pgDumpPath) {
    throw "pg_dump nie znaleziony w PATH ani w C:\Program Files\PostgreSQL\*\bin"
  }
}

# DayOfWeek: Sunday=0 ... Saturday=6 — nazwy bez polskich znakow (bezpieczne dla FS)
$dayNames = @{
  0 = "niedziela"
  1 = "poniedzialek"
  2 = "wtorek"
  3 = "sroda"
  4 = "czwartek"
  5 = "piatek"
  6 = "sobota"
}
$dayKey = [int](Get-Date).DayOfWeek
$dayName = $dayNames[$dayKey]
$out = Join-Path $BackupDir "ontime-$dayName.dump"

# Dump do pliku tymczasowego, potem atomowe nadpisanie slotu dnia
$tmp = Join-Path $BackupDir "ontime-$dayName.dump.tmp"
if (Test-Path $tmp) {
  Remove-Item $tmp -Force
}

Write-Host "Backup $DbName ($PgUser@${PgHost}:${PgPort}) -> $out (slot: $dayName)"

try {
  # Tylko public — auth/storage to stuby Supabase bez uprawnien migratora
  & $pgDumpPath -Fc -h $PgHost -p $PgPort -U $PgUser -d $DbName -n public -f $tmp
  if ($LASTEXITCODE -ne 0) {
    if (Test-Path $tmp) { Remove-Item $tmp -Force -ErrorAction SilentlyContinue }
    throw "pg_dump zakonczyl sie kodem $LASTEXITCODE"
  }
} finally {
  # Nie zostawiaj hasla w procesie Task Schedulera / sesji
  if ($connUrl) { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue }
}

Move-Item -Path $tmp -Destination $out -Force
Write-Host "OK: $out"
