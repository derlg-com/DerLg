# Design Document: DerLg.com AI Agent (Agentic LLM Chatbot)

## Overview

The DerLg.com AI Agent is a stateful, purpose-built conversational booking concierge implemented as a Python FastAPI microservice. It orchestrates a 7-stage booking journey for Cambodia travel using natural language conversation, powered by Claude Sonnet 4.5 (with swappable architecture for Ollama support).

### Core Design Principles

1. **State-Driven Architecture**: Every conversation progresses through well-defined states (DISCOVERY → SUGGESTION → EXPLORATION → CUSTOMIZATION → BOOKING → PAYMENT → POST_BOOKING)
2. **Tool-First Data Access**: The agent never invents facts—all data (prices, availability, hotel names) comes from backend tool calls
3. **Swappable LLM Backend**: Abstract ModelClient interface allows switching between Anthropic API and local Ollama models
4. **Real-Time Communication**: WebSocket connections provide instant bidirectional messaging with typing indicators and payment notifications
5. **Persistent Sessions**: Redis-backed state persistence enables conversation resumption across disconnections
6. **Multi-Language Support**: Native support for English, Khmer, and Simplified Chinese with language-specific prompting

### Technology Stack

- **Framework**: FastAPI (async Python web framework)
- **State Machine**: LangGraph (state graph orchestration)
- **LLM Provider**: Anthropic Claude Sonnet 4.5 / Ollama (swappable)
- **State Persistence**: Redis (with RedisSaver for LangGraph checkpointing)
- **Communication**: WebSocket (real-time bidirectional)
- **HTTP Client**: httpx (async HTTP for backend tool calls)
- **Validation**: Pydantic (data models and settings)
- **Logging**: structlog (structured JSON logging)
- **Monitoring**: Prometheus metrics + Sentry error tracking
- **Deployment**: Docker + Railway

### System Context

```mermaid
graph TB
    User[User Browser]
    Frontend[Next.js Frontend]
    Agent[AI Agent Service<br/>FastAPI + LangGraph]
    Backend[NestJS Backend<br/>Supabase]
    Redis[(Redis<br/>Session Store)]
    PostgreSQL[(PostgreSQL<br/>Database)]
    Anthropic[Anthropic API<br/>Claude Sonnet 4.5]
    Ollama[Ollama<br/>Local Models]
    
    User -->|HTTPS| Frontend
    Frontend <-->|WebSocket| Agent
    Agent -->|HTTP Tools| Backend
    Agent <-->|State Persistence| Redis
    Agent -->|LLM Calls| Anthropic
    Agent -.->|Alternative| Ollama
    Backend -->|Pub/Sub Events| Redis
    Backend -->|Database| PostgreSQL
    
    style Agent fill:#4A90E2
    style Redis fill:#DC382D
    style PostgreSQL fill:#336791
    style Anthropic fill:#D4A574
    style Ollama fill:#E8E8E8
```

## Architecture

### High-Level Architecture

The AI Agent follows a layered architecture with clear separation of concerns:

```mermaid
graph TB
    subgraph "API Layer"
        WS[WebSocket Handler]
        Health[Health Check]
        Metrics[Metrics Endpoint]
    end
    
    subgraph "Agent Core"
        Loop[Agent Execution Loop]
        Graph[LangGraph State Machine]
        Prompt[System Prompt Builder]
    end
    
    subgraph "Model Layer"
        Client[ModelClient Interface]
        Anthropic[AnthropicClient]
        Ollama[OllamaClient]
    end
    
    subgraph "Tool Layer"
        Schemas[Tool Schemas]
        Executor[Tool Executor]
        Handlers[Tool Handlers]
    end
    
    subgraph "State Layer"
        Session[Session Manager]
        State[ConversationState]
        Redis[(Redis)]
    end
    
    subgraph "Formatting Layer"
        Formatter[Response Formatter]
        Messages[Message Types]
    end
    
    WS --> Loop
    Loop --> Graph
    Graph --> Prompt
    Graph --> Client
    Client --> Anthropic
    Client --> Ollama
    Graph --> Executor
    Executor --> Handlers
    Handlers --> Schemas
    Loop --> Session
    Session --> State
    Session --> Redis
    Loop --> Formatter
    Formatter --> Messages
    
    style "Agent Core" fill:#E3F2FD
    style "Model Layer" fill:#FFF3E0
    style "Tool Layer" fill:#F3E5F5
    style "State Layer" fill:#FFEBEE
    style "Formatting Layer" fill:#E8F5E9
```

### Module Organization

```
ai-agent/
├── agent/
│   ├── __init__.py
│   ├── core.py              # Agent execution loop
│   ├── graph.py             # LangGraph state machine definition
│   ├── models/
│   │   ├── __init__.py
│   │   ├── client.py        # ModelClient interface
│   │   ├── anthropic.py     # AnthropicClient implementation
│   │   └── ollama.py        # OllamaClient implementation
│   ├── tools/
│   │   ├── __init__.py
│   │   ├── schemas.py       # Tool schema definitions
│   │   ├── executor.py      # Tool execution logic
│   │   └── handlers/
│   │       ├── __init__.py
│   │       ├── trips.py     # Trip-related tool handlers
│   │       ├── booking.py   # Booking tool handlers
│   │       ├── payment.py   # Payment tool handlers
│   │       └── info.py      # Information tool handlers
│   ├── prompts/
│   │   ├── __init__.py
│   │   ├── builder.py       # System prompt builder
│   │   └── templates.py     # Prompt templates
│   ├── session/
│   │   ├── __init__.py
│   │   ├── manager.py       # Session persistence logic
│   │   └── state.py         # ConversationState model
│   └── formatters/
│       ├── __init__.py
│       ├── formatter.py     # Response formatting logic
│       └── message_types.py # Pydantic message models
├── api/
│   ├── __init__.py
│   ├── websocket.py         # WebSocket endpoint handler
│   ├── health.py            # Health check endpoint
│   └── middleware.py        # CORS, logging middleware
├── config/
│   ├── __init__.py
│   └── settings.py          # Pydantic settings
├── utils/
│   ├── __init__.py
│   ├── logging.py           # Structured logging setup
│   └── redis.py             # Redis connection utilities
├── tests/
│   ├── __init__.py
│   ├── unit/                # Unit tests
│   ├── integration/         # Integration tests
│   └── property/            # Property-based tests
├── main.py                  # FastAPI application entry point
├── requirements.txt         # Python dependencies
├── Dockerfile               # Production Dockerfile
├── Dockerfile.dev           # Development Dockerfile
├── docker-compose.yml       # Multi-service orchestration
├── .dockerignore            # Docker build exclusions
├── .env.example             # Environment template
├── .env.development         # Development environment (gitignored)
├── railway.json             # Railway deployment config
└── README.md                # Project documentation
```

### Data Flow

```mermaid
sequenceDiagram
    participant User
    participant WS as WebSocket Handler
    participant Agent as Agent Loop
    participant Graph as LangGraph
    participant Model as ModelClient
    participant Tools as Tool Executor
    participant Backend as NestJS Backend
    participant Redis
    
    User->>WS: Connect + Auth
    WS->>Redis: Load/Create Session
    Redis-->>WS: ConversationState
    WS-->>User: Welcome Message
    
    User->>WS: User Message
    WS->>Agent: run_agent(session, text)
    Agent->>Redis: Save message
    Agent->>Graph: Execute state machine
    
    Graph->>Model: create_message(system, messages, tools)
    Model-->>Graph: ModelResponse (tool_use)
    
    Graph->>Tools: execute_tools_parallel(tool_calls)
    Tools->>Backend: HTTP POST /v1/ai-tools/*
    Backend-->>Tools: Tool results
    Tools-->>Graph: tool_result messages
    
    Graph->>Model: create_message (with tool results)
    Model-->>Graph: ModelResponse (end_turn)
    
    Graph-->>Agent: Final response
    Agent->>Agent: format_response()
    Agent->>Redis: Save session
    Agent-->>WS: Formatted message
    WS-->>User: Display response
```

## Docker Development Environment

### Overview

The development environment uses Docker Compose to orchestrate all services locally, providing a consistent development experience across all team members. All five services run in containers with hot-reload capabilities for rapid development.

### Docker Compose Architecture

```mermaid
graph TB
    subgraph "Docker Network: derlg-network"
        Frontend[Frontend Container<br/>Next.js:14<br/>Port 3000]
        Backend[Backend Container<br/>NestJS<br/>Port 3001]
        Agent[AI Agent Container<br/>FastAPI<br/>Port 8000]
        Redis[Redis Container<br/>Port 6379]
        PostgreSQL[PostgreSQL Container<br/>Port 5432]
    end
    
    Frontend -->|HTTP| Backend
    Frontend -->|WebSocket| Agent
    Agent -->|HTTP| Backend
    Agent -->|State| Redis
    Backend -->|Database| PostgreSQL
    Backend -->|Pub/Sub| Redis
    
    style Frontend fill:#61DAFB
    style Backend fill:#E0234E
    style Agent fill:#4A90E2
    style Redis fill:#DC382D
    style PostgreSQL fill:#336791
```

### Service Definitions

#### 1. PostgreSQL Database

**Container**: `postgres:15-alpine`
**Purpose**: Primary database for backend application data

```yaml
postgres:
  image: postgres:15-alpine
  container_name: derlg-postgres
  environment:
    POSTGRES_DB: derlg_dev
    POSTGRES_USER: derlg_user
    POSTGRES_PASSWORD: derlg_dev_password
  ports:
    - "5432:5432"
  volumes:
    - postgres_data:/var/lib/postgresql/data
    - ./backend/prisma/migrations:/docker-entrypoint-initdb.d
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U derlg_user -d derlg_dev"]
    interval: 10s
    timeout: 5s
    retries: 5
  networks:
    - derlg-network
```

**Key Features**:
- Persistent volume for data retention across restarts
- Health check ensures database is ready before dependent services start
- Migration scripts auto-run on first startup
- Alpine image for smaller footprint

#### 2. Redis Cache & Session Store

**Container**: `redis:7-alpine`
**Purpose**: Session persistence, pub/sub for payment events, caching

```yaml
redis:
  image: redis:7-alpine
  container_name: derlg-redis
  command: redis-server --appendonly yes --requirepass derlg_redis_password
  ports:
    - "6379:6379"
  volumes:
    - redis_data:/data
  healthcheck:
    test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
    interval: 10s
    timeout: 5s
    retries: 5
  networks:
    - derlg-network
```

**Key Features**:
- AOF (Append-Only File) persistence enabled
- Password protection for security
- Persistent volume for session data
- Health check validates Redis is accepting connections

#### 3. Backend Service (NestJS)

**Container**: Custom Dockerfile
**Purpose**: REST API, Supabase integration, business logic

```yaml
backend:
  build:
    context: ./backend
    dockerfile: Dockerfile.dev
  container_name: derlg-backend
  environment:
    NODE_ENV: development
    DATABASE_URL: postgresql://derlg_user:derlg_dev_password@postgres:5432/derlg_dev
    REDIS_URL: redis://:derlg_redis_password@redis:6379/0
    SUPABASE_URL: ${SUPABASE_URL}
    SUPABASE_SERVICE_KEY: ${SUPABASE_SERVICE_KEY}
    AI_SERVICE_KEY: ${AI_SERVICE_KEY}
    PORT: 3001
  ports:
    - "3001:3001"
  volumes:
    - ./backend:/app
    - /app/node_modules
    - /app/dist
  depends_on:
    postgres:
      condition: service_healthy
    redis:
      condition: service_healthy
  command: npm run start:dev
  networks:
    - derlg-network
```

**Dockerfile.dev**:
```dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Expose port
EXPOSE 3001

# Development command (overridden by docker-compose)
CMD ["npm", "run", "start:dev"]
```

**Key Features**:
- Volume mount for hot-reload (source code changes reflect immediately)
- Node modules cached in anonymous volume for performance
- Waits for PostgreSQL and Redis health checks
- Prisma client auto-generated on build

#### 4. Frontend Service (Next.js)

**Container**: Custom Dockerfile
**Purpose**: User interface, WebSocket client

```yaml
frontend:
  build:
    context: ./frontend
    dockerfile: Dockerfile.dev
  container_name: derlg-frontend
  environment:
    NODE_ENV: development
    NEXT_PUBLIC_BACKEND_URL: http://localhost:3001
    NEXT_PUBLIC_WS_URL: ws://localhost:8000
    NEXT_PUBLIC_SUPABASE_URL: ${SUPABASE_URL}
    NEXT_PUBLIC_SUPABASE_ANON_KEY: ${SUPABASE_ANON_KEY}
  ports:
    - "3000:3000"
  volumes:
    - ./frontend:/app
    - /app/node_modules
    - /app/.next
  depends_on:
    - backend
    - ai-agent
  command: npm run dev
  networks:
    - derlg-network
```

**Dockerfile.dev**:
```dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Development command (overridden by docker-compose)
CMD ["npm", "run", "dev"]
```

**Key Features**:
- Volume mount for hot-reload with Fast Refresh
- Next.js cache directory excluded from volume for performance
- Environment variables for service URLs
- Depends on backend and AI agent services

#### 5. AI Agent Service (FastAPI)

**Container**: Custom Dockerfile
**Purpose**: Conversational AI, LangGraph orchestration

```yaml
ai-agent:
  build:
    context: ./ai-agent
    dockerfile: Dockerfile.dev
  container_name: derlg-ai-agent
  environment:
    MODEL_BACKEND: anthropic
    ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
    BACKEND_URL: http://backend:3001
    AI_SERVICE_KEY: ${AI_SERVICE_KEY}
    REDIS_URL: redis://:derlg_redis_password@redis:6379/0
    HOST: 0.0.0.0
    PORT: 8000
    LOG_LEVEL: debug
  ports:
    - "8000:8000"
  volumes:
    - ./ai-agent:/app
    - /app/__pycache__
  depends_on:
    redis:
      condition: service_healthy
    backend:
      condition: service_started
  command: uvicorn main:app --host 0.0.0.0 --port 8000 --reload
  networks:
    - derlg-network
```

**Dockerfile.dev**:
```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

# Expose port
EXPOSE 8000

# Development command (overridden by docker-compose)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```

**Key Features**:
- Volume mount for hot-reload with uvicorn --reload
- Python cache excluded from volume
- Waits for Redis health check
- Debug logging enabled for development

### Complete docker-compose.yml

