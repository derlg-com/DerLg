# Implementation Tasks: DerLg.com AI Agent (Agentic LLM Chatbot)

## Overview

This task list implements the Python FastAPI AI Agent service with LangGraph state machine orchestration, Claude Sonnet 4.5 integration, WebSocket communication, and comprehensive tool calling capabilities for Cambodia travel booking assistance.

## Phase 1: Project Foundation and Configuration

### Task 1.1: Project Structure and Dependencies

- [x] 1.1.1 Create project directory structure (agent/, api/, config/, utils/, tests/)
- [x] 1.1.2 Create requirements.txt with all dependencies (FastAPI, LangGraph, Anthropic, Redis, etc.)
- [x] 1.1.3 Create .env.example with all required environment variables
- [x] 1.1.4 Create main.py with FastAPI application initialization
- [x] 1.1.5 Create config/settings.py with Pydantic BaseSettings
- [x] 1.1.6 Implement environment variable validation on startup
- [x] 1.1.7 Create Dockerfile for production deployment
- [x] 1.1.8 Create Dockerfile.dev for development with hot reload
- [x] 1.1.9 Create docker-compose.yml entry for AI agent service
- [x] 1.1.10 Create README.md with setup and deployment instructions

### Task 1.2: Logging and Monitoring Setup

- [x] 1.2.1 Configure structlog for structured JSON logging
- [x] 1.2.2 Implement logging middleware for all requests
- [x] 1.2.3 Create utils/logging.py with log level configuration
- [x] 1.2.4 Integrate Sentry for error tracking
- [x] 1.2.5 Create /health endpoint for health checks
- [x] 1.2.6 Create /metrics endpoint with Prometheus format
- [x] 1.2.7 Implement metrics tracking (active connections, messages processed, tool calls)


## Phase 2: Data Models and State Management

### Task 2.1: Conversation State Models

- [x] 2.1.1 Create agent/session/state.py with AgentState enum (7 stages)
- [x] 2.1.2 Implement ConversationState Pydantic model with all fields
- [x] 2.1.3 Add JSON serialization/deserialization methods
- [x] 2.1.4 Implement datetime handling for created_at, last_active, reserved_until
- [x] 2.1.5 Add validation for preferred_language (EN, KH, ZH)
- [x] 2.1.6 Create property-based tests for state serialization round-trip

### Task 2.2: Redis Integration

- [x] 2.2.1 Create utils/redis.py with Redis connection utilities
- [x] 2.2.2 Implement init_redis and close_redis lifecycle functions
- [x] 2.2.3 Create agent/session/manager.py with SessionManager class
- [x] 2.2.4 Implement save_session method with 7-day TTL
- [x] 2.2.5 Implement load_session method with deserialization
- [x] 2.2.6 Implement delete_session method
- [x] 2.2.7 Add booking hold expiration check on session load
- [x] 2.2.8 Implement state recovery for expired booking holds
- [x] 2.2.9 Add Redis connection error handling with retry logic
- [x] 2.2.10 Create unit tests for session persistence


## Phase 3: Model Client Architecture

### Task 3.1: Model Client Interface

- [x] 3.1.1 Create agent/models/client.py with ModelClient abstract interface
- [x] 3.1.2 Define create_message method signature
- [x] 3.1.3 Create ModelResponse dataclass
- [x] 3.1.4 Create ContentBlock dataclass for response content
- [x] 3.1.5 Implement get_model_client factory function

### Task 3.2: Anthropic Client Implementation

- [x] 3.2.1 Create agent/models/anthropic.py with AnthropicClient class
- [x] 3.2.2 Initialize AsyncAnthropic client with API key
- [x] 3.2.3 Implement create_message method calling Claude Sonnet 4.5
- [x] 3.2.4 Convert Anthropic response format to ModelResponse
- [x] 3.2.5 Handle tool_use and end_turn stop reasons
- [x] 3.2.6 Implement error handling and retry logic
- [x] 3.2.7 Add timeout configuration (60 seconds)
- [x] 3.2.8 Log token usage and latency metrics

### Task 3.3: Ollama Client Implementation

- [x] 3.3.1 Create agent/models/ollama.py with OllamaClient class
- [x] 3.3.2 Implement HTTP client for Ollama API
- [x] 3.3.3 Convert Claude tool schemas to OpenAI format
- [x] 3.3.4 Implement create_message method for Ollama
- [x] 3.3.5 Convert Ollama response format to ModelResponse
- [x] 3.3.6 Add fallback to Anthropic for Khmer language
- [x] 3.3.7 Create unit tests for both clients


## Phase 4: Tool System Implementation

### Task 4.1: Tool Schema Definitions

