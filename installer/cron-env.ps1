# Wspolny odczyt .env dla cron-invoke / install-cron (Windows).

function Read-EnvValue {
  param(
    [string[]]$Files,
    [string]$Key
  )

  foreach ($file in $Files) {
    if (-not (Test-Path $file)) { continue }
    foreach ($line in Get-Content $file -Encoding UTF8) {
      if ($line -match "^\s*$([regex]::Escape($Key))=(.+)$") {
        return $Matches[1].Trim().Trim('"').Trim("'")
      }
    }
  }
  return $null
}

function Get-CronEnvSources {
  param([string]$ProjectRoot)

  return @(
    (Join-Path $ProjectRoot ".env.local"),
    (Join-Path $ProjectRoot ".env")
  )
}

function Get-CronSecretFromEnv {
  param([string]$ProjectRoot)

  return Read-EnvValue -Files (Get-CronEnvSources -ProjectRoot $ProjectRoot) -Key "CRON_SECRET"
}

function Get-CronAppPortFromEnv {
  param(
    [string]$ProjectRoot,
    [int]$DefaultPort = 3000
  )

  $sources = Get-CronEnvSources -ProjectRoot $ProjectRoot
  $portRaw = Read-EnvValue -Files $sources -Key "APP_PORT"
  if (-not $portRaw) {
    $portRaw = Read-EnvValue -Files $sources -Key "PORT"
  }
  if ($portRaw -and $portRaw -match '^\d+$') {
    return [int]$portRaw
  }
  return $DefaultPort
}

function Test-CronSecretConfigured {
  param([string]$Secret)

  if (-not $Secret) { return $false }
  if ($Secret -eq "change-me-in-production") { return $false }
  if ($Secret -eq "dev-local-cron-secret") { return $false }
  return $true
}

function Test-PathReadableBySystem {
  param([string]$Path)

  if (-not (Test-Path $Path)) { return $false }

  try {
    $acl = Get-Acl -Path $Path
  } catch {
    return $false
  }

  foreach ($rule in $acl.Access) {
    if ($rule.AccessControlType -ne "Allow") { continue }
    $id = [string]$rule.IdentityReference
    if ($id -notmatch '(^|\\)(SYSTEM|Administrators|Everyone|Users)$') { continue }
    $rights = $rule.FileSystemRights.ToString()
    if ($rights -match 'FullControl|Modify|ReadAndExecute|Read|ListDirectory') {
      return $true
    }
  }
  return $false
}