```yaml
version: '3.9'

services:
  # Database
  postgres:
    image: postgres:15-alpine
    container_name: derlg-postgres
    environment:
      POSTGRES_DB: derlg_dev
      POSTGRES_USER: derlg_user
      POSTGRES_PASSWORD: derlg_dev_password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backend/prisma/migrations:/docker-entrypoint-initdb.d
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U derlg_user -d derlg_dev"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - derlg-network

  # Cache & Session Store
  redis:
    image: redis:7-alpine
    container_name: derlg-redis
    command: redis-server --appendonly yes --requirepass derlg_redis_password
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - derlg-network

  # Backend API
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.dev
    container_name: derlg-backend
    environment:
      NODE_ENV: development
      DATABASE_URL: postgresql://derlg_user:derlg_dev_password@postgres:5432/derlg_dev
      REDIS_URL: redis://:derlg_redis_password@redis:6379/0
      SUPABASE_URL: ${SUPABASE_URL}
      SUPABASE_SERVICE_KEY: ${SUPABASE_SERVICE_KEY}
      AI_SERVICE_KEY: ${AI_SERVICE_KEY}
      PORT: 3001
    ports:
      - "3001:3001"
    volumes:
      - ./backend:/app
      - /app/node_modules
      - /app/dist
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    command: npm run start:dev
    networks:
      - derlg-network

  # AI Agent Service
  ai-agent:
    build:
      context: ./ai-agent
      dockerfile: Dockerfile.dev
    container_name: derlg-ai-agent
    environment:
      MODEL_BACKEND: anthropic
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      BACKEND_URL: http://backend:3001
      AI_SERVICE_KEY: ${AI_SERVICE_KEY}
      REDIS_URL: redis://:derlg_redis_password@redis:6379/0
      HOST: 0.0.0.0
      PORT: 8000
      LOG_LEVEL: debug
    ports:
      - "8000:8000"
    volumes:
      - ./ai-agent:/app
      - /app/__pycache__
    depends_on:
      redis:
        condition: service_healthy
      backend:
        condition: service_started
    command: uvicorn main:app --host 0.0.0.0 --port 8000 --reload
    networks:
      - derlg-network

  # Frontend
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.dev
    container_name: derlg-frontend
    environment:
      NODE_ENV: development
      NEXT_PUBLIC_BACKEND_URL: http://localhost:3001
      NEXT_PUBLIC_WS_URL: ws://localhost:8000
      NEXT_PUBLIC_SUPABASE_URL: ${SUPABASE_URL}
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ${SUPABASE_ANON_KEY}
    ports:
      - "3000:3000"
    volumes:
      - ./frontend:/app
      - /app/node_modules
      - /app/.next
    depends_on:
      - backend
      - ai-agent
    command: npm run dev
    networks:
      - derlg-network

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local

networks:
  derlg-network:
    driver: bridge
```

### Network Configuration

**Network Name**: `derlg-network`
**Driver**: Bridge (default)

**Service Communication**:
- Services communicate using container names as hostnames
- Example: Backend connects to `postgres:5432` instead of `localhost:5432`
- Frontend uses `http://backend:3001` for internal API calls
- AI Agent uses `http://backend:3001` for tool execution

**Port Mappings**:
- Frontend: `localhost:3000` → `container:3000`
- Backend: `localhost:3001` → `container:3001`
- AI Agent: `localhost:8000` → `container:8000`
- PostgreSQL: `localhost:5432` → `container:5432`
- Redis: `localhost:6379` → `container:6379`

### Volume Management

**Named Volumes** (persistent data):
- `postgres_data`: Database files, survives container restarts
- `redis_data`: Redis AOF files, survives container restarts

**Bind Mounts** (hot-reload):
- `./backend:/app`: Backend source code
- `./frontend:/app`: Frontend source code
- `./ai-agent:/app`: AI Agent source code

**Anonymous Volumes** (performance optimization):
- `/app/node_modules`: Prevents host node_modules from overriding container
- `/app/dist`: Prevents host build artifacts from interfering
- `/app/.next`: Next.js build cache
- `/app/__pycache__`: Python cache files

### Environment Variables

**.env.development** (root directory):
```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
SUPABASE_ANON_KEY=your-anon-key

# AI Service
ANTHROPIC_API_KEY=sk-ant-your-key
AI_SERVICE_KEY=your-32-character-service-key

# Development Ports (optional, defaults shown)
FRONTEND_PORT=3000
BACKEND_PORT=3001
AI_AGENT_PORT=8000
POSTGRES_PORT=5432
REDIS_PORT=6379
```

**Loading Environment Variables**:
```bash
# docker-compose automatically loads .env file
docker-compose --env-file .env.development up
```

### Service Dependencies & Startup Order

```mermaid
graph TD
    Start[Docker Compose Up]
    Start --> PG[PostgreSQL starts]
    Start --> Redis[Redis starts]
    PG --> PGHealth{Health Check}
    Redis --> RedisHealth{Health Check}
    PGHealth -->|Healthy| Backend[Backend starts]
    RedisHealth -->|Healthy| Backend
    RedisHealth -->|Healthy| Agent[AI Agent starts]
    Backend --> Frontend[Frontend starts]
    Agent --> Frontend
```

**Dependency Configuration**:
1. PostgreSQL and Redis start first (no dependencies)
2. Backend waits for PostgreSQL and Redis health checks
3. AI Agent waits for Redis health check and Backend start
4. Frontend waits for Backend and AI Agent to start

**Health Check Details**:
- PostgreSQL: `pg_isready` command checks database accepts connections
- Redis: `redis-cli incr ping` validates Redis is operational
- Interval: 10 seconds between checks
- Timeout: 5 seconds per check
- Retries: 5 attempts before marking unhealthy

### Development Workflow

#### Initial Setup

```bash
# 1. Clone repository
git clone https://github.com/your-org/derlg.git
cd derlg

# 2. Create environment file
cp .env.example .env.development
# Edit .env.development with your values

# 3. Build all containers
docker-compose build

# 4. Start all services
docker-compose up

# 5. Run database migrations (in separate terminal)
docker-compose exec backend npx prisma migrate dev

# 6. Seed database (optional)
docker-compose exec backend npm run seed
```

#### Daily Development

```bash
# Start all services
docker-compose up

# Start specific services
docker-compose up frontend backend

# Start in background (detached mode)
docker-compose up -d

# View logs
docker-compose logs -f

# View logs for specific service
docker-compose logs -f ai-agent

# Stop all services
docker-compose down

# Stop and remove volumes (clean slate)
docker-compose down -v
```

#### Hot Reload Behavior

**Frontend (Next.js)**:
- File changes trigger Fast Refresh
- Page reloads automatically in browser
- Preserves React component state when possible

**Backend (NestJS)**:
- File changes trigger automatic restart
- Typically takes 2-3 seconds to restart
- WebSocket connections may need reconnection

**AI Agent (FastAPI)**:
- File changes trigger uvicorn reload
- Typically takes 1-2 seconds to reload
- Active WebSocket connections are preserved

#### Debugging

**Attach to Container**:
```bash
# Open shell in container
docker-compose exec backend sh
docker-compose exec ai-agent bash

# Run commands inside container
docker-compose exec backend npm run test
docker-compose exec ai-agent pytest
```

**View Container Logs**:
```bash
# All services
docker-compose logs -f

# Specific service with timestamps
docker-compose logs -f --timestamps ai-agent

# Last 100 lines
docker-compose logs --tail=100 backend
```

**Inspect Container**:
```bash
# View container details
docker inspect derlg-ai-agent

# View network configuration
docker network inspect derlg-network

# View volume contents
docker volume inspect derlg_postgres_data
```

**Database Access**:
```bash
# Connect to PostgreSQL
docker-compose exec postgres psql -U derlg_user -d derlg_dev

# Run SQL file
docker-compose exec -T postgres psql -U derlg_user -d derlg_dev < backup.sql
```

**Redis Access**:
```bash
# Connect to Redis CLI
docker-compose exec redis redis-cli -a derlg_redis_password

# View all keys
docker-compose exec redis redis-cli -a derlg_redis_password KEYS '*'

# Monitor commands
docker-compose exec redis redis-cli -a derlg_redis_password MONITOR
```

### Performance Optimization

**Build Cache**:
```bash
# Use BuildKit for faster builds
DOCKER_BUILDKIT=1 docker-compose build

# Build with no cache (clean build)
docker-compose build --no-cache
```

**Resource Limits**:
```yaml
# Add to service definition
deploy:
  resources:
    limits:
      cpus: '2.0'
      memory: 2G
    reservations:
      cpus: '1.0'
      memory: 1G
```

**Volume Performance** (macOS/Windows):
```yaml
# Use delegated consistency for better performance
volumes:
  - ./backend:/app:delegated
  - ./frontend:/app:delegated
```

### Troubleshooting

**Common Issues**:

1. **Port Already in Use**:
```bash
# Find process using port
lsof -i :3000
# Kill process or change port in docker-compose.yml
```

2. **Container Won't Start**:
```bash
# Check logs
docker-compose logs backend

# Rebuild container
docker-compose build --no-cache backend
docker-compose up backend
```

3. **Database Connection Failed**:
```bash
# Check PostgreSQL is healthy
docker-compose ps

# Restart PostgreSQL
docker-compose restart postgres

# Check connection from backend
docker-compose exec backend npx prisma db pull
```

4. **Redis Connection Failed**:
```bash
# Test Redis connection
docker-compose exec redis redis-cli -a derlg_redis_password PING

# Check Redis logs
docker-compose logs redis
```

5. **Hot Reload Not Working**:
```bash
# Ensure volumes are mounted correctly
docker-compose config

# Restart service
docker-compose restart frontend

# Rebuild if needed
docker-compose up --build frontend
```

### CI/CD Integration

**GitHub Actions Example**:
```yaml
name: Development Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Create .env file
        run: |
          echo "SUPABASE_URL=${{ secrets.SUPABASE_URL }}" >> .env.development
          echo "ANTHROPIC_API_KEY=${{ secrets.ANTHROPIC_API_KEY }}" >> .env.development
      
      - name: Build containers
        run: docker-compose build
      
      - name: Start services
        run: docker-compose up -d
      
      - name: Wait for services
        run: sleep 30
      
      - name: Run backend tests
        run: docker-compose exec -T backend npm run test
      
      - name: Run AI agent tests
        run: docker-compose exec -T ai-agent pytest
      
      - name: Stop services
        run: docker-compose down -v
```

## Components and Interfaces

### 1. FastAPI Application (main.py)

The entry point that configures the FastAPI application with middleware, routes, and lifecycle events.

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import structlog

from config.settings import settings
from api.websocket import router as ws_router
from api.health import router as health_router
from utils.logging import setup_logging
from utils.redis import init_redis, close_redis

