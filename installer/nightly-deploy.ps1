# Nocny deploy: git pull -> npm ci (gdy trzeba) -> build -> restart uslugi OnTime.
#
# Recznie:
#   .\installer\nightly-deploy.ps1
#   .\installer\nightly-deploy.ps1 -Force
#
# Harmonogram zadan (PowerShell jako Administrator):
#   .\installer\nightly-deploy.ps1 -InstallScheduledTask
#   .\installer\nightly-deploy.ps1 -InstallScheduledTask -TaskRunAs "DOMAIN\user" -TaskRunAsPassword "..."
#
param(
  [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot),
  [string]$ServiceName = "OnTime",
  [string]$Branch = "main",
  [string]$Remote = "origin",
  [int]$Port = 3000,
  [switch]$Force,
  [switch]$SkipPull,
  [switch]$InstallScheduledTask,
  [switch]$UninstallScheduledTask,
  [string]$TaskName = "OnTime Nightly Deploy",
  [string]$TaskTime = "03:30",
  [string]$TaskRunAs = "",
  [string]$TaskRunAsPassword = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$LogDir = Join-Path $ProjectRoot "logs"
$LogFile = Join-Path $LogDir "nightly-deploy.log"

function Write-Log([string]$Message) {
  $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $Message"
  New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
  Add-Content -Path $LogFile -Value $line
  Write-Host $line
}

function Find-NpmPath {
  $cmd = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }

  $candidates = @(
    "$env:ProgramFiles\nodejs\npm.cmd",
    "${env:ProgramFiles(x86)}\nodejs\npm.cmd"
  )
  foreach ($candidate in $candidates) {
    if (Test-Path $candidate) { return $candidate }
  }
  return $null
}

function Invoke-Git {
  param([string[]]$Arguments)
  $output = & git -C $ProjectRoot @Arguments 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "git $($Arguments -join ' ') -> $output"
  }
  return ($output | Out-String).Trim()
}

function Test-ServiceExists([string]$Name) {
  return $null -ne (Get-Service -Name $Name -ErrorAction SilentlyContinue)
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
  if (-not (Test-ScheduledTaskExists $Name)) { return }
  $result = Invoke-SchTasks @("/Delete", "/TN", $Name, "/F")
  if ($result.ExitCode -ne 0) {
    throw "Nie udalo sie usunac zadania $Name : $($result.Output)"
  }
}

function Resolve-TaskRunAsUser([string]$User) {
  if (-not $User) { return "" }
  if ($User -match '[\\/]') { return $User }
  return "$env:USERDOMAIN\$User"
}

function Install-NightlyDeployTask {
  $scriptPath = Join-Path $PSScriptRoot "nightly-deploy.ps1"
  $tr = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`" -ServiceName `"$ServiceName`" -Branch `"$Branch`""

  if (Test-ScheduledTaskExists $TaskName) {
    Remove-ScheduledTaskIfExists $TaskName
    Write-Log "Usunieto poprzednie zadanie: $TaskName"
  }

  $args = @(
    "/Create", "/F",
    "/TN", $TaskName,
    "/TR", $tr,
    "/SC", "DAILY",
    "/ST", $TaskTime,
    "/RL", "HIGHEST"
  )

  $runAs = Resolve-TaskRunAsUser $TaskRunAs
  if ($runAs) {
    $args += @("/RU", $runAs)
    if ($TaskRunAsPassword) {
      $args += @("/RP", $TaskRunAsPassword)
    }
  } else {
    $args += @("/RU", "SYSTEM")
  }

  $result = Invoke-SchTasks $args
  if ($result.ExitCode -ne 0) {
    throw "Nie udalo sie utworzyc zadania harmonogramu: $TaskName`n$($result.Output)"
  }

  Write-Log "Utworzono zadanie harmonogramu: $TaskName (codziennie $TaskTime, konto: $(if ($runAs) { $runAs } else { 'SYSTEM' }))"
  if ($runAs -and -not $TaskRunAsPassword) {
    Write-Log "UWAGA: ustaw haslo konta w Harmonogramie zadan (uruchom niezaleznie od logowania)"
  }
}

