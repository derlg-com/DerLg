# Requirements Document: DerLg.com AI Agent (Agentic LLM Chatbot)

## Introduction

This document specifies the requirements for implementing the DerLg.com AI Agent service, a Python-based conversational booking concierge for Cambodia travel. The AI Agent is a stateful, purpose-built microservice that guides travelers through a 7-stage booking journey using natural language conversation. It integrates with the NestJS backend via HTTP tool calls and communicates with the Next.js frontend via WebSocket connections. The agent uses Claude Sonnet 4.5 via Anthropic API (Phase 1) with a swappable architecture to support local models via Ollama (Phase 2).

The AI Agent is not a general-purpose chatbot. It is designed exclusively for Cambodia travel booking, with strict rules about data accuracy, state management, and controlled side effects. Every fact (price, availability, hotel name) comes from backend tool calls—the agent never invents data.

## Glossary

- **AI_Agent**: The Python FastAPI application that orchestrates conversational booking flows
- **LangGraph**: State machine framework for managing conversation flow through nodes and edges
- **ConversationState**: Pydantic model representing the complete state of a user's booking journey
- **AgentState**: Enum of 7 conversation stages (DISCOVERY, SUGGESTION, EXPLORATION, CUSTOMIZATION, BOOKING, PAYMENT, POST_BOOKING)
- **ModelClient**: Abstract interface for swappable LLM backends (Anthropic, Ollama)
- **Tool**: A function that the AI can call to fetch data or perform actions via the NestJS backend
- **Tool_Schema**: JSON schema definition for a tool in Anthropic's tool calling format
- **Tool_Executor**: Component that dispatches tool calls to NestJS backend HTTP endpoints
- **System_Prompt**: Dynamic instruction text that defines the AI's behavior for the current state
- **Session**: A conversation instance persisted in Redis with 7-day TTL
- **WebSocket_Connection**: Real-time bidirectional connection between frontend and AI_Agent
- **Backend_API**: The NestJS service that provides data and executes business logic
- **Frontend**: The Next.js application that displays the chat interface
- **Redis**: In-memory data store for session persistence and pub/sub messaging
- **Stripe_Event**: Payment confirmation event published to Redis by the backend
- **Service_Key**: Secret authentication key for AI_Agent to call backend tool endpoints
- **Booking_Hold**: 15-minute reservation period during payment processing
- **Response_Formatter**: Component that converts tool results into structured frontend messages
- **Message_Type**: Structured JSON format for frontend rendering (text, trip_cards, qr_payment, etc.)
- **Round_Trip_Property**: Testing pattern where parse(format(x)) == x for data integrity

## Requirements

### Requirement 1: FastAPI Application Foundation

**User Story:** As a developer, I want a properly configured FastAPI application with WebSocket support, so that I can build a real-time conversational AI service.

#### Acceptance Criteria

1. THE AI_Agent SHALL use Python 3.11 or higher
2. THE AI_Agent SHALL use FastAPI framework for HTTP and WebSocket endpoints
3. THE AI_Agent SHALL define a WebSocket endpoint at /ws/{session_id}
4. THE AI_Agent SHALL define a health check endpoint at GET /health
5. THE AI_Agent SHALL implement CORS middleware allowing connections from https://derlg.com and https://www.derlg.com
6. THE AI_Agent SHALL implement request logging middleware using structlog
7. THE AI_Agent SHALL implement global exception handlers for WebSocket and HTTP errors
8. THE AI_Agent SHALL use Pydantic BaseSettings for environment variable configuration
9. THE AI_Agent SHALL organize code into modules (agent, tools, prompts, session, formatters, api, config)
10. THE AI_Agent SHALL use async/await patterns for all I/O operations

### Requirement 2: LangGraph State Machine Architecture

**User Story:** As a developer, I want a state machine that manages conversation flow, so that the AI progresses through the booking journey systematically.

#### Acceptance Criteria

