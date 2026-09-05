# Codzienny backup PostgreSQL OnTime (Task Scheduler — zalecane 04:30).
# Przykład:
#   .\installer\backup-postgres.ps1
#   .\installer\backup-postgres.ps1 -DbName ontime -BackupDir D:\OnTime\backups -RetainDays 7
param(
  [string]$DbName = "ontime",
  [string]$BackupDir = "D:\OnTime\backups",
  [string]$PgUser = "ontime_migrator",
  [string]$PgHost = "127.0.0.1",
  [int]$PgPort = 5432,
  [int]$RetainDays = 7
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not (Test-Path $BackupDir)) {
  New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

$pgDump = Get-Command pg_dump -ErrorAction SilentlyContinue
if (-not $pgDump) {
  $candidate = "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe"
  if (Test-Path $candidate) {
    $pgDumpPath = $candidate
  } else {
    throw "pg_dump nie znaleziony w PATH ani w C:\Program Files\PostgreSQL\16\bin"
  }
} else {
  $pgDumpPath = $pgDump.Source
}

$ts = Get-Date -Format "yyyyMMdd-HHmm"
$out = Join-Path $BackupDir "ontime-$ts.dump"
Write-Host "Backup $DbName -> $out"

& $pgDumpPath -Fc -h $PgHost -p $PgPort -U $PgUser -d $DbName -f $out
if ($LASTEXITCODE -ne 0) {
  throw "pg_dump zakonczyl sie kodem $LASTEXITCODE"
}

$cutoff = (Get-Date).AddDays(-$RetainDays)
Get-ChildItem $BackupDir -Filter "ontime-*.dump" -ErrorAction SilentlyContinue |
  Where-Object { $_.LastWriteTime -lt $cutoff } |
  ForEach-Object {
    Write-Host "Usuwam stary backup: $($_.Name)"
    Remove-Item $_.FullName -Force
  }

Write-Host "OK: $out"
