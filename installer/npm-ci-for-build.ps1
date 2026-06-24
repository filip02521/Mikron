# Wspolna instalacja zaleznosci pod build Next.js na serwerze Windows.
# Dot-source: . (Join-Path $PSScriptRoot "npm-ci-for-build.ps1")

function Test-NodeModulesComplete {
  param([string]$Root)

  $required = @(
    (Join-Path $Root "node_modules\next"),
    (Join-Path $Root "node_modules\@tailwindcss\postcss"),
    (Join-Path $Root "node_modules\tailwindcss"),
    (Join-Path $Root "node_modules\typescript")
  )
  foreach ($path in $required) {
    if (-not (Test-Path $path)) { return $false }
  }
  return $true
}

function Invoke-NpmCiForBuild {
  param(
    [string]$Npm,
    [switch]$AllowInstallFallback
  )

  $prevNodeEnv = $env:NODE_ENV
  $env:NODE_ENV = $null
  try {
    & $Npm run deps:ci
    if ($LASTEXITCODE -ne 0 -and $AllowInstallFallback) {
      & $Npm install --include=dev --no-audit --no-fund
      if ($LASTEXITCODE -ne 0) { throw "npm install nie powiodlo sie" }
    } elseif ($LASTEXITCODE -ne 0) {
      throw "npm run deps:ci nie powiodlo sie"
    }
  } finally {
    if ($prevNodeEnv) { $env:NODE_ENV = $prevNodeEnv } else { Remove-Item Env:NODE_ENV -ErrorAction SilentlyContinue }
  }
}
