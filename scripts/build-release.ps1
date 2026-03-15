<#
.SYNOPSIS
    Build a self-contained release of Hytale Asset Studio.

.DESCRIPTION
    1. Builds the React frontend (frontend/dist/).
    2. Runs PyInstaller to produce dist/HytaleAssetStudio/ (--onedir).

    The final folder dist/HytaleAssetStudio/ is fully self-contained:
    copy or zip the whole directory and distribute it.

.PARAMETER SkipFrontendBuild
    Skip `npm run build` (if frontend/dist already up-to-date).

.PARAMETER Clean
    Pass --clean to PyInstaller (slower but avoids stale cache issues).

.EXAMPLE
    .\scripts\build-release.ps1
    .\scripts\build-release.ps1 -SkipFrontendBuild
    .\scripts\build-release.ps1 -Clean
#>
param(
    [switch]$SkipFrontendBuild,
    [switch]$Clean
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot   # repo root

# ---------------------------------------------------------------------------
# 1. Frontend build
# ---------------------------------------------------------------------------
if (-not $SkipFrontendBuild) {
    Write-Host "==> Building React frontend..." -ForegroundColor Cyan
    Push-Location (Join-Path $Root "frontend")
    try {
        npm run build
        if ($LASTEXITCODE -ne 0) { throw "npm run build failed (exit $LASTEXITCODE)" }
    } finally {
        Pop-Location
    }
    Write-Host "==> Frontend build done." -ForegroundColor Green
} else {
    Write-Host "==> Skipping frontend build (-SkipFrontendBuild)." -ForegroundColor Yellow
}

# Verify frontend/dist exists
$FrontendDist = Join-Path $Root "frontend" "dist"
if (-not (Test-Path $FrontendDist)) {
    Write-Error "frontend/dist not found. Run without -SkipFrontendBuild or run 'npm run build' manually."
    exit 1
}

# ---------------------------------------------------------------------------
# 2. PyInstaller
# ---------------------------------------------------------------------------
$Python = Join-Path $Root ".venv" "Scripts" "python.exe"
if (-not (Test-Path $Python)) {
    Write-Error ".venv not found at $Python. Activate or create the virtual environment first."
    exit 1
}

$SpecFile = Join-Path $Root "HytaleAssetStudio.spec"

Write-Host "==> Running PyInstaller..." -ForegroundColor Cyan
Push-Location $Root
try {
    $PyInstallerArgs = @($SpecFile, "-y")
    if ($Clean) { $PyInstallerArgs += "--clean" }

    & $Python -m PyInstaller @PyInstallerArgs
    if ($LASTEXITCODE -ne 0) { throw "PyInstaller failed (exit $LASTEXITCODE)" }
} finally {
    Pop-Location
}

# ---------------------------------------------------------------------------
# 3. Report
# ---------------------------------------------------------------------------
$OutputDir = Join-Path $Root "dist" "HytaleAssetStudio"
if (Test-Path $OutputDir) {
    $SizeMB = [math]::Round((Get-ChildItem $OutputDir -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB, 1)
    Write-Host ""
    Write-Host "==> Build successful!" -ForegroundColor Green
    Write-Host "    Output : $OutputDir" -ForegroundColor Green
    Write-Host "    Size   : ${SizeMB} MB" -ForegroundColor Green
    Write-Host ""
    Write-Host "    Run the app:" -ForegroundColor Cyan
    Write-Host "      $OutputDir\HytaleAssetStudio.exe" -ForegroundColor Cyan
} else {
    Write-Warning "Output directory not found after build — check PyInstaller output above."
}
