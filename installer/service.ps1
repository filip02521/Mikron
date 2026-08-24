# Zarzadzanie usluga Windows OnTime (NSSM).
#
#   .\installer\service.ps1 status|start|stop|restart
# Preferuj: npm run service:stop / service:start / service -- status
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

function Get-NssmPath {
  $candidate = Join-Path $ProjectRoot "nssm.exe"
  if (Test-Path $candidate) { return $candidate }
  $cmd = Get-Command nssm.exe -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  return $null
}

function Invoke-Nssm {
  param([string[]]$Arguments)
  $nssm = Get-NssmPath
  if (-not $nssm) { return $null }
  $prevEa = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $output = & $nssm @Arguments 2>&1
    return [PSCustomObject]@{
      ExitCode = $LASTEXITCODE
      Output = ($output | Out-String)
    }
  } finally {
    $ErrorActionPreference = $prevEa
  }
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

function Stop-ProcessTree([int]$RootPid) {
  if ($RootPid -le 0) { return }
  Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object { $_.ParentProcessId -eq $RootPid } |
    ForEach-Object { Stop-ProcessTree -RootPid ([int]$_.ProcessId) }
  Stop-Process -Id $RootPid -Force -ErrorAction SilentlyContinue
}

function Stop-OnTimeOrphans {
  $rootNorm = (Resolve-Path $ProjectRoot).Path.ToLowerInvariant()

  # 1) Zabij drzewo nssm.exe uruchomionego z katalogu OnTime (trzyma cmd/npm/next).
  Get-CimInstance Win32_Process -Filter "Name = 'nssm.exe'" -ErrorAction SilentlyContinue | ForEach-Object {
    $cmd = $_.CommandLine
    if (-not $cmd) { $cmd = "" }
    if ($cmd.ToLowerInvariant().Contains($rootNorm)) {
      Write-Warn "Zabijam drzewo nssm PID $($_.ProcessId)"
      Stop-ProcessTree -RootPid ([int]$_.ProcessId)
    }
  }

  # 2) Zabij pozostale node/cmd zwiazane z next start / katalogiem projektu.
  Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | ForEach-Object {
    if ($_.Name -notmatch '^(node|cmd)\.exe$') { return }
    $cmd = $_.CommandLine
    if (-not $cmd) { return }
    $cmdLower = $cmd.ToLowerInvariant()
    $isOurs = $cmdLower.Contains($rootNorm) -or ($cmdLower -match "next (start|dev)")
    if ($isOurs) {
      Write-Warn "Zabijam $($_.Name) PID $($_.ProcessId)"
      Stop-ProcessTree -RootPid ([int]$_.ProcessId)
    }
  }

  # 3) Cokolwiek siedzi na porcie aplikacji.
  foreach ($listenPid in (Get-PortListenerPids $Port)) {
    Write-Warn "Zwalniam port $Port (PID $listenPid)"
    Stop-ProcessTree -RootPid $listenPid
  }
}

function Stop-OnTimeService {
  # AppExit=Restart natychmiast odpala next po zabiciu node - wylacz na czas stopu.
  Invoke-Nssm @("set", $ServiceName, "AppExit", "Default", "Exit") | Out-Null

  try {
    Write-Warn "nssm stop $ServiceName"
    Invoke-Nssm @("stop", $ServiceName) | Out-Null
    Start-Sleep -Seconds 2

    $svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if ($svc -and $svc.Status -ne "Stopped") {
      try {
        Stop-Service -Name $ServiceName -Force -ErrorAction Stop
      } catch {
        Write-Warn "Stop-Service: $_"
      }
      Start-Sleep -Seconds 2
    }

    $svcInfo = Get-CimInstance Win32_Service -Filter "Name='$ServiceName'" -ErrorAction SilentlyContinue
    if ($svcInfo -and $svcInfo.ProcessId -gt 0) {
      Write-Warn "Zabijam drzewo uslugi PID $($svcInfo.ProcessId)"
      Stop-ProcessTree -RootPid ([int]$svcInfo.ProcessId)
    }

    for ($attempt = 1; $attempt -le 8; $attempt++) {
      Stop-OnTimeOrphans
      Start-Sleep -Seconds 1
      $busy = @(Get-PortListenerPids $Port)
      if ($busy.Count -eq 0) { break }
      Write-Warn "Port $Port nadal zajety (proba $attempt/8, PID $($busy -join ', '))"
    }
  } finally {
    Invoke-Nssm @("set", $ServiceName, "AppExit", "Default", "Restart") | Out-Null
  }

  $svc = Get-Service -Name $ServiceName
  $busy = @(Get-PortListenerPids $Port)
  if ($svc.Status -ne "Stopped") {
    Write-Err "$ServiceName nie zatrzymala sie (status: $($svc.Status))"
    exit 1
  }
  if ($busy.Count -gt 0) {
    Write-Err "Port $Port nadal zajety przez PID: $($busy -join ', ')"
    exit 1
  }
  Write-Ok "$ServiceName zatrzymana (port $Port wolny)"
}

function Start-OnTimeService {
  $svc = Get-Service -Name $ServiceName
  $busy = @(Get-PortListenerPids $Port)

  if ($svc.Status -eq "Running" -and $busy.Count -gt 0) {
    Write-Ok "$ServiceName juz dziala"
    return
  }

  if ($svc.Status -ne "Stopped" -or $busy.Count -gt 0) {
    Write-Warn "Czyszczenie przed startem (status=$($svc.Status), portBusy=$($busy.Count -gt 0))"
    Stop-OnTimeService
  }

  $busy = @(Get-PortListenerPids $Port)
  if ($busy.Count -gt 0) {
    Write-Err "Port $Port nadal zajety przez PID: $($busy -join ', ')"
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