logger = structlog.get_logger()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle manager"""
    # Startup
    setup_logging(settings.LOG_LEVEL)
    await init_redis(settings.REDIS_URL)
    logger.info("ai_agent_started", 
                model_backend=settings.MODEL_BACKEND,
                port=settings.PORT)
    
    yield
    
    # Shutdown
    await close_redis()
    logger.info("ai_agent_stopped")

app = FastAPI(
    title="DerLg AI Agent",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://derlg.com", "https://www.derlg.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(ws_router)
app.include_router(health_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        workers=2,
        log_config=None  # Use structlog instead
    )
```

### 2. Configuration Management (config/settings.py)

Centralized configuration using Pydantic BaseSettings with environment variable validation.

```python
from pydantic_settings import BaseSettings
from pydantic import Field, validator
from typing import Literal

class Settings(BaseSettings):
    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    LOG_LEVEL: str = "info"
    
    # Model Backend
    MODEL_BACKEND: Literal["anthropic", "ollama"] = Field(...)
    ANTHROPIC_API_KEY: str | None = None
    OLLAMA_BASE_URL: str | None = None
    
    # Backend API
    BACKEND_URL: str = Field(...)
    AI_SERVICE_KEY: str = Field(..., min_length=32)
    
    # Redis
    REDIS_URL: str = Field(...)
    
    # Monitoring
    SENTRY_DSN: str | None = None
    
    @validator("ANTHROPIC_API_KEY")
    def validate_anthropic_key(cls, v, values):
        if values.get("MODEL_BACKEND") == "anthropic" and not v:
            raise ValueError("ANTHROPIC_API_KEY required when MODEL_BACKEND=anthropic")
        return v
    
    @validator("OLLAMA_BASE_URL")
    def validate_ollama_url(cls, v, values):
        if values.get("MODEL_BACKEND") == "ollama" and not v:
            raise ValueError("OLLAMA_BASE_URL required when MODEL_BACKEND=ollama")
        return v
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
```

### 3. ConversationState Model (agent/session/state.py)

Comprehensive state model that tracks all conversation context.

```python
from pydantic import BaseModel, Field
from datetime import datetime
from enum import Enum
from typing import List, Dict, Any, Optional

class AgentState(str, Enum):
    """7-stage conversation flow"""
    DISCOVERY = "DISCOVERY"
    SUGGESTION = "SUGGESTION"
    EXPLORATION = "EXPLORATION"
    CUSTOMIZATION = "CUSTOMIZATION"
    BOOKING = "BOOKING"
    PAYMENT = "PAYMENT"
    POST_BOOKING = "POST_BOOKING"

class ConversationState(BaseModel):
    """Complete conversation state persisted to Redis"""
    
    # Identity
    session_id: str
    user_id: str
    
    # State
    state: AgentState = AgentState.DISCOVERY
    preferred_language: str = "EN"  # EN, KH, ZH
    
    # Messages (Anthropic format)
    messages: List[Dict[str, Any]] = Field(default_factory=list)
    
    # Trip Context
    suggested_trip_ids: List[str] = Field(default_factory=list)
    selected_trip_id: Optional[str] = None
    selected_trip_name: Optional[str] = None
    
    # Booking Context
    booking_id: Optional[str] = None
    booking_ref: Optional[str] = None
    reserved_until: Optional[datetime] = None
    
    # Payment Context
    payment_intent_id: Optional[str] = None
    payment_status: Optional[str] = None
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_active: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        use_enum_values = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
```

### 4. Session Manager (agent/session/manager.py)

Handles session persistence, loading, and expiration logic.

```python
import json
import redis.asyncio as redis
from datetime import datetime, timedelta
from typing import Optional
import structlog

from agent.session.state import ConversationState, AgentState

logger = structlog.get_logger()

class SessionManager:
    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client
        self.ttl_seconds = 7 * 24 * 60 * 60  # 7 days
    
    async def save(self, session: ConversationState) -> None:
        """Save session to Redis with TTL"""
        session.last_active = datetime.utcnow()
        key = f"session:{session.session_id}"
        
        data = session.model_dump_json()
        await self.redis.setex(key, self.ttl_seconds, data)
        
        logger.info("session_saved",
                   session_id=session.session_id,
                   state=session.state,
                   message_count=len(session.messages))
    
    async def load(self, session_id: str) -> Optional[ConversationState]:
        """Load session from Redis with expiration handling"""
        key = f"session:{session_id}"
        data = await self.redis.get(key)
        
        if not data:
            logger.info("session_not_found", session_id=session_id)
            return None
        
        session = ConversationState.model_validate_json(data)
        
        # Check for expired booking holds
        if session.state == AgentState.PAYMENT and session.reserved_until:
            if datetime.utcnow() > session.reserved_until:
                logger.warning("booking_hold_expired",
                             session_id=session_id,
                             booking_id=session.booking_id)
                
                # Reset to BOOKING state
                session.state = AgentState.BOOKING
                session.booking_id = None
                session.payment_intent_id = None
                session.reserved_until = None
                
                # Add system message for AI context
                session.messages.append({
                    "role": "system",
                    "content": "The 15-minute booking hold has expired. "
                               "Inform the user and offer to create a new booking."
                })
                
                await self.save(session)
        
        logger.info("session_loaded",
                   session_id=session_id,
                   state=session.state,
                   user_id=session.user_id)
        
        return session
    
    async def delete(self, session_id: str) -> None:
        """Delete session from Redis"""
        key = f"session:{session_id}"
        await self.redis.delete(key)
        logger.info("session_deleted", session_id=session_id)
```

### 5. ModelClient Interface (agent/models/client.py)

Abstract interface for swappable LLM backends.

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import List, Dict, Any, Optional

@dataclass
class ContentBlock:
    """Unified content block format"""
    type: str  # "text" or "tool_use"
    text: Optional[str] = None
    id: Optional[str] = None
    name: Optional[str] = None
    input: Optional[Dict[str, Any]] = None

@dataclass
class ModelResponse:
    """Unified model response format"""
    stop_reason: str  # "end_turn" or "tool_use"
    content: List[ContentBlock]

class ModelClient(ABC):
    """Abstract interface for LLM providers"""
    
    @abstractmethod
    async def create_message(
        self,
        system: str,
        messages: List[Dict[str, Any]],
        tools: List[Dict[str, Any]],
        max_tokens: int = 2048
    ) -> ModelResponse:
        """Create a message with tool calling support"""
        pass
```

### 6. AnthropicClient Implementation (agent/models/anthropic.py)

Claude Sonnet 4.5 implementation with native tool calling.

```python
import anthropic
from typing import List, Dict, Any
import structlog

from agent.models.client import ModelClient, ModelResponse, ContentBlock
from config.settings import settings

logger = structlog.get_logger()

class AnthropicClient(ModelClient):
    def __init__(self):
        self.client = anthropic.AsyncAnthropic(
            api_key=settings.ANTHROPIC_API_KEY
        )
        self.model = "claude-sonnet-4-20250514"
    
    async def create_message(
        self,
        system: str,
        messages: List[Dict[str, Any]],
        tools: List[Dict[str, Any]],
        max_tokens: int = 2048
    ) -> ModelResponse:
        """Call Claude API with tool support"""
        
        try:
            response = await self.client.messages.create(
                model=self.model,
                system=system,
                messages=messages,
                tools=tools,
                max_tokens=max_tokens,
                temperature=0.7
            )
            
            # Convert to unified format
            content_blocks = []
            for block in response.content:
                if block.type == "text":
                    content_blocks.append(ContentBlock(
                        type="text",
                        text=block.text
                    ))
                elif block.type == "tool_use":
                    content_blocks.append(ContentBlock(
                        type="tool_use",
                        id=block.id,
                        name=block.name,
                        input=block.input
                    ))
            
            logger.info("anthropic_call_success",
                       model=self.model,
                       stop_reason=response.stop_reason,
                       input_tokens=response.usage.input_tokens,
                       output_tokens=response.usage.output_tokens)
            
            return ModelResponse(
                stop_reason=response.stop_reason,
                content=content_blocks
            )
            
        except anthropic.APIError as e:
            logger.error("anthropic_api_error",
                        error=str(e),
                        status_code=getattr(e, 'status_code', None))
            raise
```

### 7. OllamaClient Implementation (agent/models/ollama.py)

Local model support with schema conversion to OpenAI format.

```python
import httpx
from typing import List, Dict, Any
import structlog
import json

from agent.models.client import ModelClient, ModelResponse, ContentBlock
from config.settings import settings

logger = structlog.get_logger()

class OllamaClient(ModelClient):
    def __init__(self):
        self.base_url = settings.OLLAMA_BASE_URL
        self.model = "llama3.1:8b"
        self.client = httpx.AsyncClient(timeout=60.0)
    
    def _convert_tools_to_openai(self, tools: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Convert Anthropic tool format to OpenAI function format"""
        openai_tools = []
        for tool in tools:
            openai_tools.append({
                "type": "function",
                "function": {
                    "name": tool["name"],
                    "description": tool["description"],
                    "parameters": tool["input_schema"]
                }
            })
        return openai_tools
    
    async def create_message(
        self,
        system: str,
        messages: List[Dict[str, Any]],
        tools: List[Dict[str, Any]],
        max_tokens: int = 2048
    ) -> ModelResponse:
        """Call Ollama API with tool support"""
        
        # Convert tools to OpenAI format
        openai_tools = self._convert_tools_to_openai(tools)
        
        # Prepend system message
        ollama_messages = [{"role": "system", "content": system}] + messages
        
        try:
            response = await self.client.post(
                f"{self.base_url}/api/chat",
                json={
                    "model": self.model,
                    "messages": ollama_messages,
                    "tools": openai_tools,
                    "stream": False
                }
            )
            response.raise_for_status()
            data = response.json()
            
            # Parse response
            message = data["message"]
            content_blocks = []
            
            if "tool_calls" in message and message["tool_calls"]:
                # Tool use response
                for tool_call in message["tool_calls"]:
                    content_blocks.append(ContentBlock(
                        type="tool_use",
                        id=tool_call["id"],
                        name=tool_call["function"]["name"],
                        input=json.loads(tool_call["function"]["arguments"])
                    ))
                stop_reason = "tool_use"
            else:
                # Text response
                content_blocks.append(ContentBlock(
                    type="text",
                    text=message["content"]
                ))
                stop_reason = "end_turn"
            
            logger.info("ollama_call_success",
                       model=self.model,
                       stop_reason=stop_reason)
            
            return ModelResponse(
                stop_reason=stop_reason,
                content=content_blocks
            )
            
        except httpx.HTTPError as e:
            logger.error("ollama_http_error", error=str(e))
            raise
    
    async def close(self):
        await self.client.aclose()
```

### 8. Model Client Factory (agent/models/__init__.py)

Factory function that selects the appropriate client based on configuration.

```python
from agent.models.client import ModelClient
from agent.models.anthropic import AnthropicClient
from agent.models.ollama import OllamaClient
from config.settings import settings

def get_model_client(preferred_language: str = "EN") -> ModelClient:
    """
    Get the appropriate model client based on configuration.
    
    Note: Khmer language always uses Anthropic for best language support.
    """
    if preferred_language == "KH":
        return AnthropicClient()
    
    if settings.MODEL_BACKEND == "anthropic":
        return AnthropicClient()
    elif settings.MODEL_BACKEND == "ollama":
        return OllamaClient()
    else:
        raise ValueError(f"Unknown MODEL_BACKEND: {settings.MODEL_BACKEND}")
```


### 9. Tool Schema Definitions (agent/tools/schemas.py)

All 20 tools defined in Anthropic's tool calling format.

```python
"""Tool schema definitions for Claude API"""

# Trip Discovery Tools
GET_TRIP_SUGGESTIONS = {
    "name": "getTripSuggestions",
    "description": "Get personalized trip suggestions based on user preferences. "
                   "Call this after gathering: mood, environment, duration_days, "
                   "people_count, budget_usd, departure_city. Returns 3-5 trip options.",
    "input_schema": {
        "type": "object",
        "properties": {
            "mood": {
                "type": "string",
                "description": "Travel mood: adventure, relaxation, cultural, romantic, family"
            },
            "environment": {
                "type": "string",
                "description": "Preferred environment: beach, mountain, city, countryside, mixed"
            },
            "duration_days": {
                "type": "integer",
                "description": "Trip duration in days (1-14)"
            },
            "people_count": {
                "type": "integer",
                "description": "Number of travelers (1-20)"
            },
            "budget_usd": {
                "type": "number",
                "description": "Total budget in USD per person"
            },
            "departure_city": {
                "type": "string",
                "description": "Departure city (e.g., 'Phnom Penh', 'Siem Reap')"
            },
            "language": {
                "type": "string",
                "enum": ["EN", "KH", "ZH"],
                "description": "Response language"
            }
        },
        "required": ["mood", "environment", "duration_days", "people_count", 
                    "budget_usd", "departure_city", "language"]
    }
}

GET_TRIP_ITINERARY = {
    "name": "getTripItinerary",
    "description": "Get detailed day-by-day itinerary for a specific trip. "
                   "Call this when user wants to see the full schedule.",
    "input_schema": {
        "type": "object",
        "properties": {
            "trip_id": {
                "type": "string",
                "description": "Trip ID from suggestions"
            }
        },
        "required": ["trip_id"]
    }
}

GET_TRIP_IMAGES = {
    "name": "getTripImages",
    "description": "Get photo gallery for a trip. Call when user wants to see pictures.",
    "input_schema": {
        "type": "object",
        "properties": {
            "trip_id": {
                "type": "string",
                "description": "Trip ID"
            }
        },
        "required": ["trip_id"]
    }
}

GET_HOTEL_DETAILS = {
    "name": "getHotelDetails",
    "description": "Get detailed information about a specific hotel including "
                   "amenities, photos, and reviews.",
    "input_schema": {
        "type": "object",
        "properties": {
            "hotel_id": {
                "type": "string",
                "description": "Hotel ID from itinerary"
            }
        },
        "required": ["hotel_id"]
    }
}

GET_WEATHER_FORECAST = {
    "name": "getWeatherForecast",
    "description": "Get weather forecast for a destination on specific dates. "
                   "Useful for packing advice.",
    "input_schema": {
        "type": "object",
        "properties": {
            "destination": {
                "type": "string",
                "description": "Destination city"
            },
            "date": {
                "type": "string",
                "format": "date",
                "description": "Date in YYYY-MM-DD format"
            }
        },
        "required": ["destination", "date"]
    }
}

COMPARE_TRIPS = {
    "name": "compareTrips",
    "description": "Compare 2-3 trips side-by-side showing price, duration, "
                   "highlights, and difficulty. Call when user is deciding between options.",
    "input_schema": {
        "type": "object",
        "properties": {
            "trip_ids": {
                "type": "array",
                "items": {"type": "string"},
                "minItems": 2,
                "maxItems": 3,
                "description": "Array of trip IDs to compare"
            }
        },
        "required": ["trip_ids"]
    }
}

# Customization Tools
CALCULATE_CUSTOM_TRIP = {
    "name": "calculateCustomTrip",
    "description": "Calculate price for a customized trip without saving. "
                   "Use this to show pricing before user commits to customization.",
    "input_schema": {
        "type": "object",
        "properties": {
            "base_trip_id": {
                "type": "string",
                "description": "Base trip ID to customize"
            },
            "customizations": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "type": {
                            "type": "string",
                            "enum": ["add_activity", "remove_activity", "upgrade_hotel", 
                                   "add_day", "remove_day", "change_transport"]
                        },
                        "details": {"type": "object"}
                    }
                },
                "description": "Array of customization requests"
            }
        },
        "required": ["base_trip_id", "customizations"]
    }
}

CUSTOMIZE_TRIP = {
    "name": "customizeTrip",
    "description": "Apply customizations to a trip and save as new variant. "
                   "Call after user confirms they want the customization.",
    "input_schema": {
        "type": "object",
        "properties": {
            "trip_id": {
                "type": "string",
                "description": "Base trip ID"
            },
            "customizations": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "type": {"type": "string"},
                        "details": {"type": "object"}
                    }
                },
                "description": "Customization array"
            }
        },
        "required": ["trip_id", "customizations"]
    }
}

# Booking Tools
APPLY_DISCOUNT_CODE = {
    "name": "applyDiscountCode",
    "description": "Validate and apply a discount code to a booking. "
                   "Returns new total if valid.",
    "input_schema": {
        "type": "object",
        "properties": {
            "code": {
                "type": "string",
                "description": "Discount code"
            },
            "booking_id": {
                "type": "string",
                "description": "Booking ID"
            }
        },
        "required": ["code", "booking_id"]
    }
}

VALIDATE_USER_DETAILS = {
    "name": "validateUserDetails",
    "description": "Validate user contact details before creating booking. "
                   "Returns validation errors if any.",
    "input_schema": {
        "type": "object",
        "properties": {
            "name": {
                "type": "string",
                "description": "Full name"
            },
            "phone": {
                "type": "string",
                "description": "Phone number with country code"
            },
            "email": {
                "type": "string",
                "format": "email",
                "description": "Email address"
            }
        },
        "required": ["name", "phone", "email"]
    }
}

CREATE_BOOKING = {
    "name": "createBooking",
    "description": "Create a booking with 15-minute hold. Call after user confirms "
                   "all details. Returns booking_id and reserved_until timestamp.",
    "input_schema": {
        "type": "object",
        "properties": {
            "user_id": {"type": "string"},
            "trip_id": {"type": "string"},
            "travel_date": {
                "type": "string",
                "format": "date",
                "description": "Start date YYYY-MM-DD"
            },
            "end_date": {
                "type": "string",
                "format": "date",
                "description": "End date YYYY-MM-DD"
            },
            "people_count": {"type": "integer"},
            "pickup_location": {"type": "string"},
            "customer_name": {"type": "string"},
            "customer_phone": {"type": "string"},
            "customer_email": {"type": "string"},
            "special_requests": {
                "type": "string",
                "description": "Optional special requests"
            },
            "discount_code": {
                "type": "string",
                "description": "Optional discount code"
            }
        },
        "required": ["user_id", "trip_id", "travel_date", "end_date", 
                    "people_count", "pickup_location", "customer_name", 
                    "customer_phone", "customer_email"]
    }
}

# Payment Tools
GENERATE_PAYMENT_QR = {
    "name": "generatePaymentQR",
    "description": "Generate ABA PayWay QR code for payment. Call immediately "
                   "after successful booking creation.",
    "input_schema": {
        "type": "object",
        "properties": {
            "booking_id": {"type": "string"},
            "user_id": {"type": "string"}
        },
        "required": ["booking_id", "user_id"]
    }
}

CHECK_PAYMENT_STATUS = {
    "name": "checkPaymentStatus",
    "description": "Check current payment status. Use sparingly as payment "
                   "confirmations are pushed via Redis pub/sub.",
    "input_schema": {
        "type": "object",
        "properties": {
            "payment_intent_id": {"type": "string"}
        },
        "required": ["payment_intent_id"]
    }
}

CANCEL_BOOKING = {
    "name": "cancelBooking",
    "description": "Cancel a booking. Only works before payment is completed.",
    "input_schema": {
        "type": "object",
        "properties": {
            "booking_id": {"type": "string"}
        },
        "required": ["booking_id"]
    }
}

MODIFY_BOOKING = {
    "name": "modifyBooking",
    "description": "Modify booking details (dates, people count, pickup). "
                   "Only works before payment.",
    "input_schema": {
        "type": "object",
        "properties": {
            "booking_id": {"type": "string"},
            "modifications": {
                "type": "object",
                "properties": {
                    "travel_date": {"type": "string", "format": "date"},
                    "end_date": {"type": "string", "format": "date"},
                    "people_count": {"type": "integer"},
                    "pickup_location": {"type": "string"}
                },
                "description": "Fields to modify"
            }
        },
        "required": ["booking_id", "modifications"]
    }
}

