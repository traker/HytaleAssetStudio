param(
  [int]$ApiPort = 8000,
  [switch]$SkipBuild,
  [switch]$PerfAudit
)

$ErrorActionPreference = 'Stop'

function Get-UvCommand() {
  $uv = Get-Command uv -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $uv) {
    throw "'uv' is not on PATH. Install it from https://docs.astral.sh/uv/ and re-run."
  }
  return $uv.Source
}

function Ensure-BackendVenv([string]$RootPath, [string]$UvCommand) {
  $venvPython = Join-Path $RootPath '.venv\Scripts\python.exe'
  if (-not (Test-Path $venvPython)) {
    Write-Host "Creating backend virtual environment with uv..." -ForegroundColor Green
    & $UvCommand venv (Join-Path $RootPath '.venv')
    if ($LASTEXITCODE -ne 0) {
      throw "uv venv failed with exit code $LASTEXITCODE."
    }
  }

  Write-Host "Syncing backend dependencies with uv..." -ForegroundColor Green
  & $UvCommand pip install --python $venvPython -r (Join-Path $RootPath 'backend\requirements.lock')
  if ($LASTEXITCODE -ne 0) {
    throw "uv pip install failed with exit code $LASTEXITCODE."
  }

  return $venvPython
}

$root = Resolve-Path (Join-Path $PSScriptRoot '..')

# --- Build frontend ---
if (-not $SkipBuild) {
  Write-Host "Building frontend..." -ForegroundColor Cyan
  Push-Location (Join-Path $root 'frontend')
  try {
    npm run build
    if ($LASTEXITCODE -ne 0) {
      throw "npm run build failed with exit code $LASTEXITCODE."
    }
  } finally {
    Pop-Location
  }
  Write-Host "Frontend build OK." -ForegroundColor Green
}

$distPath = Join-Path $root 'frontend\dist'
if (-not (Test-Path $distPath)) {
  throw "frontend/dist not found. Run without -SkipBuild or run 'npm run build' in frontend/ first."
}

# --- Ensure backend venv ---
$uvCommand = Get-UvCommand
$backendPython = Ensure-BackendVenv -RootPath $root -UvCommand $uvCommand

# --- Start ---
if ($PerfAudit) { $env:HAS_PERF_AUDIT = '1' }

Write-Host ""
Write-Host "Hytale Asset Studio" -ForegroundColor Cyan
Write-Host "  URL  : http://127.0.0.1:$ApiPort/" -ForegroundColor Cyan
Write-Host "  Mode : production (frontend served by FastAPI)" -ForegroundColor Cyan
Write-Host "  Press Ctrl+C to stop." -ForegroundColor Cyan
Write-Host ""

& $backendPython -m uvicorn backend.app.main:app --host 127.0.0.1 --port $ApiPort