- [x] 4.1.1 Create agent/tools/schemas.py
- [x] 4.1.2 Define getTripSuggestions tool schema with all parameters
- [x] 4.1.3 Define getTripItinerary tool schema
- [x] 4.1.4 Define getTripImages tool schema
- [x] 4.1.5 Define getHotelDetails tool schema
- [x] 4.1.6 Define getWeatherForecast tool schema
- [x] 4.1.7 Define compareTrips tool schema
- [x] 4.1.8 Define calculateCustomTrip tool schema
- [x] 4.1.9 Define customizeTrip tool schema
- [x] 4.1.10 Define applyDiscountCode tool schema
- [x] 4.1.11 Define validateUserDetails tool schema
- [x] 4.1.12 Define createBooking tool schema with all parameters
- [x] 4.1.13 Define generatePaymentQR tool schema
- [x] 4.1.14 Define checkPaymentStatus tool schema
- [x] 4.1.15 Define cancelBooking tool schema
- [x] 4.1.16 Define modifyBooking tool schema
- [x] 4.1.17 Define getPlaces tool schema
- [x] 4.1.18 Define getUpcomingFestivals tool schema
- [x] 4.1.19 Define estimateBudget tool schema
- [x] 4.1.20 Define getCurrencyRates tool schema
- [x] 4.1.21 Add detailed descriptions and examples for each tool
- [x] 4.1.22 Create property-based tests for schema validation

### Task 4.2: Tool Handlers - Trip Tools

- [x] 4.2.1 Create agent/tools/handlers/trips.py
- [x] 4.2.2 Implement getTripSuggestions handler calling backend API
- [x] 4.2.3 Implement getTripItinerary handler
- [x] 4.2.4 Implement getTripImages handler
- [x] 4.2.5 Implement compareTrips handler
- [x] 4.2.6 Implement calculateCustomTrip handler
- [x] 4.2.7 Implement customizeTrip handler
- [x] 4.2.8 Add error handling for all trip tool handlers
- [x] 4.2.9 Create unit tests with mocked backend responses


### Task 4.3: Tool Handlers - Booking Tools

- [x] 4.3.1 Create agent/tools/handlers/booking.py
- [x] 4.3.2 Implement validateUserDetails handler
- [x] 4.3.3 Implement createBooking handler with all parameters
- [x] 4.3.4 Implement cancelBooking handler
- [x] 4.3.5 Implement modifyBooking handler
- [x] 4.3.6 Implement applyDiscountCode handler
- [x] 4.3.7 Add validation for booking parameters
- [x] 4.3.8 Create unit tests for booking tool handlers

### Task 4.4: Tool Handlers - Payment Tools

- [x] 4.4.1 Create agent/tools/handlers/payment.py
- [x] 4.4.2 Implement generatePaymentQR handler
- [x] 4.4.3 Implement checkPaymentStatus handler
- [x] 4.4.4 Add error handling for payment failures
- [x] 4.4.5 Create unit tests for payment tool handlers

### Task 4.5: Tool Handlers - Information Tools

- [x] 4.5.1 Create agent/tools/handlers/info.py
- [x] 4.5.2 Implement getHotelDetails handler
- [x] 4.5.3 Implement getWeatherForecast handler
- [x] 4.5.4 Implement getPlaces handler with filtering
- [x] 4.5.5 Implement getUpcomingFestivals handler
- [x] 4.5.6 Implement estimateBudget handler
- [x] 4.5.7 Implement getCurrencyRates handler
- [x] 4.5.8 Create unit tests for information tool handlers

### Task 4.6: Tool Execution System

- [x] 4.6.1 Create agent/tools/executor.py
- [x] 4.6.2 Implement execute_tools_parallel function with asyncio.gather
- [x] 4.6.3 Create TOOL_DISPATCH dictionary mapping tool names to handlers
- [x] 4.6.4 Implement httpx.AsyncClient for backend HTTP requests
- [x] 4.6.5 Add X-Service-Key header to all backend requests
- [x] 4.6.6 Add Accept-Language header based on session language
- [x] 4.6.7 Implement 15-second timeout for tool requests
- [x] 4.6.8 Convert tool results to Anthropic tool_result format
- [x] 4.6.9 Implement error handling and generic error responses
- [x] 4.6.10 Create integration tests with mocked backend


### Task 4.7: Session Side Effects

- [x] 4.7.1 Create _apply_session_side_effects function
- [x] 4.7.2 Update suggested_trip_ids when getTripSuggestions succeeds
- [x] 4.7.3 Update booking_id, booking_ref, reserved_until when createBooking succeeds
- [x] 4.7.4 Transition state to PAYMENT when createBooking succeeds
- [x] 4.7.5 Update payment_intent_id when generatePaymentQR succeeds
- [x] 4.7.6 Update payment_status and transition to POST_BOOKING when payment succeeds
- [x] 4.7.7 Clear booking context and reset to DISCOVERY when cancelBooking succeeds
- [x] 4.7.8 Create unit tests for all side effect scenarios