1. THE AI_Agent SHALL use LangGraph StateGraph to define the conversation flow
2. THE AI_Agent SHALL define three nodes: call_llm, execute_tools, format_response
3. THE AI_Agent SHALL set call_llm as the entry point node
4. WHEN call_llm completes with stop_reason "tool_use", THE AI_Agent SHALL transition to execute_tools node
5. WHEN call_llm completes with stop_reason "end_turn", THE AI_Agent SHALL transition to format_response node
6. WHEN execute_tools completes, THE AI_Agent SHALL transition back to call_llm node
7. WHEN format_response completes, THE AI_Agent SHALL end the graph execution
8. THE AI_Agent SHALL use RedisSaver as the LangGraph checkpointer for state persistence
9. THE AI_Agent SHALL persist state to Redis after each node execution
10. THE AI_Agent SHALL support resuming conversations from persisted checkpoints

### Requirement 3: Conversation State Management

**User Story:** As a developer, I want a comprehensive state model, so that all conversation context is tracked and persisted.

#### Acceptance Criteria

1. THE AI_Agent SHALL define ConversationState as a Pydantic model
2. THE ConversationState SHALL include session_id (str), user_id (str), state (AgentState enum)
3. THE ConversationState SHALL include messages (list of message dicts in Anthropic format)
4. THE ConversationState SHALL include preferred_language (str: "EN", "KH", or "ZH")
5. THE ConversationState SHALL include suggested_trip_ids (list of str)
6. THE ConversationState SHALL include selected_trip_id (str), selected_trip_name (str)
7. THE ConversationState SHALL include booking_id (str), booking_ref (str), reserved_until (datetime)
8. THE ConversationState SHALL include payment_intent_id (str), payment_status (str)
9. THE ConversationState SHALL include last_active (datetime), created_at (datetime)
10. THE ConversationState SHALL serialize to JSON for Redis storage
11. THE ConversationState SHALL deserialize from JSON when loading from Redis
12. THE AI_Agent SHALL define AgentState enum with values: DISCOVERY, SUGGESTION, EXPLORATION, CUSTOMIZATION, BOOKING, PAYMENT, POST_BOOKING

### Requirement 4: Redis Session Persistence

**User Story:** As a user, I want my conversation to persist across disconnections, so that I can resume where I left off.

#### Acceptance Criteria

1. THE AI_Agent SHALL connect to Redis using the REDIS_URL environment variable
2. THE AI_Agent SHALL store sessions with key format "session:{session_id}"
3. WHEN saving a session, THE AI_Agent SHALL set TTL to 7 days (604800 seconds)
4. WHEN saving a session, THE AI_Agent SHALL update last_active timestamp to current UTC time
5. WHEN loading a session, THE AI_Agent SHALL deserialize JSON to ConversationState
6. WHEN loading a session that doesn't exist, THE AI_Agent SHALL return None
7. WHEN loading a session, THE AI_Agent SHALL check for expired booking holds and recover state
8. IF state is PAYMENT and reserved_until has passed, THE AI_Agent SHALL reset state to BOOKING
9. IF booking hold expired, THE AI_Agent SHALL clear booking_id, payment_intent_id, and reserved_until
10. IF booking hold expired, THE AI_Agent SHALL append a system message informing the AI to notify the user
11. THE AI_Agent SHALL implement session deletion method that removes the Redis key

### Requirement 5: Swappable Model Client Architecture

**User Story:** As a developer, I want to swap between Claude API and local models, so that I can optimize for cost or performance.

#### Acceptance Criteria

1. THE AI_Agent SHALL define an abstract ModelClient interface
2. THE ModelClient interface SHALL define create_message method with parameters: system (str), messages (list), tools (list), max_tokens (int)
3. THE ModelClient interface SHALL return ModelResponse dataclass with stop_reason (str) and content (list of ContentBlock)
4. THE AI_Agent SHALL define ContentBlock dataclass with type (str), text (str), id (str), name (str), input (dict)
5. THE AI_Agent SHALL implement AnthropicClient that uses anthropic.AsyncAnthropic
6. THE AnthropicClient SHALL call messages.create with model "claude-sonnet-4-5-20251001"
7. THE AnthropicClient SHALL convert Anthropic response format to ModelResponse
8. THE AI_Agent SHALL implement OllamaClient that calls Ollama HTTP API
9. THE OllamaClient SHALL convert Claude tool schemas to OpenAI format using schema_converter
10. THE AI_Agent SHALL select model backend based on MODEL_BACKEND environment variable ("anthropic" or "ollama")
11. WHEN preferred_language is "KH", THE AI_Agent SHALL always use AnthropicClient regardless of MODEL_BACKEND
12. THE AI_Agent SHALL implement get_model_client factory function that returns the appropriate client

