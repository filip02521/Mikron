# Wspolna instalacja zaleznosci pod build Next.js na serwerze Windows.
# Dot-source: . (Join-Path $PSScriptRoot "npm-ci-for-build.ps1")

function Stop-ServiceForNodeInstall {
  param(
    [string]$ProjectRoot,
    [string]$ServiceName = "OnTime"
  )

  $svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
  if ($svc -and $svc.Status -eq "Running") {
    Write-Host "  Zatrzymuje $ServiceName przed npm ci (zwalnia next-swc)..."
    Stop-Service -Name $ServiceName -Force
    Start-Sleep -Seconds 3
  }

  # NSSM czasem zostawia node.exe po Stop-Service — wtedy npm ci dostaje EPERM.
  $rootNorm = (Resolve-Path $ProjectRoot).Path.ToLowerInvariant()
  Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue | ForEach-Object {
    $cmd = $_.CommandLine
    if (-not $cmd) { $cmd = "" }
    $cmd = $cmd.ToLowerInvariant()
    if ($cmd -and ($cmd.Contains($rootNorm) -or $cmd -match "next (start|dev)")) {
      Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    }
  }
  Start-Sleep -Seconds 2
}

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
    [string]$ProjectRoot,
    [string]$ServiceName = "OnTime",
    [switch]$AllowInstallFallback
  )

  if ($ProjectRoot) {
    Stop-ServiceForNodeInstall -ProjectRoot $ProjectRoot -ServiceName $ServiceName
  }

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