## Phase 5: System Prompt Engineering

### Task 5.1: Prompt Builder Implementation

- [x] 5.1.1 Create agent/prompts/builder.py
- [x] 5.1.2 Implement build_system_prompt function
- [x] 5.1.3 Create base prompt with core identity and absolute rules
- [x] 5.1.4 Add context section with session state variables
- [x] 5.1.5 Create agent/prompts/templates.py for stage-specific prompts

### Task 5.2: Stage-Specific Prompts

- [x] 5.2.1 Create DISCOVERY stage prompt (gather 6 required fields)
- [x] 5.2.2 Create SUGGESTION stage prompt (present trip options)
- [x] 5.2.3 Create EXPLORATION stage prompt (answer questions, provide details)
- [x] 5.2.4 Create CUSTOMIZATION stage prompt (discuss modifications)
- [x] 5.2.5 Create BOOKING stage prompt (3-step booking flow)
- [x] 5.2.6 Create PAYMENT stage prompt (generate QR, monitor status)
- [x] 5.2.7 Create POST_BOOKING stage prompt (confirmation and next steps)

### Task 5.3: Language-Specific Instructions

- [x] 5.3.1 Add English (EN) language instructions
- [x] 5.3.2 Add Khmer (KH) language instructions
- [x] 5.3.3 Add Chinese (ZH) language instructions
- [x] 5.3.4 Create unit tests for prompt generation with all states and languages


## Phase 6: Response Formatting System

### Task 6.1: Message Type Definitions

- [x] 6.1.1 Create agent/formatters/message_types.py
- [x] 6.1.2 Define TextMessage Pydantic model
- [x] 6.1.3 Define TripCardsMessage model with trip data
- [x] 6.1.4 Define QRPaymentMessage model with QR data
- [x] 6.1.5 Define BookingConfirmedMessage model
- [x] 6.1.6 Define WeatherMessage model with forecast data
- [x] 6.1.7 Define ItineraryMessage model
- [x] 6.1.8 Define BudgetEstimateMessage model
- [x] 6.1.9 Define ComparisonMessage model for trip comparisons
- [x] 6.1.10 Define ImageGalleryMessage model
- [x] 6.1.11 Add "type" field to all message models for frontend routing

### Task 6.2: Response Formatter Implementation

- [x] 6.2.1 Create agent/formatters/formatter.py
- [x] 6.2.2 Implement format_response function
- [x] 6.2.3 Detect "trips" array in tool results → return TripCardsMessage
- [x] 6.2.4 Detect "qr_code_url" → return QRPaymentMessage
- [x] 6.2.5 Detect payment success + POST_BOOKING state → return BookingConfirmedMessage
- [x] 6.2.6 Detect "forecast" → return WeatherMessage
- [x] 6.2.7 Detect "itinerary" → return ItineraryMessage
- [x] 6.2.8 Detect "total_estimate_usd" → return BudgetEstimateMessage
- [x] 6.2.9 Detect exactly 2 trips → return ComparisonMessage
- [x] 6.2.10 Detect "images" array → return ImageGalleryMessage
- [x] 6.2.11 Default to TextMessage when no structured data present
- [x] 6.2.12 Create unit tests for all message type detections


## Phase 7: LangGraph State Machine

### Task 7.1: State Machine Definition

- [x] 7.1.1 Create agent/graph.py
- [x] 7.1.2 Define LangGraph StateGraph
- [x] 7.1.3 Create call_llm node function
- [x] 7.1.4 Create execute_tools node function
- [x] 7.1.5 Create format_response node function
- [x] 7.1.6 Set call_llm as entry point
- [x] 7.1.7 Add edge: call_llm → execute_tools (when stop_reason = "tool_use")
- [x] 7.1.8 Add edge: call_llm → format_response (when stop_reason = "end_turn")
- [x] 7.1.9 Add edge: execute_tools → call_llm (loop back)
- [x] 7.1.10 Add edge: format_response → END

### Task 7.2: State Persistence with RedisSaver

- [x] 7.2.1 Configure RedisSaver as LangGraph checkpointer
- [x] 7.2.2 Persist state after each node execution
- [x] 7.2.3 Implement checkpoint loading for conversation resumption
- [x] 7.2.4 Create integration tests for state persistence

### Task 7.3: Agent Execution Loop

