# Instalacja OnTime jako uslugi Windows (NSSM) na porcie 3000 (backend za nginx).
# Nginx dziala osobno i przekierowuje ruch na 127.0.0.1:3000.
# Uruchom PowerShell jako Administrator w katalogu projektu:
#   .\installer\install-windows-service.ps1
#   .\installer\install-windows-service.ps1 -WithCron -WithNightlyDeploy
#   .\installer\install-windows-service.ps1 -Uninstall
#
param(
  [string]$ServiceName = "OnTime",
  [string]$NginxServiceName = "OnTimeNginx",
  [int]$Port = 3000,
  [string]$ProjectRoot = "",
  [string]$NssmPath = "",
  [string]$DeployBranch = "main",
  [string]$NightlyDeployAt = "03:30",
  [string]$DeployTaskRunAs = "",
  [string]$DeployTaskRunAsPassword = "",
  [switch]$SkipInstall,
  [switch]$ForceInstall,
  [switch]$SkipBuild,
  [switch]$WithCron,
  [switch]$WithNightlyDeploy,
  [switch]$Uninstall,
  [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "npm-ci-for-build.ps1")

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
  param([string]$Root = "")

  if ($NssmPath) {
    if (-not (Test-Path $NssmPath)) {
      throw "NSSM nie znaleziony: $NssmPath"
    }
    return (Resolve-Path $NssmPath).Path
  }

  if (-not $Root) {
    $Root = Resolve-ProjectRoot
  }

  $cwd = (Get-Location).Path
  $searchDirs = @($Root)
  if ($cwd -ne $Root) {
    $searchDirs += $cwd
  }

  $relativePaths = @(
    "nssm.exe",
    "win64\nssm.exe",
    "nssm\win64\nssm.exe"
  )

  foreach ($dir in $searchDirs) {
    foreach ($rel in $relativePaths) {
      $candidate = Join-Path $dir $rel
      if (Test-Path $candidate) {
        return (Resolve-Path $candidate).Path
      }
    }
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
    throw "nssm $($Arguments -join ' ') zakonczone kodem $LASTEXITCODE"
  }
}

function Get-ServiceExists([string]$Name) {
  return $null -ne (Get-Service -Name $Name -ErrorAction SilentlyContinue)
}

function Test-NodeModulesFresh {
  param([string]$Root)

  if (-not (Test-NodeModulesComplete -Root $Root)) {
    return $false
  }

  $lock = Join-Path $Root "package-lock.json"
  $modules = Join-Path $Root "node_modules"
  $pkg = Join-Path $Root "package.json"
  if (-not (Test-Path $modules) -or -not (Test-Path $lock) -or -not (Test-Path $pkg)) {
    return $false
  }

  $requiredPackages = @(
    (Join-Path $modules "next"),
    (Join-Path $modules "@tailwindcss\postcss"),
    (Join-Path $modules "tailwindcss")
  )
  foreach ($path in $requiredPackages) {
    if (-not (Test-Path $path)) {
      return $false
    }
  }

  $modulesTime = (Get-Item $modules).LastWriteTime
  $lockTime = (Get-Item $lock).LastWriteTime
  $pkgTime = (Get-Item $pkg).LastWriteTime
  return ($modulesTime -ge $lockTime) -and ($modulesTime -ge $pkgTime)
}

function Invoke-NpmInstall {
  param([string]$Npm)

  Write-Host "  (npm ci moze trwac 2-5 min na Windowsie - to normalne, poczekaj...)"
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  Invoke-NpmCiForBuild -Npm $Npm -AllowInstallFallback
  $sw.Stop()
  Write-Ok "Zaleznosci zainstalowane ($([math]::Round($sw.Elapsed.TotalSeconds)) s)"
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
  Write-Ok "Usunieto zadanie harmonogramu: $Name"
}

function New-ScheduledTask {
  param(
    [string]$Name,
    [string[]]$CreateArgs
  )

  Remove-ScheduledTaskIfExists $Name
  $result = Invoke-SchTasks $CreateArgs
  if ($result.ExitCode -ne 0) {
    throw "Nie udalo sie utworzyc $Name : $($result.Output)"
  }
}

