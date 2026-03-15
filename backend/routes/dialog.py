from __future__ import annotations

"""Native OS file/folder dialog — local-only, never expose to the internet."""

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1", tags=["dialog"])


class DialogResponse(BaseModel):
    path: str | None  # None if user cancelled


def _open_dialog_webview(mode: str, filter_zip: bool) -> str | None:
    """Use pywebview's built-in dialog when a window is open.

    Required in standalone/frozen mode: pywebview owns the main thread so
    tkinter cannot create a window from a uvicorn worker thread.
    pywebview.window.create_file_dialog() marshals to the UI thread internally.
    """
    import webview  # noqa: PLC0415

    windows = webview.windows
    if not windows:
        return None

    win = windows[0]
    FileDialog = webview.FileDialog  # pywebview >= 4 enum (replaces legacy constants)
    if mode == "folder":
        result = win.create_file_dialog(FileDialog.FOLDER)
    elif filter_zip:
        result = win.create_file_dialog(
            FileDialog.OPEN,
            file_types=("ZIP files (*.zip)", "All files (*.*)")
        )
    else:
        result = win.create_file_dialog(FileDialog.OPEN)

    return result[0] if result else None


def _open_dialog_tkinter(mode: str, filter_zip: bool) -> str | None:
    """Fallback: Tk dialog for dev / run.ps1 mode (no pywebview window)."""
    import tkinter as tk  # noqa: PLC0415
    from tkinter import filedialog  # noqa: PLC0415

    root = tk.Tk()
    root.withdraw()
    root.attributes("-topmost", True)

    if mode == "folder":
        result = filedialog.askdirectory(title="Select folder", parent=root)
    elif filter_zip:
        result = filedialog.askopenfilename(
            title="Select file",
            filetypes=[("ZIP files", "*.zip"), ("All files", "*.*")],
            parent=root,
        )
    else:
        result = filedialog.askopenfilename(
            title="Select file",
            filetypes=[("All files", "*.*")],
            parent=root,
        )

    root.destroy()
    return result or None


def _open_dialog(mode: str, filter_zip: bool) -> str | None:
    """Open a native OS file/folder dialog and return the selected path."""
    # Prefer pywebview dialog when a window is active (standalone exe mode).
    # Falls back to tkinter in dev/run.ps1 mode where no pywebview window exists.
    try:
        path = _open_dialog_webview(mode, filter_zip)
        if path is not None or _has_webview_window():
            return path
    except Exception:
        pass

    return _open_dialog_tkinter(mode, filter_zip)


def _has_webview_window() -> bool:
    try:
        import webview  # noqa: PLC0415
        return bool(webview.windows)
    except Exception:
        return False


@router.get("/dialog/browse", response_model=DialogResponse)
def dialog_browse(mode: str = "folder", filter: str = "") -> DialogResponse:
    """
    Open a native OS file/folder dialog and return the selected absolute path.

    Query params:
    - mode: "folder" | "file"  (default: "folder")
    - filter: "zip" to restrict to .zip files
    """
    path = _open_dialog(mode=mode, filter_zip=(filter == "zip"))
    return DialogResponse(path=path)