# Information Tools
GET_PLACES = {
    "name": "getPlaces",
    "description": "Get list of places by category (temples, beaches, restaurants, etc.)",
    "input_schema": {
        "type": "object",
        "properties": {
            "category": {
                "type": "string",
                "enum": ["temples", "beaches", "restaurants", "markets", 
                        "museums", "nature", "nightlife"],
                "description": "Place category"
            },
            "region": {
                "type": "string",
                "description": "Region filter (optional)"
            },
            "language": {
                "type": "string",
                "enum": ["EN", "KH", "ZH"]
            }
        },
        "required": ["category", "language"]
    }
}

GET_UPCOMING_FESTIVALS = {
    "name": "getUpcomingFestivals",
    "description": "Get upcoming festivals and events in date range",
    "input_schema": {
        "type": "object",
        "properties": {
            "start_date": {"type": "string", "format": "date"},
            "end_date": {"type": "string", "format": "date"},
            "language": {"type": "string", "enum": ["EN", "KH", "ZH"]}
        },
        "required": ["start_date", "end_date", "language"]
    }
}

ESTIMATE_BUDGET = {
    "name": "estimateBudget",
    "description": "Get budget estimate for a trip type without specific trip selection",
    "input_schema": {
        "type": "object",
        "properties": {
            "trip_type": {
                "type": "string",
                "enum": ["budget", "standard", "luxury"]
            },
            "duration_days": {"type": "integer"},
            "people_count": {"type": "integer"}
        },
        "required": ["trip_type", "duration_days", "people_count"]
    }
}

GET_CURRENCY_RATES = {
    "name": "getCurrencyRates",
    "description": "Get current currency exchange rates",
    "input_schema": {
        "type": "object",
        "properties": {
            "from_currency": {
                "type": "string",
                "description": "Source currency code (e.g., 'USD')"
            },
            "to_currency": {
                "type": "string",
                "description": "Target currency code (e.g., 'KHR')"
            }
        },
        "required": ["from_currency", "to_currency"]
    }
}

# Export all schemas
ALL_TOOLS = [
    GET_TRIP_SUGGESTIONS,
    GET_TRIP_ITINERARY,
    GET_TRIP_IMAGES,
    GET_HOTEL_DETAILS,
    GET_WEATHER_FORECAST,
    COMPARE_TRIPS,
    CALCULATE_CUSTOM_TRIP,
    CUSTOMIZE_TRIP,
    APPLY_DISCOUNT_CODE,
    VALIDATE_USER_DETAILS,
    CREATE_BOOKING,
    GENERATE_PAYMENT_QR,
    CHECK_PAYMENT_STATUS,
    CANCEL_BOOKING,
    MODIFY_BOOKING,
    GET_PLACES,
    GET_UPCOMING_FESTIVALS,
    ESTIMATE_BUDGET,
    GET_CURRENCY_RATES
]
```

### 10. Tool Executor (agent/tools/executor.py)

Parallel tool execution with backend API integration.

```python
import asyncio
import httpx
from typing import List, Dict, Any
import structlog

from config.settings import settings
from agent.tools.handlers import TOOL_DISPATCH

logger = structlog.get_logger()

class ToolExecutor:
    def __init__(self):
        self.backend_url = settings.BACKEND_URL
        self.service_key = settings.AI_SERVICE_KEY
        self.timeout = 15.0
    
    async def execute_tools_parallel(
        self,
        tool_calls: List[Dict[str, Any]],
        session_language: str
    ) -> List[Dict[str, Any]]:
        """
        Execute multiple tool calls in parallel.
        
        Returns list of tool_result messages in Anthropic format.
        """
        tasks = []
        for tool_call in tool_calls:
            task = self._execute_single_tool(
                tool_call["id"],
                tool_call["name"],
                tool_call["input"],
                session_language
            )
            tasks.append(task)
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Convert to tool_result messages
        tool_results = []
        for i, result in enumerate(results):
            tool_call = tool_calls[i]
            
            if isinstance(result, Exception):
                logger.error("tool_execution_exception",
                           tool_name=tool_call["name"],
                           error=str(result))
                content = {
                    "success": False,
                    "error": {
                        "code": "EXECUTION_ERROR",
                        "message": "Tool execution failed"
                    }
                }
            else:
                content = result
            
            tool_results.append({
                "type": "tool_result",
                "tool_use_id": tool_call["id"],
                "content": str(content)  # Anthropic expects string
            })
        
        return tool_results
    
    async def _execute_single_tool(
        self,
        tool_id: str,
        tool_name: str,
        tool_input: Dict[str, Any],
        session_language: str
    ) -> Dict[str, Any]:
        """Execute a single tool call"""
        
        logger.info("tool_execution_start",
                   tool_id=tool_id,
                   tool_name=tool_name,
                   input=tool_input)
        
        # Get handler function
        handler = TOOL_DISPATCH.get(tool_name)
        if not handler:
            logger.error("tool_not_found", tool_name=tool_name)
            return {
                "success": False,
                "error": {
                    "code": "TOOL_NOT_FOUND",
                    "message": f"Tool {tool_name} not implemented"
                }
            }
        
        try:
            # Call handler with HTTP client
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                result = await handler(
                    client=client,
                    backend_url=self.backend_url,
                    service_key=self.service_key,
                    language=session_language,
                    **tool_input
                )
            
            logger.info("tool_execution_success",
                       tool_id=tool_id,
                       tool_name=tool_name)
            
            return {"success": True, "data": result}
            
        except httpx.TimeoutException:
            logger.error("tool_timeout", tool_name=tool_name)
            return {
                "success": False,
                "error": {
                    "code": "TIMEOUT",
                    "message": "Tool execution timed out"
                }
            }
        except httpx.HTTPStatusError as e:
            logger.error("tool_http_error",
                        tool_name=tool_name,
                        status_code=e.response.status_code)
            return {
                "success": False,
                "error": {
                    "code": "HTTP_ERROR",
                    "message": f"Backend returned {e.response.status_code}"
                }
            }
        except Exception as e:
            logger.error("tool_unexpected_error",
                        tool_name=tool_name,
                        error=str(e))
            return {
                "success": False,
                "error": {
                    "code": "UNEXPECTED_ERROR",
                    "message": "An unexpected error occurred"
                }
            }
```

### 11. Tool Handlers (agent/tools/handlers/__init__.py)

Example tool handler implementations.

```python
"""Tool handler functions that call backend endpoints"""

import httpx
from typing import Dict, Any

# Trip handlers
async def handle_get_trip_suggestions(
    client: httpx.AsyncClient,
    backend_url: str,
    service_key: str,
    language: str,
    **kwargs
) -> Dict[str, Any]:
    """Get trip suggestions from backend"""
    response = await client.post(
        f"{backend_url}/v1/ai-tools/trip-suggestions",
        json=kwargs,
        headers={
            "X-Service-Key": service_key,
            "Accept-Language": language
        }
    )
    response.raise_for_status()
    return response.json()

async def handle_get_trip_itinerary(
    client: httpx.AsyncClient,
    backend_url: str,
    service_key: str,
    language: str,
    trip_id: str
) -> Dict[str, Any]:
    """Get trip itinerary"""
    response = await client.get(
        f"{backend_url}/v1/ai-tools/trips/{trip_id}/itinerary",
        headers={
            "X-Service-Key": service_key,
            "Accept-Language": language
        }
    )
    response.raise_for_status()
    return response.json()

# Booking handlers
async def handle_create_booking(
    client: httpx.AsyncClient,
    backend_url: str,
    service_key: str,
    language: str,
    **kwargs
) -> Dict[str, Any]:
    """Create booking with 15-minute hold"""
    response = await client.post(
        f"{backend_url}/v1/ai-tools/bookings",
        json=kwargs,
        headers={
            "X-Service-Key": service_key,
            "Accept-Language": language
        }
    )
    response.raise_for_status()
    return response.json()

# Payment handlers
async def handle_generate_payment_qr(
    client: httpx.AsyncClient,
    backend_url: str,
    service_key: str,
    language: str,
    booking_id: str,
    user_id: str
) -> Dict[str, Any]:
    """Generate ABA PayWay QR code"""
    response = await client.post(
        f"{backend_url}/v1/ai-tools/payments/generate-qr",
        json={"booking_id": booking_id, "user_id": user_id},
        headers={
            "X-Service-Key": service_key,
            "Accept-Language": language
        }
    )
    response.raise_for_status()
    return response.json()

# Tool dispatch dictionary
TOOL_DISPATCH = {
    "getTripSuggestions": handle_get_trip_suggestions,
    "getTripItinerary": handle_get_trip_itinerary,
    "createBooking": handle_create_booking,
    "generatePaymentQR": handle_generate_payment_qr,
    # ... (add all 20 tool handlers)
}
```


### 12. Session Side Effects (agent/session/side_effects.py)

Automatic session state updates based on tool results.

```python
"""Apply side effects to session state based on tool results"""

from datetime import datetime
from typing import Dict, Any
import structlog

from agent.session.state import ConversationState, AgentState

logger = structlog.get_logger()

def apply_session_side_effects(
    session: ConversationState,
    tool_name: str,
    tool_result: Dict[str, Any]
) -> None:
    """
    Mutate session state based on tool execution results.
    
    This ensures conversation context stays synchronized with backend state.
    """
    
    if not tool_result.get("success"):
        return  # No side effects for failed tools
    
    data = tool_result.get("data", {})
    
    # getTripSuggestions -> store suggested trip IDs
    if tool_name == "getTripSuggestions":
        trips = data.get("trips", [])
        session.suggested_trip_ids = [trip["id"] for trip in trips]
        session.state = AgentState.SUGGESTION
        logger.info("side_effect_trip_suggestions",
                   session_id=session.session_id,
                   trip_count=len(trips))
    
    # User selects a trip -> store selection
    elif tool_name == "getTripItinerary":
        trip_id = data.get("trip_id")
        trip_name = data.get("trip_name")
        if trip_id:
            session.selected_trip_id = trip_id
            session.selected_trip_name = trip_name
            session.state = AgentState.EXPLORATION
            logger.info("side_effect_trip_selected",
                       session_id=session.session_id,
                       trip_id=trip_id)
    
    # customizeTrip -> update selected trip to customized version
    elif tool_name == "customizeTrip":
        custom_trip_id = data.get("custom_trip_id")
        if custom_trip_id:
            session.selected_trip_id = custom_trip_id
            session.state = AgentState.CUSTOMIZATION
            logger.info("side_effect_trip_customized",
                       session_id=session.session_id,
                       custom_trip_id=custom_trip_id)
    
    # createBooking -> store booking details and transition to PAYMENT
    elif tool_name == "createBooking":
        booking_id = data.get("booking_id")
        booking_ref = data.get("booking_ref")
        reserved_until_str = data.get("reserved_until")
        
        if booking_id:
            session.booking_id = booking_id
            session.booking_ref = booking_ref
            session.reserved_until = datetime.fromisoformat(reserved_until_str)
            session.state = AgentState.PAYMENT
            logger.info("side_effect_booking_created",
                       session_id=session.session_id,
                       booking_id=booking_id,
                       reserved_until=reserved_until_str)
    
    # generatePaymentQR -> store payment intent ID
    elif tool_name == "generatePaymentQR":
        payment_intent_id = data.get("payment_intent_id")
        if payment_intent_id:
            session.payment_intent_id = payment_intent_id
            logger.info("side_effect_payment_qr_generated",
                       session_id=session.session_id,
                       payment_intent_id=payment_intent_id)
    
    # checkPaymentStatus -> update payment status
    elif tool_name == "checkPaymentStatus":
        status = data.get("status")
        if status == "SUCCEEDED":
            session.payment_status = "CONFIRMED"
            session.state = AgentState.POST_BOOKING
            logger.info("side_effect_payment_confirmed",
                       session_id=session.session_id,
                       booking_id=session.booking_id)
    
    # cancelBooking -> reset booking context
    elif tool_name == "cancelBooking":
        session.booking_id = None
        session.booking_ref = None
        session.payment_intent_id = None
        session.reserved_until = None
        session.state = AgentState.DISCOVERY
        logger.info("side_effect_booking_cancelled",
                   session_id=session.session_id)
```

### 13. System Prompt Builder (agent/prompts/builder.py)

Dynamic prompt generation based on conversation state.

```python
"""Build dynamic system prompts based on conversation state"""

from agent.session.state import ConversationState, AgentState
from agent.prompts.templates import (
    BASE_PROMPT,
    STAGE_PROMPTS,
    LANGUAGE_INSTRUCTIONS,
    ABSOLUTE_RULES
)

def build_system_prompt(session: ConversationState) -> str:
    """
    Build a comprehensive system prompt that adapts to conversation state.
    
    Structure:
    1. Base identity and personality
    2. Current session context
    3. Stage-specific instructions
    4. Language-specific instructions
    5. Absolute rules
    """
    
    # 1. Base prompt
    prompt_parts = [BASE_PROMPT]
    
    # 2. Session context
    context = f"""
## Current Session Context

- Session ID: {session.session_id}
- User ID: {session.user_id}
- Current Stage: {session.state}
- Language: {session.preferred_language}
- Message Count: {len(session.messages)}
"""
    
    if session.suggested_trip_ids:
        context += f"- Suggested Trip IDs: {', '.join(session.suggested_trip_ids)}\n"
    
    if session.selected_trip_id:
        context += f"- Selected Trip: {session.selected_trip_name} ({session.selected_trip_id})\n"
    
    if session.booking_id:
        context += f"- Booking ID: {session.booking_id}\n"
        context += f"- Booking Reference: {session.booking_ref}\n"
        if session.reserved_until:
            context += f"- Reserved Until: {session.reserved_until.isoformat()}\n"
    
    if session.payment_intent_id:
        context += f"- Payment Intent: {session.payment_intent_id}\n"
        context += f"- Payment Status: {session.payment_status}\n"
    
    prompt_parts.append(context)
    
    # 3. Stage-specific instructions
    stage_prompt = STAGE_PROMPTS.get(session.state, "")
    prompt_parts.append(stage_prompt)
    
    # 4. Language instructions
    lang_instructions = LANGUAGE_INSTRUCTIONS.get(session.preferred_language, "")
    prompt_parts.append(lang_instructions)
    
    # 5. Absolute rules
    prompt_parts.append(ABSOLUTE_RULES)
    
    return "\n\n".join(prompt_parts)
```

### 14. Prompt Templates (agent/prompts/templates.py)

Structured prompt templates for each conversation stage.

```python
"""Prompt templates for system prompt builder"""

BASE_PROMPT = """# Identity

You are the DerLg.com AI Travel Concierge, a specialized booking assistant for Cambodia travel experiences. You guide travelers through a structured 7-stage booking journey with warmth, expertise, and cultural insight.

## Personality

- Warm and welcoming, like a knowledgeable local friend
- Patient and thorough in gathering information
- Enthusiastic about Cambodia's culture, history, and natural beauty
- Professional but conversational
- Proactive in offering relevant suggestions
- Clear about pricing and logistics

## Core Capabilities

You have access to 20 tools that let you:
- Search and suggest personalized trips
- Provide detailed itineraries and pricing
- Customize trips based on preferences
- Create bookings with payment processing
- Answer questions about destinations, weather, and logistics
"""

