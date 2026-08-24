# Instalacja harmonogramu zadan cron dla OnTime na Windows (Harmonogram zadan / schtasks).
#
# Uruchom PowerShell jako Administrator w katalogu projektu:
#   .\installer\install-cron.ps1
#   .\installer\install-cron.ps1 -Install
#   .\installer\install-cron.ps1 -Test -Job informacja-stock-sync -Force
#   .\installer\install-cron.ps1 -Uninstall
#
# Pelna instrukcja Windows Server: docs/cron-windows-server.md
#
param(
  [string]$ProjectRoot = "",
  [switch]$Install,
  [switch]$Uninstall,
  [switch]$Test,
  [ValidateSet("morning", "process-deliveries", "informacja-stock-sync", "catalog-zd-sync", "zd-eta-sync", "morning-sync")]
  [string]$Job = "morning",
  [switch]$Force,
  [switch]$List
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "cron-jobs.ps1")
. (Join-Path $PSScriptRoot "cron-env.ps1")

$CatalogZdSyncSlots = @("0200", "0220", "0240", "0300", "0320", "0340", "0400", "0420", "0440")
$TaskNames = @(
  "OnTime Cron Morning",
  "OnTime Cron Process Deliveries",
  "OnTime Cron Informacja Stock Sync",
  "OnTime Cron ZD ETA Sync"
) + ($CatalogZdSyncSlots | ForEach-Object { "OnTime Cron Catalog ZD Sync $_" })
$LegacyTaskNames = @(
  "OnTime Cron Catalog ZD Sync",
  "OnTime Cron Catalog ZD Sync Continue",
  "OnTime Cron Scheduled Mails 0700",
  "OnTime Cron Scheduled Mails 0800",
  "OnTime Cron Scheduled Mails 0900"
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

function New-SchTasksCronTask {
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

function Test-WarsawLikeTimeZone {
  try {
    $tz = Get-TimeZone
  } catch {
    return $false
  }
  $id = $tz.Id
  # Windows: "Central European Standard Time" = Warszawa / Sarajewo / Skopje
  if ($id -eq "Central European Standard Time") { return $true }
  if ($tz.DisplayName -match 'Warszawa|Warsaw|Sarajewo|Belgrade') { return $true }
  return $false
}

function Assert-CronInstallPreflight {
  param([string]$Root)

  Write-Step "Preflight cron"

  if (-not (Get-Command curl.exe -ErrorAction SilentlyContinue)) {
    throw "Brak curl.exe w PATH (wymagany do wywolan Harmonogramu zadan)."
  }
  Write-Ok "curl.exe"

  $secret = Get-CronSecretFromEnv -ProjectRoot $Root
  if (-not (Test-CronSecretConfigured -Secret $secret)) {
    throw "Ustaw silny CRON_SECRET w .env.local (nie change-me-in-production / dev-local-cron-secret)."
  }
  Write-Ok "CRON_SECRET"

  $envLocal = Join-Path $Root ".env.local"
  if (Test-Path $envLocal) {
    if (-not (Test-PathReadableBySystem -Path $envLocal)) {
      Write-Warn "SYSTEM moze nie czytac .env.local - zadania cron (konto SYSTEM) dostana blad sekretu."
      Write-Warn "Nadaj odczyt: icacls `"$envLocal`" /grant `"NT AUTHORITY\SYSTEM:(R)`""
    } else {
      Write-Ok ".env.local czytelny dla SYSTEM/Admin"
    }
  } else {
    Write-Warn "Brak .env.local w $Root (uzyte bedzie .env jesli istnieje)"
  }

  if (-not (Test-WarsawLikeTimeZone)) {
    Write-Warn "Strefa Windows nie wyglada na Europe/Warsaw (Central European Standard Time)."
    Write-Warn "Harmonogram uzywa czasu lokalnego serwera - ustaw strefe na Warszawa."
  } else {
    Write-Ok "Strefa czasowa (Warszawa / CET)"
  }

  $port = Get-CronAppPortFromEnv -ProjectRoot $Root -DefaultPort 3000
  Write-Ok "Port aplikacji: $port"

  $logsDir = Join-Path $Root "logs"
  New-Item -ItemType Directory -Force -Path $logsDir | Out-Null
  Write-Ok "Katalog logow: $logsDir"

  try {
    $probe = Invoke-WebRequest -Uri "http://127.0.0.1:$port/login" -Method Head -TimeoutSec 5 -UseBasicParsing
    Write-Ok "Aplikacja odpowiada na :$port (HTTP $($probe.StatusCode))"
  } catch {
    Write-Warn "Aplikacja nie odpowiada na http://127.0.0.1:$port/login - zadania powstana, ale crony beda padac az usluga wstanie."
  }
}

function Register-WeekdayRepeatingCronTask {
  param(
    [string]$Name,
    [string]$Root,
    [string]$JobName,
    [string]$Interval,
    [int]$DurationHours = 11,
    [string]$StartTime = "08:00:00"
  )

  Remove-ScheduledTaskIfExists $Name | Out-Null

  $cronScript = Join-Path $PSScriptRoot "cron-invoke.ps1"
  if (-not (Test-Path $cronScript)) {
    throw "Brak $cronScript"
  }

  $psArgs = "-NoProfile -ExecutionPolicy Bypass -File `"$cronScript`" -Job $JobName -ProjectRoot `"$Root`""
  $escapedArgs = [System.Security.SecurityElement]::Escape($psArgs)
  $escapedRoot = [System.Security.SecurityElement]::Escape($Root)
  $startDate = (Get-Date).ToString("yyyy-MM-dd")
  $duration = "PT${DurationHours}H"

  $xml = @"
<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.4" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <Triggers>
    <CalendarTrigger>
      <StartBoundary>${startDate}T${StartTime}</StartBoundary>
      <Enabled>true</Enabled>
      <ScheduleByWeek>
        <DaysOfWeek>
          <Monday />
          <Tuesday />
          <Wednesday />
          <Thursday />
          <Friday />
        </DaysOfWeek>
        <WeeksInterval>1</WeeksInterval>
      </ScheduleByWeek>
      <Repetition>
        <Interval>$Interval</Interval>
        <Duration>$duration</Duration>
        <StopAtDurationEnd>false</StopAtDurationEnd>
      </Repetition>
    </CalendarTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <UserId>S-1-5-18</UserId>
      <RunLevel>HighestAvailable</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <StartWhenAvailable>true</StartWhenAvailable>
    <Enabled>true</Enabled>
    <ExecutionTimeLimit>PT1H</ExecutionTimeLimit>
    <RestartOnFailure>
      <Interval>PT2M</Interval>
      <Count>2</Count>
    </RestartOnFailure>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>powershell.exe</Command>
      <Arguments>$escapedArgs</Arguments>
      <WorkingDirectory>$escapedRoot</WorkingDirectory>
    </Exec>
  </Actions>
</Task>
"@

  Register-ScheduledTask -TaskName $Name -Xml $xml -Force | Out-Null
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

  Assert-CronInstallPreflight -Root $Root

  Write-Step "Harmonogram zadan OnTime (Europe/Warsaw - czas lokalny Windows)"

  foreach ($legacyName in $LegacyTaskNames) {
    Remove-ScheduledTaskIfExists $legacyName | Out-Null
  }

  $trMorning = Get-CronInvokeCommand -Root $Root -JobName "morning"
  New-SchTasksCronTask "OnTime Cron Morning" @(
    "/Create", "/F", "/TN", "OnTime Cron Morning", "/TR", $trMorning,
    "/RU", "SYSTEM", "/RL", "HIGHEST", "/SC", "WEEKLY",
    "/D", "MON,TUE,WED,THU,FRI", "/ST", "06:00"
  )

  Register-WeekdayRepeatingCronTask -Name "OnTime Cron Process Deliveries" -Root $Root -JobName "process-deliveries" -Interval "PT1H"

  Register-WeekdayRepeatingCronTask -Name "OnTime Cron Informacja Stock Sync" -Root $Root -JobName "informacja-stock-sync" -Interval "PT1H"

  Register-WeekdayRepeatingCronTask -Name "OnTime Cron ZD ETA Sync" -Root $Root -JobName "zd-eta-sync" -Interval "PT2H"

  $trSync = Get-CronInvokeCommand -Root $Root -JobName "catalog-zd-sync"
  foreach ($slot in @("02:00", "02:20", "02:40", "03:00", "03:20", "03:40", "04:00", "04:20", "04:40")) {
    $slotId = $slot.Replace(":", "")
    New-SchTasksCronTask "OnTime Cron Catalog ZD Sync $slotId" @(
      "/Create", "/F", "/TN", "OnTime Cron Catalog ZD Sync $slotId", "/TR", $trSync,
      "/RU", "SYSTEM", "/RL", "HIGHEST", "/SC", "DAILY", "/ST", $slot
    )
  }

  Show-CronJobsTable
  Write-Host "Logi: $Root\logs\cron-*.log"
  Write-Host "Podglad: taskschd.msc (Harmonogram zadan)"
  Write-Host "Dokumentacja: docs/cron-windows-server.md"
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
  foreach ($name in ($TaskNames + $LegacyTaskNames)) {
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
Write-Step "OnTime - cron na Windows"
Write-Host "Katalog projektu: $Root"
Show-CronJobsTable
Write-Host "Instalacja (Administrator):" -ForegroundColor Yellow
Write-Host "  .\installer\install-cron.ps1 -Install"
Write-Host "  npm run install-cron:win -- -Install"
Write-Host "  .\installer\install-windows-service.ps1 -WithCron   # aplikacja + cron razem"
Write-Host ""
Write-Host "Test reczny (pomija okna czasowe z -Force):" -ForegroundColor Yellow
foreach ($jobId in (Get-CronJobIds)) {
  Write-Host "  .\installer\install-cron.ps1 -Test -Job $jobId -Force"
}
Write-Host ""
Write-Host "Podglad zadan / usuniecie:" -ForegroundColor Yellow
Write-Host "  .\installer\install-cron.ps1 -List"
Write-Host "  .\installer\install-cron.ps1 -Uninstall"
Write-Host ""
Write-Host "Pelna instrukcja Windows Server: docs/cron-windows-server.md" -ForegroundColor Cyan
Write-Host ""
Show-ScheduledTasks
