from __future__ import annotations

import contextvars
import logging
import time
import uuid
from contextlib import contextmanager
from dataclasses import dataclass, field


logger = logging.getLogger("uvicorn.error")


@dataclass
class PerfMetric:
    total_ms: float = 0.0
    count: int = 0


@dataclass
class RequestPerfState:
    request_id: str
    method: str
    path: str
    total_ms: float = 0.0
    metrics: dict[str, PerfMetric] = field(default_factory=dict)


_REQUEST_PERF_STATE: contextvars.ContextVar[RequestPerfState | None] = contextvars.ContextVar(
    "has_request_perf_state",
    default=None,
)


def has_request_perf() -> bool:
    return _REQUEST_PERF_STATE.get() is not None


def start_request_perf(method: str, path: str) -> contextvars.Token:
    state = RequestPerfState(
        request_id=uuid.uuid4().hex[:8],
        method=method,
        path=path,
    )
    return _REQUEST_PERF_STATE.set(state)


def finish_request_perf(token: contextvars.Token, total_ms: float) -> RequestPerfState | None:
    state = _REQUEST_PERF_STATE.get()
    if state is not None:
        state.total_ms = total_ms
    _REQUEST_PERF_STATE.reset(token)
    return state


def record_duration(name: str, duration_ms: float) -> None:
    state = _REQUEST_PERF_STATE.get()
    if state is None:
        return
    metric = state.metrics.get(name)
    if metric is None:
        metric = PerfMetric()
        state.metrics[name] = metric
    metric.total_ms += duration_ms
    metric.count += 1


@contextmanager
def timed(name: str):
    if not has_request_perf():
        yield
        return

    start = time.perf_counter()
    try:
        yield
    finally:
        record_duration(name, (time.perf_counter() - start) * 1000.0)


def build_server_timing_header(state: RequestPerfState, max_metrics: int = 8) -> str:
    metrics = sorted(state.metrics.items(), key=lambda item: item[1].total_ms, reverse=True)
    parts = [f'total;dur={state.total_ms:.2f}']
    for name, metric in metrics[:max_metrics]:
        parts.append(f'{name};dur={metric.total_ms:.2f};desc="count={metric.count}"')
    return ", ".join(parts)


def log_request_perf(state: RequestPerfState, status_code: int) -> None:
    metrics = ", ".join(
        f"{name}={metric.total_ms:.2f}ms/{metric.count}"
        for name, metric in sorted(state.metrics.items(), key=lambda item: item[1].total_ms, reverse=True)
    )
    logger.info(
        "perf_audit %s %s status=%s total=%.2fms id=%s metrics=[%s]",
        state.method,
        state.path,
        status_code,
        state.total_ms,
        state.request_id,
        metrics,
    )