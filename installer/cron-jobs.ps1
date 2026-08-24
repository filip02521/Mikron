# Wspolna lista zadan cron OnTime (Windows + dokumentacja).
# Strefa docelowa serwera: Europe/Warsaw (Central European Standard Time).
# ASCII-only (PS 5.1 bez BOM psuje en-dash/UTF-8).

$script:CronJobDefinitions = @(
  @{
    Id = "morning"
    Path = "/api/cron/morning"
    Label = "Poranna rutyna (panel dzienny, kolejka realizacji)"
    Schedule = "pn-pt 06:00"
  },
  @{
    Id = "process-deliveries"
    Path = "/api/cron/process-deliveries"
    Label = "Zapasowe domkniecie dostaw z kolejki"
    Schedule = "pn-pt co godz. 08:00-18:00"
  },
  @{
    Id = "informacja-stock-sync"
    Path = "/api/cron/informacja-stock-sync"
    Label = "Automatyczne powiadomienia informacji ze stanu Subiekta"
    Schedule = "pn-pt co godz. 08:00-18:00"
  },
  @{
    Id = "zd-eta-sync"
    Path = "/api/cron/zd-eta-sync"
    Label = "Backup sync terminow ZD na prosbach"
    Schedule = "pn-pt co 2 h 08:00-18:00"
  },
  @{
    Id = "catalog-zd-sync"
    Path = "/api/cron/catalog-zd-sync"
    Label = "Indeks ZD + import katalogu (noc, wymaga Subiekta w LAN)"
    Schedule = "codziennie 02:00-04:40 co 20 min"
  },
  @{
    Id = "morning-sync"
    Path = "/api/cron/morning-sync"
    Label = "Tylko przeliczenie harmonogramow (test / serwis)"
    Schedule = "recznie"
  }
)

function Get-CronJobDefinition {
  param([Parameter(Mandatory = $true)][string]$Id)
  $def = $script:CronJobDefinitions | Where-Object { $_.Id -eq $Id } | Select-Object -First 1
  if (-not $def) {
    $known = ($script:CronJobDefinitions | ForEach-Object { $_.Id }) -join ", "
    throw "Nieznany job: $Id (dozwolone: $known)"
  }
  return $def
}

function Get-CronJobIds {
  return $script:CronJobDefinitions | ForEach-Object { $_.Id }
}

function Get-CronPathForJob {
  param([Parameter(Mandatory = $true)][string]$Id)
  return (Get-CronJobDefinition -Id $Id).Path
}

function Show-CronJobsTable {
  Write-Host ""
  Write-Host "Zadania cron (Europe/Warsaw):" -ForegroundColor White
  foreach ($job in $script:CronJobDefinitions) {
    Write-Host ("  {0,-22} {1}" -f $job.Id, $job.Schedule)
    Write-Host ("    {0}" -f $job.Label) -ForegroundColor DarkGray
    Write-Host ("    -> {0}" -f $job.Path) -ForegroundColor DarkGray
  }
  Write-Host ""
}