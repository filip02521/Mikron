# Instalacja harmonogramu zadan cron dla OnTime na Windows (Harmonogram zadan / schtasks).
#
# Uruchom PowerShell jako Administrator w katalogu projektu:
#   .\installer\install-cron.ps1
#   .\installer\install-cron.ps1 -Install
#   .\installer\install-cron.ps1 -Test -Job morning -Force
#   .\installer\install-cron.ps1 -Uninstall
#
param(
  [string]$ProjectRoot = "",
  [switch]$Install,
  [switch]$Uninstall,
  [switch]$Test,
  [ValidateSet("morning", "process-deliveries", "catalog-zd-sync", "zd-eta-sync", "morning-sync")]
  [string]$Job = "morning",
  [switch]$Force,
  [switch]$List
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$TaskNames = @(
  "OnTime Cron Morning",
  "OnTime Cron Process Deliveries",
  "OnTime Cron ZD ETA Sync",
  "OnTime Cron Catalog ZD Sync",
  "OnTime Cron Catalog ZD Sync Continue"
)

function Write-Step([string]$Message) {
  Write-Host ""
  Write-Host "=== $Message ===" -ForegroundColor Cyan
}

function Write-Ok([string]$Message) {
  Write-Host "  OK  $Message" -ForegroundColor Green
}

function Write-Warn([string]$Message) {
  Write-Host "  !!  $Message" -ForegroundColor Yellow
}

function Test-IsAdmin {
  $current = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
  return $current.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Resolve-ProjectRoot {
  if ($ProjectRoot) {
    return (Resolve-Path $ProjectRoot).Path
  }
  return (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

function Invoke-SchTasks {
  param([string[]]$Arguments)

  $prevEa = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $output = & schtasks.exe @Arguments 2>&1
    return [PSCustomObject]@{
      ExitCode = $LASTEXITCODE
      Output = ($output | Out-String).Trim()
    }
  } finally {
    $ErrorActionPreference = $prevEa
  }
}

function Test-ScheduledTaskExists([string]$Name) {
  return (Invoke-SchTasks @("/Query", "/TN", $Name)).ExitCode -eq 0
}

function Remove-ScheduledTaskIfExists([string]$Name) {
  if (-not (Test-ScheduledTaskExists $Name)) { return $false }
  $result = Invoke-SchTasks @("/Delete", "/TN", $Name, "/F")
  if ($result.ExitCode -ne 0) {
    throw "Nie udalo sie usunac zadania $Name : $($result.Output)"
  }
  Write-Ok "Usunieto: $Name"
  return $true
}

function New-ScheduledTask {
  param(
    [string]$Name,
    [string[]]$CreateArgs
  )

  Remove-ScheduledTaskIfExists $Name | Out-Null
  $result = Invoke-SchTasks $CreateArgs
  if ($result.ExitCode -ne 0) {
    throw "Nie udalo sie utworzyc $Name : $($result.Output)"
  }
  Write-Ok "Utworzono: $Name"
}

function Get-CronInvokeCommand {
  param(
    [string]$Root,
    [string]$JobName
  )

  $cronScript = Join-Path $PSScriptRoot "cron-invoke.ps1"
  if (-not (Test-Path $cronScript)) {
    throw "Brak $cronScript"
  }
  return "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$cronScript`" -Job $JobName -ProjectRoot `"$Root`""
}

function Install-CronScheduledTasks {
  param([string]$Root)

  Write-Step "Harmonogram zadan OnTime (Europe/Warsaw — ustaw strefe serwera na Windows)"

  $trMorning = Get-CronInvokeCommand -Root $Root -JobName "morning"
  New-ScheduledTask "OnTime Cron Morning" @(
    "/Create", "/F", "/TN", "OnTime Cron Morning", "/TR", $trMorning,
    "/RU", "SYSTEM", "/RL", "HIGHEST", "/SC", "WEEKLY",
    "/D", "MON,TUE,WED,THU,FRI", "/ST", "06:00"
  )

  $trDeliveries = Get-CronInvokeCommand -Root $Root -JobName "process-deliveries"
  New-ScheduledTask "OnTime Cron Process Deliveries" @(
    "/Create", "/F", "/TN", "OnTime Cron Process Deliveries", "/TR", $trDeliveries,
    "/RU", "SYSTEM", "/RL", "HIGHEST", "/SC", "DAILY",
    "/ST", "08:00", "/RI", "60", "/DU", "11:00", "/D", "MON,TUE,WED,THU,FRI"
  )

  $trEta = Get-CronInvokeCommand -Root $Root -JobName "zd-eta-sync"
  New-ScheduledTask "OnTime Cron ZD ETA Sync" @(
    "/Create", "/F", "/TN", "OnTime Cron ZD ETA Sync", "/TR", $trEta,
    "/RU", "SYSTEM", "/RL", "HIGHEST", "/SC", "DAILY",
    "/ST", "08:00", "/RI", "120", "/DU", "11:00", "/D", "MON,TUE,WED,THU,FRI"
  )

  $trSync = Get-CronInvokeCommand -Root $Root -JobName "catalog-zd-sync"
  New-ScheduledTask "OnTime Cron Catalog ZD Sync" @(
    "/Create", "/F", "/TN", "OnTime Cron Catalog ZD Sync", "/TR", $trSync,
    "/RU", "SYSTEM", "/RL", "HIGHEST", "/SC", "DAILY", "/ST", "02:00"
  )
  New-ScheduledTask "OnTime Cron Catalog ZD Sync Continue" @(
    "/Create", "/F", "/TN", "OnTime Cron Catalog ZD Sync Continue", "/TR", $trSync,
    "/RU", "SYSTEM", "/RL", "HIGHEST", "/SC", "DAILY", "/ST", "02:20"
  )

  Write-Host ""
  Write-Host "Harmonogram:" -ForegroundColor White
  Write-Host "  06:00 pn-pt     -> morning"
  Write-Host "  08-18 pn-pt     -> process-deliveries (co godz.)"
  Write-Host "  08-18 pn-pt     -> zd-eta-sync (co 2 h)"
  Write-Host "  02:00 + 02:20   -> catalog-zd-sync (noc, Subiekt LAN)"
  Write-Host ""
  Write-Host "Logi: $Root\logs\cron-*.log"
  Write-Host "Podglad: taskschd.msc (Harmonogram zadan)"
}

function Show-ScheduledTasks {
  Write-Step "Zadania OnTime"
  foreach ($name in $TaskNames) {
    if (Test-ScheduledTaskExists $name) {
      Write-Ok $name
    } else {
      Write-Warn "Brak: $name"
    }
  }
}

$Root = Resolve-ProjectRoot

if ($Test) {
  $cronScript = Join-Path $PSScriptRoot "cron-invoke.ps1"
  $args = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $cronScript, "-Job", $Job, "-ProjectRoot", $Root)
  if ($Force) { $args += "-Force" }
  & powershell.exe @args
  exit $LASTEXITCODE
}

if ($Uninstall) {
  if (-not (Test-IsAdmin)) {
    throw "Odinstalowanie wymaga PowerShell jako Administrator."
  }
  Write-Step "Usuwanie zadan cron"
  foreach ($name in $TaskNames) {
    Remove-ScheduledTaskIfExists $name | Out-Null
  }
  Write-Host ""
  Write-Host "Gotowe."
  exit 0
}

if ($Install) {
  if (-not (Test-IsAdmin)) {
    throw "Instalacja wymaga PowerShell jako Administrator."
  }
  Install-CronScheduledTasks -Root $Root
  exit 0
}

if ($List) {
  Show-ScheduledTasks
  exit 0
}

# Domyslnie: podglad + instrukcja
Write-Step "OnTime — cron na Windows"
Write-Host "Katalog projektu: $Root"
Write-Host ""
Write-Host "Instalacja (Administrator):" -ForegroundColor Yellow
Write-Host "  .\installer\install-cron.ps1 -Install"
Write-Host "  npm run install-cron:win -- -Install"
Write-Host ""
Write-Host "Test reczny:" -ForegroundColor Yellow
Write-Host "  .\installer\install-cron.ps1 -Test -Job morning -Force"
Write-Host ""
Write-Host "Usuniecie:" -ForegroundColor Yellow
Write-Host "  .\installer\install-cron.ps1 -Uninstall"
Write-Host ""
Show-ScheduledTasks
