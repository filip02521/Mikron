# Instalacja OnTime jako usługi Windows (NSSM) + opcjonalnie nginx i cron.
# Uruchom PowerShell jako Administrator w katalogu projektu:
#   .\installer\install-windows-service.ps1
#   .\installer\install-windows-service.ps1 -WithNginx -NginxPath C:\nginx -WithCron
#   .\installer\install-windows-service.ps1 -WithNightlyDeploy
#   .\installer\install-windows-service.ps1 -Uninstall
#
param(
  [string]$ServiceName = "OnTime",
  [string]$NginxServiceName = "OnTimeNginx",
  [int]$Port = 3000,
  [string]$ProjectRoot = "",
  [string]$NssmPath = "",
  [string]$NginxPath = "",
  [string]$DeployBranch = "main",
  [string]$NightlyDeployAt = "03:30",
  [string]$DeployTaskRunAs = "",
  [string]$DeployTaskRunAsPassword = "",
  [switch]$SkipInstall,
  [switch]$SkipBuild,
  [switch]$WithNginx,
  [switch]$WithCron,
  [switch]$WithNightlyDeploy,
  [switch]$Uninstall,
  [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

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

function Write-Err([string]$Message) {
  Write-Host "  XX  $Message" -ForegroundColor Red
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

function Find-NssmPath {
  if ($NssmPath) {
    if (-not (Test-Path $NssmPath)) {
      throw "NSSM nie znaleziony: $NssmPath"
    }
    return (Resolve-Path $NssmPath).Path
  }

  $cmd = Get-Command nssm.exe -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }

  $candidates = @(
    "C:\tools\nssm\win64\nssm.exe",
    "C:\nssm\win64\nssm.exe",
    "C:\Program Files\nssm\nssm.exe"
  )
  foreach ($candidate in $candidates) {
    if (Test-Path $candidate) { return (Resolve-Path $candidate).Path }
  }
  return $null
}

function Invoke-Nssm {
  param(
    [string[]]$Arguments
  )
  & $script:NssmExe @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "nssm $($Arguments -join ' ') zakończone kodem $LASTEXITCODE"
  }
}

function Get-ServiceExists([string]$Name) {
  return $null -ne (Get-Service -Name $Name -ErrorAction SilentlyContinue)
}

function Remove-ScheduledTaskIfExists([string]$Name) {
  $existing = schtasks /Query /TN $Name 2>$null
  if ($LASTEXITCODE -eq 0) {
    schtasks /Delete /TN $Name /F | Out-Null
    Write-Ok "Usunięto zadanie harmonogramu: $Name"
  }
}

function Install-CronTasks {
  param([string]$Root)

  $cronScript = Join-Path $PSScriptRoot "cron-invoke.ps1"
  if (-not (Test-Path $cronScript)) {
    throw "Brak $cronScript"
  }

  Write-Step "Harmonogram zadań (cron)"

  Remove-ScheduledTaskIfExists "OnTime Cron Morning"
  $trMorning = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$cronScript`" -Job morning"
  schtasks /Create /F /TN "OnTime Cron Morning" /TR $trMorning /RU SYSTEM /RL HIGHEST `
    /SC WEEKLY /D MON,TUE,WED,THU,FRI /ST 06:00 | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Nie udało się utworzyć OnTime Cron Morning" }
  Write-Ok "Utworzono zadanie harmonogramu: OnTime Cron Morning (pn–pt 06:00)"

  Remove-ScheduledTaskIfExists "OnTime Cron Process Deliveries"
  $tr = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$cronScript`" -Job process-deliveries"
  schtasks /Create /F /TN "OnTime Cron Process Deliveries" /TR $tr /RU SYSTEM /RL HIGHEST `
    /SC DAILY /ST 08:00 /RI 60 /DU 11:00 /D MON,TUE,WED,THU,FRI | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Nie udało się utworzyć OnTime Cron Process Deliveries" }
  Write-Ok "Utworzono zadanie harmonogramu: OnTime Cron Process Deliveries (pn–pt co godz. 8–18)"

  Remove-ScheduledTaskIfExists "OnTime Cron Catalog ZD Sync"
  $trSync = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$cronScript`" -Job catalog-zd-sync"
  schtasks /Create /F /TN "OnTime Cron Catalog ZD Sync" /TR $trSync /RU SYSTEM /RL HIGHEST `
    /SC DAILY /ST 02:00 | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Nie udało się utworzyć OnTime Cron Catalog ZD Sync" }
  Write-Ok "Utworzono zadanie harmonogramu: OnTime Cron Catalog ZD Sync (02:00)"

  Remove-ScheduledTaskIfExists "OnTime Cron Catalog ZD Sync Continue"
  schtasks /Create /F /TN "OnTime Cron Catalog ZD Sync Continue" /TR $trSync /RU SYSTEM /RL HIGHEST `
    /SC DAILY /ST 02:20 | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Nie udało się utworzyć OnTime Cron Catalog ZD Sync Continue" }
  Write-Ok "Utworzono zadanie harmonogramu: OnTime Cron Catalog ZD Sync Continue (02:20)"
}

function Install-NightlyDeployTask {
  param([string]$Root)

  $deployScript = Join-Path $PSScriptRoot "nightly-deploy.ps1"
  if (-not (Test-Path $deployScript)) {
    throw "Brak $deployScript"
  }

  Write-Step "Harmonogram zadań (nightly deploy)"

  $runAs = $DeployTaskRunAs
  if (-not $runAs) {
    $runAs = "$env:USERDOMAIN\$env:USERNAME"
  }

  $args = @(
    "-NoProfile", "-ExecutionPolicy", "Bypass",
    "-File", $deployScript,
    "-InstallScheduledTask",
    "-ServiceName", $ServiceName,
    "-Branch", $DeployBranch,
    "-TaskTime", $NightlyDeployAt,
    "-TaskRunAs", $runAs
  )
  if ($DeployTaskRunAsPassword) {
    $args += @("-TaskRunAsPassword", $DeployTaskRunAsPassword)
  }

  & powershell.exe @args
  if ($LASTEXITCODE -ne 0) {
    throw "Nie udało się skonfigurować nightly deploy"
  }
  Write-Ok "Nightly deploy: codziennie $NightlyDeployAt (branch $DeployBranch, konto $runAs)"
  if (-not $DeployTaskRunAsPassword) {
    Write-Warn "Bez -DeployTaskRunAsPassword zadanie może wymagać hasła w Harmonogramie zadań (uruchomienie bez logowania)"
  }
}

function Uninstall-All {
  param([string]$Root)

  Write-Step "Odinstalowywanie"

  if ($script:NssmExe) {
    foreach ($name in @($ServiceName, $NginxServiceName)) {
      if (Get-ServiceExists $name) {
        try { Stop-Service $name -Force -ErrorAction SilentlyContinue } catch {}
        Invoke-Nssm @("remove", $name, "confirm")
        Write-Ok "Usunięto usługę: $name"
      }
    }
  } else {
    Write-Warn "NSSM nie znaleziony — usuń usługi ręcznie (services.msc)"
  }

  $deployScript = Join-Path $PSScriptRoot "nightly-deploy.ps1"
  if (Test-Path $deployScript) {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $deployScript -UninstallScheduledTask | Out-Null
  }

  foreach ($task in @(
    "OnTime Cron Morning",
    "OnTime Cron Process Deliveries",
    "OnTime Cron Catalog ZD Sync",
    "OnTime Cron Catalog ZD Sync Continue"
  )) {
    Remove-ScheduledTaskIfExists $task
  }

  Write-Host ""
  Write-Host "Gotowe. Katalog projektu pozostaje: $Root"
  exit 0
}

# --- main ---

if (-not (Test-IsAdmin)) {
  Write-Err "Uruchom PowerShell jako Administrator."
  exit 1
}

$Root = Resolve-ProjectRoot
$script:NssmExe = Find-NssmPath
$NpmExe = Find-NpmPath

Write-Host "OnTime — instalacja usługi Windows"
Write-Host "Katalog projektu: $Root"

if ($Uninstall) {
  if (-not $script:NssmExe) {
    Write-Warn "NSSM nie znaleziony — pomijam usuwanie usług NSSM"
  }
  Uninstall-All -Root $Root
}

if (-not $script:NssmExe) {
  Write-Err "NSSM nie znaleziony. Pobierz: https://nssm.cc/download"
  Write-Host "  Np. rozpakuj do C:\tools\nssm\ i uruchom ponownie z:"
  Write-Host "  .\installer\install-windows-service.ps1 -NssmPath C:\tools\nssm\win64\nssm.exe"
  exit 1
}

if (-not $NpmExe) {
  Write-Err "npm.cmd nie znaleziony. Zainstaluj Node.js >= 20.9 (https://nodejs.org)"
  exit 1
}

$nodeVersion = (& node -v) -replace '^v', ''
$minVersion = [version]"20.9.0"
if ([version]$nodeVersion -lt $minVersion) {
  Write-Err "Node.js $nodeVersion — wymagane >= 20.9.0"
  exit 1
}
Write-Ok "Node.js v$nodeVersion, npm: $NpmExe"

$envLocal = Join-Path $Root ".env.local"
if (-not (Test-Path $envLocal)) {
  Write-Err "Brak .env.local — skopiuj .env.production.example i uzupełnij klucze:"
  Write-Host "  copy .env.production.example .env.local"
  exit 1
}
Write-Ok ".env.local istnieje"

Push-Location $Root
try {
  if (-not $SkipInstall) {
    Write-Step "npm ci"
    & $NpmExe ci
    if ($LASTEXITCODE -ne 0) { throw "npm ci nie powiodło się" }
    Write-Ok "Zależności zainstalowane"
  }

  if (-not $SkipBuild) {
    Write-Step "npm run build"
    $env:NODE_ENV = "production"
    & $NpmExe run build
    if ($LASTEXITCODE -ne 0) { throw "npm run build nie powiodło się" }
    Write-Ok "Build zakończony"
  }

  Write-Step "Weryfikacja (setup-check)"
  & $NpmExe run setup-check
  if ($LASTEXITCODE -ne 0) {
    Write-Warn "setup-check zgłosił problemy — sprawdź .env.local i migracje Supabase"
  } else {
    Write-Ok "setup-check OK"
  }

  Write-Step "Usługa Windows: $ServiceName"

  if (Get-ServiceExists $ServiceName) {
    if (-not $Force) {
      Write-Err "Usługa '$ServiceName' już istnieje. Użyj -Force aby nadpisać lub -Uninstall."
      exit 1
    }
    try { Stop-Service $ServiceName -Force -ErrorAction SilentlyContinue } catch {}
    Invoke-Nssm @("remove", $ServiceName, "confirm")
    Write-Ok "Usunięto poprzednią usługę $ServiceName"
  }

  $logsDir = Join-Path $Root "logs"
  New-Item -ItemType Directory -Force -Path $logsDir | Out-Null

  Invoke-Nssm @("install", $ServiceName, $NpmExe, "run start")
  Invoke-Nssm @("set", $ServiceName, "AppDirectory", $Root)
  Invoke-Nssm @("set", $ServiceName, "AppEnvironmentExtra", "NODE_ENV=production`nPORT=$Port")
  Invoke-Nssm @("set", $ServiceName, "DisplayName", "OnTime System Dostaw")
  Invoke-Nssm @("set", $ServiceName, "Description", "Next.js — system dostaw (OnTime)")
  Invoke-Nssm @("set", $ServiceName, "Start", "SERVICE_AUTO_START")
  Invoke-Nssm @("set", $ServiceName, "AppStdout", (Join-Path $logsDir "ontime-stdout.log"))
  Invoke-Nssm @("set", $ServiceName, "AppStderr", (Join-Path $logsDir "ontime-stderr.log"))
  Invoke-Nssm @("set", $ServiceName, "AppRotateFiles", "1")
  Invoke-Nssm @("set", $ServiceName, "AppRotateBytes", "10485760")

  Invoke-Nssm @("start", $ServiceName)
  Start-Sleep -Seconds 3

  $svc = Get-Service $ServiceName
  if ($svc.Status -ne "Running") {
    Write-Warn "Usługa $ServiceName nie działa (status: $($svc.Status)). Sprawdź logs\ontime-stderr.log"
  } else {
    Write-Ok "Usługa $ServiceName działa"
  }

  try {
    $probe = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/login" -Method Head -TimeoutSec 15 -UseBasicParsing
    Write-Ok "HTTP probe: $($probe.StatusCode) http://127.0.0.1:$Port/login"
  } catch {
    Write-Warn "HTTP probe nie powiódł się — sprawdź logi w logs\"
  }

  if ($WithNginx) {
    Write-Step "Usługa nginx: $NginxServiceName"

    if (-not $NginxPath) {
      $NginxPath = "C:\nginx"
    }
    $nginxExe = Join-Path $NginxPath "nginx.exe"
    if (-not (Test-Path $nginxExe)) {
      throw "nginx.exe nie znaleziony: $nginxExe (podaj -NginxPath)"
    }

    & $nginxExe -t -p $NginxPath 2>&1 | ForEach-Object { Write-Host "  $_" }
    if ($LASTEXITCODE -ne 0) {
      throw "nginx -t nie powiódł się — skonfiguruj conf (patrz docs/nginx.md)"
    }

    if (Get-ServiceExists $NginxServiceName) {
      if ($Force) {
        try { Stop-Service $NginxServiceName -Force -ErrorAction SilentlyContinue } catch {}
        Invoke-Nssm @("remove", $NginxServiceName, "confirm")
      } else {
        throw "Usługa '$NginxServiceName' już istnieje (użyj -Force)"
      }
    }

    Invoke-Nssm @("install", $NginxServiceName, $nginxExe)
    Invoke-Nssm @("set", $NginxServiceName, "AppDirectory", $NginxPath)
    Invoke-Nssm @("set", $NginxServiceName, "DisplayName", "OnTime Nginx")
    Invoke-Nssm @("set", $NginxServiceName, "Start", "SERVICE_AUTO_START")
    Invoke-Nssm @("start", $NginxServiceName)
    Write-Ok "Usługa $NginxServiceName uruchomiona"
    Write-Warn "Upewnij się, że NEXT_PUBLIC_APP_URL w .env.local nie zawiera :3000 (reverse proxy na 80)"
  }

  if ($WithCron) {
    Install-CronTasks -Root $Root
  }

  if ($WithNightlyDeploy) {
    Install-NightlyDeployTask -Root $Root
  }

  Write-Step "Gotowe"
  Write-Host ""
  Write-Host "  Usługa:     $ServiceName (port $Port)"
  Write-Host "  Logi:       $logsDir"
  Write-Host "  Restart:    Restart-Service $ServiceName"
  Write-Host "  Odinstaluj: .\installer\install-windows-service.ps1 -Uninstall"
  Write-Host ""
  Write-Host "  Test:       curl -I http://127.0.0.1:$Port/login"
  Write-Host "  Docs:       docs/nginx.md, docs/production-urls.md"
  Write-Host ""

  if (-not $WithCron) {
    Write-Warn "Cron nie skonfigurowany — dodaj: -WithCron"
  }
  if (-not $WithNightlyDeploy) {
    Write-Warn "Nightly deploy pominięty — dodaj: -WithNightlyDeploy"
  }
  if (-not $WithNginx) {
    Write-Warn "Nginx pominięty — użytkownicy wchodzą na :$Port lub dodaj: -WithNginx -NginxPath C:\nginx"
  }
} finally {
  Pop-Location
}
