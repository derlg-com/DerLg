# Bugfix Requirements Document: DerLg AI Agent Critical Bugs

## Introduction

The DerLg AI Agent (Agentic LLM Chatbot) is a Python FastAPI application using LangGraph state machine with 7 conversation stages (DISCOVERY, SUGGESTION, EXPLORATION, CUSTOMIZATION, BOOKING, PAYMENT, POST_BOOKING). The system connects to frontend via WebSocket, calls NestJS backend via 20 HTTP tools, uses Claude Sonnet 4.5, persists state in Redis with 7-day TTL, and manages booking holds with 15-minute expiration.

This bugfix addresses critical bugs identified through comprehensive QA analysis across 8 categories: Discovery Stage, Tool Calling, State Machine, Payment Flow, Session Memory, Multi-language, Edge Cases, and Tool Failures. The bugs range from financial integrity issues (hallucinated prices, premature booking confirmations) to user experience problems (lost sessions, repeated questions, state confusion).

The bug condition methodology is applied to systematically validate fixes through:
- **Fix Checking**: Verify bugs are fixed for all buggy inputs
- **Preservation Checking**: Verify existing correct behavior is unchanged

## Bug Analysis

### Current Behavior (Defect)

#### 1. Discovery Stage Bugs

1.1 WHEN user provides 4 of 6 required discovery fields (mood, environment, duration, people, budget, departure) THEN the system calls getTripSuggestions tool with null/missing fields causing validation errors or incorrect suggestions

1.2 WHEN user provides vague budget expressions like "not too expensive", "cheap", "affordable" THEN the system assumes a specific budget value and proceeds without clarification

1.3 WHEN user provides multiple pieces of information in one message (e.g., "budget is $200, 2 people, 5 days") THEN the system only extracts the last piece and ignores the others

1.4 WHEN user provides all 6 discovery fields in opening message THEN the system still asks unnecessary clarifying questions instead of immediately calling getTripSuggestions

#### 2. Tool Calling Bugs

1.5 WHEN user requests customizations (add-ons, upgrades) THEN the system hallucinates prices from training data instead of calling customizeTrip tool to get actual prices

1.6 WHEN user provides ambiguous booking confirmation like "Looks good to me", "That seems fine" THEN the system calls createBooking without explicit "yes" confirmation

1.7 WHEN createBooking tool fails with network error or 500 response THEN the system invents a fake booking reference (e.g., "DLG-2025-XXXX") instead of reporting the error

1.8 WHEN user asks about payment status ("Did my payment go through?") THEN the system guesses or trusts user's claim without calling checkPaymentStatus tool

1.9 WHEN payment QR is already displayed and user asks status questions THEN the system calls generatePaymentQR multiple times creating duplicate Stripe Payment Intents

1.10 WHEN two users chat simultaneously in concurrent sessions THEN tool calls use wrong user_id due to shared state contamination (Alice's booking appears in Bob's account)

#### 3. State Machine Bugs

1.11 WHEN state transitions occur (e.g., BOOKING → PAYMENT after createBooking succeeds) THEN the system updates session.state in memory but fails to persist to Redis before potential crash

1.12 WHEN user selects a trip in EXPLORATION stage THEN the system skips CUSTOMIZATION stage and jumps directly to BOOKING, preventing add-on purchases

1.13 WHEN user requests backward transition (e.g., "change the hotel" in CUSTOMIZATION) THEN the system resets all previously collected data (selected_trip_id, customizations) instead of preserving them

1.14 WHEN user is in POST_BOOKING stage and asks general questions THEN the system reverts to DISCOVERY mode and asks "Are you planning a trip?"

1.15 WHEN user returns to PAYMENT stage after 20+ minutes and booking hold has expired THEN the system shows expired QR code without detecting expiration

#### 4. Payment Flow Bugs

1.16 WHEN user claims payment completed ("I paid! Banking app said successful") THEN the system confirms booking without calling checkPaymentStatus to verify actual payment status

1.17 WHEN booking hold expires (reserved_until < current time) and user attempts payment THEN the system generates QR for expired/cancelled booking

1.18 WHEN payment fails 3 times (payment_attempts >= 3) and user requests retry THEN the system generates 4th QR code instead of blocking and providing support contact

1.19 WHEN payment webhook arrives while user is actively chatting THEN race condition causes duplicate confirmation messages or session state corruption

1.20 WHEN loyalty points are applied at booking stage THEN the system deducts points immediately before payment confirmation, losing points if payment fails

#### 5. Session Memory Bugs

