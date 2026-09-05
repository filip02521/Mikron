# Rejestruje Task Scheduler: codzienny backup PG o 04:30 (przed nightly-deploy 05:00).
# Uruchom jako Administrator:
#   .\installer\install-postgres-backup-task.ps1
param(
  [string]$TaskName = "OnTime-Postgres-Backup",
  [string]$BackupAt = "04:30",
  [string]$BackupDir = "D:\OnTime\backups",
  [string]$DbName = "ontime",
  [switch]$Uninstall
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptPath = Join-Path $PSScriptRoot "backup-postgres.ps1"
if (-not (Test-Path $scriptPath)) {
  throw "Brak $scriptPath"
}

if ($Uninstall) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
  Write-Host "Usunieto zadanie $TaskName"
  exit 0
}

$action = New-ScheduledTaskAction `
  -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`" -DbName $DbName -BackupDir `"$BackupDir`""

$trigger = New-ScheduledTaskTrigger -Daily -At $BackupAt
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Principal $principal `
  -Force | Out-Null

Write-Host "Zarejestrowano $TaskName codziennie o $BackupAt"
