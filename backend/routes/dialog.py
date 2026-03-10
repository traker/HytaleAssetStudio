from __future__ import annotations

"""Native OS file/folder dialog — local-only, never expose to the internet."""

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1", tags=["dialog"])


class DialogResponse(BaseModel):
    path: str | None  # None if user cancelled


def _open_dialog(mode: str, filter_zip: bool) -> str | None:
    """Open a native Tk dialog in its own hidden root window."""
    import tkinter as tk
    from tkinter import filedialog

    root = tk.Tk()
    root.withdraw()          # hide the empty Tk window
    root.attributes("-topmost", True)   # dialog appears on top

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
