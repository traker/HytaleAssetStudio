<#
.SYNOPSIS
    Build and publish a new release of Hytale Asset Studio to GitHub.

.DESCRIPTION
    1. Reads the current version from VERSION.
    2. Optionally bumps the version (major / minor / patch).
    3. Builds the release zip via build-release.ps1.
    4. Creates a git tag and pushes it.
    5. Creates a GitHub Release with `gh` and attaches the zip.

    Requires: gh (GitHub CLI) authenticated, .venv, npm.

.PARAMETER Bump
    Version component to bump before building: major | minor | patch | none.
    Default: ask interactively.

.PARAMETER SkipFrontendBuild
    Passed through to build-release.ps1.

.PARAMETER Clean
    Passed through to build-release.ps1 (PyInstaller --clean).

.EXAMPLE
    .\scripts\publish-release.ps1
    .\scripts\publish-release.ps1 -Bump patch
    .\scripts\publish-release.ps1 -Bump none -SkipFrontendBuild
#>
param(
    [ValidateSet("major", "minor", "patch", "none", "")]
    [string]$Bump = "",
    [switch]$SkipFrontendBuild,
    [switch]$Clean
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
function Confirm-Step([string]$Message) {
    Write-Host ""
    $answer = Read-Host "$Message [y/N]"
    if ($answer -notmatch '^[Yy]$') {
        Write-Host "Aborted." -ForegroundColor Yellow
        exit 0
    }
}

# ---------------------------------------------------------------------------
# 0. Check prerequisites
# ---------------------------------------------------------------------------
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Error "GitHub CLI (gh) not found. Install it from https://cli.github.com/ and authenticate with 'gh auth login'."
    exit 1
}

$VersionFile = Join-Path $Root "VERSION"
if (-not (Test-Path $VersionFile)) {
    Write-Error "VERSION file not found at $Root"
    exit 1
}

# ---------------------------------------------------------------------------
# 1. Read and optionally bump version
# ---------------------------------------------------------------------------
$CurrentVersion = (Get-Content $VersionFile -Raw).Trim()
Write-Host "==> Current version: $CurrentVersion" -ForegroundColor Cyan

# Semver parts
if ($CurrentVersion -notmatch '^(\d+)\.(\d+)\.(\d+)$') {
    Write-Error "VERSION '$CurrentVersion' is not in semver format (X.Y.Z)."
    exit 1
}
[int]$Major = $Matches[1]
[int]$Minor = $Matches[2]
[int]$Patch = $Matches[3]

# Interactive bump selection if not provided via parameter
if ($Bump -eq "") {
    Write-Host ""
    Write-Host "  [1] patch  -> $Major.$Minor.$($Patch + 1)"
    Write-Host "  [2] minor  -> $Major.$($Minor + 1).0"
    Write-Host "  [3] major  -> $($Major + 1).0.0"
    Write-Host "  [4] none   -> keep $CurrentVersion"
    Write-Host ""
    $choice = Read-Host "Choose version bump (1-4)"
    switch ($choice) {
        "1" { $Bump = "patch" }
        "2" { $Bump = "minor" }
        "3" { $Bump = "major" }
        "4" { $Bump = "none" }
        default {
            Write-Host "Invalid choice. Aborted." -ForegroundColor Yellow
            exit 0
        }
    }
}

switch ($Bump) {
    "patch" { $NewVersion = "$Major.$Minor.$($Patch + 1)" }
    "minor" { $NewVersion = "$Major.$($Minor + 1).0" }
    "major" { $NewVersion = "$($Major + 1).0.0" }
    "none"  { $NewVersion = $CurrentVersion }
}

Write-Host "==> Release version will be: $NewVersion" -ForegroundColor Cyan

# ---------------------------------------------------------------------------
# 2. Prompt release notes
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "Enter release notes (one paragraph, empty line to finish):" -ForegroundColor Cyan
$lines = @()
do {
    $line = Read-Host "  "
    if ($line -ne "") { $lines += $line }
} while ($line -ne "")

if ($lines.Count -eq 0) {
    $ReleaseNotes = "Release v$NewVersion"
} else {
    $ReleaseNotes = $lines -join "`n"
}

# ---------------------------------------------------------------------------
# 3. Summary + global confirmation
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " Release summary" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Version      : $NewVersion"
Write-Host "  Tag          : v$NewVersion"
Write-Host "  Notes        : $ReleaseNotes"
Write-Host "  Bump         : $Bump"
Write-Host "  Frontend     : $(if ($SkipFrontendBuild) { 'skipped' } else { 'will build' })"
Write-Host "  PyInstaller  : $(if ($Clean) { '--clean' } else { 'normal' })"
Write-Host "==========================================" -ForegroundColor Cyan

Confirm-Step "Proceed with this release?"

# ---------------------------------------------------------------------------
# 4. Bump VERSION file + commit if needed
# ---------------------------------------------------------------------------
if ($Bump -ne "none") {
    Write-Host ""
    Write-Host "==> Bumping VERSION to $NewVersion ..." -ForegroundColor Cyan
    Set-Content -Path $VersionFile -Value $NewVersion -NoNewline
    git -C $Root add VERSION
    git -C $Root commit -m "chore(release): bump version to $NewVersion"
}

# ---------------------------------------------------------------------------
# 5. Build
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "==> Starting build..." -ForegroundColor Cyan

$BuildScript = Join-Path $PSScriptRoot "build-release.ps1"
$buildArgs = @()
if ($SkipFrontendBuild) { $buildArgs += "-SkipFrontendBuild" }
if ($Clean)             { $buildArgs += "-Clean" }

& $BuildScript @buildArgs
if ($LASTEXITCODE -ne 0) {
    Write-Error "Build failed. Release aborted."
    exit 1
}

# ---------------------------------------------------------------------------
# 6. Verify zip exists
# ---------------------------------------------------------------------------
$ZipName = "HytaleAssetStudio-v${NewVersion}-win64.zip"
$ZipPath = Join-Path (Join-Path $Root "dist") $ZipName
if (-not (Test-Path $ZipPath)) {
    Write-Error "Expected zip not found: $ZipPath"
    exit 1
}
$ZipMB = [math]::Round((Get-Item $ZipPath).Length / 1MB, 1)
Write-Host ""
Write-Host "==> Zip ready: $ZipPath (${ZipMB} MB)" -ForegroundColor Green

# ---------------------------------------------------------------------------
# 7. Git tag + push
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "==> Creating git tag v$NewVersion ..." -ForegroundColor Cyan
git -C $Root tag -a "v$NewVersion" -m "Release v$NewVersion"

Confirm-Step "Push commit(s) and tag to origin/main?"
git -C $Root push origin main --tags
Write-Host "==> Pushed." -ForegroundColor Green

# ---------------------------------------------------------------------------
# 8. GitHub Release
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "==> Creating GitHub Release v$NewVersion ..." -ForegroundColor Cyan

gh release create "v$NewVersion" $ZipPath `
    --repo "traker/HytaleAssetStudio" `
    --title "v$NewVersion" `
    --notes $ReleaseNotes `
    --latest

Write-Host ""
Write-Host "==> Release v$NewVersion published!" -ForegroundColor Green
Write-Host "    https://github.com/traker/HytaleAssetStudio/releases/tag/v$NewVersion" -ForegroundColor Cyan
