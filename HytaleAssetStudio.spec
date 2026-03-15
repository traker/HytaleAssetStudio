# -*- mode: python ; coding: utf-8 -*-
#
# PyInstaller spec for Hytale Asset Studio
#
# Build with:
#   pyinstaller HytaleAssetStudio.spec --clean
#
# The output is a self-contained directory:
#   dist/HytaleAssetStudio/HytaleAssetStudio.exe
#
# Prerequisites before running pyinstaller:
#   - frontend/dist/ must exist (run `npm run build` in frontend/ first)

import sys
from pathlib import Path

ROOT = Path(SPECPATH)

# ---------------------------------------------------------------------------
# Data files
# ---------------------------------------------------------------------------

datas = [
    # VERSION file — read by backend/core/config.py to expose the app version
    (str(ROOT / "VERSION"), "."),

    # React production build — served by FastAPI StaticFiles
    (str(ROOT / "frontend" / "dist"), "frontend/dist"),

    # pywebview: Edge/WinForms DLLs and JS assets (via the hook they provide)
    # The hook-webview.py in pywebview.__pyinstaller covers these automatically
    # when --additional-hooks-dir is set; listed here as explicit fallback.
    (str(ROOT / ".venv" / "Lib" / "site-packages" / "webview" / "lib"), "webview/lib"),
    (str(ROOT / ".venv" / "Lib" / "site-packages" / "webview" / "js"), "webview/js"),

    # clr_loader native DLLs (required by pythonnet / pywebview WinForms backend)
    (str(ROOT / ".venv" / "Lib" / "site-packages" / "clr_loader" / "ffi" / "dlls"), "clr_loader/ffi/dlls"),

    # pythonnet .NET runtime assemblies
    (str(ROOT / ".venv" / "Lib" / "site-packages" / "pythonnet" / "runtime"), "pythonnet/runtime"),
]

# ---------------------------------------------------------------------------
# Hidden imports (not auto-detected by PyInstaller static analysis)
# ---------------------------------------------------------------------------

hidden_imports = [
    # uvicorn entry points loaded dynamically
    "uvicorn.logging",
    "uvicorn.loops",
    "uvicorn.loops.auto",
    "uvicorn.loops.asyncio",
    "uvicorn.protocols",
    "uvicorn.protocols.http",
    "uvicorn.protocols.http.auto",
    "uvicorn.protocols.http.h11_impl",
    "uvicorn.protocols.http.httptools_impl",
    "uvicorn.protocols.websockets",
    "uvicorn.protocols.websockets.auto",
    "uvicorn.protocols.websockets.websockets_impl",
    "uvicorn.lifespan",
    "uvicorn.lifespan.on",
    "uvicorn.lifespan.off",
    # anyio asyncio backend
    "anyio._backends._asyncio",
    # pywebview WinForms/EdgeChromium platform
    "webview.platforms.winforms",
    "webview.platforms.edgechromium",
    # pythonnet / clr
    "clr",
    "clr_loader",
    "pythonnet",
    # bottle (embedded HTTP server used by pywebview)
    "bottle",
]

# ---------------------------------------------------------------------------
# Excludes (not needed at runtime, reduces size)
# ---------------------------------------------------------------------------

excludes = [
    "pytest",
    "pytest_cov",
    "coverage",
    "_pytest",
    "pygments",
    "tkinter",
]

# ---------------------------------------------------------------------------
# PyInstaller analysis
# ---------------------------------------------------------------------------

a = Analysis(
    [str(ROOT / "app.py")],
    pathex=[str(ROOT)],
    binaries=[],
    datas=datas,
    hiddenimports=hidden_imports,
    hookspath=[
        # Use the hook provided by pywebview itself
        str(ROOT / ".venv" / "Lib" / "site-packages" / "webview" / "__pyinstaller"),
    ],
    hooksconfig={},
    runtime_hooks=[],
    excludes=excludes,
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="HytaleAssetStudio",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,        # UPX off — causes false-positive AV alerts on some machines
    console=False,    # No console window for end users
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name="HytaleAssetStudio",
)