- [x] 7.3.1 Create agent/core.py
- [x] 7.3.2 Implement run_agent function
- [x] 7.3.3 Append user message to session.messages
- [x] 7.3.4 Build system prompt using build_system_prompt
- [x] 7.3.5 Get model client using get_model_client
- [x] 7.3.6 Pass last 20 messages to model (context window limit)
- [x] 7.3.7 Pass all 20 tool schemas to model
- [x] 7.3.8 Set max_tokens to 2048
- [x] 7.3.9 Handle tool_use stop_reason with tool execution loop
- [x] 7.3.10 Handle end_turn stop_reason with response formatting
- [x] 7.3.11 Implement maximum 5 tool call loops to prevent infinite loops
- [x] 7.3.12 Return formatted response to WebSocket handler
- [x] 7.3.13 Create integration tests for agent execution


## Phase 8: WebSocket Server Implementation

### Task 8.1: WebSocket Endpoint

- [x] 8.1.1 Create api/websocket.py
- [x] 8.1.2 Define WebSocket endpoint at /ws/{session_id}
- [x] 8.1.3 Accept WebSocket connection
- [x] 8.1.4 Load or create session on connection
- [x] 8.1.5 Maintain active_connections dictionary

### Task 8.2: Authentication and Welcome Flow

- [x] 8.2.1 Expect first message to be auth message with user_id and language
- [x] 8.2.2 Update session.user_id and session.preferred_language
- [x] 8.2.3 Send welcome message for new sessions
- [x] 8.2.4 Send resume message for existing sessions
- [x] 8.2.5 Create welcome/resume message templates in all languages

### Task 8.3: Message Handling

- [x] 8.3.1 Listen for messages with type "user_message"
- [x] 8.3.2 Send typing_start indicator when processing begins
- [x] 8.3.3 Call run_agent function with session and message
- [x] 8.3.4 Send typing_end indicator when processing completes
- [x] 8.3.5 Send formatted response message
- [x] 8.3.6 Send error message with type "error" on failures
- [x] 8.3.7 Save session to Redis after every message exchange

### Task 8.4: Connection Management

- [x] 8.4.1 Save session on WebSocket disconnect
- [x] 8.4.2 Remove connection from active_connections
- [x] 8.4.3 Implement graceful shutdown handling
- [x] 8.4.4 Add connection timeout handling
- [x] 8.4.5 Create integration tests for WebSocket flow


## Phase 9: Payment Event Listener

### Task 9.1: Redis Pub/Sub Integration

- [x] 9.1.1 Start background task listen_for_payment_events on WebSocket connect
- [x] 9.1.2 Subscribe to Redis channel "payment_events:{user_id}"
- [x] 9.1.3 Listen for payment events with status "SUCCEEDED"

### Task 9.2: Payment Confirmation Flow

- [x] 9.2.1 Update session state to POST_BOOKING on payment success
- [x] 9.2.2 Update session.payment_status to "CONFIRMED"
- [x] 9.2.3 Save session to Redis
- [x] 9.2.4 Send payment_confirmed event to WebSocket
- [x] 9.2.5 Generate confirmation message using run_agent
- [x] 9.2.6 Send confirmation message to WebSocket

### Task 9.3: Error Handling

- [x] 9.3.1 Cancel payment listener task on WebSocket disconnect
- [x] 9.3.2 Handle Redis connection errors gracefully
- [x] 9.3.3 Implement reconnection logic for Redis pub/sub
- [x] 9.3.4 Create integration tests for payment event flow

## Phase 10: Multi-Language Support

### Task 10.1: Language Configuration

- [x] 10.1.1 Support three languages: EN, KH, ZH
- [x] 10.1.2 Accept preferred_language in WebSocket auth message
- [x] 10.1.3 Pass preferred_language to backend in Accept-Language header
- [x] 10.1.4 Include language-specific instructions in system prompt

### Task 10.2: Language-Specific Behavior

- [x] 10.2.1 Instruct Claude to respond in English for EN
- [x] 10.2.2 Instruct Claude to respond in Khmer for KH
- [x] 10.2.3 Instruct Claude to respond in Simplified Chinese for ZH
- [x] 10.2.4 Always use AnthropicClient for KH (best Khmer support)
- [x] 10.2.5 Pass language parameter to tools supporting localized content
- [x] 10.2.6 Format welcome and resume messages in preferred language
- [x] 10.2.7 Create integration tests for all three languages


## Phase 11: Error Handling and Resilience

### Task 11.1: Exception Handling

- [x] 11.1.1 Catch all exceptions in WebSocket message handler
- [x] 11.1.2 Log errors with full stack trace using structlog
- [x] 11.1.3 Send user-friendly error messages to WebSocket
- [x] 11.1.4 Sanitize error messages to avoid exposing internal details

### Task 11.2: Timeout Handling

- [x] 11.2.1 Implement 60-second timeout for model API calls
- [x] 11.2.2 Implement 15-second timeout for backend tool calls
- [x] 11.2.3 Return error response on timeout and continue conversation
- [x] 11.2.4 Create unit tests for timeout scenarios

