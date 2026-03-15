param(
  [int]$ApiPort = 8000,
  [int]$WebPort = 5173,
  [switch]$KillExisting,
  [switch]$PerfAudit
)

$ErrorActionPreference = 'Stop'

function Get-UvCommand() {
  $uv = Get-Command uv -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $uv) {
    throw "The dev launcher now requires 'uv' on PATH to manage the backend virtual environment."
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
  & $UvCommand pip install --python $venvPython -r (Join-Path $RootPath 'backend\requirements.txt')
  if ($LASTEXITCODE -ne 0) {
    throw "uv pip install failed with exit code $LASTEXITCODE."
  }

  return $venvPython
}

function Get-ListeningPids([int]$Port) {
  try {
    return @(
      Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop |
        Select-Object -ExpandProperty OwningProcess -Unique
    )
  } catch {
    return @()
  }
}

function Stop-ListeningProcesses([int]$Port) {
  $pids = Get-ListeningPids -Port $Port
  foreach ($processId in $pids) {
    try {
      $p = Get-Process -Id $processId -ErrorAction Stop
      Write-Host "Stopping PID $processId ($($p.ProcessName)) listening on $Port" -ForegroundColor Yellow
      Stop-Process -Id $processId -Force
    } catch {
      Write-Host "Failed to stop PID $processId on port $Port $($_.Exception.Message)" -ForegroundColor Red
    }
  }
}

Write-Host "HytaleAssetStudio dev launcher" -ForegroundColor Cyan
Write-Host "- API port: $ApiPort" -ForegroundColor Cyan
Write-Host "- Web port: $WebPort" -ForegroundColor Cyan
Write-Host "- Perf audit: $PerfAudit" -ForegroundColor Cyan

if ($KillExisting) {
  Stop-ListeningProcesses -Port $ApiPort
  Stop-ListeningProcesses -Port $WebPort
}

$apiPids = Get-ListeningPids -Port $ApiPort
if (@($apiPids).Count -gt 0) {
  Write-Host "WARNING: something is already listening on API port $ApiPort (PID(s): $($apiPids -join ', '))." -ForegroundColor Yellow
  Write-Host "         Stop it first or re-run with -KillExisting, or choose another -ApiPort." -ForegroundColor Yellow
  if (-not $KillExisting) {
    throw "API port $ApiPort is already in use. Re-run with -KillExisting to avoid starting a stale backend/frontend pair."
  }
}

$webPids = Get-ListeningPids -Port $WebPort
if (@($webPids).Count -gt 0) {
  Write-Host "WARNING: something is already listening on Web port $WebPort (PID(s): $($webPids -join ', '))." -ForegroundColor Yellow
  Write-Host "         Stop it first or re-run with -KillExisting, or choose another -WebPort." -ForegroundColor Yellow
  if (-not $KillExisting) {
    throw "Web port $WebPort is already in use. Re-run with -KillExisting to avoid attaching to a stale dev server."
  }
}

# Ensure frontend proxy targets the right backend port
$env:HAS_API_PORT = "$ApiPort"

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$uvCommand = Get-UvCommand
$backendPython = Ensure-BackendVenv -RootPath $root -UvCommand $uvCommand

$preferredShell = (Get-Command pwsh -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Source)
if (-not $preferredShell) {
  $preferredShell = (Get-Command powershell -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Source)
}
if (-not $preferredShell) {
  throw "Neither 'pwsh' nor 'powershell' was found on PATH."
}

$commonShellArgs = @(
  '-NoExit',
  '-NoLogo',
  '-NoProfile',
  '-ExecutionPolicy', 'Bypass',
  '-Command'
)

$backendCommand = "& '$backendPython' -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port $ApiPort"
if ($PerfAudit) {
  $backendCommand = "`$env:HAS_PERF_AUDIT='1'; $backendCommand"
}

Write-Host "\nStarting backend..." -ForegroundColor Green
Start-Process -WorkingDirectory $root -FilePath $preferredShell -ArgumentList (
  $commonShellArgs + @($backendCommand)
)

Write-Host "Starting frontend..." -ForegroundColor Green
$frontendRoot = Join-Path $root 'frontend'
Start-Process -WorkingDirectory $frontendRoot -FilePath $preferredShell -ArgumentList (
  $commonShellArgs + @("`$env:HAS_API_PORT=$ApiPort; `$env:HAS_WEB_HOST='127.0.0.1'; `$env:HAS_WEB_PORT=$WebPort; npm run dev")
)

if ($PerfAudit) {
  Write-Host "Frontend perf logs: open http://127.0.0.1:$WebPort/?perfAudit=1" -ForegroundColor Yellow
}

Write-Host "\nDone. Close the two terminals to stop servers." -ForegroundColor Cyan
