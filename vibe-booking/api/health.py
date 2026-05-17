import time
from fastapi import APIRouter
from prometheus_client import Counter, Gauge, Histogram, generate_latest, CONTENT_TYPE_LATEST
from fastapi.responses import Response

router = APIRouter()

_start_time = time.time()

active_connections = Gauge("active_connections", "Active WebSocket connections")
messages_processed = Counter("messages_processed_total", "Total messages processed")
tool_calls_total = Counter("tool_calls_total", "Total tool calls", ["tool_name"])
errors_total = Counter("errors_total", "Total errors", ["error_type"])
response_time = Histogram("response_time_seconds", "Agent response time")


@router.get("/health")
async def health() -> dict:
    return {"status": "ok", "uptime_seconds": int(time.time() - _start_time)}


@router.get("/metrics")
async def metrics() -> Response:
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)
