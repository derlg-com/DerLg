import sentry_sdk
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config.settings import settings
from utils.logging import configure_logging, logger
from utils.redis import init_redis, close_redis
from api.middleware import LoggingMiddleware
from api.health import router as health_router
from api.websocket import websocket_endpoint


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    _validate_startup()
    # P6a: log the resolved model + provider so a stale .env (e.g. a shell-
    # exported NVIDIA_API_KEY or wrong MODEL_LLM) is visible at boot, not after
    # the first 403.
    backend_name = "ollama" if settings.use_ollama else ("rayucode" if "rayucode" in settings.effective_base_url else "gateway")
    logger.info(
        "model_configured",
        model=settings.effective_model,
        backend=backend_name,
        base_url=settings.effective_base_url,
        timeout_s=settings.model_timeout_s,
    )
    await init_redis()
    if settings.sentry_dsn:
        sentry_sdk.init(dsn=settings.sentry_dsn)
    yield
    await close_redis()
    # Close singleton HTTP clients
    from agent.models.factory import _gateway_client, _nvidia_client, _ollama_client
    from agent.backend_client import get_backend_client
    if _gateway_client is not None:
        await _gateway_client.aclose()
    elif _nvidia_client is not None:
        await _nvidia_client.aclose()
    if _ollama_client is not None:
        await _ollama_client.aclose()
    await get_backend_client().aclose()


def _validate_startup() -> None:
    if not settings.use_ollama and not settings.effective_api_key:
        raise RuntimeError("LLM API key is required (set LLM_API_KEY in .env)")
    if settings.use_ollama and not settings.ollama_base_url:
        raise RuntimeError("OLLAMA_BASE_URL is required when USE_OLLAMA=true")


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
app.add_api_websocket_route("/ws/chat", websocket_endpoint)
