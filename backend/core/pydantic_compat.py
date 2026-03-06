from __future__ import annotations

from typing import Any


def model_dump(model: Any) -> dict:
    """Return a dict representation compatible with Pydantic v1 and v2."""

    fn = getattr(model, "model_dump", None)
    if callable(fn):
        return fn()

    fn = getattr(model, "dict", None)
    if callable(fn):
        return fn()

    raise TypeError(f"Object of type {type(model)!r} does not support model dump")