function Install-CronTasks {
  param([string]$Root)

  $cronInstaller = Join-Path $PSScriptRoot "install-cron.ps1"
  if (-not (Test-Path $cronInstaller)) {
    throw "Brak $cronInstaller"
  }

  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $cronInstaller -Install -ProjectRoot $Root
  if ($LASTEXITCODE -ne 0) {
    throw "Nie udalo sie skonfigurowac harmonogramu cron"
  }
}

function Install-NightlyDeployTask {
  param([string]$Root)

  $deployScript = Join-Path $PSScriptRoot "nightly-deploy.ps1"
  if (-not (Test-Path $deployScript)) {
    throw "Brak $deployScript"
  }

  Write-Step "Harmonogram zadan (nightly deploy)"

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
    throw "Nie udalo sie skonfigurowac nightly deploy"
  }
  Write-Ok "Nightly deploy: codziennie $NightlyDeployAt (branch $DeployBranch, konto $runAs)"
  if (-not $DeployTaskRunAsPassword) {
    Write-Warn "Bez -DeployTaskRunAsPassword zadanie moze wymagac hasla w Harmonogramie zadan"
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
        Write-Ok "Usunieto usluge: $name"
      }
    }
  } else {
    Write-Warn "NSSM nie znaleziony - usun uslugi recznie (services.msc)"
  }

  $deployScript = Join-Path $PSScriptRoot "nightly-deploy.ps1"
  if (Test-Path $deployScript) {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $deployScript -UninstallScheduledTask | Out-Null
  }

  $cronInstaller = Join-Path $PSScriptRoot "install-cron.ps1"
  if (Test-Path $cronInstaller) {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $cronInstaller -Uninstall -ProjectRoot $Root | Out-Null
  } else {
    foreach ($task in @(
      "OnTime Cron Morning",
      "OnTime Cron Process Deliveries",
      "OnTime Cron ZD ETA Sync",
      "OnTime Cron Catalog ZD Sync",
      "OnTime Cron Catalog ZD Sync Continue"
    )) {
      Remove-ScheduledTaskIfExists $task
    }
  }

  Write-Host ""
  Write-Host "Gotowe. Katalog projektu pozostaje: $Root"
  exit 0
}

function Test-ValidServiceName {
  param([string]$Name)

  if ($Name -match '^-') {
    Write-Err "Nieprawidlowy argument: '$Name' (wyglada jak flaga, nie nazwa uslugi)"
    if ($Name -match 'Corn') {
      Write-Host "  Literowka? Uzyj -WithCron (jedna kreska, Cron nie Corn)"
    }
    Write-Host "  Przyklad: .\installer\install-windows-service.ps1 -WithCron -WithNightlyDeploy"
    exit 1
  }
  if ($Name -notmatch '^[A-Za-z0-9_-]+$') {
    Write-Err "Nieprawidlowa nazwa uslugi: $Name"
    exit 1
  }
}

# --- main ---

if (-not (Test-IsAdmin)) {
  Write-Err "Uruchom PowerShell jako Administrator."
  exit 1
}

Test-ValidServiceName $ServiceName

$Root = Resolve-ProjectRoot
$script:NssmExe = Find-NssmPath -Root $Root
$NpmExe = Find-NpmPath

Write-Host "OnTime - instalacja uslugi Windows"
Write-Host "Katalog projektu: $Root"