STAGE_PROMPTS = {
    "DISCOVERY": """## Current Stage: DISCOVERY

Your goal is to understand the traveler's preferences to provide personalized suggestions.

### Required Information (gather all 6 before calling getTripSuggestions):
1. **Mood**: adventure, relaxation, cultural, romantic, or family
2. **Environment**: beach, mountain, city, countryside, or mixed
3. **Duration**: How many days (1-14)
4. **People Count**: Number of travelers
5. **Budget**: Total budget in USD per person
6. **Departure City**: Where they're starting from

### Approach:
- Ask 2-3 questions at a time (don't interrogate)
- Provide context for why you're asking
- Offer examples to help them decide
- If they're unsure, suggest popular options
- Once you have all 6 fields, call getTripSuggestions immediately

### Example Flow:
"I'd love to help you discover the perfect Cambodia adventure! To find trips that match your style, I have a few questions:

What kind of vibe are you looking for? Are you seeking adventure and excitement, cultural immersion, peaceful relaxation, or something else?

And how many days do you have for this trip?"
""",
    
    "SUGGESTION": """## Current Stage: SUGGESTION

You've provided trip suggestions. Now help the user explore and select one.

### Your Goals:
- Present the suggested trips clearly (they're already displayed as cards)
- Highlight what makes each trip unique
- Answer comparison questions
- Use compareTrips tool if they're deciding between 2-3 options
- Guide them toward selection without being pushy

### Available Tools:
- compareTrips: Show side-by-side comparison
- getTripItinerary: Show full day-by-day schedule
- getTripImages: Show photo gallery
- getHotelDetails: Show hotel information

### Transition:
When they express interest in a specific trip, call getTripItinerary to show details.
""",
    
    "EXPLORATION": """## Current Stage: EXPLORATION

The user has selected a trip and is exploring details.

### Your Goals:
- Answer all questions about the itinerary
- Provide additional context about destinations
- Explain what's included vs. not included
- Discuss logistics (pickup, transport, meals)
- Gauge interest in customization

### Available Tools:
- getHotelDetails: Hotel amenities and reviews
- getWeatherForecast: Weather for travel dates
- getPlaces: Information about specific locations
- calculateCustomTrip: Price out modifications

### Transition:
- If they want changes → CUSTOMIZATION (use calculateCustomTrip)
- If they're ready to book → BOOKING (start booking flow)
""",
    
    "CUSTOMIZATION": """## Current Stage: CUSTOMIZATION

The user wants to modify the trip.

### Your Goals:
- Understand what they want to change
- Use calculateCustomTrip to show pricing BEFORE committing
- Explain how changes affect the experience
- Once they approve, use customizeTrip to save the variant

### Customization Types:
- add_activity: Add an experience
- remove_activity: Remove something
- upgrade_hotel: Better accommodation
- add_day / remove_day: Change duration
- change_transport: Different vehicle

### Approach:
1. Clarify the desired change
2. Call calculateCustomTrip to show new price
3. Present the change clearly
4. If approved, call customizeTrip
5. Transition to BOOKING when ready
""",
    
    "BOOKING": """## Current Stage: BOOKING

Ready to create the booking. Follow the 3-step flow:

### Step 1: Summary Confirmation
Present a clear summary:
- Trip name and dates
- Number of people
- Total price
- What's included
Ask: "Does everything look correct?"

### Step 2: Collect Details
Gather required information:
- Full name (as on passport)
- Phone number (with country code)
- Email address
- Pickup location
- Travel dates (if not already set)
- Special requests (optional)

Use validateUserDetails before proceeding.

### Step 3: Create Booking
Call createBooking with all details.
This creates a 15-minute hold.

### Important:
- Be clear about the 15-minute payment window
- Explain cancellation policy
- Transition to PAYMENT immediately after successful booking
""",
    
    "PAYMENT": """## Current Stage: PAYMENT

Booking created with 15-minute hold. Now process payment.

### Immediate Action:
Call generatePaymentQR immediately to get the QR code.

### Your Goals:
- Display the QR code (it will render automatically)
- Explain how to pay with ABA mobile app
- Reassure them the booking is held for 15 minutes
- Monitor for payment confirmation (happens automatically via Redis pub/sub)

### Important:
- Don't repeatedly call checkPaymentStatus (we get push notifications)
- If hold expires, inform them and offer to rebook
- Be patient and supportive during payment

### Transition:
When payment succeeds, you'll automatically move to POST_BOOKING.
""",
    
    "POST_BOOKING": """## Current Stage: POST_BOOKING

Payment confirmed! Booking is complete.

### Your Goals:
- Celebrate the booking!
- Provide booking confirmation details
- Explain next steps:
  - Confirmation email sent
  - What to bring
  - Pickup details
  - Contact information for questions
- Offer additional help:
  - Weather forecast for travel dates
  - Packing suggestions
  - Cultural tips
  - Other trips they might enjoy

### Tone:
Excited and helpful. Make them feel confident about their upcoming adventure.
"""
}

LANGUAGE_INSTRUCTIONS = {
    "EN": """## Language: English

Respond in clear, natural English. Use travel industry terminology appropriately.
""",
    
    "KH": """## Language: Khmer (ខ្មែរ)

Respond in Khmer language. Use respectful and culturally appropriate phrasing.
Be especially warm and welcoming, as you're helping Cambodian travelers explore their own country.
""",
    
    "ZH": """## Language: Simplified Chinese (简体中文)

Respond in Simplified Chinese. Use clear, professional language appropriate for travel services.
Be mindful of Chinese travelers' common questions about visas, currency, and cultural differences.
"""
}

ABSOLUTE_RULES = """## Absolute Rules (NEVER VIOLATE)

1. **Never Invent Data**: All facts (prices, availability, hotel names, dates) MUST come from tool calls. If you don't have data, call the appropriate tool.

2. **Tool-First Approach**: When a user asks about something factual, call a tool. Don't guess or use general knowledge.

3. **Stay On Topic**: You are a Cambodia travel booking assistant. Politely decline requests about:
   - Other countries
   - Non-travel topics
   - General knowledge questions
   - Technical support for the website

4. **Respect State Transitions**: Follow the stage flow. Don't skip stages or create bookings prematurely.

5. **Verify Before Booking**: Always confirm all details before calling createBooking.

6. **Be Transparent**: If a tool fails, explain what happened and offer alternatives.

7. **Protect Privacy**: Never log or expose sensitive user data in your responses.

8. **Time Sensitivity**: Respect the 15-minute booking hold. Warn users when time is running out.
"""
```


### 15. LangGraph State Machine (agent/graph.py)

State machine orchestration using LangGraph.

```python
"""LangGraph state machine for conversation flow"""

from langgraph.graph import StateGraph, END
from langgraph.checkpoint.redis import RedisSaver
from typing import TypedDict, List, Dict, Any
import structlog

from agent.models import get_model_client
from agent.tools.executor import ToolExecutor
from agent.prompts.builder import build_system_prompt
from agent.formatters.formatter import format_response
from agent.session.side_effects import apply_session_side_effects
from agent.session.state import ConversationState

logger = structlog.get_logger()

class GraphState(TypedDict):
    """State passed between nodes"""
    session: ConversationState
    user_text: str
    model_response: Any
    tool_results: List[Dict[str, Any]]
    formatted_response: Dict[str, Any]
    iteration: int

def call_llm(state: GraphState) -> GraphState:
    """
    Node 1: Call the LLM with current conversation state.
    
    Returns model response which may contain text or tool_use blocks.
    """
    session = state["session"]
    iteration = state.get("iteration", 0)
    
    # Prevent infinite loops
    if iteration >= 5:
        logger.warning("max_iterations_reached", session_id=session.session_id)
        return {
            **state,
            "model_response": {
                "stop_reason": "end_turn",
                "content": [{"type": "text", "text": "I apologize, but I'm having trouble processing your request. Could you rephrase that?"}]
            }
        }
    
    # Build system prompt
    system_prompt = build_system_prompt(session)
    
    # Get model client
    client = get_model_client(session.preferred_language)
    
    # Limit context window to last 20 messages
    recent_messages = session.messages[-20:]
    
    # Import tool schemas
    from agent.tools.schemas import ALL_TOOLS
    
    logger.info("calling_llm",
               session_id=session.session_id,
               message_count=len(recent_messages),
               iteration=iteration)
    
    try:
        response = await client.create_message(
            system=system_prompt,
            messages=recent_messages,
            tools=ALL_TOOLS,
            max_tokens=2048
        )
        
        return {
            **state,
            "model_response": response,
            "iteration": iteration + 1
        }
        
    except Exception as e:
        logger.error("llm_call_failed",
                    session_id=session.session_id,
                    error=str(e))
        raise

def execute_tools(state: GraphState) -> GraphState:
    """
    Node 2: Execute tool calls from LLM response.
    
    Extracts tool_use blocks, executes them in parallel, and returns tool_result messages.
    """
    session = state["session"]
    model_response = state["model_response"]
    
    # Extract tool_use blocks
    tool_calls = []
    for block in model_response.content:
        if block.type == "tool_use":
            tool_calls.append({
                "id": block.id,
                "name": block.name,
                "input": block.input
            })
    
    logger.info("executing_tools",
               session_id=session.session_id,
               tool_count=len(tool_calls))
    
    # Execute tools in parallel
    executor = ToolExecutor()
    tool_results = await executor.execute_tools_parallel(
        tool_calls,
        session.preferred_language
    )
    
    # Append assistant message with tool_use blocks
    assistant_message = {
        "role": "assistant",
        "content": [
            {
                "type": "tool_use",
                "id": tc["id"],
                "name": tc["name"],
                "input": tc["input"]
            }
            for tc in tool_calls
        ]
    }
    session.messages.append(assistant_message)
    
    # Append tool_result messages
    for result in tool_results:
        session.messages.append({
            "role": "user",
            "content": [result]
        })
    
    # Apply session side effects
    for i, tool_call in enumerate(tool_calls):
        tool_result_content = eval(tool_results[i]["content"])  # Parse string back to dict
        apply_session_side_effects(session, tool_call["name"], tool_result_content)
    
    return {
        **state,
        "tool_results": tool_results
    }

def format_response_node(state: GraphState) -> GraphState:
    """
    Node 3: Format the final response for the frontend.
    
    Converts AI text and tool results into structured message types.
    """
    session = state["session"]
    model_response = state["model_response"]
    
    # Extract text content
    text_content = ""
    for block in model_response.content:
        if block.type == "text":
            text_content += block.text
    
    # Append assistant message
    session.messages.append({
        "role": "assistant",
        "content": text_content
    })
    
    # Format response
    formatted = format_response(
        ai_text=text_content,
        tool_results=state.get("tool_results", []),
        session=session
    )
    
    logger.info("response_formatted",
               session_id=session.session_id,
               message_type=formatted.get("type"))
    
    return {
        **state,
        "formatted_response": formatted
    }

def should_execute_tools(state: GraphState) -> str:
    """
    Edge condition: Determine next node based on stop_reason.
    """
    model_response = state["model_response"]
    
    if model_response.stop_reason == "tool_use":
        return "execute_tools"
    else:
        return "format_response"

def build_graph(redis_saver: RedisSaver) -> StateGraph:
    """
    Build the LangGraph state machine.
    
    Flow:
    START -> call_llm -> [tool_use] -> execute_tools -> call_llm (loop)
                      -> [end_turn] -> format_response -> END
    """
    graph = StateGraph(GraphState)
    
    # Add nodes
    graph.add_node("call_llm", call_llm)
    graph.add_node("execute_tools", execute_tools)
    graph.add_node("format_response", format_response_node)
    
    # Set entry point
    graph.set_entry_point("call_llm")
    
    # Add conditional edges from call_llm
    graph.add_conditional_edges(
        "call_llm",
        should_execute_tools,
        {
            "execute_tools": "execute_tools",
            "format_response": "format_response"
        }
    )
    
    # Add edge from execute_tools back to call_llm
    graph.add_edge("execute_tools", "call_llm")
    
    # Add edge from format_response to END
    graph.add_edge("format_response", END)
    
    # Compile with checkpointer
    return graph.compile(checkpointer=redis_saver)
```

### 16. Agent Execution Loop (agent/core.py)

Main agent loop that orchestrates the conversation.

```python
"""Core agent execution loop"""

import structlog
from typing import Dict, Any

from agent.session.state import ConversationState
from agent.graph import build_graph, GraphState
from utils.redis import get_redis_saver

logger = structlog.get_logger()

async def run_agent(
    session: ConversationState,
    user_text: str
) -> Dict[str, Any]:
    """
    Execute the agent for one user message.
    
    This is the main entry point called by the WebSocket handler.
    
    Args:
        session: Current conversation state
        user_text: User's message text
    
    Returns:
        Formatted response dictionary ready for WebSocket transmission
    """
    
    logger.info("agent_run_start",
               session_id=session.session_id,
               state=session.state,
               user_text_length=len(user_text))
    
    # Append user message to conversation
    session.messages.append({
        "role": "user",
        "content": user_text
    })
    
    # Build graph with Redis checkpointer
    redis_saver = get_redis_saver()
    graph = build_graph(redis_saver)
    
    # Initial state
    initial_state: GraphState = {
        "session": session,
        "user_text": user_text,
        "model_response": None,
        "tool_results": [],
        "formatted_response": {},
        "iteration": 0
    }
    
    # Execute graph
    try:
        # Run with checkpointing
        config = {
            "configurable": {
                "thread_id": session.session_id
            }
        }
        
        final_state = await graph.ainvoke(initial_state, config)
        
        logger.info("agent_run_complete",
                   session_id=session.session_id,
                   iterations=final_state["iteration"])
        
        return final_state["formatted_response"]
        
    except Exception as e:
        logger.error("agent_run_failed",
                    session_id=session.session_id,
                    error=str(e),
                    exc_info=True)
        
        # Return error message
        return {
            "type": "error",
            "message": "I apologize, but I encountered an error processing your request. Please try again."
        }
```

### 17. Response Formatter (agent/formatters/formatter.py)

Converts tool results into structured frontend messages.

```python
"""Format agent responses for frontend consumption"""

from typing import Dict, Any, List
import structlog

from agent.session.state import ConversationState, AgentState
from agent.formatters.message_types import (
    TextMessage,
    TripCardsMessage,
    QRPaymentMessage,
    BookingConfirmedMessage,
    WeatherMessage,
    ItineraryMessage,
    BudgetEstimateMessage,
    ComparisonMessage,
    ImageGalleryMessage
)

logger = structlog.get_logger()