### Requirement 6: Tool Schema Definitions

**User Story:** As a developer, I want all 20 tools defined as JSON schemas, so that Claude API knows what functions it can call.

#### Acceptance Criteria

1. THE AI_Agent SHALL define all tool schemas in agent/tools/schemas.py
2. THE AI_Agent SHALL define getTripSuggestions tool with parameters: mood, environment, duration_days, people_count, budget_usd, departure_city, language
3. THE AI_Agent SHALL define getTripItinerary tool with parameter: trip_id
4. THE AI_Agent SHALL define getTripImages tool with parameter: trip_id
5. THE AI_Agent SHALL define getHotelDetails tool with parameter: hotel_id
6. THE AI_Agent SHALL define getWeatherForecast tool with parameters: destination, date
7. THE AI_Agent SHALL define compareTrips tool with parameter: trip_ids (array)
8. THE AI_Agent SHALL define calculateCustomTrip tool with parameters: base_trip_id, customizations (array)
9. THE AI_Agent SHALL define customizeTrip tool with parameters: trip_id, customizations (array)
10. THE AI_Agent SHALL define applyDiscountCode tool with parameters: code, booking_id
11. THE AI_Agent SHALL define validateUserDetails tool with parameters: name, phone, email
12. THE AI_Agent SHALL define createBooking tool with parameters: user_id, trip_id, travel_date, end_date, people_count, pickup_location, customer_name, customer_phone, and optional parameters
13. THE AI_Agent SHALL define generatePaymentQR tool with parameters: booking_id, user_id
14. THE AI_Agent SHALL define checkPaymentStatus tool with parameter: payment_intent_id
15. THE AI_Agent SHALL define cancelBooking tool with parameter: booking_id
16. THE AI_Agent SHALL define modifyBooking tool with parameters: booking_id, modifications (object)
17. THE AI_Agent SHALL define getPlaces tool with parameters: category, region, language
18. THE AI_Agent SHALL define getUpcomingFestivals tool with parameters: start_date, end_date, language
19. THE AI_Agent SHALL define estimateBudget tool with parameters: trip_type, duration_days, people_count
20. THE AI_Agent SHALL define getCurrencyRates tool with parameters: from_currency, to_currency
21. THE AI_Agent SHALL include detailed descriptions in each tool schema explaining when to call the tool
22. THE AI_Agent SHALL mark required parameters in the input_schema for each tool


### Requirement 7: Tool Execution System

**User Story:** As a developer, I want a tool executor that calls backend endpoints, so that the AI can fetch real data and perform actions.

#### Acceptance Criteria

1. THE AI_Agent SHALL implement execute_tools_parallel function that executes multiple tool calls concurrently
2. WHEN Claude returns multiple tool_use blocks, THE AI_Agent SHALL execute all tools in parallel using asyncio.gather
3. THE AI_Agent SHALL define a TOOL_DISPATCH dictionary mapping tool names to handler functions
4. THE AI_Agent SHALL implement handler functions for all 20 tools in agent/tools/handlers/
5. THE AI_Agent SHALL use httpx.AsyncClient for HTTP requests to backend endpoints
6. THE AI_Agent SHALL call backend endpoints at {BACKEND_URL}/v1/ai-tools/{endpoint}
7. THE AI_Agent SHALL include X-Service-Key header with AI_SERVICE_KEY value in all backend requests
8. THE AI_Agent SHALL include Accept-Language header with session.preferred_language in all backend requests
9. THE AI_Agent SHALL set timeout to 15 seconds for tool HTTP requests
10. WHEN a tool call succeeds, THE AI_Agent SHALL return {"success": true, "data": response_data}
11. WHEN a tool call fails, THE AI_Agent SHALL return {"success": false, "error": {"code": error_code, "message": error_message}}
12. WHEN a tool execution raises an exception, THE AI_Agent SHALL catch it and return a generic error response
13. THE AI_Agent SHALL convert tool results to tool_result messages in Anthropic format
14. THE AI_Agent SHALL append tool_result messages to the conversation messages list