if ($Uninstall) {
  if (-not $script:NssmExe) {
    Write-Warn "NSSM nie znaleziony - pomijam usuwanie uslug NSSM"
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
  Write-Err "Node.js $nodeVersion - wymagane >= 20.9.0"
  exit 1
}
Write-Ok "Node.js v$nodeVersion, npm: $NpmExe"

$envFile = Join-Path $Root ".env"
if (-not (Test-Path $envFile)) {
  Write-Err "Brak .env - skopiuj .env.production.example i uzupelnij klucze:"
  Write-Host "  copy .env.production.example .env"
  exit 1
}
Write-Ok ".env istnieje"

Push-Location $Root
try {
  if (-not $SkipInstall) {
    if ((Test-NodeModulesFresh -Root $Root) -and -not $ForceInstall) {
      Write-Ok "node_modules aktualne - pomijam npm ci (wymus: -ForceInstall)"
    } else {
      Write-Step "npm ci"
      Invoke-NpmInstall -Npm $NpmExe
    }
  }

  if (-not $SkipBuild) {
    Write-Step "npm run build"
    $env:NODE_ENV = "production"
    & $NpmExe run build
    if ($LASTEXITCODE -ne 0) { throw "npm run build nie powiodlo sie" }
    Write-Ok "Build zakonczony"
  }

  Write-Step "Weryfikacja (setup-check)"
  & $NpmExe run setup-check
  if ($LASTEXITCODE -ne 0) {
    Write-Warn "setup-check zglosil problemy - sprawdz .env i migracje Supabase"
  } else {
    Write-Ok "setup-check OK"
  }

  Write-Step "Usluga Windows: $ServiceName"

  if (Get-ServiceExists $ServiceName) {
    if (-not $Force) {
      Write-Err "Usluga '$ServiceName' juz istnieje. Uzyj -Force aby nadpisac lub -Uninstall."
      exit 1
    }
    try { Stop-Service $ServiceName -Force -ErrorAction SilentlyContinue } catch {}
    Invoke-Nssm @("remove", $ServiceName, "confirm")
    Write-Ok "Usunieto poprzednia usluge $ServiceName"
  }

  $logsDir = Join-Path $Root "logs"
  New-Item -ItemType Directory -Force -Path $logsDir | Out-Null

  Invoke-Nssm @("install", $ServiceName, $NpmExe, "run start")
  Invoke-Nssm @("set", $ServiceName, "AppDirectory", $Root)
  Invoke-Nssm @("set", $ServiceName, "AppEnvironmentExtra", "NODE_ENV=production`nPORT=$Port")
  Invoke-Nssm @("set", $ServiceName, "DisplayName", "OnTime System Dostaw")
  Invoke-Nssm @("set", $ServiceName, "Description", "Next.js - system dostaw (OnTime)")
  Invoke-Nssm @("set", $ServiceName, "Start", "SERVICE_AUTO_START")
  Invoke-Nssm @("set", $ServiceName, "AppStdout", (Join-Path $logsDir "ontime-stdout.log"))
  Invoke-Nssm @("set", $ServiceName, "AppStderr", (Join-Path $logsDir "ontime-stderr.log"))
  Invoke-Nssm @("set", $ServiceName, "AppRotateFiles", "1")
  Invoke-Nssm @("set", $ServiceName, "AppRotateBytes", "10485760")

  Invoke-Nssm @("start", $ServiceName)
  Start-Sleep -Seconds 3

  $svc = Get-Service $ServiceName
  if ($svc.Status -ne "Running") {
    Write-Warn "Usluga $ServiceName nie dziala (status: $($svc.Status)). Sprawdz logs\ontime-stderr.log"
  } else {
    Write-Ok "Usluga $ServiceName dziala"
  }

  try {
    $probe = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/login" -Method Head -TimeoutSec 15 -UseBasicParsing
    Write-Ok "HTTP probe: $($probe.StatusCode) http://127.0.0.1:$Port/login"
  } catch {
    Write-Warn "HTTP probe nie powiodl sie - sprawdz logi w logs\"
  }

  Write-Warn "Nginx: zakladamy reverse proxy na port $Port (patrz deploy/nginx/ontime.conf)"
  Write-Warn "NEXT_PUBLIC_APP_URL w .env bez :3000 (adres z portu 80)"

  if ($WithCron) {
    Install-CronTasks -Root $Root
  }

  if ($WithNightlyDeploy) {
    Install-NightlyDeployTask -Root $Root
  }

  Write-Step "Gotowe"
  Write-Host ""
  Write-Host "  Usluga:     $ServiceName (port $Port, backend za nginx)"
  Write-Host "  Logi:       $logsDir"
  Write-Host "  Restart:    Restart-Service $ServiceName"
  Write-Host "  Odinstaluj: .\installer\install-windows-service.ps1 -Uninstall"
  Write-Host ""
  Write-Host "  Test app:   curl -I http://127.0.0.1:$Port/login"
  Write-Host "  Test nginx: curl -I http://ontime.mikran.pl/login"
  Write-Host "  Docs:       docs/nginx.md, docs/production-urls.md"
  Write-Host ""

  if (-not $WithCron) {
    Write-Warn "Cron nie skonfigurowany - dodaj: -WithCron"
  }
  if (-not $WithNightlyDeploy) {
    Write-Warn "Nightly deploy pominiety - dodaj: -WithNightlyDeploy"
  }
} finally {
  Pop-Location
}