def format_response(
    ai_text: str,
    tool_results: List[Dict[str, Any]],
    session: ConversationState
) -> Dict[str, Any]:
    """
    Analyze AI text and tool results to determine the best message format.
    
    Priority order:
    1. Payment confirmation (if state is POST_BOOKING)
    2. QR code (if payment_intent_id in results)
    3. Trip cards (if trips array in results)
    4. Booking confirmation
    5. Structured data (weather, itinerary, etc.)
    6. Plain text
    """
    
    # Parse tool results
    parsed_results = []
    for result in tool_results:
        try:
            content = eval(result["content"])  # Parse string to dict
            if content.get("success"):
                parsed_results.append(content.get("data", {}))
        except:
            continue
    
    # 1. Payment confirmation
    if session.state == AgentState.POST_BOOKING and session.payment_status == "CONFIRMED":
        return BookingConfirmedMessage(
            text=ai_text,
            booking_ref=session.booking_ref,
            booking_id=session.booking_id,
            trip_name=session.selected_trip_name
        ).model_dump()
    
    # 2. QR Payment
    for data in parsed_results:
        if "qr_code_url" in data:
            return QRPaymentMessage(
                text=ai_text,
                qr_code_url=data["qr_code_url"],
                amount=data.get("amount"),
                currency=data.get("currency", "USD"),
                expires_at=data.get("expires_at")
            ).model_dump()
    
    # 3. Trip Cards
    for data in parsed_results:
        if "trips" in data and isinstance(data["trips"], list):
            return TripCardsMessage(
                text=ai_text,
                trips=data["trips"]
            ).model_dump()
    
    # 4. Weather
    for data in parsed_results:
        if "forecast" in data:
            return WeatherMessage(
                text=ai_text,
                forecast=data["forecast"],
                destination=data.get("destination")
            ).model_dump()
    
    # 5. Itinerary
    for data in parsed_results:
        if "itinerary" in data:
            return ItineraryMessage(
                text=ai_text,
                itinerary=data["itinerary"],
                trip_id=data.get("trip_id"),
                trip_name=data.get("trip_name")
            ).model_dump()
    
    # 6. Budget Estimate
    for data in parsed_results:
        if "total_estimate_usd" in data:
            return BudgetEstimateMessage(
                text=ai_text,
                estimate=data
            ).model_dump()
    
    # 7. Comparison (exactly 2 trips)
    for data in parsed_results:
        if "comparison" in data and len(data.get("trips", [])) == 2:
            return ComparisonMessage(
                text=ai_text,
                comparison=data["comparison"]
            ).model_dump()
    
    # 8. Image Gallery
    for data in parsed_results:
        if "images" in data and isinstance(data["images"], list):
            return ImageGalleryMessage(
                text=ai_text,
                images=data["images"],
                trip_id=data.get("trip_id")
            ).model_dump()
    
    # 9. Default: Plain text
    return TextMessage(text=ai_text).model_dump()
```

### 18. Message Type Definitions (agent/formatters/message_types.py)

Pydantic models for all frontend message types.

```python
"""Pydantic models for structured frontend messages"""

from pydantic import BaseModel
from typing import List, Dict, Any, Optional

class TextMessage(BaseModel):
    """Plain text message"""
    type: str = "text"
    text: str

class TripCardsMessage(BaseModel):
    """Trip suggestion cards"""
    type: str = "trip_cards"
    text: str
    trips: List[Dict[str, Any]]

class QRPaymentMessage(BaseModel):
    """ABA PayWay QR code"""
    type: str = "qr_payment"
    text: str
    qr_code_url: str
    amount: float
    currency: str = "USD"
    expires_at: Optional[str] = None

class BookingConfirmedMessage(BaseModel):
    """Booking confirmation"""
    type: str = "booking_confirmed"
    text: str
    booking_ref: str
    booking_id: str
    trip_name: str

class WeatherMessage(BaseModel):
    """Weather forecast"""
    type: str = "weather"
    text: str
    forecast: Dict[str, Any]
    destination: Optional[str] = None

class ItineraryMessage(BaseModel):
    """Day-by-day itinerary"""
    type: str = "itinerary"
    text: str
    itinerary: List[Dict[str, Any]]
    trip_id: Optional[str] = None
    trip_name: Optional[str] = None

class BudgetEstimateMessage(BaseModel):
    """Budget breakdown"""
    type: str = "budget_estimate"
    text: str
    estimate: Dict[str, Any]

class ComparisonMessage(BaseModel):
    """Side-by-side trip comparison"""
    type: str = "comparison"
    text: str
    comparison: Dict[str, Any]

class ImageGalleryMessage(BaseModel):
    """Photo gallery"""
    type: str = "image_gallery"
    text: str
    images: List[Dict[str, Any]]
    trip_id: Optional[str] = None
