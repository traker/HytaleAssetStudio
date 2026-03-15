"""
Hytale Asset Studio — standalone entry point.

Starts the FastAPI backend in a background thread, waits for it to be ready,
then opens a native pywebview window on the local URL.
Closing the window stops the server and exits cleanly.

Usage:
    python app.py [--port PORT] [--perf-audit]
"""
from __future__ import annotations

import argparse
import logging
import signal
import sys
import threading
import time

import httpx
import uvicorn
import webview

# Import the FastAPI app object directly — avoids uvicorn's import_from_string
# which can silently fail in a PyInstaller frozen bundle.
from backend.app.main import app as _fastapi_app  # noqa: E402

# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Hytale Asset Studio")
    p.add_argument("--port", type=int, default=8000, help="Backend port (default: 8000)")
    p.add_argument("--perf-audit", action="store_true", help="Enable backend performance audit headers")
    return p.parse_args()


# ---------------------------------------------------------------------------
# Backend lifecycle
# ---------------------------------------------------------------------------

class _ServerThread(threading.Thread):
    """Runs uvicorn in a daemon thread. Stopped via server.should_exit."""

    def __init__(self, host: str, port: int) -> None:
        super().__init__(daemon=True, name="uvicorn")
        self.host = host
        self.port = port
        self._server: uvicorn.Server | None = None
        self.error: BaseException | None = None

    def run(self) -> None:
        try:
            config = uvicorn.Config(
                _fastapi_app,  # Pass object directly — string form fails in frozen bundles
                host=self.host,
                port=self.port,
                log_level="warning",
                # No reload in standalone mode.
                reload=False,
                # Single worker — in-memory state is not shared across processes.
                workers=1,
            )
            self._server = uvicorn.Server(config)
            self._server.run()
        except Exception as exc:
            self.error = exc
            raise

    def stop(self) -> None:
        if self._server is not None:
            self._server.should_exit = True


def _wait_for_backend(url: str, timeout: float = 15.0, interval: float = 0.15) -> bool:
    """Poll GET url until 200 or timeout. Returns True if ready."""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            r = httpx.get(url, timeout=2.0)
            if r.status_code == 200:
                return True
        except Exception:
            pass
        time.sleep(interval)
    return False


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    args = _parse_args()

    if args.perf_audit:
        import os
        os.environ["HAS_PERF_AUDIT"] = "1"

    host = "127.0.0.1"
    port = args.port
    base_url = f"http://{host}:{port}"
    health_url = f"{base_url}/api/v1/health"

    logging.basicConfig(level=logging.WARNING)
    logger = logging.getLogger("has.standalone")

    # --- Start backend ---
    server_thread = _ServerThread(host=host, port=port)
    server_thread.start()

    logger.info("Waiting for backend on %s …", health_url)
    if not _wait_for_backend(health_url):
        err_detail = repr(server_thread.error) if server_thread.error else "health check timeout (no exception captured)"
        logger.error("Backend did not become ready: %s", err_detail)
        # Write a startup-failure log next to the exe for user diagnostics
        import os, traceback
        _log_dir = os.path.dirname(sys.executable) if getattr(sys, "frozen", False) else "."
        _log_path = os.path.join(_log_dir, "HytaleAssetStudio.log")
        with open(_log_path, "w", encoding="utf-8") as _f:
            _f.write(f"Backend startup failed: {err_detail}\n")
            if server_thread.error is not None:
                traceback.print_exception(type(server_thread.error), server_thread.error,
                                          server_thread.error.__traceback__, file=_f)
        server_thread.stop()
        sys.exit(1)

    logger.info("Backend ready.")

    # --- Open native window ---
    # pywebview blocks here until the window is closed.
    window = webview.create_window(
        title="Hytale Asset Studio",
        url=base_url,
        width=1400,
        height=860,
        min_size=(900, 600),
    )

    def _on_closed():
        logger.info("Window closed, stopping backend …")
        server_thread.stop()

    window.events.closed += _on_closed

    # Suppress Ctrl+C noise — closing the window is the intended exit path.
    signal.signal(signal.SIGINT, lambda *_: server_thread.stop())

    webview.start(debug=False)

    # Wait for uvicorn thread to finish after window close.
    server_thread.join(timeout=5.0)


if __name__ == "__main__":
    # In a frozen bundle (console=False) all exceptions are swallowed silently.
    # Write a crash log next to the exe so the user (and devs) can diagnose.
    import os, traceback
    _log_dir = os.path.dirname(sys.executable) if getattr(sys, "frozen", False) else "."
    _log_path = os.path.join(_log_dir, "HytaleAssetStudio.log")
    try:
        main()
    except SystemExit:
        raise  # sys.exit() — already logged by _wait_for_backend handler above
    except Exception:
        with open(_log_path, "a", encoding="utf-8") as _f:
            traceback.print_exc(file=_f)
        raise
