# Zarzadzanie usluga Windows OnTime (NSSM).
#
#   .\installer\service.ps1 status
#   .\installer\service.ps1 start
#   .\installer\service.ps1 stop
#   .\installer\service.ps1 restart
#
param(
  [Parameter(Position = 0)]
  [ValidateSet("status", "start", "stop", "restart")]
  [string]$Action = "status",

  [string]$ServiceName = "OnTime",
  [int]$Port = 3000,
  [switch]$Probe
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot

function Write-Ok([string]$Message) {
  Write-Host "  OK  $Message" -ForegroundColor Green
}

function Write-Err([string]$Message) {
  Write-Host "  XX  $Message" -ForegroundColor Red
}

function Write-Warn([string]$Message) {
  Write-Host "  !!  $Message" -ForegroundColor Yellow
}

function Get-OnTimeService {
  $svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
  if (-not $svc) {
    Write-Err "Usluga '$ServiceName' nie istnieje."
    Write-Host "  Zainstaluj: .\installer\install-windows-service.ps1"
    exit 1
  }
  return $svc
}

function Invoke-HttpProbe {
  if (-not $Probe) { return }
  try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/login" -Method Head -TimeoutSec 15 -UseBasicParsing
    Write-Ok "HTTP $($response.StatusCode) http://127.0.0.1:$Port/login"
  } catch {
    Write-Err "HTTP probe nie powiodl sie: http://127.0.0.1:$Port/login"
    exit 1
  }
}

function Get-PortListenerPids([int]$ListenPort) {
  $found = @()
  $lines = netstat -ano | Select-String ":$ListenPort\s+.*LISTENING"
  foreach ($line in $lines) {
    if ($line -match '\s+(\d+)\s*$') {
      $found += [int]$Matches[1]
    }
  }
  return @($found | Select-Object -Unique)
}

function Stop-OnTimeOrphans {
  # NSSM czesto zostawia node/npm po Stop-Service (Paused / EADDRINUSE / EPERM).
  $rootNorm = (Resolve-Path $ProjectRoot).Path.ToLowerInvariant()
  Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue | ForEach-Object {
    $cmd = $_.CommandLine
    if (-not $cmd) { $cmd = "" }
    $cmdLower = $cmd.ToLowerInvariant()
    if ($cmdLower.Contains($rootNorm) -or $cmdLower -match "next (start|dev)") {
      Write-Warn "Zabijam osierocony node PID $($_.ProcessId)"
      Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    }
  }

  foreach ($listenPid in (Get-PortListenerPids $Port)) {
    $proc = Get-Process -Id $listenPid -ErrorAction SilentlyContinue
    if ($proc -and $proc.ProcessName -match '^(node|npm)$') {
      Write-Warn "Zwalniam port $Port (PID $listenPid)"
      Stop-Process -Id $listenPid -Force -ErrorAction SilentlyContinue
    }
  }

  Start-Sleep -Seconds 2
}

function Stop-OnTimeService {
  $svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
  if ($svc -and $svc.Status -ne "Stopped") {
    try {
      Stop-Service -Name $ServiceName -Force -ErrorAction Stop
    } catch {
      Write-Warn "Stop-Service: $_"
    }
    Start-Sleep -Seconds 2
  }

  Stop-OnTimeOrphans

  $svc = Get-Service -Name $ServiceName
  if ($svc.Status -ne "Stopped") {
    # Paused / StartPending - NSSM czasem zostaje w limbo; twardy reset przez nssm stop.
    $nssm = Join-Path $ProjectRoot "nssm.exe"
    if (Test-Path $nssm) {
      Write-Warn "Status $($svc.Status) - wymuszam nssm stop"
      & $nssm stop $ServiceName | Out-Null
      Start-Sleep -Seconds 2
      Stop-OnTimeOrphans
    }
  }

  $svc = Get-Service -Name $ServiceName
  if ($svc.Status -ne "Stopped") {
    Write-Err "$ServiceName nie zatrzymala sie (status: $($svc.Status))"
    exit 1
  }
  Write-Ok "$ServiceName zatrzymana (port $Port wolny)"
}

function Start-OnTimeService {
  $svc = Get-Service -Name $ServiceName
  if ($svc.Status -eq "Running") {
    Write-Ok "$ServiceName juz dziala"
    return
  }

  # Przed startem zawsze wyczysc Paused / osierocone node (EADDRINUSE).
  if ($svc.Status -ne "Stopped") {
    Write-Warn "Status $($svc.Status) - najpierw stop + czyszczenie"
    Stop-OnTimeService
  } else {
    Stop-OnTimeOrphans
  }

  $busy = @(Get-PortListenerPids $Port)
  if ($busy.Count -gt 0) {
    Write-Err "Port $Port nadal zajety przez PID: $($busy -join ', ')"
    Write-Host "  Zabij recznie albo sprawdz: netstat -ano | findstr :$Port"
    exit 1
  }

  Start-Service -Name $ServiceName
  Start-Sleep -Seconds 3
  $svc = Get-Service -Name $ServiceName
  if ($svc.Status -ne "Running") {
    Write-Err "$ServiceName nie wystartowala (status: $($svc.Status))"
    Write-Host "  Sprawdz: logs\ontime-stderr.log"
    exit 1
  }
  Write-Ok "$ServiceName uruchomiona"
}

$svc = Get-OnTimeService

switch ($Action) {
  "status" {
    Write-Host "Usluga: $ServiceName"
    Write-Host "  Status: $($svc.Status)"
    Write-Host "  Start:  $($svc.StartType)"
    $busy = @(Get-PortListenerPids $Port)
    if ($busy.Count -gt 0) {
      Write-Host "  Port ${Port}: zajety przez PID $($busy -join ', ')"
    } else {
      Write-Host "  Port ${Port}: wolny"
    }
    if ($svc.Status -eq "Running") {
      Invoke-HttpProbe
    }
    if ($svc.Status -ne "Running") { exit 1 }
  }
  "start" {
    Start-OnTimeService
    Invoke-HttpProbe
  }
  "stop" {
    $busy = @(Get-PortListenerPids $Port)
    if ($svc.Status -eq "Stopped" -and $busy.Count -eq 0) {
      Write-Ok "$ServiceName juz zatrzymana"
    } else {
      Stop-OnTimeService
    }
  }
  "restart" {
    Stop-OnTimeService
    Start-OnTimeService
    Invoke-HttpProbe
  }
}