1.21 WHEN Redis returns corrupted/partial JSON (mid-write crash scenario) THEN the system crashes with JSONDecodeError instead of handling gracefully

1.22 WHEN user sends message on day 6 of 7-day TTL THEN the system does not reset Redis TTL, causing active session to expire

1.23 WHEN conversation exceeds 20 messages and history is truncated THEN the system loses critical context (pickup location, budget) and re-asks questions already answered

1.24 WHEN session fields with datetime types (reserved_until, created_at) are deserialized from Redis THEN the system loads them as strings instead of datetime objects, causing TypeError in comparisons

1.25 WHEN tool result messages (tool_use/tool_result blocks) are saved to Redis THEN the system flattens nested structure, causing Claude API to receive malformed message history

#### 6. Multi-language Bugs

1.26 WHEN user switches language mid-conversation ("Show the total in KHR") THEN the system does not update language preference in subsequent responses

1.27 WHEN user provides budget in non-USD currency (KHR "200,000 រៀល" or CNY "500块") THEN the system fails to convert to USD or ask for USD equivalent

#### 7. Edge Case Bugs

1.28 WHEN unauthenticated guest user (user_id=None) reaches booking stage THEN the system calls createBooking with null user_id causing backend validation error

1.29 WHEN getTripSuggestions returns 0 results or only 1 result (not 3) THEN the system crashes or fabricates fake trip options

1.30 WHEN user provides very large group size (45 students) THEN the system fails to parse number or doesn't mention large total cost ($89 × 45 = $4,005)

### Expected Behavior (Correct)

#### 2. Discovery Stage Fixes

2.1 WHEN user provides 4 of 6 required discovery fields THEN the system SHALL identify missing fields, ask ONE clarifying question for a missing field, and NOT call getTripSuggestions until all 6 fields are collected

2.2 WHEN user provides vague budget expressions THEN the system SHALL ask clarifying question with specific anchors ("Under $50, $50-$150, or above $150 per person?") and NOT assume any budget value

2.3 WHEN user provides multiple pieces of information in one message THEN the system SHALL extract ALL pieces (budget, people_count, duration), update session with all values, and ask about remaining missing fields

2.4 WHEN user provides all 6 discovery fields in opening message THEN the system SHALL immediately call getTripSuggestions and present trip suggestions without asking unnecessary questions

#### 3. Tool Calling Fixes

2.5 WHEN user requests customizations THEN the system SHALL call customizeTrip tool to get actual prices and present the tool result price, NOT prices from training data

2.6 WHEN user provides ambiguous booking confirmation THEN the system SHALL ask explicit confirmation question ("Shall I go ahead and book this for you?") and ONLY call createBooking on explicit "yes" phrases ("Yes, book it", "Go ahead", "Please book")

2.7 WHEN createBooking tool fails THEN the system SHALL inform user of error, retry once, and if retry fails provide clear error message without inventing booking references

2.8 WHEN user asks about payment status THEN the system SHALL call checkPaymentStatus tool with payment_intent_id and report actual status from tool result

2.9 WHEN payment QR is already displayed and user asks status questions THEN the system SHALL answer with text and NOT call generatePaymentQR unless user explicitly says "QR isn't working" or timer expired

2.10 WHEN two users chat simultaneously THEN the system SHALL maintain separate session state per session_id and ensure each tool call uses correct user_id from that session

#### 4. State Machine Fixes

2.11 WHEN state transitions occur THEN the system SHALL update session.state in memory AND immediately call session_manager.save() to persist to Redis before continuing

2.12 WHEN user selects a trip in EXPLORATION stage THEN the system SHALL transition to CUSTOMIZATION stage and ask about customizations before proceeding to BOOKING

2.13 WHEN user requests backward transition THEN the system SHALL preserve previously collected data (selected_trip_id, customizations) and only clear fields relevant to the re-selection

2.14 WHEN user is in POST_BOOKING stage and asks general questions THEN the system SHALL remain in POST_BOOKING state, answer the question, and NOT revert to DISCOVERY mode

2.15 WHEN user returns to PAYMENT stage THEN the system SHALL check if reserved_until < current time, detect expiration, inform user, and NOT show expired QR code

#### 5. Payment Flow Fixes

2.16 WHEN user claims payment completed THEN the system SHALL call checkPaymentStatus tool, verify actual status, and ONLY confirm booking if status is SUCCEEDED

2.17 WHEN booking hold expires THEN the system SHALL detect expiration, inform user ("Your booking hold expired X minutes ago"), offer to re-reserve, and NOT generate QR for expired booking