### Requirement 8: Session Side Effects from Tool Results

**User Story:** As a developer, I want tool results to update session state automatically, so that the conversation context stays synchronized.

#### Acceptance Criteria

1. WHEN getTripSuggestions succeeds, THE AI_Agent SHALL update session.suggested_trip_ids with returned trip IDs
2. WHEN createBooking succeeds, THE AI_Agent SHALL update session.booking_id with returned booking_id
3. WHEN createBooking succeeds, THE AI_Agent SHALL update session.booking_ref with returned booking_ref
4. WHEN createBooking succeeds, THE AI_Agent SHALL update session.reserved_until with returned reserved_until timestamp
5. WHEN createBooking succeeds, THE AI_Agent SHALL transition session.state to PAYMENT
6. WHEN generatePaymentQR succeeds, THE AI_Agent SHALL update session.payment_intent_id with returned payment_intent_id
7. WHEN checkPaymentStatus returns status "SUCCEEDED", THE AI_Agent SHALL update session.payment_status to "CONFIRMED"
8. WHEN checkPaymentStatus returns status "SUCCEEDED", THE AI_Agent SHALL transition session.state to POST_BOOKING
9. WHEN cancelBooking succeeds, THE AI_Agent SHALL clear session.booking_id, session.booking_ref, session.payment_intent_id
10. WHEN cancelBooking succeeds, THE AI_Agent SHALL transition session.state to DISCOVERY
11. THE AI_Agent SHALL implement _apply_session_side_effects function that mutates session based on tool name and result

### Requirement 9: Dynamic System Prompt Builder

**User Story:** As a developer, I want system prompts that adapt to conversation state, so that the AI behaves appropriately at each stage.

#### Acceptance Criteria

1. THE AI_Agent SHALL implement build_system_prompt function that takes ConversationState as input
2. THE AI_Agent SHALL include base prompt with core identity, absolute rules, and personality
3. THE AI_Agent SHALL include context section with current session state, user_id, booking_id, suggested_trip_ids
4. THE AI_Agent SHALL include stage-specific instructions based on session.state value
5. WHEN state is DISCOVERY, THE AI_Agent SHALL include instructions to gather 6 required fields before calling getTripSuggestions
6. WHEN state is SUGGESTION, THE AI_Agent SHALL include instructions to present trip options and guide selection
7. WHEN state is EXPLORATION, THE AI_Agent SHALL include instructions to answer questions and provide details
8. WHEN state is CUSTOMIZATION, THE AI_Agent SHALL include instructions to discuss modifications and calculate pricing
9. WHEN state is BOOKING, THE AI_Agent SHALL include instructions for 3-step booking flow (summary, confirmation, details collection)
10. WHEN state is PAYMENT, THE AI_Agent SHALL include instructions to generate QR and monitor payment status
11. WHEN state is POST_BOOKING, THE AI_Agent SHALL include instructions to provide confirmation and next steps
12. THE AI_Agent SHALL include language-specific instructions based on session.preferred_language
13. THE AI_Agent SHALL include absolute rules: never invent data, always call tools for facts, never discuss non-travel topics

### Requirement 10: Response Formatting System

**User Story:** As a developer, I want to convert tool results into structured frontend messages, so that the UI can render rich components.

#### Acceptance Criteria

1. THE AI_Agent SHALL implement format_response function that analyzes AI text and tool results
2. WHEN tool results contain "trips" array, THE AI_Agent SHALL return TripCardsMessage with trip data
3. WHEN tool results contain "qr_code_url", THE AI_Agent SHALL return QRPaymentMessage with QR data
4. WHEN payment status is "SUCCEEDED" and state is POST_BOOKING, THE AI_Agent SHALL return BookingConfirmedMessage
5. WHEN tool results contain "forecast", THE AI_Agent SHALL return WeatherMessage with forecast data
6. WHEN tool results contain "itinerary", THE AI_Agent SHALL return ItineraryMessage with itinerary data
7. WHEN tool results contain "total_estimate_usd", THE AI_Agent SHALL return BudgetEstimateMessage
8. WHEN tool results contain exactly 2 trips, THE AI_Agent SHALL return ComparisonMessage
9. WHEN tool results contain "images" array, THE AI_Agent SHALL return ImageGalleryMessage
10. WHEN no structured data is present, THE AI_Agent SHALL return TextMessage with AI text content
11. THE AI_Agent SHALL define Pydantic models for all message types in agent/formatters/message_types.py
12. THE AI_Agent SHALL include "type" field in all message responses for frontend routing