### Task 11.3: Retry Logic

- [x] 11.3.1 Retry model API calls once before returning error
- [x] 11.3.2 Implement exponential backoff for retries
- [x] 11.3.3 Create unit tests for retry logic

### Task 11.4: Circuit Breaker Pattern

- [x] 11.4.1 Implement circuit breaker for backend API calls
- [x] 11.4.2 Open circuit after 5 consecutive failures
- [x] 11.4.3 Half-open circuit after 30-second cooldown
- [x] 11.4.4 Inform user when backend is unavailable
- [x] 11.4.5 Create integration tests for circuit breaker

### Task 11.5: Redis Connection Resilience

- [x] 11.5.1 Log Redis connection failures
- [x] 11.5.2 Attempt Redis reconnection with exponential backoff
- [x] 11.5.3 Gracefully degrade when Redis is unavailable
- [x] 11.5.4 Create integration tests for Redis failure scenarios


## Phase 12: Security and Authentication

### Task 12.1: Service Key Authentication

- [x] 12.1.1 Require AI_SERVICE_KEY environment variable
- [x] 12.1.2 Include X-Service-Key header in all backend requests
- [x] 12.1.3 Validate AI_SERVICE_KEY is at least 32 characters on startup
- [x] 12.1.4 Fail fast with clear error if key is missing or invalid

### Task 12.2: Input Validation

- [x] 12.2.1 Validate session_id format (UUID) before accepting connection
- [x] 12.2.2 Require user_id in auth message before processing
- [x] 12.2.3 Sanitize user input to prevent injection attacks
- [x] 12.2.4 Validate all tool inputs before making backend calls

### Task 12.3: Rate Limiting

- [x] 12.3.1 Implement rate limiting on WebSocket messages (10 per minute per session)
- [x] 12.3.2 Use Redis for distributed rate limiting
- [x] 12.3.3 Return rate limit error message to user
- [x] 12.3.4 Create unit tests for rate limiting

### Task 12.4: Secure Communication

