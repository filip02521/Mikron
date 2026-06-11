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

function Write-Ok([string]$Message) {
  Write-Host "  OK  $Message" -ForegroundColor Green
}

function Write-Err([string]$Message) {
  Write-Host "  XX  $Message" -ForegroundColor Red
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

$svc = Get-OnTimeService

switch ($Action) {
  "status" {
    Write-Host "Usluga: $ServiceName"
    Write-Host "  Status: $($svc.Status)"
    Write-Host "  Start:  $($svc.StartType)"
    if ($svc.Status -eq "Running") {
      Invoke-HttpProbe
    }
    if ($svc.Status -ne "Running") { exit 1 }
  }
  "start" {
    if ($svc.Status -eq "Running") {
      Write-Ok "$ServiceName juz dziala"
    } else {
      Start-Service -Name $ServiceName
      Start-Sleep -Seconds 2
      $svc = Get-Service -Name $ServiceName
      if ($svc.Status -ne "Running") {
        Write-Err "$ServiceName nie wystartowala (status: $($svc.Status))"
        Write-Host "  Sprawdz: logs\ontime-stderr.log"
        exit 1
      }
      Write-Ok "$ServiceName uruchomiona"
    }
    Invoke-HttpProbe
  }
  "stop" {
    if ($svc.Status -eq "Stopped") {
      Write-Ok "$ServiceName juz zatrzymana"
    } else {
      Stop-Service -Name $ServiceName -Force
      Start-Sleep -Seconds 1
      $svc = Get-Service -Name $ServiceName
      if ($svc.Status -ne "Stopped") {
        Write-Err "$ServiceName nie zatrzymala sie (status: $($svc.Status))"
        exit 1
      }
      Write-Ok "$ServiceName zatrzymana"
    }
  }
  "restart" {
    Restart-Service -Name $ServiceName -Force
    Start-Sleep -Seconds 3
    $svc = Get-Service -Name $ServiceName
    if ($svc.Status -ne "Running") {
      Write-Err "$ServiceName nie dziala po restarcie (status: $($svc.Status))"
      Write-Host "  Sprawdz: logs\ontime-stderr.log"
      exit 1
    }
    Write-Ok "$ServiceName zrestartowana"
    Invoke-HttpProbe
  }
}