### Requirement 11: WebSocket Server Implementation

**User Story:** As a user, I want to chat with the AI in real-time, so that I can have a natural conversation experience.

#### Acceptance Criteria

1. THE AI_Agent SHALL accept WebSocket connections at /ws/{session_id}
2. WHEN a WebSocket connection is established, THE AI_Agent SHALL accept the connection
3. WHEN a WebSocket connection is established, THE AI_Agent SHALL load or create a session
4. THE AI_Agent SHALL expect first message to be auth message with type "auth", user_id, and language
5. WHEN auth message is received, THE AI_Agent SHALL update session.user_id and session.preferred_language
6. WHEN session is new, THE AI_Agent SHALL send welcome message in preferred language
7. WHEN session is resumed, THE AI_Agent SHALL send resume message referencing previous context
8. THE AI_Agent SHALL listen for messages with type "user_message" and content field
9. WHEN user message is received, THE AI_Agent SHALL send typing_start indicator
10. WHEN user message is received, THE AI_Agent SHALL call run_agent function with session and message
11. WHEN agent response is ready, THE AI_Agent SHALL send typing_end indicator
12. WHEN agent response is ready, THE AI_Agent SHALL send formatted response message
13. WHEN agent processing fails, THE AI_Agent SHALL send error message with type "error"
14. THE AI_Agent SHALL save session to Redis after every message exchange
15. WHEN WebSocket disconnects, THE AI_Agent SHALL save session and remove from active connections
16. THE AI_Agent SHALL maintain active_connections dictionary mapping session_id to WebSocket

### Requirement 12: Payment Event Listener

**User Story:** As a user, I want to receive payment confirmation in the chat, so that I know my booking is confirmed immediately.

#### Acceptance Criteria

1. THE AI_Agent SHALL start a background task listen_for_payment_events when WebSocket connects
2. THE AI_Agent SHALL subscribe to Redis pub/sub channel "payment_events:{user_id}"
3. WHEN a payment event is received with status "SUCCEEDED", THE AI_Agent SHALL update session state to POST_BOOKING
4. WHEN a payment event is received with status "SUCCEEDED", THE AI_Agent SHALL update session.payment_status to "CONFIRMED"
5. WHEN a payment event is received with status "SUCCEEDED", THE AI_Agent SHALL save session to Redis
6. WHEN a payment event is received with status "SUCCEEDED", THE AI_Agent SHALL send payment_confirmed event to WebSocket
7. WHEN a payment event is received with status "SUCCEEDED", THE AI_Agent SHALL generate confirmation message using run_agent
8. WHEN a payment event is received with status "SUCCEEDED", THE AI_Agent SHALL send confirmation message to WebSocket
9. THE AI_Agent SHALL cancel payment listener task when WebSocket disconnects
10. THE AI_Agent SHALL handle Redis connection errors gracefully without crashing WebSocket

### Requirement 13: Agent Execution Loop

**User Story:** As a developer, I want a core agent loop that orchestrates LLM calls and tool execution, so that conversations flow naturally.

#### Acceptance Criteria

1. THE AI_Agent SHALL implement run_agent function that takes session and user_text as parameters
2. THE AI_Agent SHALL append user message to session.messages in Anthropic format
3. THE AI_Agent SHALL build system prompt using build_system_prompt function
4. THE AI_Agent SHALL get model client using get_model_client function
5. THE AI_Agent SHALL pass last 20 messages to model client to limit context window
6. THE AI_Agent SHALL pass all 20 tool schemas to model client
7. THE AI_Agent SHALL set max_tokens to 2048 for model calls
8. WHEN model returns stop_reason "tool_use", THE AI_Agent SHALL extract tool_use blocks from content
9. WHEN model returns stop_reason "tool_use", THE AI_Agent SHALL execute tools using execute_tools_parallel
10. WHEN model returns stop_reason "tool_use", THE AI_Agent SHALL append tool_result messages to session.messages
11. WHEN model returns stop_reason "tool_use", THE AI_Agent SHALL call model again with tool results
12. WHEN model returns stop_reason "end_turn", THE AI_Agent SHALL extract text content from response
13. WHEN model returns stop_reason "end_turn", THE AI_Agent SHALL format response using format_response function
14. THE AI_Agent SHALL return formatted response to WebSocket handler
15. THE AI_Agent SHALL implement maximum 5 tool call loops to prevent infinite loops

