import os
import pytest
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env.test"), override=True)


@pytest.fixture
def anyio_backend():
    return "asyncio"
