param(
  [switch]$NoBrowser
)

# Native tools such as Docker, Supabase and Expo write harmless progress messages
# to stderr. We validate their exit codes explicitly instead of treating every
# stderr line as a terminating PowerShell error.
$ErrorActionPreference = 'Continue'
$repoRoot = Split-Path -Parent $PSScriptRoot
$doctorEnv = Join-Path $repoRoot 'apps\doctor\.env'
$doctorEnvExample = Join-Path $repoRoot 'apps\doctor\.env.example'
$runtimeDir = Join-Path $repoRoot '.tawreed-local'
$dockerPipe = '\\.\pipe\dockerDesktopLinuxEngine'
$dockerDesktop = 'C:\Program Files\Docker\Docker\Docker Desktop.exe'

function Write-Step([string]$Message) {
  Write-Host "[Tawreed] $Message" -ForegroundColor Green
}

function Set-EnvValue([string]$Path, [string]$Name, [string]$Value) {
  $lines = if (Test-Path -LiteralPath $Path) { @(Get-Content -LiteralPath $Path) } else { @() }
  $prefix = "$Name="
  $updated = $false
  $next = foreach ($line in $lines) {
    if ($line.StartsWith($prefix, [StringComparison]::Ordinal)) {
      $updated = $true
      "$prefix$Value"
    } else {
      $line
    }
  }
  if (-not $updated) { $next += "$prefix$Value" }
  Set-Content -LiteralPath $Path -Value $next -Encoding utf8
}

Set-Location -LiteralPath $repoRoot
$pnpm = Get-Command pnpm.cmd -ErrorAction SilentlyContinue
if (-not $pnpm) { $pnpm = Get-Command pnpm -ErrorAction SilentlyContinue }
if (-not $pnpm) { throw 'pnpm is not installed. Install pnpm 11.25.0 once, then run this launcher again.' }

if (-not (Test-Path -LiteralPath (Join-Path $repoRoot 'node_modules'))) {
  Write-Step 'Installing project dependencies...'
  & $pnpm.Source install --frozen-lockfile
  if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
}

if (-not (Test-Path -LiteralPath $dockerPipe)) {
  if (-not (Test-Path -LiteralPath $dockerDesktop)) { throw 'Docker Desktop is not installed in its standard location.' }
  Write-Step 'Starting Docker Desktop...'
  Start-Process -FilePath $dockerDesktop -WindowStyle Hidden
  for ($second = 0; $second -lt 120 -and -not (Test-Path -LiteralPath $dockerPipe); $second++) {
    Start-Sleep -Seconds 1
  }
  if (-not (Test-Path -LiteralPath $dockerPipe)) { throw 'Docker Desktop did not become ready within two minutes.' }
}

Write-Step 'Starting local Supabase...'
$supabaseOutput = & $pnpm.Source exec supabase start 2>&1
if ($LASTEXITCODE -ne 0) {
  for ($second = 0; $second -lt 45; $second++) {
    $health = docker inspect --format '{{.State.Health.Status}}' supabase_db_tawreed-doctor 2>$null
    if ($health -eq 'healthy') { break }
    Start-Sleep -Seconds 1
  }
  $supabaseOutput = & $pnpm.Source exec supabase start 2>&1
  if ($LASTEXITCODE -ne 0) { throw "Supabase failed to start: $($supabaseOutput -join ' ')" }
}

$statusJson = (& $pnpm.Source exec supabase status -o json 2>$null) -join [Environment]::NewLine
$status = $statusJson | ConvertFrom-Json
if (-not $status.API_URL -or -not $status.PUBLISHABLE_KEY) { throw 'Supabase started, but its local public configuration could not be read.' }

if (-not (Test-Path -LiteralPath $doctorEnv)) { Copy-Item -LiteralPath $doctorEnvExample -Destination $doctorEnv }
Set-EnvValue -Path $doctorEnv -Name 'EXPO_PUBLIC_SUPABASE_URL' -Value $status.API_URL
Set-EnvValue -Path $doctorEnv -Name 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY' -Value $status.PUBLISHABLE_KEY
Write-Step 'Local environment is configured.'

New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null
$listening = Get-NetTCPConnection -LocalPort 8081 -State Listen -ErrorAction SilentlyContinue
if (-not $listening) {
  Write-Step 'Starting Tawreed web app...'
  $stdout = Join-Path $runtimeDir 'expo.log'
  $stderr = Join-Path $runtimeDir 'expo-error.log'
  $expo = Start-Process -FilePath $pnpm.Source -ArgumentList @('dev:web') -WorkingDirectory $repoRoot -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
  for ($second = 0; $second -lt 90; $second++) {
    if ($expo.HasExited) {
      $details = if (Test-Path -LiteralPath $stderr) { (Get-Content -LiteralPath $stderr -Tail 20) -join ' ' } else { 'No error log was produced.' }
      throw "Expo stopped before it became ready: $details"
    }
    if (Get-NetTCPConnection -LocalPort 8081 -State Listen -ErrorAction SilentlyContinue) { $listening = $true; break }
    Start-Sleep -Seconds 1
  }
  if (-not $listening) { throw 'Expo did not become ready on port 8081 within 90 seconds.' }
}

$appUrl = 'http://localhost:8081'
if (-not $NoBrowser) { Start-Process $appUrl }
Write-Step "Ready: $appUrl"
Write-Step 'Supabase Studio: http://127.0.0.1:54323'