### Requirement 14: Multi-language Support

**User Story:** As a user, I want to chat in my preferred language, so that I can communicate naturally.

#### Acceptance Criteria

1. THE AI_Agent SHALL support three languages: English (EN), Khmer (KH), Chinese (ZH)
2. THE AI_Agent SHALL accept preferred_language in WebSocket auth message
3. THE AI_Agent SHALL pass preferred_language to backend tool calls in Accept-Language header
4. THE AI_Agent SHALL include language-specific instructions in system prompt
5. WHEN language is EN, THE AI_Agent SHALL instruct Claude to respond in English
6. WHEN language is KH, THE AI_Agent SHALL instruct Claude to respond in Khmer
7. WHEN language is ZH, THE AI_Agent SHALL instruct Claude to respond in Simplified Chinese
8. THE AI_Agent SHALL pass language parameter to tools that support localized content
9. THE AI_Agent SHALL format welcome and resume messages in the preferred language
10. WHEN language is KH, THE AI_Agent SHALL always use AnthropicClient for best Khmer support

### Requirement 15: Error Handling and Resilience

**User Story:** As a user, I want the AI to handle errors gracefully, so that I can continue my conversation even when issues occur.

#### Acceptance Criteria

1. THE AI_Agent SHALL catch all exceptions in WebSocket message handler
2. WHEN an exception occurs, THE AI_Agent SHALL log the error with full stack trace
3. WHEN an exception occurs, THE AI_Agent SHALL send user-friendly error message to WebSocket
4. THE AI_Agent SHALL implement timeout handling for model API calls with 60-second timeout
5. THE AI_Agent SHALL implement timeout handling for backend tool calls with 15-second timeout
6. WHEN a tool call times out, THE AI_Agent SHALL return error response and continue conversation
7. WHEN Redis connection fails, THE AI_Agent SHALL log error and attempt reconnection
8. WHEN model API call fails, THE AI_Agent SHALL retry once before returning error
9. THE AI_Agent SHALL validate all tool inputs before making backend calls
10. THE AI_Agent SHALL sanitize error messages to avoid exposing internal details to users
11. THE AI_Agent SHALL implement circuit breaker pattern for backend API calls
12. WHEN backend is unavailable, THE AI_Agent SHALL inform user and suggest trying again later

### Requirement 16: Security and Authentication

**User Story:** As a developer, I want secure communication between services, so that unauthorized access is prevented.

#### Acceptance Criteria

1. THE AI_Agent SHALL require AI_SERVICE_KEY environment variable for backend authentication
2. THE AI_Agent SHALL include X-Service-Key header with AI_SERVICE_KEY in all backend requests
3. THE AI_Agent SHALL validate that AI_SERVICE_KEY is at least 32 characters long on startup
4. THE AI_Agent SHALL require user_id in WebSocket auth message before processing user messages
5. THE AI_Agent SHALL validate session_id format (UUID) before accepting WebSocket connection
6. THE AI_Agent SHALL not expose internal error details or stack traces to WebSocket clients
7. THE AI_Agent SHALL implement rate limiting on WebSocket message processing (10 messages per minute per session)
8. THE AI_Agent SHALL sanitize user input to prevent injection attacks
9. THE AI_Agent SHALL use TLS for Redis connections when REDIS_URL uses rediss:// scheme
10. THE AI_Agent SHALL not log sensitive data (user_id, booking_id, payment_intent_id) in plain text

### Requirement 17: Logging and Monitoring

**User Story:** As a developer, I want comprehensive logging and monitoring, so that I can debug issues and track performance.

#### Acceptance Criteria