2.18 WHEN payment fails 3 times THEN the system SHALL NOT generate 4th QR code and SHALL provide support contact information (support@derlg.com, +855 12 345 678)

2.19 WHEN payment webhook arrives during active chat THEN the system SHALL coordinate WebSocket message sending to prevent race conditions and ensure exactly one confirmation message

2.20 WHEN loyalty points are applied THEN the system SHALL track points_to_use in session but NOT deduct from user balance until payment webhook confirms success

#### 6. Session Memory Fixes

2.21 WHEN Redis returns corrupted JSON THEN the system SHALL catch JSONDecodeError, return None (treat as new session), log error to Sentry with session_id and raw payload, and start fresh DISCOVERY

2.22 WHEN user sends message THEN the system SHALL reset Redis TTL to 7 days on every session_manager.save() call using setex() to ensure active sessions never expire

2.23 WHEN conversation history is truncated THEN the system SHALL inject session context block (budget, people_count, pickup_location, etc.) into system prompt so critical data remains accessible

2.24 WHEN session fields are deserialized from Redis THEN the system SHALL convert ISO string datetime fields to datetime objects to enable proper comparisons

2.25 WHEN tool result messages are saved THEN the system SHALL preserve nested structure of tool_use/tool_result content blocks in JSON serialization

#### 7. Multi-language Fixes

2.26 WHEN user switches language mid-conversation THEN the system SHALL update session.preferred_language and apply new language to all subsequent responses

2.27 WHEN user provides budget in non-USD currency THEN the system SHALL convert to USD using current exchange rate or ask user for USD equivalent

#### 8. Edge Case Fixes

2.28 WHEN unauthenticated guest user reaches booking stage THEN the system SHALL block createBooking call and redirect user to login/register with clear message

2.29 WHEN getTripSuggestions returns 0 or fewer than 3 results THEN the system SHALL present available results, ask user to adjust preferences, and NOT fabricate fake options

2.30 WHEN user provides very large group size THEN the system SHALL parse number correctly, set people_count, and mention total cost when presenting prices

### Unchanged Behavior (Regression Prevention)

#### 3. Preserved Correct Behaviors

3.1 WHEN user provides valid complete discovery information and all 6 fields are collected THEN the system SHALL CONTINUE TO call getTripSuggestions and present 3 trip options

3.2 WHEN user provides explicit booking confirmation ("Yes, book it") after seeing summary THEN the system SHALL CONTINUE TO call createBooking and proceed to PAYMENT stage

3.3 WHEN payment webhook confirms SUCCEEDED status THEN the system SHALL CONTINUE TO transition to POST_BOOKING and send booking confirmation card

3.4 WHEN user is in valid state with no errors THEN the system SHALL CONTINUE TO respond within 2-3 seconds with appropriate conversational tone

3.5 WHEN session is loaded from Redis with valid JSON and correct structure THEN the system SHALL CONTINUE TO deserialize successfully and resume conversation

3.6 WHEN user asks factual questions about destinations, weather, or trip details THEN the system SHALL CONTINUE TO call appropriate tools (getPlaces, getWeatherForecast, getTripItinerary)

3.7 WHEN user completes booking and payment successfully THEN the system SHALL CONTINUE TO store booking_id, booking_ref, and payment_intent_id in session

3.8 WHEN user requests cancellation in POST_BOOKING stage THEN the system SHALL CONTINUE TO show refund amount before calling cancelBooking

3.9 WHEN tool calls execute successfully with valid responses THEN the system SHALL CONTINUE TO extract data from tool results and present to user

3.10 WHEN user sends messages in their preferred language (EN, KH, ZH) THEN the system SHALL CONTINUE TO respond in the same language

3.11 WHEN state transitions follow valid paths (DISCOVERY→SUGGESTION→EXPLORATION→CUSTOMIZATION→BOOKING→PAYMENT→POST_BOOKING) THEN the system SHALL CONTINUE TO transition correctly

3.12 WHEN Redis TTL is set on new session creation THEN the system SHALL CONTINUE TO set 7-day expiration

3.13 WHEN WebSocket connection is established with valid session_id THEN the system SHALL CONTINUE TO load session from Redis or create new session

3.14 WHEN user provides valid discount code THEN the system SHALL CONTINUE TO call applyDiscountCode and update total price

3.15 WHEN parallel tool calls are made (getTripItinerary and getWeatherForecast) THEN the system SHALL CONTINUE TO execute both and include both results in response