function Uninstall-NightlyDeployTask {
  if (Test-ScheduledTaskExists $TaskName) {
    Remove-ScheduledTaskIfExists $TaskName
    Write-Log "Usunieto zadanie harmonogramu: $TaskName"
  } else {
    Write-Log "Brak zadania harmonogramu: $TaskName"
  }
}

function Invoke-NightlyDeploy {
  $npm = Find-NpmPath
  if (-not $npm) {
    throw "npm.cmd nie znaleziony"
  }

  if (-not (Test-Path (Join-Path $ProjectRoot ".git"))) {
    throw "Brak repozytorium git w $ProjectRoot"
  }

  $headBefore = Invoke-Git @("rev-parse", "HEAD")
  $pullOutput = ""

  if (-not $SkipPull) {
    Write-Log "git fetch $Remote $Branch"
    Invoke-Git @("fetch", $Remote, $Branch) | Out-Null

    Write-Log "git pull --ff-only $Remote $Branch"
    try {
      $pullOutput = Invoke-Git @("pull", "--ff-only", $Remote, $Branch)
    } catch {
      throw "git pull nie powiodl sie (sprawdz credentials i konflikty): $_"
    }
    if ($pullOutput) {
      Write-Log $pullOutput
    }
  } else {
    Write-Log "Pominieto git pull (-SkipPull)"
  }

  $headAfter = Invoke-Git @("rev-parse", "HEAD")
  if ($headBefore -eq $headAfter -and -not $Force) {
    Write-Log "Brak nowych commitow ($headAfter) - pomijam build i restart"
    return
  }

  Write-Log "Zmiana: $headBefore -> $headAfter"

  $lockChanged = $false
  try {
    $diff = Invoke-Git @("diff", "--name-only", $headBefore, $headAfter)
    if ($diff -match '(^|/)package(-lock)?\.json($|\r)') {
      $lockChanged = $true
    }
  } catch {
    Write-Log "Nie udalo sie sprawdzic diff - uruchamiam npm ci na wszelki wypadek"
    $lockChanged = $true
  }

  Push-Location $ProjectRoot
  try {
    if ($lockChanged) {
      Write-Log "npm ci (zmiana package.json / package-lock.json)"
      & $npm ci
      if ($LASTEXITCODE -ne 0) { throw "npm ci nie powiodlo sie" }
    }

    Write-Log "npm run build"
    $env:NODE_ENV = "production"
    & $npm run build
    if ($LASTEXITCODE -ne 0) { throw "npm run build nie powiodlo sie" }

    if (-not (Test-ServiceExists $ServiceName)) {
      throw "Usluga '$ServiceName' nie istnieje - zainstaluj: .\installer\install-windows-service.ps1"
    }

    Write-Log "Restart-Service $ServiceName"
    Restart-Service -Name $ServiceName -Force
    Start-Sleep -Seconds 3

    $svc = Get-Service $ServiceName
    if ($svc.Status -ne "Running") {
      throw "Usluga $ServiceName nie dziala po restarcie (status: $($svc.Status))"
    }

    try {
      $probe = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/login" -Method Head -TimeoutSec 30 -UseBasicParsing
      Write-Log "HTTP probe OK: $($probe.StatusCode) http://127.0.0.1:$Port/login"
    } catch {
      Write-Log "UWAGA: HTTP probe nie powiodl sie po restarcie - sprawdz logs\ontime-stderr.log"
    }

    Write-Log "Deploy zakonczony pomyslnie"
  } finally {
    Pop-Location
  }
}

if ($InstallScheduledTask) {
  Install-NightlyDeployTask
  exit 0
}

if ($UninstallScheduledTask) {
  Uninstall-NightlyDeployTask
  exit 0
}

try {
  Write-Log "=== Nightly deploy start ==="
  Invoke-NightlyDeploy
} catch {
  Write-Log "BLAD: $_"
  exit 1
}