1. THE AI_Agent SHALL use structlog for structured JSON logging
2. THE AI_Agent SHALL log all WebSocket connections with session_id and user_id
3. THE AI_Agent SHALL log all user messages with session_id and message length
4. THE AI_Agent SHALL log all model API calls with token counts and latency
5. THE AI_Agent SHALL log all tool executions with tool name, parameters, and execution time
6. THE AI_Agent SHALL log all errors with exception type, message, and stack trace
7. THE AI_Agent SHALL log session state transitions with old state and new state
8. THE AI_Agent SHALL implement health check endpoint that returns status and uptime
9. THE AI_Agent SHALL integrate with Sentry for error tracking using SENTRY_DSN environment variable
10. THE AI_Agent SHALL expose metrics endpoint at /metrics with Prometheus format
11. THE AI_Agent SHALL track metrics: active_connections, messages_processed, tool_calls_total, errors_total, response_time_seconds

### Requirement 18: Configuration Management

**User Story:** As a developer, I want centralized configuration, so that I can manage environment-specific settings easily.

#### Acceptance Criteria

1. THE AI_Agent SHALL use Pydantic BaseSettings for configuration management
2. THE AI_Agent SHALL load configuration from environment variables
3. THE AI_Agent SHALL require MODEL_BACKEND environment variable with values "anthropic" or "ollama"
4. THE AI_Agent SHALL require ANTHROPIC_API_KEY when MODEL_BACKEND is "anthropic"
5. THE AI_Agent SHALL require OLLAMA_BASE_URL when MODEL_BACKEND is "ollama"
6. THE AI_Agent SHALL require BACKEND_URL environment variable for backend API base URL
7. THE AI_Agent SHALL require AI_SERVICE_KEY environment variable for backend authentication
8. THE AI_Agent SHALL require REDIS_URL environment variable for Redis connection
9. THE AI_Agent SHALL use default values for optional settings: HOST (0.0.0.0), PORT (8000), LOG_LEVEL (info)
10. THE AI_Agent SHALL validate all required environment variables on startup
11. THE AI_Agent SHALL fail fast with clear error message if required configuration is missing
12. THE AI_Agent SHALL support .env file loading for local development

### Requirement 19: Testing Requirements

**User Story:** As a developer, I want comprehensive tests, so that I can ensure the AI agent works correctly.

#### Acceptance Criteria

1. THE AI_Agent SHALL include unit tests for all tool handlers using pytest
2. THE AI_Agent SHALL include unit tests for system prompt builder with all states
3. THE AI_Agent SHALL include unit tests for response formatter with all message types
4. THE AI_Agent SHALL include unit tests for session side effects logic
5. THE AI_Agent SHALL include integration tests for WebSocket message flow
6. THE AI_Agent SHALL include integration tests for tool execution with mocked backend
7. THE AI_Agent SHALL include integration tests for payment event listener
8. THE AI_Agent SHALL mock external dependencies (Anthropic API, backend API, Redis) in tests
9. THE AI_Agent SHALL use pytest-asyncio for async test support
10. THE AI_Agent SHALL achieve minimum 80% code coverage
11. THE AI_Agent SHALL include property-based tests for ConversationState serialization round-trip
12. THE AI_Agent SHALL include property-based tests for tool schema validation

### Requirement 20: Deployment Requirements

**User Story:** As a developer, I want containerized deployment, so that I can deploy the AI agent to any cloud platform.

#### Acceptance Criteria

1. THE AI_Agent SHALL include a Dockerfile with Python 3.11 base image
2. THE AI_Agent SHALL use multi-stage Docker build for smaller image size
3. THE AI_Agent SHALL install dependencies from requirements.txt
4. THE AI_Agent SHALL expose port 8000 for HTTP and WebSocket traffic
5. THE AI_Agent SHALL run with uvicorn ASGI server with 2 workers
6. THE AI_Agent SHALL include health check in Dockerfile using HEALTHCHECK instruction
7. THE AI_Agent SHALL include .dockerignore to exclude unnecessary files
8. THE AI_Agent SHALL support deployment to Railway with railway.json configuration
9. THE AI_Agent SHALL include requirements.txt with pinned versions for all dependencies
10. THE AI_Agent SHALL document deployment steps in README.md
11. THE AI_Agent SHALL support horizontal scaling with multiple instances sharing Redis state