```


### 19. WebSocket Handler (api/websocket.py)

Real-time WebSocket communication with authentication and payment event listening.

```python
"""WebSocket endpoint for real-time chat"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict
import structlog
import json
import asyncio
import redis.asyncio as redis

from agent.core import run_agent
from agent.session.manager import SessionManager
from agent.session.state import ConversationState, AgentState
from config.settings import settings
from utils.redis import get_redis_client

logger = structlog.get_logger()
router = APIRouter()

# Active WebSocket connections
active_connections: Dict[str, WebSocket] = {}

@router.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    """
    WebSocket endpoint for real-time conversation.
    
    Protocol:
    1. Client connects
    2. Client sends auth message: {"type": "auth", "user_id": "...", "language": "EN"}
    3. Server sends welcome/resume message
    4. Client sends user messages: {"type": "user_message", "content": "..."}
    5. Server sends typing indicators and responses
    6. Server pushes payment confirmations via Redis pub/sub
    """
    
    await websocket.accept()
    logger.info("websocket_connected", session_id=session_id)
    
    # Store connection
    active_connections[session_id] = websocket
    
    # Initialize session manager
    redis_client = get_redis_client()
    session_manager = SessionManager(redis_client)
    
    # Load or create session
    session = await session_manager.load(session_id)
    is_new_session = session is None
    
    if is_new_session:
        session = ConversationState(
            session_id=session_id,
            user_id="",  # Will be set by auth message
            state=AgentState.DISCOVERY
        )
    
    # Payment event listener task
    payment_listener_task = None
    
    try:
        # Wait for auth message
        auth_data = await websocket.receive_json()
        
        if auth_data.get("type") != "auth":
            await websocket.close(code=1008, reason="First message must be auth")
            return
        
        # Update session with auth info
        session.user_id = auth_data.get("user_id", "")
        session.preferred_language = auth_data.get("language", "EN")
        await session_manager.save(session)
        
        logger.info("websocket_authenticated",
                   session_id=session_id,
                   user_id=session.user_id,
                   language=session.preferred_language)
        
        # Start payment event listener
        payment_listener_task = asyncio.create_task(
            listen_for_payment_events(websocket, session, session_manager)
        )
        
        # Send welcome or resume message
        if is_new_session:
            welcome_messages = {
                "EN": "Welcome to DerLg! I'm your Cambodia travel concierge. I'll help you discover and book the perfect trip. What kind of adventure are you looking for?",
                "KH": "សូមស្វាគមន៍មកកាន់ DerLg! ខ្ញុំជាអ្នកណែនាំទេសចរណ៍របស់អ្នក។ តើអ្នកកំពុងស្វែងរកការផ្សងព្រេងប្រភេទណា?",
                "ZH": "欢迎来到DerLg！我是您的柬埔寨旅行顾问。我将帮助您发现并预订完美的旅程。您在寻找什么样的冒险？"
            }
            await websocket.send_json({
                "type": "text",
                "text": welcome_messages.get(session.preferred_language, welcome_messages["EN"])
            })
        else:
            resume_messages = {
                "EN": f"Welcome back! We were at the {session.state} stage. How can I help you continue?",
                "KH": f"សូមស្វាគមន៍ត្រឡប់មកវិញ! យើងកំពុងស្ថិតនៅដំណាក់កាល {session.state}។",
                "ZH": f"欢迎回来！我们在{session.state}阶段。我能如何帮助您继续？"
            }
            await websocket.send_json({
                "type": "text",
                "text": resume_messages.get(session.preferred_language, resume_messages["EN"])
            })
        
        # Message loop
        while True:
            # Receive user message
            data = await websocket.receive_json()
            
            if data.get("type") != "user_message":
                continue
            
            user_text = data.get("content", "").strip()
            if not user_text:
                continue
            
            logger.info("user_message_received",
                       session_id=session_id,
                       message_length=len(user_text))
            
            # Send typing indicator
            await websocket.send_json({"type": "typing_start"})
            
            try:
                # Run agent
                response = await run_agent(session, user_text)
                
                # Save session
                await session_manager.save(session)
                
                # Send typing end
                await websocket.send_json({"type": "typing_end"})
                
                # Send response
                await websocket.send_json(response)
                
                logger.info("response_sent",
                           session_id=session_id,
                           response_type=response.get("type"))
                
            except Exception as e:
                logger.error("message_processing_error",
                            session_id=session_id,
                            error=str(e),
                            exc_info=True)
                
                await websocket.send_json({"type": "typing_end"})
                await websocket.send_json({
                    "type": "error",
                    "message": "I apologize, but I encountered an error. Please try again."
                })
    
    except WebSocketDisconnect:
        logger.info("websocket_disconnected", session_id=session_id)
    
    except Exception as e:
        logger.error("websocket_error",
                    session_id=session_id,
                    error=str(e),
                    exc_info=True)
    
    finally:
        # Cleanup
        if payment_listener_task:
            payment_listener_task.cancel()
        
        if session_id in active_connections:
            del active_connections[session_id]
        
        await session_manager.save(session)
        logger.info("websocket_cleanup_complete", session_id=session_id)

async def listen_for_payment_events(
    websocket: WebSocket,
    session: ConversationState,
    session_manager: SessionManager
):
    """
    Listen for payment confirmation events from Redis pub/sub.
    
    When payment succeeds, update session and notify user.
    """
    redis_client = get_redis_client()
    pubsub = redis_client.pubsub()
    
    channel = f"payment_events:{session.user_id}"
    await pubsub.subscribe(channel)
    
    logger.info("payment_listener_started",
               session_id=session.session_id,
               channel=channel)
    
    try:
        async for message in pubsub.listen():
            if message["type"] != "message":
                continue
            
            try:
                event_data = json.loads(message["data"])
                
                if event_data.get("status") == "SUCCEEDED":
                    payment_intent_id = event_data.get("payment_intent_id")
                    
                    # Verify this is for current session
                    if payment_intent_id != session.payment_intent_id:
                        continue
                    
                    logger.info("payment_confirmed_via_pubsub",
                               session_id=session.session_id,
                               payment_intent_id=payment_intent_id)
                    
                    # Update session
                    session.payment_status = "CONFIRMED"
                    session.state = AgentState.POST_BOOKING
                    await session_manager.save(session)
                    
                    # Send payment confirmed event
                    await websocket.send_json({
                        "type": "payment_confirmed",
                        "booking_ref": session.booking_ref
                    })
                    
                    # Generate confirmation message
                    confirmation_text = "Payment confirmed! Your booking is complete."
                    response = await run_agent(session, confirmation_text)
                    await websocket.send_json(response)
                    
            except json.JSONDecodeError:
                logger.warning("invalid_payment_event_json",
                             session_id=session.session_id)
            except Exception as e:
                logger.error("payment_event_processing_error",
                            session_id=session.session_id,
                            error=str(e))
    
    except asyncio.CancelledError:
        logger.info("payment_listener_cancelled", session_id=session.session_id)
        await pubsub.unsubscribe(channel)
        await pubsub.close()
```

### 20. Health Check Endpoint (api/health.py)

Health check for monitoring and load balancers.

```python
"""Health check endpoint"""

from fastapi import APIRouter
from datetime import datetime
import structlog

router = APIRouter()
logger = structlog.get_logger()

start_time = datetime.utcnow()

@router.get("/health")
async def health_check():
    """
    Health check endpoint for monitoring.
    
    Returns:
        - status: "healthy"
        - uptime: seconds since startup
        - timestamp: current UTC time
    """
    uptime = (datetime.utcnow() - start_time).total_seconds()
    
    return {
        "status": "healthy",
        "service": "ai-agent",
        "uptime_seconds": uptime,
        "timestamp": datetime.utcnow().isoformat()
    }
```

### 21. Redis Utilities (utils/redis.py)

Redis connection management and RedisSaver for LangGraph.

```python
"""Redis connection utilities"""

import redis.asyncio as redis
from langgraph.checkpoint.redis import RedisSaver
import structlog

from config.settings import settings

logger = structlog.get_logger()

_redis_client: redis.Redis = None
_redis_saver: RedisSaver = None

async def init_redis(redis_url: str):
    """Initialize Redis connection"""
    global _redis_client, _redis_saver
    
    _redis_client = redis.from_url(
        redis_url,
        encoding="utf-8",
        decode_responses=True
    )
    
    # Test connection
    await _redis_client.ping()
    logger.info("redis_connected", url=redis_url.split("@")[-1])  # Hide credentials
    
    # Initialize RedisSaver for LangGraph
    _redis_saver = RedisSaver(_redis_client)

async def close_redis():
    """Close Redis connection"""
    global _redis_client
    
    if _redis_client:
        await _redis_client.close()
        logger.info("redis_disconnected")

def get_redis_client() -> redis.Redis:
    """Get Redis client instance"""
    if not _redis_client:
        raise RuntimeError("Redis not initialized. Call init_redis() first.")
    return _redis_client

def get_redis_saver() -> RedisSaver:
    """Get RedisSaver for LangGraph checkpointing"""
    if not _redis_saver:
        raise RuntimeError("Redis not initialized. Call init_redis() first.")
    return _redis_saver
```

### 22. Structured Logging Setup (utils/logging.py)

Structured JSON logging with structlog.

```python
"""Structured logging configuration"""

import structlog
import logging
import sys

def setup_logging(log_level: str = "info"):
    """
    Configure structlog for JSON logging.
    
    Logs include:
    - timestamp
    - level
    - event (message)
    - context fields
    """
    
    # Convert log level string to logging constant
    numeric_level = getattr(logging, log_level.upper(), logging.INFO)
    
    # Configure standard logging
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=numeric_level
    )
    
    # Configure structlog
    structlog.configure(
        processors=[
            structlog.stdlib.filter_by_level,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.UnicodeDecoder(),
            structlog.processors.JSONRenderer()
        ],
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )
```

## Data Models

### ConversationState Schema

```json
{
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": "user_123",
  "state": "PAYMENT",
  "preferred_language": "EN",
  "messages": [
    {
      "role": "user",
      "content": "I want to visit Angkor Wat"
    },
    {
      "role": "assistant",
      "content": "Great choice! Let me ask you a few questions..."
    }
  ],
  "suggested_trip_ids": ["trip_001", "trip_002", "trip_003"],
  "selected_trip_id": "trip_001",
  "selected_trip_name": "Angkor Wonder 3-Day Tour",
  "booking_id": "booking_456",
  "booking_ref": "DLG-2024-001",
  "reserved_until": "2024-01-15T10:30:00Z",
  "payment_intent_id": "pi_789",
  "payment_status": "PENDING",
  "created_at": "2024-01-15T10:00:00Z",
  "last_active": "2024-01-15T10:15:00Z"
}
```

### Tool Result Format

```json
{
  "success": true,
  "data": {
    "trips": [
      {
        "id": "trip_001",
        "name": "Angkor Wonder 3-Day Tour",
        "price_usd": 450,
        "duration_days": 3,
        "highlights": ["Angkor Wat", "Bayon Temple", "Ta Prohm"],
        "image_url": "https://..."
      }
    ]
  }
}
```

### WebSocket Message Protocol

```typescript
// Client -> Server
type ClientMessage = 
  | { type: "auth"; user_id: string; language: "EN" | "KH" | "ZH" }
  | { type: "user_message"; content: string };

// Server -> Client
type ServerMessage =
  | { type: "text"; text: string }
  | { type: "trip_cards"; text: string; trips: Trip[] }
  | { type: "qr_payment"; text: string; qr_code_url: string; amount: number }
  | { type: "booking_confirmed"; text: string; booking_ref: string }
  | { type: "typing_start" }
  | { type: "typing_end" }
  | { type: "payment_confirmed"; booking_ref: string }
  | { type: "error"; message: string };
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing all acceptance criteria, I identified the following redundancies and consolidations:

- **Serialization properties (3.10, 3.11, 4.5)**: Combined into single round-trip property
- **Header inclusion (7.7, 7.8, 16.2)**: Combined into single property about required headers
- **Error handling (7.12, 15.1, 15.3)**: Combined into comprehensive exception handling property
- **Language routing (5.11, 14.10)**: Duplicate - kept single property
- **Session persistence (2.9, 11.14)**: Combined into property about state persistence after operations
- **Tool result formatting (7.13, 7.14)**: Combined into single property about tool result processing
- **Error sanitization (15.10, 16.6)**: Duplicate - kept single property

### Property 1: ConversationState Serialization Round-Trip

*For any* valid ConversationState object, serializing to JSON and then deserializing should produce an equivalent ConversationState with all fields preserved.

**Validates: Requirements 3.10, 3.11, 4.5**

### Property 2: State Machine Transitions

*For any* LangGraph execution, when call_llm returns stop_reason "tool_use", the next node executed must be execute_tools; when call_llm returns stop_reason "end_turn", the next node executed must be format_response.

**Validates: Requirements 2.4, 2.5**

### Property 3: Session Persistence After Operations

*For any* session state modification (message addition, tool execution, state transition), the session must be persisted to Redis with updated last_active timestamp and 7-day TTL.

**Validates: Requirements 2.9, 4.3, 4.4, 11.14**

### Property 4: Session Key Format

*For any* session_id, the Redis key used for storage must follow the format "session:{session_id}".

**Validates: Requirements 4.2**

### Property 5: Booking Hold Expiration Recovery

*For any* session in PAYMENT state where reserved_until timestamp has passed, loading the session must reset state to BOOKING, clear booking_id/payment_intent_id/reserved_until fields, and append a system message about expiration.

**Validates: Requirements 4.7, 4.8, 4.9, 4.10**

### Property 6: Model Client Selection

*For any* language preference, when preferred_language is "KH", get_model_client must return AnthropicClient regardless of MODEL_BACKEND setting; otherwise, it must return the client matching MODEL_BACKEND configuration.

**Validates: Requirements 5.10, 5.11, 14.10**

### Property 7: Parallel Tool Execution

*For any* list of tool_use blocks from the model, execute_tools_parallel must execute all tools concurrently and return tool_result messages in the same order as the input tool calls.

**Validates: Requirements 7.2**

### Property 8: Backend Request Headers

*For any* backend tool call, the HTTP request must include both X-Service-Key header with AI_SERVICE_KEY value and Accept-Language header with session.preferred_language value.

**Validates: Requirements 7.7, 7.8, 16.2**

### Property 9: Tool Result Format Consistency

*For any* tool execution result, successful calls must return {"success": true, "data": {...}} format and failed calls must return {"success": false, "error": {"code": "...", "message": "..."}} format.

**Validates: Requirements 7.10, 7.11**

### Property 10: Exception Handling and Error Responses

*For any* exception raised during tool execution or message processing, the system must catch the exception, log it, and return a user-friendly error message without exposing internal details or stack traces.

**Validates: Requirements 7.12, 15.1, 15.3, 15.10, 16.6**

### Property 11: Tool Result Message Conversion

*For any* tool execution results, the system must convert them to Anthropic tool_result message format and append them to session.messages in the correct order.

**Validates: Requirements 7.13, 7.14**

### Property 12: Session Side Effects Application

*For any* successful tool execution, if the tool name matches a side-effect trigger (getTripSuggestions, createBooking, generatePaymentQR, checkPaymentStatus, cancelBooking), the corresponding session fields must be updated according to the tool result data.

**Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10**

### Property 13: System Prompt State Adaptation

*For any* ConversationState, the generated system prompt must include base identity, current session context (session_id, user_id, state, language, booking_id if present), stage-specific instructions matching the current state, language-specific instructions matching preferred_language, and absolute rules.

**Validates: Requirements 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 9.10, 9.11, 9.12, 9.13**

### Property 14: Response Message Type Determination

*For any* combination of AI text and tool results, format_response must analyze the data and return the most specific message type available (payment confirmation > QR code > trip cards > structured data > plain text), and all responses must include a "type" field.

**Validates: Requirements 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9, 10.10, 10.12**

### Property 15: WebSocket Session Initialization

*For any* new WebSocket connection, when an auth message is received, the session must be updated with user_id and preferred_language, and a welcome message in the preferred language must be sent; when resuming an existing session, a resume message referencing the current state must be sent.

**Validates: Requirements 11.5, 11.6, 11.7**

### Property 16: Message Processing Flow

*For any* user message received via WebSocket, the system must send typing_start indicator, execute run_agent, save the session, send typing_end indicator, and send the formatted response in that order.

**Validates: Requirements 11.8, 11.9, 11.10, 11.11, 11.12, 11.13**

### Property 17: Payment Event State Synchronization

*For any* payment event received via Redis pub/sub with status "SUCCEEDED" matching the session's payment_intent_id, the session must be updated to POST_BOOKING state with payment_status "CONFIRMED", saved to Redis, and a payment_confirmed event must be sent to the WebSocket.

**Validates: Requirements 12.3, 12.4, 12.5, 12.6, 12.7, 12.8**

### Property 18: Agent Message Appending

*For any* user message passed to run_agent, the message must be appended to session.messages in Anthropic format before LLM processing begins.

**Validates: Requirements 13.2**

### Property 19: Tool Call Loop Limit

*For any* agent execution, the system must enforce a maximum of 5 tool call iterations to prevent infinite loops, returning an error message if the limit is reached.

**Validates: Requirements 13.15**

### Property 20: Language Propagation

*For any* backend tool call, the session's preferred_language must be passed in the Accept-Language header, and welcome/resume messages must be formatted in the preferred language.

**Validates: Requirements 14.3, 14.8, 14.9**

### Property 21: Timeout Error Handling

*For any* tool call that times out (exceeds 15 seconds), the system must return an error response with code "TIMEOUT" and continue conversation processing without crashing.

**Validates: Requirements 15.6**

### Property 22: Model API Retry Logic

*For any* model API call that fails, the system must retry exactly once before returning an error to the user.

**Validates: Requirements 15.8**

### Property 23: Tool Input Validation

*For any* tool call, the system must validate tool inputs against the tool schema before making backend HTTP requests.

**Validates: Requirements 15.9**

### Property 24: Circuit Breaker Behavior

*For any* sequence of backend API failures exceeding the circuit breaker threshold, subsequent requests must fail fast with a user-friendly message about service unavailability.

**Validates: Requirements 15.11, 15.12**

### Property 25: Session ID Format Validation

*For any* WebSocket connection attempt, if the session_id is not a valid UUID format, the connection must be rejected.

**Validates: Requirements 16.5**

### Property 26: Rate Limiting Enforcement

*For any* session, if more than 10 messages are sent within a 1-minute window, subsequent messages must be rejected with a rate limit error.

**Validates: Requirements 16.7**

### Property 27: Input Sanitization

*For any* user input received via WebSocket, the system must sanitize the input to prevent injection attacks before processing.

**Validates: Requirements 16.8**

## Error Handling

### Exception Hierarchy

```python
class AIAgentException(Exception):
    """Base exception for AI Agent errors"""
    pass

class ModelAPIError(AIAgentException):
    """LLM API call failed"""
    pass

class ToolExecutionError(AIAgentException):
    """Tool execution failed"""
    pass

class SessionError(AIAgentException):
    """Session management error"""
    pass

class ValidationError(AIAgentException):
    """Input validation failed"""
    pass

class RateLimitError(AIAgentException):
    """Rate limit exceeded"""
    pass
```

### Error Handling Patterns

1. **WebSocket Errors**: Catch all exceptions, log with context, send user-friendly error message
2. **Tool Execution Errors**: Return error in tool result format, allow conversation to continue
3. **Model API Errors**: Retry once, then return error message
4. **Redis Errors**: Log and attempt reconnection, fail gracefully
5. **Validation Errors**: Return clear validation message to user

### Circuit Breaker Configuration

```python
CIRCUIT_BREAKER_CONFIG = {
    "failure_threshold": 5,  # Open after 5 failures
    "recovery_timeout": 60,  # Try again after 60 seconds
    "expected_exception": httpx.HTTPError
}
```

### Timeout Configuration

- **Model API calls**: 60 seconds
- **Backend tool calls**: 15 seconds
- **Redis operations**: 5 seconds
- **WebSocket message processing**: No timeout (async)

## Testing Strategy

### Dual Testing Approach

The AI Agent requires both unit tests and property-based tests for comprehensive coverage:

- **Unit tests**: Verify specific examples, edge cases, and integration points
- **Property tests**: Verify universal properties across all inputs using randomization

### Unit Testing

**Test Coverage Areas**:
- WebSocket connection lifecycle (connect, auth, disconnect)
- Health check endpoint returns correct format
- CORS middleware allows specified origins
- Tool handler functions call correct backend endpoints
- Session side effects update correct fields
- System prompt includes required sections for each state
- Response formatter selects correct message type
- Payment event listener subscribes to correct channel
- Configuration validation rejects invalid settings
- Error messages don't expose internal details

**Mocking Strategy**:
- Mock Anthropic API with `responses` library
- Mock backend HTTP calls with `httpx_mock`
- Mock Redis with `fakeredis`
- Mock WebSocket connections with FastAPI test client

**Example Unit Test**:
```python
import pytest
from agent.session.side_effects import apply_session_side_effects
from agent.session.state import ConversationState, AgentState

def test_create_booking_side_effect():
    """Test that createBooking updates session correctly"""
    session = ConversationState(
        session_id="test-123",
        user_id="user-456",
        state=AgentState.BOOKING
    )
    
    tool_result = {
        "success": True,
        "data": {
            "booking_id": "booking-789",
            "booking_ref": "DLG-2024-001",
            "reserved_until": "2024-01-15T10:30:00Z"
        }
    }
    
    apply_session_side_effects(session, "createBooking", tool_result)
    
    assert session.booking_id == "booking-789"
    assert session.booking_ref == "DLG-2024-001"
    assert session.state == AgentState.PAYMENT
    assert session.reserved_until is not None
```

### Property-Based Testing

**Library**: Use `hypothesis` for Python property-based testing

**Configuration**: Minimum 100 iterations per property test

**Test Tagging**: Each property test must reference its design property
```python
@pytest.mark.property_test
@pytest.mark.feature("agentic-llm-chatbot")
@pytest.mark.property(1, "ConversationState Serialization Round-Trip")
```

**Property Test Examples**:

```python
from hypothesis import given, strategies as st
from agent.session.state import ConversationState, AgentState
import json

@given(
    session_id=st.uuids().map(str),
    user_id=st.text(min_size=1, max_size=50),
    state=st.sampled_from(list(AgentState)),
    language=st.sampled_from(["EN", "KH", "ZH"])
)
@pytest.mark.property_test
@pytest.mark.feature("agentic-llm-chatbot")
@pytest.mark.property(1, "ConversationState Serialization Round-Trip")
@settings(max_examples=100)
def test_conversation_state_serialization_round_trip(
    session_id, user_id, state, language
):
    """
    Property 1: For any valid ConversationState, 
    serialize -> deserialize should preserve all fields
    
    Feature: agentic-llm-chatbot, Property 1: ConversationState Serialization Round-Trip
    """
    # Create original state
    original = ConversationState(
        session_id=session_id,
        user_id=user_id,
        state=state,
        preferred_language=language
    )
    
    # Serialize to JSON
    json_str = original.model_dump_json()
    
    # Deserialize back
    restored = ConversationState.model_validate_json(json_str)
    
    # Assert equivalence
    assert restored.session_id == original.session_id
    assert restored.user_id == original.user_id
    assert restored.state == original.state
    assert restored.preferred_language == original.preferred_language
```

```python
from hypothesis import given, strategies as st
from agent.tools.executor import ToolExecutor

@given(
    tool_calls=st.lists(
        st.fixed_dictionaries({
            "id": st.uuids().map(str),
            "name": st.sampled_from(["getTripSuggestions", "getTripItinerary"]),
            "input": st.fixed_dictionaries({})
        }),
        min_size=2,
        max_size=5
    )
)
@pytest.mark.property_test
@pytest.mark.feature("agentic-llm-chatbot")
@pytest.mark.property(7, "Parallel Tool Execution")
@settings(max_examples=100)
async def test_parallel_tool_execution_order(tool_calls):
    """
    Property 7: For any list of tool calls, 
    results must be returned in the same order as inputs
    
    Feature: agentic-llm-chatbot, Property 7: Parallel Tool Execution
    """
    executor = ToolExecutor()
    
    # Execute tools
    results = await executor.execute_tools_parallel(tool_calls, "EN")
    
    # Assert same length
    assert len(results) == len(tool_calls)
    
    # Assert order preserved (tool_use_id matches)
    for i, result in enumerate(results):
        assert result["tool_use_id"] == tool_calls[i]["id"]
```

```python
from hypothesis import given, strategies as st
from agent.prompts.builder import build_system_prompt
from agent.session.state import ConversationState, AgentState

@given(
    state=st.sampled_from(list(AgentState)),
    language=st.sampled_from(["EN", "KH", "ZH"]),
    has_booking=st.booleans()
)
@pytest.mark.property_test
@pytest.mark.feature("agentic-llm-chatbot")
@pytest.mark.property(13, "System Prompt State Adaptation")
@settings(max_examples=100)
def test_system_prompt_includes_required_sections(state, language, has_booking):
    """
    Property 13: For any ConversationState, 
    system prompt must include all required sections
    
    Feature: agentic-llm-chatbot, Property 13: System Prompt State Adaptation
    """
    session = ConversationState(
        session_id="test-123",
        user_id="user-456",
        state=state,
        preferred_language=language
    )
    
    if has_booking:
        session.booking_id = "booking-789"
        session.booking_ref = "DLG-2024-001"
    
    prompt = build_system_prompt(session)
    
    # Assert required sections present
    assert "DerLg.com AI Travel Concierge" in prompt  # Base identity
    assert f"Current Stage: {state}" in prompt  # Session context
    assert session.session_id in prompt  # Session ID
    assert session.user_id in prompt  # User ID
    assert "Absolute Rules" in prompt  # Absolute rules
    
    # Assert language-specific content
    if language == "EN":
        assert "English" in prompt
    elif language == "KH":
        assert "Khmer" in prompt or "ខ្មែរ" in prompt
    elif language == "ZH":
        assert "Chinese" in prompt or "中文" in prompt
    
    # Assert booking context if present
    if has_booking:
        assert session.booking_id in prompt
```

### Integration Testing

**Test Scenarios**:
1. Full conversation flow from DISCOVERY to POST_BOOKING
2. WebSocket connection with authentication and message exchange
3. Payment event triggering state transition
4. Session resumption after disconnection
5. Tool execution with mocked backend responses
6. Error recovery and retry logic
7. Rate limiting enforcement
8. Circuit breaker activation and recovery

**Example Integration Test**:
```python
@pytest.mark.asyncio
async def test_full_booking_flow():
    """Integration test for complete booking journey"""
    async with AsyncClient(app=app, base_url="http://test") as client:
        # Connect WebSocket
        async with client.websocket_connect("/ws/test-session-123") as websocket:
            # Send auth
            await websocket.send_json({
                "type": "auth",
                "user_id": "user-456",
                "language": "EN"
            })
            
            # Receive welcome
            welcome = await websocket.receive_json()
            assert welcome["type"] == "text"
            assert "Welcome" in welcome["text"]
            
            # Send discovery message
            await websocket.send_json({
                "type": "user_message",
                "content": "I want a 3-day beach adventure for 2 people with $500 budget"
            })
            
            # Receive typing indicators and response
            typing_start = await websocket.receive_json()
            assert typing_start["type"] == "typing_start"
            
            typing_end = await websocket.receive_json()
            assert typing_end["type"] == "typing_end"
            
            response = await websocket.receive_json()
            assert response["type"] == "trip_cards"
            assert len(response["trips"]) > 0
            
            # Continue through booking flow...
```

### Test Coverage Goals

- **Overall code coverage**: Minimum 80%
- **Critical paths coverage**: 100% (session management, tool execution, state transitions)
- **Property test iterations**: Minimum 100 per property
- **Integration test scenarios**: All 7 conversation stages covered


## Deployment

### Deployment Environments

The AI Agent supports two deployment modes:

1. **Development**: Docker Compose (all services containerized locally)
2. **Production**: Railway (cloud platform with managed services)

### Development Deployment (Docker Compose)

See the [Docker Development Environment](#docker-development-environment) section above for complete details.

**Quick Start**:
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

**Architecture**:
- All 5 services run in Docker containers
- PostgreSQL and Redis use persistent volumes
- Hot-reload enabled for all application services
- Services communicate via Docker network

### Production Deployment (Railway)

#### Docker Configuration for Production

**Dockerfile** (production-optimized):
```dockerfile
# Multi-stage build for smaller image size
FROM python:3.11-slim as builder

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Final stage
FROM python:3.11-slim

WORKDIR /app

# Copy dependencies from builder
COPY --from=builder /root/.local /root/.local

# Copy application code
COPY . .

# Make sure scripts in .local are usable
ENV PATH=/root/.local/bin:$PATH

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD python -c "import httpx; httpx.get('http://localhost:8000/health')"

# Run with uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
```

**.dockerignore**:
```
__pycache__
*.pyc
*.pyo
*.pyd
.Python
env/
venv/
.venv/
pip-log.txt
pip-delete-this-directory.txt
.tox/
.coverage
.coverage.*
.cache
nosetests.xml
coverage.xml
*.cover
*.log
.git
.gitignore
.mypy_cache
.pytest_cache
.hypothesis
*.md
tests/
.env
.env.local
```

### Requirements

**requirements.txt**:
```
fastapi==0.109.0
uvicorn[standard]==0.27.0
websockets==12.0
pydantic==2.5.3
pydantic-settings==2.1.0
anthropic==0.18.1
langgraph==0.0.26
redis==5.0.1
httpx==0.26.0
structlog==24.1.0
sentry-sdk==1.40.0
python-dotenv==1.0.0
pytest==7.4.4
pytest-asyncio==0.23.3
pytest-cov==4.1.0
hypothesis==6.98.0
httpx-mock==0.7.0
fakeredis==2.21.0
```

### Environment Variables

**Development (.env.development)**:
```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
SUPABASE_ANON_KEY=your-anon-key

# AI Service
ANTHROPIC_API_KEY=sk-ant-your-key
AI_SERVICE_KEY=your-32-character-service-key

# Database (Docker Compose)
DATABASE_URL=postgresql://derlg_user:derlg_dev_password@postgres:5432/derlg_dev

# Redis (Docker Compose)
REDIS_URL=redis://:derlg_redis_password@redis:6379/0

# Backend URL (Docker Compose)
BACKEND_URL=http://backend:3001

# Development Settings
NODE_ENV=development
LOG_LEVEL=debug
```

**Production (Railway)**:
```bash
# Model Backend
MODEL_BACKEND=anthropic  # or "ollama"
ANTHROPIC_API_KEY=sk-ant-...  # Required if MODEL_BACKEND=anthropic
OLLAMA_BASE_URL=http://localhost:11434  # Required if MODEL_BACKEND=ollama

# Backend API
BACKEND_URL=https://api.derlg.com
AI_SERVICE_KEY=your-32-character-service-key-here

# Redis (Railway Plugin)
REDIS_URL=redis://default:password@redis.railway.internal:6379

# Optional
HOST=0.0.0.0
PORT=8000
LOG_LEVEL=info
SENTRY_DSN=https://...@sentry.io/...
```

**.env.example**:
```bash
# Copy this file to .env and fill in your values

# Model Configuration
MODEL_BACKEND=anthropic
ANTHROPIC_API_KEY=
OLLAMA_BASE_URL=http://localhost:11434

# Backend Integration
BACKEND_URL=http://localhost:3000
AI_SERVICE_KEY=

# Redis
REDIS_URL=redis://localhost:6379/0

# Server
HOST=0.0.0.0
PORT=8000
LOG_LEVEL=info

# Monitoring (optional)
SENTRY_DSN=
```

### Railway Deployment

**railway.json**:
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "numReplicas": 2,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3,
    "healthcheckPath": "/health",
    "healthcheckTimeout": 10
  }
}
```

**Deployment Steps**:

1. **Create Railway Project**:
   ```bash
   railway init
   ```

2. **Add Redis Service**:
   - Add Redis plugin in Railway dashboard
   - Copy REDIS_URL from plugin settings

3. **Configure Environment Variables**:
   - Set all required environment variables in Railway dashboard
   - Use Railway's secret management for sensitive values

4. **Deploy**:
   ```bash
   railway up
   ```

5. **Verify Deployment**:
   ```bash
   curl https://your-app.railway.app/health
   ```

### Horizontal Scaling

The AI Agent is designed for horizontal scaling:

**Stateless Design**:
- All conversation state stored in Redis
- No in-memory session storage
- WebSocket connections can reconnect to any instance

**Load Balancing**:
- Railway automatically load balances across replicas
- WebSocket connections use sticky sessions (same instance for duration)
- Redis pub/sub ensures payment events reach correct instance

**Scaling Configuration**:
```json
{
  "deploy": {
    "numReplicas": 2,  // Start with 2, scale up as needed
    "autoscaling": {
      "enabled": true,
      "minReplicas": 2,
      "maxReplicas": 10,
      "targetCPUUtilization": 70
    }
  }
}
```

### Monitoring and Observability

**Health Checks**:
- Endpoint: `GET /health`
- Frequency: Every 30 seconds
- Timeout: 10 seconds
- Failure threshold: 3 consecutive failures

**Metrics** (Prometheus format at `/metrics`):
```
# Active WebSocket connections
ai_agent_active_connections{} 15

# Messages processed
ai_agent_messages_total{status="success"} 1234
ai_agent_messages_total{status="error"} 12

# Tool calls
ai_agent_tool_calls_total{tool_name="getTripSuggestions"} 456
ai_agent_tool_calls_total{tool_name="createBooking"} 89

# Response time
ai_agent_response_time_seconds{quantile="0.5"} 1.2
ai_agent_response_time_seconds{quantile="0.95"} 3.5
ai_agent_response_time_seconds{quantile="0.99"} 5.8

# Errors
ai_agent_errors_total{type="model_api_error"} 5
ai_agent_errors_total{type="tool_execution_error"} 8
```

**Structured Logging**:
```json
{
  "timestamp": "2024-01-15T10:30:45.123Z",
  "level": "info",
  "event": "user_message_received",
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": "user_123",
  "message_length": 45,
  "state": "DISCOVERY"
}
```

**Sentry Integration**:
- Automatic error tracking
- Performance monitoring
- Release tracking
- User context (session_id, user_id)

### Performance Considerations

**Optimization Strategies**:

1. **Context Window Management**:
   - Limit to last 20 messages (prevents token overflow)
   - Summarize older context if needed

2. **Parallel Tool Execution**:
   - Execute multiple tools concurrently with `asyncio.gather`
   - Reduces total latency for multi-tool responses

3. **Redis Connection Pooling**:
   - Reuse Redis connections across requests
   - Configure pool size based on replica count

4. **HTTP Client Reuse**:
   - Use persistent httpx.AsyncClient for backend calls
   - Enable HTTP/2 for multiplexing

5. **Caching**:
   - Cache tool schemas (loaded once at startup)
   - Cache prompt templates (loaded once at startup)

**Expected Performance**:
- **Simple message** (no tools): 1-2 seconds
- **Single tool call**: 2-4 seconds
- **Multiple tool calls**: 3-6 seconds (parallel execution)
- **WebSocket latency**: <100ms
- **Redis operations**: <10ms

### Security Considerations

**Authentication**:
- Service-to-service: X-Service-Key header (32+ character secret)
- User authentication: Handled by frontend, user_id passed in WebSocket auth

**Data Protection**:
- TLS for all external connections (Redis, backend API, Anthropic)
- No sensitive data in logs (user_id/booking_id hashed or redacted)
- Input sanitization to prevent injection attacks

**Rate Limiting**:
- 10 messages per minute per session
- Circuit breaker for backend API (5 failures = open circuit)
- Timeout enforcement (60s model, 15s tools)

**Secrets Management**:
- Environment variables for all secrets
- Railway secret management in production
- Never commit secrets to version control

### Disaster Recovery

**Backup Strategy**:
- Redis persistence enabled (RDB + AOF)
- Daily Redis backups to S3
- 7-day retention for session data

**Recovery Procedures**:
1. **Redis Failure**: Automatic reconnection, sessions lost if Redis data lost
2. **Backend API Failure**: Circuit breaker opens, user-friendly error messages
3. **Model API Failure**: Retry once, then error message
4. **Complete Service Failure**: Railway auto-restart, health check recovery

**Monitoring Alerts**:
- Health check failures (3+ consecutive)
- Error rate spike (>5% of requests)
- High latency (p95 >10 seconds)
- Redis connection failures
- Circuit breaker open

## Development Workflow

### Local Development Setup (Docker Compose)

**Recommended Approach**: Use Docker Compose for consistent development environment.

1. **Clone Repository**:
   ```bash
   git clone https://github.com/your-org/derlg.git
   cd derlg
   ```

2. **Create Environment File**:
   ```bash
   cp .env.example .env.development
   # Edit .env.development with your API keys
   ```

3. **Start All Services**:
   ```bash
   docker-compose up -d
   ```

4. **Run Database Migrations**:
   ```bash
   docker-compose exec backend npx prisma migrate dev
   ```

5. **Access Services**:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001
   - AI Agent: http://localhost:8000
   - PostgreSQL: localhost:5432
   - Redis: localhost:6379

6. **View Logs**:
   ```bash
   # All services
   docker-compose logs -f
   
   # Specific service
   docker-compose logs -f ai-agent
   ```

7. **Stop Services**:
   ```bash
   docker-compose down
   ```

### Alternative: Local Development (Without Docker)

If you prefer to run services directly on your machine:

1. **Clone Repository**:
   ```bash
   git clone https://github.com/your-org/ai-agent.git
   cd ai-agent
   ```

2. **Create Virtual Environment**:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Start Redis** (Docker):
   ```bash
   docker run -d -p 6379:6379 redis:7-alpine
   ```

5. **Configure Environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your values
   # Use localhost URLs for BACKEND_URL and REDIS_URL
   ```

6. **Run Application**:
   ```bash
   uvicorn main:app --reload --port 8000
   ```

7. **Test WebSocket**:
   ```bash
   # Use wscat or browser console
   wscat -c ws://localhost:8000/ws/test-session-123
   ```

### Testing with Docker

**Run All Tests**:
```bash
# Backend tests
docker-compose exec backend npm run test

# AI Agent tests
docker-compose exec ai-agent pytest

# Frontend tests
docker-compose exec frontend npm run test
```

**Run with Coverage**:
```bash
docker-compose exec ai-agent pytest --cov=agent --cov-report=html
```

**Run Property Tests Only**:
```bash
docker-compose exec ai-agent pytest -m property_test
```

**Run Integration Tests**:
```bash
docker-compose exec ai-agent pytest -m integration
```

### Code Quality

**Linting**:
```bash
ruff check .
```

**Type Checking**:
```bash
mypy agent/
```

**Formatting**:
```bash
black .
```

## Future Enhancements

### Phase 2: Ollama Support

- Complete Ollama client implementation
- Schema conversion testing
- Performance benchmarking vs. Claude
- Model selection UI in admin panel

### Phase 3: Advanced Features

- **Multi-turn Tool Planning**: Let AI plan multiple tool calls ahead
- **Conversation Summarization**: Compress old messages to extend context
- **Proactive Suggestions**: AI initiates helpful suggestions based on context
- **Voice Input/Output**: WebRTC integration for voice conversations
- **Image Understanding**: Upload photos for trip customization

### Phase 4: Analytics

- **Conversation Analytics**: Track common paths, drop-off points
- **A/B Testing**: Test different prompt strategies
- **User Satisfaction**: Collect feedback after bookings
- **Performance Optimization**: Identify slow tools, optimize prompts

## Conclusion

This design document provides a comprehensive blueprint for implementing the DerLg.com AI Agent. The architecture emphasizes:

- **Modularity**: Clear separation between model clients, tools, state management, and formatting
- **Testability**: Property-based testing ensures correctness across all inputs
- **Scalability**: Stateless design with Redis persistence enables horizontal scaling
- **Reliability**: Circuit breakers, retries, and graceful error handling
- **Maintainability**: Structured logging, comprehensive monitoring, and clear code organization

The implementation follows best practices for production AI systems while maintaining flexibility for future enhancements.
