"""Unit tests for agent.models.factory and api.middleware (Task 18.1.12)."""
import time
from unittest.mock import patch, MagicMock, AsyncMock
import pytest
from fastapi import FastAPI
from starlette.testclient import TestClient

from agent.models.factory import get_model_client, reset_clients
from agent.session.state import ConversationState
from api.middleware import LoggingMiddleware


def test_factory_uses_nvidia_for_khmer_session():
    reset_clients()
    session = ConversationState(session_id="s", user_id="u", preferred_language="KH")
    with patch("agent.models.factory._nvidia_client", None), \
         patch("agent.models.nvidia.NvidiaClient") as mock_nvidia:
        mock_nvidia.return_value = MagicMock()
        client = get_model_client(session)
    reset_clients()
    assert isinstance(client, MagicMock)


def test_factory_uses_ollama_when_use_ollama_true():
    reset_clients()
    session = ConversationState(session_id="s", user_id="u", preferred_language="EN")
    with patch("agent.models.factory.settings") as mock_settings, \
         patch("agent.models.ollama.OllamaClient") as mock_ollama:
        mock_settings.use_ollama = True
        mock_ollama.return_value = MagicMock()
        client = get_model_client(session)
    reset_clients()
    assert isinstance(client, MagicMock)


def test_factory_defaults_to_nvidia_when_no_session():
    reset_clients()
    with patch("agent.models.factory.settings") as mock_settings, \
         patch("agent.models.nvidia.NvidiaClient") as mock_nvidia:
        mock_settings.use_ollama = False
        mock_nvidia.return_value = MagicMock()
        client = get_model_client(None)
    reset_clients()
    assert isinstance(client, MagicMock)


def test_logging_middleware_logs_request():
    app = FastAPI()
    app.add_middleware(LoggingMiddleware)

    @app.get("/healthz")
    def healthz():
        return {"ok": True}

    with patch("api.middleware.logger") as mock_logger:
        with TestClient(app) as client:
            r = client.get("/healthz")
        assert r.status_code == 200
        mock_logger.info.assert_called()
        kwargs = mock_logger.info.call_args.kwargs
        assert kwargs["method"] == "GET"
        assert kwargs["path"] == "/healthz"
        assert kwargs["status"] == 200
        assert "duration_ms" in kwargs
