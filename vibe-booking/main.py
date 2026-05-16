import sentry_sdk
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config.settings import settings
from utils.logging import configure_logging
from utils.redis import init_redis, close_redis
from api.middleware import LoggingMiddleware
from api.health import router as health_router
from api.websocket import websocket_endpoint


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    _validate_startup()
    await init_redis()
    if settings.sentry_dsn:
        sentry_sdk.init(dsn=settings.sentry_dsn)
    yield
    await close_redis()


def _validate_startup() -> None:
    if settings.model_backend == "nvidia" and not settings.nvidia_api_key:
        raise RuntimeError("NVIDIA_API_KEY is required when MODEL_BACKEND=nvidia")
    if settings.model_backend == "ollama" and not settings.ollama_base_url:
        raise RuntimeError("OLLAMA_BASE_URL is required when MODEL_BACKEND=ollama")


app = FastAPI(title="DerLg Vibe Booking AI Agent", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://derlg.com", "https://www.derlg.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(LoggingMiddleware)

app.include_router(health_router)
app.add_api_websocket_route("/ws/{session_id}", websocket_endpoint)