- [x] 12.4.1 Use TLS for Redis connections (rediss:// scheme)
- [x] 12.4.2 Do not expose internal errors to WebSocket clients
- [x] 12.4.3 Do not log sensitive data (user_id, booking_id, payment_intent_id) in plain text
- [x] 12.4.4 Implement security headers in FastAPI responses


## Phase 13: Testing Infrastructure

### Task 13.1: Unit Tests

- [x] 13.1.1 Create tests/unit/ directory structure
- [x] 13.1.2 Write unit tests for all tool handlers (20 tools)
- [x] 13.1.3 Write unit tests for system prompt builder (all states)
- [x] 13.1.4 Write unit tests for response formatter (all message types)
- [x] 13.1.5 Write unit tests for session side effects logic
- [x] 13.1.6 Mock external dependencies (Anthropic, backend, Redis)
- [x] 13.1.7 Use pytest-asyncio for async test support
- [x] 13.1.8 Achieve minimum 80% code coverage

### Task 13.2: Integration Tests

- [x] 13.2.1 Create tests/integration/ directory structure
- [x] 13.2.2 Write integration tests for WebSocket message flow
- [x] 13.2.3 Write integration tests for tool execution with mocked backend
- [x] 13.2.4 Write integration tests for payment event listener
- [x] 13.2.5 Write integration tests for state machine execution
- [x] 13.2.6 Use test Redis instance for integration tests

### Task 13.3: Property-Based Tests

- [x] 13.3.1 Create tests/property/ directory structure
- [x] 13.3.2 Write property tests for ConversationState serialization round-trip
- [x] 13.3.3 Write property tests for tool schema validation
- [x] 13.3.4 Use Hypothesis library for property-based testing
- [x] 13.3.5 Verify parse(format(x)) == x for all data models

### Task 13.4: Test Configuration

- [x] 13.4.1 Create pytest.ini configuration
- [x] 13.4.2 Create conftest.py with shared fixtures
- [x] 13.4.3 Configure test coverage reporting
- [x] 13.4.4 Create test environment variables file
- [x] 13.4.5 Add test commands to README.md


## Phase 14: Docker Development Environment

### Task 14.1: Development Dockerfile

- [x] 14.1.1 Create Dockerfile.dev with Python 3.11 base image
- [x] 14.1.2 Install dependencies from requirements.txt
- [x] 14.1.3 Configure uvicorn with --reload for hot reload
- [x] 14.1.4 Expose port 8000
- [x] 14.1.5 Set working directory to /app

### Task 14.2: Docker Compose Integration

- [x] 14.2.1 Add ai-agent service to docker-compose.yml
- [x] 14.2.2 Configure environment variables (MODEL_BACKEND, ANTHROPIC_API_KEY, etc.)
- [x] 14.2.3 Set up volume mounts for hot reload (./ai-agent:/app)
- [x] 14.2.4 Configure dependencies (wait for Redis and Backend)
- [x] 14.2.5 Add to derlg-network bridge network
- [x] 14.2.6 Map port 8000:8000

### Task 14.3: Service Communication

- [x] 14.3.1 Configure BACKEND_URL to use container name (http://backend:3001)
- [x] 14.3.2 Configure REDIS_URL to use container name (redis://redis:6379)
- [x] 14.3.3 Test inter-service communication
- [x] 14.3.4 Verify WebSocket connections from frontend container

### Task 14.4: Development Workflow

- [x] 14.4.1 Document docker-compose up command
- [x] 14.4.2 Document hot reload behavior
- [x] 14.4.3 Document debugging with docker-compose exec
- [x] 14.4.4 Document viewing logs with docker-compose logs
- [x] 14.4.5 Create troubleshooting guide for common issues


## Phase 15: Production Deployment

### Task 15.1: Production Dockerfile

- [x] 15.1.1 Create Dockerfile with multi-stage build
- [x] 15.1.2 Use Python 3.11-slim base image for smaller size
- [x] 15.1.3 Install production dependencies only
- [x] 15.1.4 Copy application code
- [x] 15.1.5 Expose port 8000
- [x] 15.1.6 Add HEALTHCHECK instruction
- [x] 15.1.7 Run with uvicorn using 2 workers
- [x] 15.1.8 Create .dockerignore to exclude unnecessary files

### Task 15.2: Railway Deployment Configuration

- [x] 15.2.1 Create railway.json configuration file
- [x] 15.2.2 Configure build command
- [x] 15.2.3 Configure start command
- [x] 15.2.4 Set health check path to /health
- [x] 15.2.5 Configure environment variables in Railway dashboard
- [x] 15.2.6 Document deployment steps in README.md

### Task 15.3: Environment Configuration

- [x] 15.3.1 Create .env.example with all required variables
- [x] 15.3.2 Document MODEL_BACKEND options (anthropic, ollama)
- [x] 15.3.3 Document ANTHROPIC_API_KEY requirement
- [x] 15.3.4 Document BACKEND_URL format
- [x] 15.3.5 Document AI_SERVICE_KEY generation
- [x] 15.3.6 Document REDIS_URL format (Upstash)
- [x] 15.3.7 Document optional SENTRY_DSN for error tracking

### Task 15.4: Production Monitoring

- [x] 15.4.1 Configure Sentry error tracking
- [x] 15.4.2 Set up Prometheus metrics collection
- [x] 15.4.3 Configure structured logging for production
- [x] 15.4.4 Set up health check monitoring
- [x] 15.4.5 Configure uptime monitoring
- [x] 15.4.6 Document monitoring dashboard access


## Phase 16: Integration with Backend and Frontend

### Task 16.1: Backend AI Tools API Integration

- [x] 16.1.1 Verify backend /v1/ai-tools/ endpoints are implemented
- [x] 16.1.2 Test getTripSuggestions tool with backend
- [x] 16.1.3 Test createBooking tool with backend
- [x] 16.1.4 Test generatePaymentQR tool with backend
- [x] 16.1.5 Test all 20 tools end-to-end with backend
- [x] 16.1.6 Verify X-Service-Key authentication works
- [x] 16.1.7 Verify Accept-Language header is respected
- [x] 16.1.8 Test error handling for backend failures

### Task 16.2: Frontend WebSocket Integration

- [x] 16.2.1 Verify frontend can connect to /ws/{session_id}
- [x] 16.2.2 Test auth message flow from frontend
- [x] 16.2.3 Test user message sending from frontend
- [x] 16.2.4 Test structured message rendering in frontend
- [x] 16.2.5 Test typing indicators in frontend
- [x] 16.2.6 Test connection status indicators in frontend
- [x] 16.2.7 Test reconnection logic from frontend
- [x] 16.2.8 Test chat history persistence in frontend

### Task 16.3: Payment Event Integration

- [x] 16.3.1 Verify backend publishes to Redis payment_events channel
- [x] 16.3.2 Test payment event listener receives events
- [x] 16.3.3 Test payment confirmation flow end-to-end
- [x] 16.3.4 Verify frontend receives payment confirmation
- [x] 16.3.5 Test state transition to POST_BOOKING

### Task 16.4: Multi-Service Testing

- [x] 16.4.1 Test complete booking flow (Frontend → AI Agent → Backend)
- [x] 16.4.2 Test payment flow with Stripe webhook
- [x] 16.4.3 Test emergency alert flow
- [x] 16.4.4 Test student discount verification flow
- [x] 16.4.5 Test loyalty points redemption flow
- [x] 16.4.6 Create end-to-end test suite for critical flows


## Phase 17: Documentation and Developer Experience

### Task 17.1: API Documentation

- [x] 17.1.1 Document WebSocket connection protocol
- [x] 17.1.2 Document message format specifications
- [x] 17.1.3 Document all tool schemas with examples
- [x] 17.1.4 Document conversation state model
- [x] 17.1.5 Document error codes and handling
- [x] 17.1.6 Create API reference documentation

### Task 17.2: Developer Guide

- [x] 17.2.1 Write setup instructions for local development
- [x] 17.2.2 Document Docker development workflow
- [x] 17.2.3 Document testing procedures
- [x] 17.2.4 Document debugging techniques
- [x] 17.2.5 Create troubleshooting guide
- [x] 17.2.6 Document common issues and solutions

### Task 17.3: Architecture Documentation

- [x] 17.3.1 Create architecture diagrams (state machine, data flow)
- [x] 17.3.2 Document design decisions and rationale
- [x] 17.3.3 Document LangGraph state machine flow
- [x] 17.3.4 Document tool execution pipeline
- [x] 17.3.5 Document session management strategy
- [x] 17.3.6 Document multi-language support approach

### Task 17.4: Code Quality

- [x] 17.4.1 Add type hints to all Python functions
- [x] 17.4.2 Add docstrings to all public functions and classes
- [x] 17.4.3 Configure Black for code formatting
- [x] 17.4.4 Configure Pylint for linting
- [x] 17.4.5 Configure mypy for type checking
- [x] 17.4.6 Add pre-commit hooks for formatting and linting
- [x] 17.4.7 Create CONTRIBUTING.md with code standards


## Phase 18: Performance Optimization

### Task 18.1: Response Time Optimization

- [x] 18.1.1 Profile tool execution times
- [x] 18.1.2 Optimize parallel tool execution
- [x] 18.1.3 Implement caching for frequently accessed data
- [x] 18.1.4 Optimize Redis operations
- [x] 18.1.5 Reduce model API latency with streaming (if supported)
- [x] 18.1.6 Benchmark end-to-end response times

### Task 18.2: Resource Optimization

- [x] 18.2.1 Optimize memory usage for session storage
- [x] 18.2.2 Implement connection pooling for HTTP clients
- [x] 18.2.3 Optimize Redis connection management
- [x] 18.2.4 Profile CPU usage and optimize hot paths
- [x] 18.2.5 Configure appropriate worker count for production

### Task 18.3: Scalability

- [x] 18.3.1 Test horizontal scaling with multiple instances
- [x] 18.3.2 Verify Redis state sharing across instances
- [x] 18.3.3 Test load balancing behavior
- [x] 18.3.4 Implement graceful shutdown for zero-downtime deploys
- [x] 18.3.5 Document scaling recommendations

## Phase 19: Advanced Features

### Task 19.1: Conversation Context Management

- [x] 19.1.1 Implement conversation summarization for long sessions
- [x] 19.1.2 Optimize message history pruning (keep last 20 messages)
- [x] 19.1.3 Implement context window management
- [x] 19.1.4 Add conversation export functionality
- [x] 19.1.5 Test context preservation across reconnections

### Task 19.2: Enhanced Error Recovery

- [x] 19.2.1 Implement automatic retry for transient failures
- [x] 19.2.2 Add fallback responses for tool failures
- [x] 19.2.3 Implement graceful degradation when services unavailable
- [x] 19.2.4 Add user-friendly error explanations
- [x] 19.2.5 Test error recovery scenarios

### Task 19.3: Analytics and Insights

- [x] 19.3.1 Track conversation metrics (duration, message count)
- [x] 19.3.2 Track tool usage statistics
- [x] 19.3.3 Track state transition patterns
- [x] 19.3.4 Track conversion rates (discovery → booking)
- [x] 19.3.5 Create analytics dashboard
- [x] 19.3.6 Export metrics to monitoring system


## Phase 20: Quality Assurance and Launch Preparation

### Task 20.1: Comprehensive Testing

- [x] 20.1.1 Run full test suite (unit, integration, property-based)
- [x] 20.1.2 Verify 80%+ code coverage achieved
- [x] 20.1.3 Perform load testing with multiple concurrent connections
- [x] 20.1.4 Test all 7 conversation states thoroughly
- [x] 20.1.5 Test all 20 tools with various inputs
- [x] 20.1.6 Test error scenarios and edge cases
- [x] 20.1.7 Test multi-language support (EN, KH, ZH)
- [x] 20.1.8 Perform security testing (injection, authentication)

### Task 20.2: User Acceptance Testing

- [x] 20.2.1 Test complete booking flow with real users
- [x] 20.2.2 Test payment flow with test Stripe account
- [x] 20.2.3 Test emergency alert flow
- [x] 20.2.4 Gather feedback on conversation quality
- [x] 20.2.5 Test on multiple devices and browsers
- [x] 20.2.6 Verify mobile responsiveness
- [x] 20.2.7 Test offline behavior

### Task 20.3: Production Readiness Checklist

- [x] 20.3.1 Verify all environment variables configured
- [x] 20.3.2 Verify Anthropic API key is valid and has credits
- [x] 20.3.3 Verify backend AI_SERVICE_KEY matches
- [x] 20.3.4 Verify Redis connection (Upstash) is configured
- [x] 20.3.5 Verify Sentry error tracking is working
- [x] 20.3.6 Verify health check endpoint responds correctly
- [x] 20.3.7 Verify metrics endpoint is accessible
- [x] 20.3.8 Verify logging is configured for production
- [x] 20.3.9 Verify CORS settings allow frontend domain
- [x] 20.3.10 Verify rate limiting is enabled

### Task 20.4: Launch Documentation

- [x] 20.4.1 Create deployment runbook
- [x] 20.4.2 Document rollback procedures
- [x] 20.4.3 Create incident response guide
- [x] 20.4.4 Document monitoring and alerting setup
- [x] 20.4.5 Create user guide for AI chat features
- [x] 20.4.6 Document known limitations and workarounds

### Task 20.5: Post-Launch Monitoring

- [x] 20.5.1 Set up alerts for error rate thresholds
- [x] 20.5.2 Set up alerts for response time degradation
- [x] 20.5.3 Set up alerts for WebSocket connection failures
- [x] 20.5.4 Monitor Anthropic API usage and costs
- [x] 20.5.5 Monitor Redis memory usage
- [x] 20.5.6 Create dashboard for real-time metrics
- [x] 20.5.7 Schedule regular performance reviews


## Phase 21: Future Enhancements (Optional)

### Task 21.1: Ollama Local Model Support

- [x] 21.1.1* Test OllamaClient with local models
- [x] 21.1.2* Benchmark performance vs Anthropic
- [x] 21.1.3* Test quality of responses with local models
- [x] 21.1.4* Document model selection criteria
- [x] 21.1.5* Create migration guide for switching models

### Task 21.2: Advanced Conversation Features

- [x] 21.2.1* Implement conversation branching
- [x] 21.2.2* Add support for voice input/output
- [x] 21.2.3* Implement image understanding for trip photos
- [x] 21.2.4* Add support for file attachments
- [x] 21.2.5* Implement conversation templates

### Task 21.3: Enhanced Personalization

- [x] 21.3.1* Implement user preference learning
- [x] 21.3.2* Add personalized trip recommendations
- [x] 21.3.3* Implement conversation style adaptation
- [x] 21.3.4* Add support for saved conversation contexts
- [x] 21.3.5* Implement proactive suggestions

### Task 21.4: Multi-Agent Collaboration

- [x] 21.4.1* Design multi-agent architecture
- [x] 21.4.2* Implement specialist agents (booking, travel info, emergency)
- [x] 21.4.3* Implement agent coordination logic
- [x] 21.4.4* Test multi-agent conversations
- [x] 21.4.5* Document multi-agent patterns

## Summary

This comprehensive task list covers the complete implementation of the DerLg.com AI Agent service, from project foundation through production deployment and future enhancements. The tasks are organized into 21 phases with clear dependencies and alignment with the backend NestJS API and frontend Next.js application.

### Key Milestones

1. **Phase 1-3**: Foundation (project setup, data models, model clients)
2. **Phase 4-7**: Core Functionality (tools, prompts, state machine, agent loop)
3. **Phase 8-10**: Communication (WebSocket, payment events, multi-language)
4. **Phase 11-12**: Reliability (error handling, security)
5. **Phase 13-14**: Development (testing, Docker environment)
6. **Phase 15-16**: Deployment (production setup, integration)
7. **Phase 17-19**: Polish (documentation, performance, advanced features)
8. **Phase 20**: Launch (QA, production readiness)
9. **Phase 21**: Future (optional enhancements)

### Dependencies

- **Backend**: Requires NestJS backend with /v1/ai-tools/ endpoints
- **Frontend**: Integrates with Next.js WebSocket client
- **External Services**: Anthropic API, Redis (Upstash), Stripe
- **Infrastructure**: Docker, Railway (or similar PaaS)

### Success Criteria

- All 20 tools implemented and tested
- 7-stage conversation flow working correctly
- WebSocket communication stable and reliable
- Multi-language support (EN, KH, ZH) functional
- 80%+ test coverage achieved
- Production deployment successful
- Integration with backend and frontend verified
