# Chatbot Bug Testing and Fixes Design

## Overview

This design addresses 30 critical bugs in the DerLg AI Agent (Python FastAPI + LangGraph) identified through comprehensive QA analysis. The bugs span 8 categories: Discovery Stage (4), Tool Calling (6), State Machine (5), Payment Flow (5), Session Memory (5), Multi-language (2), and Edge Cases (3). The fix strategy employs systematic testing with pytest, property-based testing with hypothesis, and comprehensive regression testing to ensure preserved behaviors remain unchanged.

The approach follows the bug condition methodology:
- **Exploratory Testing**: Surface counterexamples on unfixed code to confirm root causes
- **Fix Checking**: Verify bugs are fixed for all buggy inputs
- **Preservation Checking**: Verify existing correct behavior is unchanged

## Glossary

- **Bug_Condition (C)**: The condition that triggers each of the 30 bugs
- **Property (P)**: The desired behavior when bug conditions are met
- **Preservation**: Existing correct behaviors that must remain unchanged (15 preserved behaviors documented)
- **LangGraph State Machine**: 7-stage conversation flow (DISCOVERY → SUGGESTION → EXPLORATION → CUSTOMIZATION → BOOKING → PAYMENT → POST_BOOKING)
- **Session State**: ConversationState model persisted to Redis with 7-day TTL
- **Tool Executor**: Component that makes HTTP calls to NestJS backend for 20 tools
- **ModelClient**: Abstract interface for LLM providers (AnthropicClient, OllamaClient)
- **WebSocket Handler**: Real-time bidirectional communication with frontend
- **Booking Hold**: 15-minute reservation window tracked by reserved_until timestamp
- **Payment Intent**: Stripe payment object with QR code for user payment

## Bug Details

### Category 1: Discovery Stage Bugs (4 bugs)


#### Bug 1.1: Incomplete Discovery Field Collection

**Fault Condition:**
User provides 4 of 6 required discovery fields (mood, environment, duration, people, budget, departure), causing getTripSuggestions to be called with null/missing fields.

**Formal Specification:**
```
FUNCTION isBugCondition_1_1(input)
  INPUT: input of type UserMessage
  OUTPUT: boolean
  
  collected_fields := extract_discovery_fields(input.text, session.state)
  required_fields := ['mood', 'environment', 'duration', 'people', 'budget', 'departure']
  
  RETURN count(collected_fields) >= 1 
         AND count(collected_fields) < 6
         AND agent_calls_getTripSuggestions(session)
END FUNCTION
```

**Examples:**
- User: "I want adventure travel for 5 days with 2 people" → System calls getTripSuggestions with null budget/departure/environment
- User: "Budget is $200, leaving next Monday" → System calls getTripSuggestions with null mood/environment/duration/people

**Root Cause:** Discovery field extraction logic doesn't validate completeness before transitioning to SUGGESTION stage.

#### Bug 1.2: Vague Budget Handling

**Fault Condition:**
User provides vague budget expressions like "not too expensive", "cheap", "affordable" and system assumes specific budget value.

**Formal Specification:**
```
FUNCTION isBugCondition_1_2(input)
  INPUT: input of type UserMessage
  OUTPUT: boolean
  
  vague_budget_phrases := ['not too expensive', 'cheap', 'affordable', 'reasonable', 'budget-friendly']
  
  RETURN input.text CONTAINS_ANY vague_budget_phrases
         AND session.budget IS_SET_TO_SPECIFIC_VALUE
         AND NOT user_was_asked_clarifying_question
END FUNCTION
```

**Examples:**
- User: "Something affordable" → System assumes $50 budget without asking
- User: "Not too expensive" → System assumes $100 budget without clarification

**Root Cause:** Budget extraction uses LLM inference instead of explicit clarification for ambiguous values.


#### Bug 1.3: Multi-Field Extraction Failure

**Fault Condition:**
User provides multiple pieces of information in one message but system only extracts the last piece.

**Formal Specification:**
```
FUNCTION isBugCondition_1_3(input)
  INPUT: input of type UserMessage
  OUTPUT: boolean
  
  fields_in_message := count_discovery_fields_in_text(input.text)
  fields_extracted := count_fields_updated_in_session(session)
  
  RETURN fields_in_message >= 2
         AND fields_extracted < fields_in_message
END FUNCTION
```

**Examples:**
- User: "Budget is $200, 2 people, 5 days" → System only extracts "5 days", ignores budget and people
- User: "Adventure trip, leaving Monday, 3 travelers" → System only extracts "3 travelers"

**Root Cause:** Field extraction processes message sequentially and overwrites instead of accumulating.

#### Bug 1.4: Unnecessary Clarification Questions

**Fault Condition:**
User provides all 6 discovery fields in opening message but system still asks clarifying questions.

**Formal Specification:**
```
FUNCTION isBugCondition_1_4(input)
  INPUT: input of type UserMessage
  OUTPUT: boolean
  
  required_fields := ['mood', 'environment', 'duration', 'people', 'budget', 'departure']
  fields_in_message := extract_all_fields(input.text)
  
  RETURN count(fields_in_message) == 6
         AND all_fields_valid(fields_in_message)
         AND agent_asks_clarifying_question
         AND NOT agent_calls_getTripSuggestions
END FUNCTION
```

**Examples:**
- User: "I want adventure beach trip for 5 days, 2 people, $500 budget, leaving March 15" → System asks "How many people?"

**Root Cause:** State machine always asks clarification regardless of completeness check.


### Category 2: Tool Calling Bugs (6 bugs)

#### Bug 1.5: Hallucinated Customization Prices

**Fault Condition:**
User requests customizations (add-ons, upgrades) and system hallucinates prices from training data instead of calling customizeTrip tool.

**Formal Specification:**
```
FUNCTION isBugCondition_1_5(input)
  INPUT: input of type UserMessage
  OUTPUT: boolean
  
  customization_requests := ['add hotel upgrade', 'include guide', 'add transportation']
  
  RETURN input.text CONTAINS_ANY customization_requests
         AND agent_provides_price_in_response
         AND NOT tool_called('customizeTrip')
END FUNCTION
```

**Examples:**
- User: "Can I add a hotel upgrade?" → System: "Hotel upgrade is $50" (hallucinated, actual price is $75)
- User: "Include a tour guide" → System: "Guide costs $30/day" (not from tool call)

**Root Cause:** LLM generates plausible prices from training data when tool call fails or is skipped.

#### Bug 1.6: Ambiguous Booking Confirmation

**Fault Condition:**
User provides ambiguous confirmation like "Looks good to me" and system calls createBooking without explicit "yes".

**Formal Specification:**
```
FUNCTION isBugCondition_1_6(input)
  INPUT: input of type UserMessage
  OUTPUT: boolean
  
  ambiguous_phrases := ['looks good', 'seems fine', 'okay', 'sounds nice', 'that works']
  explicit_confirmations := ['yes book it', 'go ahead', 'please book', 'confirm booking']
  
  RETURN input.text CONTAINS_ANY ambiguous_phrases
         AND input.text NOT_CONTAINS_ANY explicit_confirmations
         AND tool_called('createBooking')
END FUNCTION
```

**Examples:**
- User: "Looks good to me" → System calls createBooking (should ask explicit confirmation)
- User: "That seems fine" → System creates booking (ambiguous intent)

**Root Cause:** Booking confirmation logic uses loose pattern matching instead of explicit confirmation.


#### Bug 1.7: Fake Booking References

**Fault Condition:**
createBooking tool fails with network error or 500 response and system invents fake booking reference.

**Formal Specification:**
```
FUNCTION isBugCondition_1_7(input)
  INPUT: input of type ToolResult
  OUTPUT: boolean
  
  RETURN input.tool_name == 'createBooking'
         AND (input.status_code >= 500 OR input.error == 'NetworkError')
         AND agent_response CONTAINS 'DLG-'
         AND session.booking_ref IS_SET
END FUNCTION
```

**Examples:**
- createBooking returns 500 → System: "Your booking DLG-2025-XXXX is confirmed" (fake reference)
- Network timeout → System invents "DLG-2025-1234" instead of reporting error

**Root Cause:** Error handling generates fallback booking reference instead of surfacing error to user.

#### Bug 1.8: Payment Status Guessing

**Fault Condition:**
User asks about payment status and system guesses or trusts user's claim without calling checkPaymentStatus tool.

**Formal Specification:**
```
FUNCTION isBugCondition_1_8(input)
  INPUT: input of type UserMessage
  OUTPUT: boolean
  
  payment_status_queries := ['did my payment go through', 'is payment complete', 'payment status']
  
  RETURN input.text CONTAINS_ANY payment_status_queries
         AND session.payment_intent_id IS_SET
         AND NOT tool_called('checkPaymentStatus')
         AND agent_provides_status_answer
END FUNCTION
```

**Examples:**
- User: "Did my payment go through?" → System: "Yes, payment is complete" (without checking)
- User: "I paid already" → System trusts claim without verification

**Root Cause:** Agent responds based on conversation context instead of calling verification tool.


#### Bug 1.9: Duplicate Payment QR Generation

**Fault Condition:**
Payment QR is already displayed and user asks status questions, causing system to call generatePaymentQR multiple times.

**Formal Specification:**
```
FUNCTION isBugCondition_1_9(input)
  INPUT: input of type UserMessage
  OUTPUT: boolean
  
  RETURN session.payment_intent_id IS_SET
         AND session.state == 'PAYMENT'
         AND input.text CONTAINS_ANY ['how do I pay', 'show QR', 'payment method']
         AND tool_called('generatePaymentQR')
         AND count_tool_calls('generatePaymentQR', session) > 1
END FUNCTION
```

**Examples:**
- QR displayed, User: "How do I pay?" → System generates 2nd Payment Intent
- QR displayed, User: "Show me the QR again" → Creates duplicate Stripe Payment Intent

**Root Cause:** Tool calling logic doesn't check if payment_intent_id already exists before generating new QR.

#### Bug 1.10: Concurrent Session State Contamination

**Fault Condition:**
Two users chat simultaneously and tool calls use wrong user_id due to shared state contamination.

**Formal Specification:**
```
FUNCTION isBugCondition_1_10(input)
  INPUT: input of type ConcurrentSessions
  OUTPUT: boolean
  
  RETURN session_A.user_id == 'alice'
         AND session_B.user_id == 'bob'
         AND tool_call_from_session_A.user_id == 'bob'
         OR booking_appears_in_wrong_account
END FUNCTION
```

**Examples:**
- Alice and Bob chat at same time → Alice's booking appears in Bob's account
- Concurrent tool calls use wrong user_id parameter

**Root Cause:** Global state or improper session isolation in tool executor.


### Category 3: State Machine Bugs (5 bugs)

#### Bug 1.11: State Transition Persistence Failure

**Fault Condition:**
State transitions occur (e.g., BOOKING → PAYMENT) but system updates session.state in memory without persisting to Redis before potential crash.

**Formal Specification:**
```
FUNCTION isBugCondition_1_11(input)
  INPUT: input of type StateTransition
  OUTPUT: boolean
  
  RETURN session.state_in_memory == 'PAYMENT'
         AND session.state_in_redis == 'BOOKING'
         AND time_since_transition < 5_seconds
         AND NOT redis_save_called_after_transition
END FUNCTION
```

**Examples:**
- createBooking succeeds → state changes to PAYMENT in memory → crash before Redis save → user reconnects in BOOKING state
- State transition happens but Redis still shows old state

**Root Cause:** State machine updates in-memory state but doesn't immediately call session_manager.save().

#### Bug 1.12: Skipped Customization Stage

**Fault Condition:**
User selects a trip in EXPLORATION stage and system skips CUSTOMIZATION stage, jumping directly to BOOKING.

**Formal Specification:**
```
FUNCTION isBugCondition_1_12(input)
  INPUT: input of type UserMessage
  OUTPUT: boolean
  
  RETURN session.state == 'EXPLORATION'
         AND input.text CONTAINS 'select trip' OR 'choose option'
         AND next_state == 'BOOKING'
         AND NOT next_state == 'CUSTOMIZATION'
END FUNCTION
```

**Examples:**
- User: "I'll take option 2" → System jumps to BOOKING without asking about add-ons
- Trip selection skips customization opportunity

**Root Cause:** State machine transition logic missing CUSTOMIZATION stage in flow.


#### Bug 1.13: Backward Transition Data Loss

**Fault Condition:**
User requests backward transition (e.g., "change the hotel" in CUSTOMIZATION) and system resets all previously collected data.

**Formal Specification:**
```
FUNCTION isBugCondition_1_13(input)
  INPUT: input of type UserMessage
  OUTPUT: boolean
  
  backward_requests := ['change hotel', 'pick different trip', 'go back']
  
  RETURN input.text CONTAINS_ANY backward_requests
         AND session.selected_trip_id WAS_SET
         AND session.selected_trip_id BECOMES_NULL
         AND session.customizations BECOMES_EMPTY
END FUNCTION
```

**Examples:**
- User in CUSTOMIZATION: "Change the hotel" → System clears selected_trip_id and all customizations
- Backward navigation loses all progress

**Root Cause:** Backward transition handler resets entire session instead of preserving relevant data.

#### Bug 1.14: Post-Booking State Reversion

**Fault Condition:**
User is in POST_BOOKING stage and asks general questions, causing system to revert to DISCOVERY mode.

**Formal Specification:**
```
FUNCTION isBugCondition_1_14(input)
  INPUT: input of type UserMessage
  OUTPUT: boolean
  
  general_questions := ['what is the weather', 'tell me about Angkor Wat', 'best restaurants']
  
  RETURN session.state == 'POST_BOOKING'
         AND session.booking_id IS_SET
         AND input.text CONTAINS_ANY general_questions
         AND next_state == 'DISCOVERY'
END FUNCTION
```

**Examples:**
- User after booking: "What's the weather like?" → System: "Are you planning a trip?" (reverts to DISCOVERY)
- General question causes state confusion

**Root Cause:** State machine interprets general questions as new trip intent.


#### Bug 1.15: Expired Booking Hold Detection

**Fault Condition:**
User returns to PAYMENT stage after 20+ minutes and booking hold has expired, but system shows expired QR code.

**Formal Specification:**
```
FUNCTION isBugCondition_1_15(input)
  INPUT: input of type SessionLoad
  OUTPUT: boolean
  
  RETURN session.state == 'PAYMENT'
         AND session.reserved_until < current_time
         AND agent_displays_payment_qr
         AND NOT agent_detects_expiration
END FUNCTION
```

**Examples:**
- Booking hold expires at 14:15, user returns at 14:30 → System shows expired QR without warning
- reserved_until timestamp not checked before displaying payment

**Root Cause:** Payment stage doesn't validate reserved_until before showing QR code.

### Category 4: Payment Flow Bugs (5 bugs)

#### Bug 1.16: Unverified Payment Confirmation

**Fault Condition:**
User claims payment completed and system confirms booking without calling checkPaymentStatus to verify.

**Formal Specification:**
```
FUNCTION isBugCondition_1_16(input)
  INPUT: input of type UserMessage
  OUTPUT: boolean
  
  payment_claims := ['I paid', 'payment done', 'banking app said successful']
  
  RETURN input.text CONTAINS_ANY payment_claims
         AND NOT tool_called('checkPaymentStatus')
         AND agent_confirms_booking
         AND session.state TRANSITIONS_TO 'POST_BOOKING'
END FUNCTION
```

**Examples:**
- User: "I paid! Banking app said successful" → System: "Booking confirmed!" (without verification)
- Trust-based confirmation without actual payment check

**Root Cause:** Agent trusts user claim instead of verifying with Stripe API.


#### Bug 1.17: Expired Booking Payment Generation

**Fault Condition:**
Booking hold expires (reserved_until < current time) and user attempts payment, but system generates QR for expired booking.

**Formal Specification:**
```
FUNCTION isBugCondition_1_17(input)
  INPUT: input of type UserMessage
  OUTPUT: boolean
  
  RETURN session.reserved_until < current_time
         AND input.text CONTAINS 'pay' OR 'show QR'
         AND tool_called('generatePaymentQR')
         AND booking_status == 'EXPIRED' OR 'CANCELLED'
END FUNCTION
```

**Examples:**
- reserved_until expired 10 minutes ago → User: "Show me the QR" → System generates QR for cancelled booking
- Payment QR created for booking that no longer exists

**Root Cause:** generatePaymentQR doesn't check booking expiration before creating Payment Intent.

#### Bug 1.18: Excessive Payment Retry Attempts

**Fault Condition:**
Payment fails 3 times (payment_attempts >= 3) and user requests retry, but system generates 4th QR code.

**Formal Specification:**
```
FUNCTION isBugCondition_1_18(input)
  INPUT: input of type UserMessage
  OUTPUT: boolean
  
  RETURN session.payment_attempts >= 3
         AND input.text CONTAINS 'retry' OR 'try again'
         AND tool_called('generatePaymentQR')
         AND NOT agent_blocks_retry
END FUNCTION
```

**Examples:**
- 3 failed payments → User: "Let me try again" → System generates 4th QR (should block and provide support)
- No limit enforcement on payment retries

**Root Cause:** Payment retry logic doesn't check attempt count before generating new QR.


#### Bug 1.19: Payment Webhook Race Condition

**Fault Condition:**
Payment webhook arrives while user is actively chatting, causing race condition with duplicate confirmation messages or session state corruption.

**Formal Specification:**
```
FUNCTION isBugCondition_1_19(input)
  INPUT: input of type WebhookEvent
  OUTPUT: boolean
  
  RETURN input.event_type == 'payment.succeeded'
         AND websocket_connection_active(session_id)
         AND user_message_in_flight
         AND (duplicate_confirmation_sent OR session_state_corrupted)
END FUNCTION
```

**Examples:**
- Webhook arrives during user message processing → Two "Booking confirmed!" messages sent
- Concurrent state updates cause session corruption

**Root Cause:** No coordination between webhook handler and WebSocket message handler.

#### Bug 1.20: Premature Loyalty Points Deduction

**Fault Condition:**
Loyalty points are applied at booking stage and deducted immediately before payment confirmation, losing points if payment fails.

**Formal Specification:**
```
FUNCTION isBugCondition_1_20(input)
  INPUT: input of type BookingCreation
  OUTPUT: boolean
  
  RETURN session.points_to_use > 0
         AND user_points_balance_decreased
         AND session.state == 'PAYMENT'
         AND payment_status != 'SUCCEEDED'
END FUNCTION
```

**Examples:**
- User applies 500 points → Points deducted → Payment fails → Points lost
- Points deducted before payment confirmation

**Root Cause:** Points deduction happens at booking creation instead of payment confirmation.


### Category 5: Session Memory Bugs (5 bugs)

#### Bug 1.21: Corrupted JSON Handling

**Fault Condition:**
Redis returns corrupted/partial JSON (mid-write crash scenario) and system crashes with JSONDecodeError.

**Formal Specification:**
```
FUNCTION isBugCondition_1_21(input)
  INPUT: input of type RedisLoad
  OUTPUT: boolean
  
  RETURN input.json_string IS_INVALID_JSON
         AND system_raises_exception('JSONDecodeError')
         AND NOT error_handled_gracefully
END FUNCTION
```

**Examples:**
- Redis contains `{"session_id": "abc", "state": "DISCO` (truncated) → System crashes
- Corrupted JSON causes unhandled exception

**Root Cause:** JSON deserialization doesn't catch JSONDecodeError.

#### Bug 1.22: Session TTL Not Reset

**Fault Condition:**
User sends message on day 6 of 7-day TTL and system doesn't reset Redis TTL, causing active session to expire.

**Formal Specification:**
```
FUNCTION isBugCondition_1_22(input)
  INPUT: input of type UserMessage
  OUTPUT: boolean
  
  RETURN session.created_at + 6_days < current_time
         AND user_sends_message
         AND redis_ttl_not_reset
         AND session_expires_in < 24_hours
END FUNCTION
```

**Examples:**
- Session created 6 days ago → User sends message → TTL not reset → Session expires next day
- Active sessions expire due to TTL not being refreshed

**Root Cause:** session_manager.save() doesn't use setex() to reset TTL.


#### Bug 1.23: Context Loss from Truncation

**Fault Condition:**
Conversation exceeds 20 messages and history is truncated, causing system to lose critical context and re-ask questions.

**Formal Specification:**
```
FUNCTION isBugCondition_1_23(input)
  INPUT: input of type MessageHistory
  OUTPUT: boolean
  
  RETURN count(session.messages) > 20
         AND messages_truncated
         AND critical_context_in_truncated_messages
         AND agent_re_asks_previously_answered_question
END FUNCTION
```

**Examples:**
- 25 messages in history → Truncated to last 15 → Budget info lost → System asks "What's your budget?" again
- Pickup location lost after truncation

**Root Cause:** Truncation doesn't preserve critical session context in system prompt.

#### Bug 1.24: Datetime Deserialization Error

**Fault Condition:**
Session fields with datetime types (reserved_until, created_at) are deserialized from Redis as strings instead of datetime objects.

**Formal Specification:**
```
FUNCTION isBugCondition_1_24(input)
  INPUT: input of type SessionLoad
  OUTPUT: boolean
  
  RETURN session.reserved_until IS_STRING
         AND code_attempts_datetime_comparison
         AND system_raises_exception('TypeError')
END FUNCTION
```

**Examples:**
- reserved_until loaded as "2025-01-15T14:30:00" string → Comparison `reserved_until < now()` raises TypeError
- Datetime fields not converted from ISO strings

**Root Cause:** JSON deserialization doesn't convert ISO datetime strings to datetime objects.


#### Bug 1.25: Tool Message Structure Flattening

**Fault Condition:**
Tool result messages (tool_use/tool_result blocks) are saved to Redis with flattened structure, causing Claude API to receive malformed message history.

**Formal Specification:**
```
FUNCTION isBugCondition_1_25(input)
  INPUT: input of type MessageSerialization
  OUTPUT: boolean
  
  RETURN message.type == 'tool_result'
         AND message.content IS_FLATTENED
         AND claude_api_returns_error('invalid_message_format')
END FUNCTION
```

**Examples:**
- Tool result saved as flat dict → Loaded from Redis → Claude API rejects malformed message
- Nested content blocks lost in serialization

**Root Cause:** JSON serialization flattens nested tool message structure.

### Category 6: Multi-language Bugs (2 bugs)

#### Bug 1.26: Language Switch Not Persisted

**Fault Condition:**
User switches language mid-conversation ("Show the total in KHR") but system doesn't update language preference in subsequent responses.

**Formal Specification:**
```
FUNCTION isBugCondition_1_26(input)
  INPUT: input of type UserMessage
  OUTPUT: boolean
  
  language_switch_phrases := ['in Khmer', 'in Chinese', 'show in KHR', '用中文']
  
  RETURN input.text CONTAINS_ANY language_switch_phrases
         AND session.preferred_language NOT_UPDATED
         AND next_response_in_wrong_language
END FUNCTION
```

**Examples:**
- User: "Show the total in KHR" → System responds in English instead of Khmer
- Language switch detected but not persisted to session

**Root Cause:** Language detection doesn't update session.preferred_language.


#### Bug 1.27: Non-USD Currency Conversion Failure

**Fault Condition:**
User provides budget in non-USD currency (KHR "200,000 រៀល" or CNY "500块") and system fails to convert to USD.

**Formal Specification:**
```
FUNCTION isBugCondition_1_27(input)
  INPUT: input of type UserMessage
  OUTPUT: boolean
  
  non_usd_currencies := ['KHR', 'រៀល', 'CNY', '块', '元']
  
  RETURN input.text CONTAINS_BUDGET_WITH non_usd_currencies
         AND session.budget IS_NULL OR IS_INCORRECT_VALUE
         AND NOT currency_conversion_attempted
END FUNCTION
```

**Examples:**
- User: "Budget is 200,000 រៀល" → System doesn't convert to USD (~$50)
- User: "500块" → System fails to recognize CNY and convert

**Root Cause:** Budget extraction doesn't handle currency conversion for non-USD values.

### Category 7: Edge Case Bugs (3 bugs)

#### Bug 1.28: Unauthenticated User Booking Attempt

**Fault Condition:**
Unauthenticated guest user (user_id=None) reaches booking stage and system calls createBooking with null user_id.

**Formal Specification:**
```
FUNCTION isBugCondition_1_28(input)
  INPUT: input of type BookingAttempt
  OUTPUT: boolean
  
  RETURN session.user_id IS_NULL
         AND session.state == 'BOOKING'
         AND tool_called('createBooking', {user_id: null})
         AND backend_returns_validation_error
END FUNCTION
```

**Examples:**
- Guest user reaches booking → System calls createBooking(user_id=null) → Backend returns 400 error
- No authentication check before booking

**Root Cause:** Booking stage doesn't validate user authentication before calling createBooking.


#### Bug 1.29: Empty Trip Suggestions Handling

**Fault Condition:**
getTripSuggestions returns 0 results or only 1 result (not 3) and system crashes or fabricates fake trip options.

**Formal Specification:**
```
FUNCTION isBugCondition_1_29(input)
  INPUT: input of type ToolResult
  OUTPUT: boolean
  
  RETURN input.tool_name == 'getTripSuggestions'
         AND count(input.results) < 3
         AND (system_crashes OR agent_fabricates_fake_trips)
END FUNCTION
```

**Examples:**
- getTripSuggestions returns [] → System crashes with IndexError
- Returns 1 trip → System invents 2 more fake trips to show 3 options

**Root Cause:** Response handling assumes exactly 3 results without validation.

#### Bug 1.30: Large Group Size Handling

**Fault Condition:**
User provides very large group size (45 students) and system fails to parse number or doesn't mention large total cost.

**Formal Specification:**
```
FUNCTION isBugCondition_1_30(input)
  INPUT: input of type UserMessage
  OUTPUT: boolean
  
  RETURN input.text CONTAINS_NUMBER >= 20
         AND (session.people_count NOT_SET OR session.people_count < 20)
         AND agent_presents_price_without_total_calculation
END FUNCTION
```

**Examples:**
- User: "45 students" → System sets people_count=4 or fails to parse
- System shows "$89 per person" without mentioning total $4,005

**Root Cause:** Number extraction fails for large values or total cost calculation not performed.


## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Valid complete discovery information (all 6 fields) continues to trigger getTripSuggestions successfully
- Explicit booking confirmations ("Yes, book it") continue to call createBooking and proceed to PAYMENT
- Payment webhook with SUCCEEDED status continues to transition to POST_BOOKING with confirmation
- Valid state transitions following the correct path (DISCOVERY→SUGGESTION→EXPLORATION→CUSTOMIZATION→BOOKING→PAYMENT→POST_BOOKING) continue to work
- Session loading from Redis with valid JSON continues to deserialize successfully
- Tool calls with valid parameters continue to execute and return results correctly
- Factual questions about destinations continue to call appropriate tools (getPlaces, getWeatherForecast, getTripItinerary)
- Successful booking and payment continue to store booking_id, booking_ref, and payment_intent_id in session
- Cancellation requests in POST_BOOKING continue to show refund amount before calling cancelBooking
- Multi-language responses (EN, KH, ZH) continue to work when language is set correctly
- Parallel tool calls continue to execute concurrently and include all results
- Valid discount codes continue to be applied via applyDiscountCode tool
- WebSocket connections with valid session_id continue to load or create sessions correctly
- New session creation continues to set 7-day Redis TTL
- Response times for valid requests continue to be 2-3 seconds with appropriate conversational tone

**Scope:**
All inputs that do NOT trigger the 30 identified bug conditions should be completely unaffected by these fixes. This includes:
- Normal conversation flows with complete, valid information
- Successful tool executions with proper responses
- Valid state transitions without edge cases
- Properly formatted session data in Redis
- Authenticated users with valid booking flows
- Standard payment flows without race conditions or retries


## Hypothesized Root Cause

Based on the bug analysis, the most likely root causes are:

1. **Incomplete Validation Logic**: Discovery stage, booking confirmation, and payment flows lack proper validation before proceeding
   - Discovery field completeness not checked before calling getTripSuggestions
   - Booking confirmation uses loose pattern matching instead of explicit validation
   - Payment stage doesn't validate booking expiration or retry limits

2. **Missing Tool Call Guards**: Agent generates responses without calling required tools for data verification
   - Customization prices hallucinated instead of calling customizeTrip
   - Payment status guessed instead of calling checkPaymentStatus
   - Duplicate QR generation without checking existing payment_intent_id

3. **State Persistence Gaps**: State transitions update in-memory state without immediate Redis persistence
   - State machine transitions don't call session_manager.save() immediately
   - Redis TTL not reset on active sessions (missing setex() call)
   - Datetime fields not properly serialized/deserialized

4. **Insufficient Error Handling**: Tool failures and edge cases not handled gracefully
   - createBooking failures generate fake booking references
   - Corrupted JSON from Redis causes crashes instead of graceful recovery
   - Empty tool results cause crashes or fabricated data

5. **Race Condition Vulnerabilities**: Concurrent operations lack coordination
   - Payment webhook and WebSocket messages not synchronized
   - Concurrent sessions may share state due to improper isolation
   - Points deducted before payment confirmation

6. **Context Management Issues**: Session context not properly preserved or injected
   - Message history truncation loses critical context
   - Backward transitions reset all data instead of preserving relevant fields
   - Tool message structure flattened in serialization

7. **Language and Currency Handling**: Multi-language and currency conversion not properly implemented
   - Language switches detected but not persisted to session
   - Non-USD currencies not converted or recognized

8. **Authentication and Authorization**: Guest user flows not properly gated
   - Unauthenticated users can reach booking stage
   - No authentication check before calling createBooking


## Correctness Properties

Property 1: Fault Condition - Bug Fixes for All 30 Bugs

_For any_ input where any of the 30 bug conditions hold (isBugCondition_1_1 through isBugCondition_1_30 return true), the fixed agent SHALL exhibit the correct behavior as defined in the Expected Behavior section (requirements 2.1-2.30), preventing the defective behavior from occurring.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 2.12, 2.13, 2.14, 2.15, 2.16, 2.17, 2.18, 2.19, 2.20, 2.21, 2.22, 2.23, 2.24, 2.25, 2.26, 2.27, 2.28, 2.29, 2.30**

Property 2: Preservation - Existing Correct Behavior

_For any_ input where none of the 30 bug conditions hold (all isBugCondition functions return false), the fixed agent SHALL produce exactly the same behavior as the original agent, preserving all 15 documented correct behaviors including valid discovery flows, explicit booking confirmations, successful payment webhooks, valid state transitions, proper session loading, successful tool executions, multi-language support, and standard conversation flows.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12, 3.13, 3.14, 3.15**


## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct, the fixes will be implemented across multiple files in the `llm_agentic_chatbot/` directory:

**File**: `agent/state_machine.py` (LangGraph state machine)

**Specific Changes**:
1. **Discovery Stage Validation**: Add completeness check before calling getTripSuggestions
   - Implement `validate_discovery_fields()` function to check all 6 required fields
   - Add clarification logic to ask for missing fields one at a time
   - Implement multi-field extraction to capture all fields from single message

2. **State Transition Persistence**: Call session_manager.save() immediately after state changes
   - Add `await session_manager.save(session)` after every state transition
   - Ensure state is persisted before continuing execution

3. **Customization Stage Insertion**: Add CUSTOMIZATION stage between EXPLORATION and BOOKING
   - Update state transition logic to include CUSTOMIZATION stage
   - Add customization prompt and tool call logic

4. **Backward Transition Preservation**: Preserve relevant data during backward transitions
   - Implement selective field clearing instead of full session reset
   - Maintain selected_trip_id and customizations when going back

5. **Post-Booking State Stability**: Prevent state reversion from POST_BOOKING
   - Add state guard to keep POST_BOOKING state for general questions
   - Only transition to DISCOVERY on explicit new trip intent

**File**: `agent/tools/executor.py` (Tool execution logic)

**Specific Changes**:
1. **Tool Call Guards**: Add validation before tool execution
   - Check if payment_intent_id exists before calling generatePaymentQR
   - Validate booking expiration before payment operations
   - Check payment_attempts count before retry

2. **Session Isolation**: Ensure proper session isolation for concurrent users
   - Pass session_id explicitly to all tool calls
   - Extract user_id from session context, not global state

3. **Error Handling**: Implement graceful error handling for tool failures
   - Catch createBooking failures and report errors without fake references
   - Handle empty getTripSuggestions results gracefully
   - Retry logic with exponential backoff


**File**: `agent/session/manager.py` (Session persistence)

**Specific Changes**:
1. **TTL Reset**: Use setex() to reset TTL on every save
   - Replace `redis.set()` with `redis.setex(key, 604800, value)` (7 days)
   - Ensure active sessions never expire

2. **Corrupted JSON Handling**: Add try-catch for JSONDecodeError
   - Wrap json.loads() in try-except block
   - Return None and log error to Sentry on corruption
   - Start fresh DISCOVERY session on corruption

3. **Datetime Serialization**: Properly serialize/deserialize datetime fields
   - Convert datetime objects to ISO strings on save
   - Convert ISO strings back to datetime objects on load
   - Handle reserved_until, created_at, last_active fields

4. **Tool Message Structure**: Preserve nested structure in serialization
   - Use custom JSON encoder for tool_use/tool_result messages
   - Maintain nested content blocks structure

5. **Context Injection**: Inject session context into system prompt on truncation
   - Extract critical fields (budget, people_count, pickup_location, etc.)
   - Add context block to system prompt when messages > 20

**File**: `agent/prompts/builder.py` (System prompt construction)

**Specific Changes**:
1. **Budget Clarification**: Add explicit budget clarification prompts
   - Provide specific anchors ("Under $50, $50-$150, or above $150?")
   - Require explicit confirmation for vague budget expressions

2. **Booking Confirmation**: Strengthen booking confirmation requirements
   - Only accept explicit confirmations: "yes book it", "go ahead", "please book"
   - Reject ambiguous phrases: "looks good", "seems fine", "okay"

3. **Tool Calling Instructions**: Add mandatory tool call instructions
   - Always call customizeTrip for customization prices
   - Always call checkPaymentStatus for payment verification
   - Never hallucinate prices or booking references

4. **Language Handling**: Add language switch detection and persistence
   - Detect language switch phrases in user messages
   - Update session.preferred_language when detected
   - Apply new language to all subsequent responses


**File**: `agent/tools/handlers/payment.py` (Payment tool handlers)

**Specific Changes**:
1. **Booking Expiration Check**: Validate reserved_until before payment operations
   - Check `session.reserved_until < datetime.utcnow()` before generatePaymentQR
   - Inform user of expiration and offer to re-reserve

2. **Payment Retry Limit**: Enforce 3-attempt limit
   - Check `session.payment_attempts >= 3` before generating QR
   - Block 4th attempt and provide support contact

3. **Payment Status Verification**: Always call checkPaymentStatus for user claims
   - Never trust user claims without API verification
   - Call Stripe API to check actual payment status

4. **Duplicate QR Prevention**: Check existing payment_intent_id before generating new QR
   - If payment_intent_id exists and not expired, reuse existing QR
   - Only generate new QR if none exists or previous expired

5. **Webhook Coordination**: Add locking mechanism for webhook race conditions
   - Use Redis lock during payment confirmation
   - Prevent duplicate confirmation messages

6. **Points Deduction Timing**: Defer points deduction until payment confirmation
   - Track points_to_use in session without deducting
   - Only deduct from user balance on payment webhook success

**File**: `agent/tools/handlers/booking.py` (Booking tool handlers)

**Specific Changes**:
1. **Authentication Check**: Validate user authentication before booking
   - Check `session.user_id is not None` before calling createBooking
   - Redirect to login/register if unauthenticated

2. **Error Handling**: Handle createBooking failures gracefully
   - Catch network errors and 500 responses
   - Retry once with exponential backoff
   - Report clear error message without fake booking references

3. **Empty Results Handling**: Handle getTripSuggestions with < 3 results
   - Check result count before processing
   - Present available results and ask user to adjust preferences
   - Never fabricate fake trip options


**File**: `agent/tools/handlers/trips.py` (Trip tool handlers)

**Specific Changes**:
1. **Multi-Field Extraction**: Extract all discovery fields from single message
   - Parse message for all 6 fields simultaneously
   - Update session with all extracted fields
   - Use accumulation instead of overwriting

2. **Large Group Size Handling**: Properly parse and handle large numbers
   - Support parsing numbers >= 20
   - Calculate and display total cost for large groups
   - Format large numbers with proper separators

3. **Currency Conversion**: Add currency conversion for non-USD budgets
   - Detect KHR, CNY, and other currencies
   - Call currency conversion API or ask for USD equivalent
   - Store budget in USD in session

**File**: `websocket/chat_handler.py` (WebSocket handler)

**Specific Changes**:
1. **Session Isolation**: Ensure proper session isolation per WebSocket connection
   - Store session_id in connection context
   - Pass session_id to all agent operations
   - Prevent cross-session contamination

2. **Webhook Message Coordination**: Coordinate webhook and WebSocket messages
   - Use Redis pub/sub for webhook notifications
   - Queue messages to prevent race conditions
   - Ensure exactly-once delivery of confirmation messages

**File**: `services/redis_client.py` (Redis client)

**Specific Changes**:
1. **Lock Implementation**: Add distributed lock for critical sections
   - Implement Redis-based lock using SET NX EX
   - Use locks for payment confirmation and state transitions
   - Automatic lock expiration after 30 seconds


## Testing Strategy

### Validation Approach

The testing strategy follows a three-phase approach:
1. **Exploratory Testing**: Surface counterexamples on unfixed code to confirm root causes
2. **Fix Checking**: Verify bugs are fixed for all buggy inputs after implementation
3. **Preservation Checking**: Verify existing correct behavior remains unchanged

### Testing Framework Setup

**Technology Stack:**
- pytest 7.4+ (test framework)
- pytest-asyncio 0.21+ (async test support)
- pytest-mock 3.11+ (mocking)
- hypothesis 6.82+ (property-based testing)
- httpx (async HTTP client for mocking backend)
- fakeredis (Redis mocking)
- freezegun (datetime mocking)

**Test Structure:**
```
llm_agentic_chatbot/tests/
├── conftest.py                    # Shared fixtures
├── unit/
│   ├── test_discovery_stage.py   # Bug 1.1-1.4
│   ├── test_tool_calling.py      # Bug 1.5-1.10
│   ├── test_state_machine.py     # Bug 1.11-1.15
│   ├── test_payment_flow.py      # Bug 1.16-1.20
│   ├── test_session_memory.py    # Bug 1.21-1.25
│   ├── test_multilanguage.py     # Bug 1.26-1.27
│   └── test_edge_cases.py        # Bug 1.28-1.30
├── integration/
│   ├── test_websocket_flow.py    # End-to-end WebSocket tests
│   ├── test_redis_persistence.py # Redis integration tests
│   └── test_backend_tools.py     # Backend HTTP tool tests
├── property/
│   ├── test_state_serialization.py  # Property-based state tests
│   └── test_tool_validation.py      # Property-based tool tests
└── regression/
    └── test_preserved_behaviors.py  # Regression test suite
```


### Exploratory Fault Condition Checking

**Goal**: Surface counterexamples that demonstrate bugs BEFORE implementing fixes. Confirm or refute root cause analysis.

**Test Plan**: Write tests that simulate each of the 30 bug conditions and run them on UNFIXED code to observe failures and understand root causes.

**Category 1: Discovery Stage Tests (Bugs 1.1-1.4)**

1. **Test Incomplete Field Collection** (Bug 1.1)
   - Simulate user providing 4 of 6 fields: "Adventure trip for 5 days with 2 people"
   - Assert getTripSuggestions is called with null budget/departure/environment
   - Expected: Test FAILS on unfixed code (tool called prematurely)

2. **Test Vague Budget Handling** (Bug 1.2)
   - Simulate user saying "Something affordable"
   - Assert session.budget is set to specific value without clarification
   - Expected: Test FAILS on unfixed code (budget assumed)

3. **Test Multi-Field Extraction** (Bug 1.3)
   - Simulate user saying "Budget is $200, 2 people, 5 days"
   - Assert only last field extracted, others ignored
   - Expected: Test FAILS on unfixed code (only "5 days" extracted)

4. **Test Complete Field Skip** (Bug 1.4)
   - Simulate user providing all 6 fields in opening message
   - Assert system asks clarifying question instead of calling getTripSuggestions
   - Expected: Test FAILS on unfixed code (unnecessary question asked)

**Category 2: Tool Calling Tests (Bugs 1.5-1.10)**

5. **Test Hallucinated Prices** (Bug 1.5)
   - Simulate user asking "Can I add a hotel upgrade?"
   - Assert agent provides price without calling customizeTrip
   - Expected: Test FAILS on unfixed code (price hallucinated)

6. **Test Ambiguous Confirmation** (Bug 1.6)
   - Simulate user saying "Looks good to me"
   - Assert createBooking is called without explicit confirmation
   - Expected: Test FAILS on unfixed code (booking created prematurely)

7. **Test Fake Booking Reference** (Bug 1.7)
   - Mock createBooking to return 500 error
   - Assert agent invents fake booking reference "DLG-2025-XXXX"
   - Expected: Test FAILS on unfixed code (fake reference generated)

8. **Test Payment Status Guessing** (Bug 1.8)
   - Simulate user asking "Did my payment go through?"
   - Assert agent responds without calling checkPaymentStatus
   - Expected: Test FAILS on unfixed code (status guessed)

9. **Test Duplicate QR Generation** (Bug 1.9)
   - Set payment_intent_id in session, simulate user asking "How do I pay?"
   - Assert generatePaymentQR called multiple times
   - Expected: Test FAILS on unfixed code (duplicate Payment Intent created)

10. **Test Concurrent Session Contamination** (Bug 1.10)
    - Create two concurrent sessions with different user_ids
    - Simulate simultaneous tool calls
    - Assert tool calls use correct user_id from respective sessions
    - Expected: Test FAILS on unfixed code (wrong user_id used)


**Category 3: State Machine Tests (Bugs 1.11-1.15)**

11. **Test State Persistence Failure** (Bug 1.11)
    - Trigger state transition BOOKING → PAYMENT
    - Check Redis immediately after transition
    - Assert state in Redis still shows BOOKING (not persisted)
    - Expected: Test FAILS on unfixed code (state not saved)

12. **Test Skipped Customization** (Bug 1.12)
    - Set state to EXPLORATION, simulate trip selection
    - Assert next state is BOOKING (skips CUSTOMIZATION)
    - Expected: Test FAILS on unfixed code (stage skipped)

13. **Test Backward Transition Data Loss** (Bug 1.13)
    - Set selected_trip_id and customizations, simulate "change hotel"
    - Assert selected_trip_id becomes null
    - Expected: Test FAILS on unfixed code (data cleared)

14. **Test Post-Booking State Reversion** (Bug 1.14)
    - Set state to POST_BOOKING with booking_id, ask "What's the weather?"
    - Assert state reverts to DISCOVERY
    - Expected: Test FAILS on unfixed code (state reverted)

15. **Test Expired Booking Detection** (Bug 1.15)
    - Set reserved_until to past timestamp, load PAYMENT stage
    - Assert expired QR displayed without warning
    - Expected: Test FAILS on unfixed code (expiration not detected)

**Category 4: Payment Flow Tests (Bugs 1.16-1.20)**

16. **Test Unverified Payment** (Bug 1.16)
    - Simulate user claiming "I paid! Banking app said successful"
    - Assert booking confirmed without checkPaymentStatus call
    - Expected: Test FAILS on unfixed code (unverified confirmation)

17. **Test Expired Booking Payment** (Bug 1.17)
    - Set reserved_until to past timestamp, request payment QR
    - Assert generatePaymentQR called for expired booking
    - Expected: Test FAILS on unfixed code (QR generated for expired booking)

18. **Test Excessive Retries** (Bug 1.18)
    - Set payment_attempts to 3, request retry
    - Assert 4th QR code generated
    - Expected: Test FAILS on unfixed code (retry not blocked)

19. **Test Webhook Race Condition** (Bug 1.19)
    - Simulate payment webhook during active chat
    - Assert duplicate confirmation messages or state corruption
    - Expected: Test FAILS on unfixed code (race condition occurs)

20. **Test Premature Points Deduction** (Bug 1.20)
    - Apply loyalty points, create booking, check user balance
    - Assert points deducted before payment confirmation
    - Expected: Test FAILS on unfixed code (points deducted early)


**Category 5: Session Memory Tests (Bugs 1.21-1.25)**

21. **Test Corrupted JSON** (Bug 1.21)
    - Store corrupted JSON in Redis: `{"session_id": "abc", "state": "DISCO`
    - Attempt to load session
    - Assert system crashes with JSONDecodeError
    - Expected: Test FAILS on unfixed code (unhandled exception)

22. **Test TTL Not Reset** (Bug 1.22)
    - Create session 6 days ago, send message
    - Check Redis TTL after save
    - Assert TTL not reset to 7 days
    - Expected: Test FAILS on unfixed code (TTL not refreshed)

23. **Test Context Loss** (Bug 1.23)
    - Create session with 25 messages including budget in message 5
    - Trigger truncation, ask question requiring budget
    - Assert agent re-asks for budget
    - Expected: Test FAILS on unfixed code (context lost)

24. **Test Datetime Deserialization** (Bug 1.24)
    - Store session with reserved_until as ISO string
    - Load session and attempt datetime comparison
    - Assert TypeError raised
    - Expected: Test FAILS on unfixed code (string comparison fails)

25. **Test Tool Message Flattening** (Bug 1.25)
    - Save session with tool_result message
    - Load session and send to Claude API
    - Assert Claude API returns invalid_message_format error
    - Expected: Test FAILS on unfixed code (malformed message)

**Category 6: Multi-language Tests (Bugs 1.26-1.27)**

26. **Test Language Switch** (Bug 1.26)
    - Set language to EN, simulate user saying "Show in KHR"
    - Assert next response still in English
    - Expected: Test FAILS on unfixed code (language not updated)

27. **Test Currency Conversion** (Bug 1.27)
    - Simulate user saying "Budget is 200,000 រៀល"
    - Assert session.budget is null or incorrect
    - Expected: Test FAILS on unfixed code (conversion failed)

**Category 7: Edge Case Tests (Bugs 1.28-1.30)**

28. **Test Unauthenticated Booking** (Bug 1.28)
    - Set user_id to None, reach BOOKING stage
    - Assert createBooking called with null user_id
    - Expected: Test FAILS on unfixed code (no auth check)

29. **Test Empty Trip Results** (Bug 1.29)
    - Mock getTripSuggestions to return []
    - Assert system crashes or fabricates trips
    - Expected: Test FAILS on unfixed code (crash or fabrication)

30. **Test Large Group Size** (Bug 1.30)
    - Simulate user saying "45 students"
    - Assert people_count not set correctly or total cost not mentioned
    - Expected: Test FAILS on unfixed code (parsing failed)


### Fix Checking

**Goal**: Verify that for all inputs where bug conditions hold, the fixed agent produces expected behavior.

**Pseudocode:**
```
FOR EACH bug_id IN [1.1, 1.2, ..., 1.30] DO
  FOR ALL input WHERE isBugCondition_{bug_id}(input) DO
    result := fixed_agent.process(input)
    ASSERT expectedBehavior_{bug_id}(result)
  END FOR
END FOR
```

**Testing Approach**: Re-run all 30 exploratory tests on FIXED code and verify they now pass.

**Test Cases**: Same as exploratory tests, but with assertions inverted:
- Bug 1.1: Assert getTripSuggestions NOT called until all 6 fields collected
- Bug 1.2: Assert clarifying question asked for vague budget
- Bug 1.3: Assert all fields extracted from multi-field message
- Bug 1.4: Assert getTripSuggestions called immediately for complete fields
- Bug 1.5: Assert customizeTrip called for customization prices
- Bug 1.6: Assert explicit confirmation required before createBooking
- Bug 1.7: Assert error reported without fake booking reference
- Bug 1.8: Assert checkPaymentStatus called for payment queries
- Bug 1.9: Assert existing payment_intent_id reused, no duplicate
- Bug 1.10: Assert correct user_id used in concurrent sessions
- Bug 1.11: Assert state persisted to Redis immediately after transition
- Bug 1.12: Assert CUSTOMIZATION stage included in flow
- Bug 1.13: Assert selected_trip_id preserved during backward transition
- Bug 1.14: Assert POST_BOOKING state maintained for general questions
- Bug 1.15: Assert expiration detected and user informed
- Bug 1.16: Assert checkPaymentStatus called before confirmation
- Bug 1.17: Assert expiration detected, no QR for expired booking
- Bug 1.18: Assert 4th retry blocked, support contact provided
- Bug 1.19: Assert single confirmation message, no race condition
- Bug 1.20: Assert points not deducted until payment confirmed
- Bug 1.21: Assert JSONDecodeError caught, fresh session started
- Bug 1.22: Assert Redis TTL reset to 7 days on save
- Bug 1.23: Assert critical context injected into system prompt
- Bug 1.24: Assert datetime fields properly deserialized
- Bug 1.25: Assert tool message structure preserved
- Bug 1.26: Assert language preference updated and applied
- Bug 1.27: Assert currency converted or USD equivalent requested
- Bug 1.28: Assert authentication check blocks unauthenticated booking
- Bug 1.29: Assert empty results handled gracefully
- Bug 1.30: Assert large group size parsed and total cost displayed


### Preservation Checking

**Goal**: Verify that for all inputs where bug conditions do NOT hold, the fixed agent produces the same result as the original agent.

**Pseudocode:**
```
FOR ALL input WHERE NOT any_bug_condition(input) DO
  ASSERT fixed_agent.process(input) == original_agent.process(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- Generates many test cases automatically across the input domain
- Catches edge cases that manual unit tests might miss
- Provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Capture behavior on UNFIXED code for valid inputs, then write property-based tests verifying this behavior continues after fixes.

**Test Cases:**

1. **Valid Discovery Flow Preservation**
   - Generate random valid complete discovery inputs (all 6 fields)
   - Assert getTripSuggestions called with correct parameters
   - Assert 3 trip options presented

2. **Explicit Booking Confirmation Preservation**
   - Generate random explicit confirmation phrases ("Yes, book it", "Go ahead", "Please book")
   - Assert createBooking called and PAYMENT transition occurs

3. **Payment Webhook Success Preservation**
   - Generate random payment webhook events with SUCCEEDED status
   - Assert POST_BOOKING transition and confirmation message sent

4. **Valid State Transition Preservation**
   - Generate random valid state transition sequences
   - Assert all transitions follow correct path without errors

5. **Session Load Preservation**
   - Generate random valid session JSON structures
   - Assert successful deserialization and conversation resumption

6. **Tool Execution Preservation**
   - Generate random valid tool calls with proper parameters
   - Assert tools execute successfully and results returned

7. **Factual Query Preservation**
   - Generate random factual questions about destinations
   - Assert appropriate tools called (getPlaces, getWeatherForecast, getTripItinerary)

8. **Booking Storage Preservation**
   - Generate random successful booking flows
   - Assert booking_id, booking_ref, payment_intent_id stored in session

9. **Cancellation Flow Preservation**
   - Generate random cancellation requests in POST_BOOKING
   - Assert refund amount shown before cancelBooking called

10. **Multi-language Response Preservation**
    - Generate random messages in EN, KH, ZH with language set
    - Assert responses in correct language

11. **Parallel Tool Call Preservation**
    - Generate random parallel tool call scenarios
    - Assert both tools execute and results included

12. **Discount Code Preservation**
    - Generate random valid discount codes
    - Assert applyDiscountCode called and price updated

13. **WebSocket Connection Preservation**
    - Generate random WebSocket connections with valid session_id
    - Assert session loaded or created successfully

14. **New Session TTL Preservation**
    - Generate random new session creations
    - Assert 7-day TTL set in Redis

15. **Response Time Preservation**
    - Generate random valid requests
    - Assert response time within 2-3 seconds


### Unit Tests

**Discovery Stage Unit Tests:**
- Test discovery field extraction for each field type (mood, environment, duration, people, budget, departure)
- Test completeness validation logic
- Test clarification question generation
- Test multi-field extraction from single message
- Test vague expression detection and clarification

**Tool Calling Unit Tests:**
- Test tool call guard conditions (payment_intent_id check, booking expiration, retry limit)
- Test error handling for tool failures (network errors, 500 responses, empty results)
- Test tool parameter extraction from session context
- Test tool result parsing and response formatting
- Test concurrent tool execution isolation

**State Machine Unit Tests:**
- Test each state transition (DISCOVERY→SUGGESTION, SUGGESTION→EXPLORATION, etc.)
- Test state persistence after transitions
- Test backward transition data preservation
- Test state guard conditions (POST_BOOKING stability, CUSTOMIZATION inclusion)
- Test state validation and error handling

**Payment Flow Unit Tests:**
- Test booking expiration detection
- Test payment retry limit enforcement
- Test payment status verification
- Test QR code generation and reuse logic
- Test webhook coordination and locking
- Test points deduction timing

**Session Memory Unit Tests:**
- Test JSON serialization/deserialization
- Test datetime field handling
- Test TTL reset logic
- Test context injection on truncation
- Test tool message structure preservation
- Test corrupted JSON error handling

**Multi-language Unit Tests:**
- Test language detection from user messages
- Test language preference persistence
- Test currency conversion for KHR, CNY
- Test response formatting in each language

**Edge Case Unit Tests:**
- Test authentication validation before booking
- Test empty tool result handling
- Test large number parsing
- Test total cost calculation for large groups


### Property-Based Tests

**State Serialization Properties:**

Using hypothesis to generate random session states and verify serialization/deserialization:

```python
from hypothesis import given, strategies as st
from datetime import datetime, timedelta

@given(
    session_id=st.uuids(),
    user_id=st.uuids(),
    state=st.sampled_from(['DISCOVERY', 'SUGGESTION', 'EXPLORATION', 
                           'CUSTOMIZATION', 'BOOKING', 'PAYMENT', 'POST_BOOKING']),
    message_count=st.integers(min_value=0, max_value=50),
    has_booking=st.booleans(),
    has_payment=st.booleans()
)
def test_session_serialization_roundtrip(session_id, user_id, state, 
                                         message_count, has_booking, has_payment):
    """Property: Session serialization is lossless"""
    session = create_session(session_id, user_id, state, message_count, 
                            has_booking, has_payment)
    
    # Serialize to JSON
    json_str = session_manager.serialize(session)
    
    # Deserialize back
    restored_session = session_manager.deserialize(json_str)
    
    # Assert all fields match
    assert restored_session == session
    assert isinstance(restored_session.reserved_until, datetime)
    assert isinstance(restored_session.created_at, datetime)
```

**Tool Validation Properties:**

```python
@given(
    tool_name=st.sampled_from(['getTripSuggestions', 'createBooking', 
                               'generatePaymentQR', 'checkPaymentStatus']),
    user_id=st.uuids(),
    session_state=st.sampled_from(['DISCOVERY', 'BOOKING', 'PAYMENT'])
)
def test_tool_calls_use_correct_user_id(tool_name, user_id, session_state):
    """Property: All tool calls use user_id from session context"""
    session = create_session_with_user(user_id, session_state)
    
    # Execute tool
    tool_call = execute_tool(tool_name, session)
    
    # Assert user_id in tool call matches session
    assert tool_call.parameters['user_id'] == str(user_id)
```

**Discovery Field Extraction Properties:**

```python
@given(
    mood=st.sampled_from(['adventure', 'relaxation', 'culture', 'nature']),
    environment=st.sampled_from(['beach', 'mountain', 'city', 'countryside']),
    duration=st.integers(min_value=1, max_value=14),
    people=st.integers(min_value=1, max_value=50),
    budget=st.integers(min_value=50, max_value=5000),
    departure=st.dates(min_value=datetime.now().date(), 
                      max_value=(datetime.now() + timedelta(days=365)).date())
)
def test_complete_discovery_triggers_suggestions(mood, environment, duration, 
                                                 people, budget, departure):
    """Property: Complete discovery fields always trigger getTripSuggestions"""
    message = f"I want {mood} {environment} trip for {duration} days, " \
              f"{people} people, ${budget} budget, leaving {departure}"
    
    session = create_new_session()
    response = agent.process_message(session, message)
    
    # Assert getTripSuggestions was called
    assert 'getTripSuggestions' in response.tool_calls
    assert response.tool_calls['getTripSuggestions']['mood'] == mood
    assert response.tool_calls['getTripSuggestions']['people_count'] == people
```


### Integration Tests

**WebSocket Flow Integration Tests:**

```python
@pytest.mark.asyncio
async def test_complete_booking_flow_via_websocket():
    """Integration test: Complete booking flow from discovery to payment"""
    async with WebSocketClient() as ws:
        # Connect
        await ws.connect(session_id="test-session-1", user_id="user-123")
        
        # Discovery stage
        await ws.send_message("I want adventure beach trip for 5 days, 2 people, $500, leaving March 15")
        response = await ws.receive_message()
        assert "3 trip options" in response.text
        
        # Exploration stage
        await ws.send_message("Tell me more about option 2")
        response = await ws.receive_message()
        assert "itinerary" in response.text.lower()
        
        # Customization stage
        await ws.send_message("I'll take option 2")
        response = await ws.receive_message()
        assert "customization" in response.text.lower() or "add-on" in response.text.lower()
        
        # Booking stage
        await ws.send_message("No customizations, please book it")
        response = await ws.receive_message()
        assert "confirm" in response.text.lower()
        
        await ws.send_message("Yes, book it")
        response = await ws.receive_message()
        assert "booking confirmed" in response.text.lower()
        assert response.session.state == "PAYMENT"
        
        # Payment stage
        assert response.session.payment_intent_id is not None
        assert response.session.reserved_until > datetime.utcnow()
```

**Redis Persistence Integration Tests:**

```python
@pytest.mark.asyncio
async def test_session_persistence_across_reconnections():
    """Integration test: Session persists across WebSocket reconnections"""
    session_id = "test-session-persist"
    
    # First connection
    async with WebSocketClient() as ws1:
        await ws1.connect(session_id=session_id, user_id="user-123")
        await ws1.send_message("I want adventure trip for 5 days")
        response1 = await ws1.receive_message()
        
        # Verify session saved to Redis
        redis_data = await redis_client.get(f"session:{session_id}")
        assert redis_data is not None
        session_data = json.loads(redis_data)
        assert "5 days" in str(session_data['messages'])
    
    # Second connection (reconnect)
    async with WebSocketClient() as ws2:
        await ws2.connect(session_id=session_id, user_id="user-123")
        
        # Session should be restored
        await ws2.send_message("What was my duration?")
        response2 = await ws2.receive_message()
        assert "5 days" in response2.text
```

**Backend Tool Integration Tests:**

```python
@pytest.mark.asyncio
async def test_backend_tool_calls_with_real_http():
    """Integration test: Tool calls to backend API"""
    # Mock backend server
    async with MockBackendServer() as backend:
        backend.register_endpoint(
            'POST', '/v1/ai-tools/get-trip-suggestions',
            response={'trips': [{'id': 'trip-1', 'name': 'Angkor Adventure'}]}
        )
        
        session = create_session_with_complete_discovery()
        response = await agent.process_message(session, "Show me trips")
        
        # Verify tool was called
        assert backend.was_called('POST', '/v1/ai-tools/get-trip-suggestions')
        assert 'Angkor Adventure' in response.text
```


### Regression Test Suite

**Preserved Behavior Tests:**

```python
class TestPreservedBehaviors:
    """Regression tests to ensure fixes don't break existing correct behavior"""
    
    def test_valid_discovery_flow_unchanged(self):
        """Preserved: Valid complete discovery triggers getTripSuggestions"""
        message = "I want adventure beach trip for 5 days, 2 people, $500, leaving March 15"
        session = create_new_session()
        
        response = agent.process_message(session, message)
        
        assert 'getTripSuggestions' in response.tool_calls
        assert len(response.suggested_trips) == 3
    
    def test_explicit_booking_confirmation_unchanged(self):
        """Preserved: Explicit 'yes' confirmation creates booking"""
        session = create_session_ready_for_booking()
        
        response = agent.process_message(session, "Yes, book it")
        
        assert 'createBooking' in response.tool_calls
        assert session.state == 'PAYMENT'
    
    def test_payment_webhook_success_unchanged(self):
        """Preserved: Payment webhook transitions to POST_BOOKING"""
        session = create_session_in_payment()
        
        webhook_event = create_payment_success_webhook(session.payment_intent_id)
        response = agent.handle_webhook(session, webhook_event)
        
        assert session.state == 'POST_BOOKING'
        assert 'booking confirmed' in response.text.lower()
    
    def test_multi_language_responses_unchanged(self):
        """Preserved: Multi-language support works correctly"""
        for lang in ['EN', 'KH', 'ZH']:
            session = create_session_with_language(lang)
            response = agent.process_message(session, "Hello")
            
            assert response.language == lang
            assert is_valid_response_in_language(response.text, lang)
    
    def test_parallel_tool_calls_unchanged(self):
        """Preserved: Parallel tool execution works"""
        session = create_session_with_selected_trip()
        
        response = agent.process_message(session, "Show itinerary and weather")
        
        assert 'getTripItinerary' in response.tool_calls
        assert 'getWeatherForecast' in response.tool_calls
        assert both_results_in_response(response)
    
    def test_discount_code_application_unchanged(self):
        """Preserved: Discount codes apply correctly"""
        session = create_session_ready_for_booking()
        
        response = agent.process_message(session, "Apply code SUMMER2025")
        
        assert 'applyDiscountCode' in response.tool_calls
        assert session.discount_applied == True
        assert session.total_price < session.original_price
```


### Test Data Fixtures and Mocking Strategies

**Fixtures (conftest.py):**

```python
import pytest
from datetime import datetime, timedelta
import fakeredis
from unittest.mock import AsyncMock

@pytest.fixture
def redis_client():
    """Fake Redis client for testing"""
    return fakeredis.FakeAsyncRedis()

@pytest.fixture
def mock_backend_client():
    """Mock backend HTTP client"""
    client = AsyncMock()
    client.get_trip_suggestions.return_value = {
        'trips': [
            {'id': 'trip-1', 'name': 'Angkor Adventure', 'price': 89},
            {'id': 'trip-2', 'name': 'Beach Paradise', 'price': 120},
            {'id': 'trip-3', 'name': 'Cultural Journey', 'price': 75}
        ]
    }
    client.create_booking.return_value = {
        'booking_id': 'booking-123',
        'booking_ref': 'DLG-2025-0001',
        'reserved_until': (datetime.utcnow() + timedelta(minutes=15)).isoformat()
    }
    return client

@pytest.fixture
def mock_claude_client():
    """Mock Claude API client"""
    client = AsyncMock()
    client.create_message.return_value = {
        'content': [{'type': 'text', 'text': 'Test response'}],
        'stop_reason': 'end_turn'
    }
    return client

@pytest.fixture
def sample_session():
    """Sample session for testing"""
    return ConversationState(
        session_id='test-session-1',
        user_id='user-123',
        state='DISCOVERY',
        preferred_language='EN',
        messages=[],
        created_at=datetime.utcnow(),
        last_active=datetime.utcnow()
    )

@pytest.fixture
def session_with_complete_discovery():
    """Session with all discovery fields collected"""
    session = ConversationState(
        session_id='test-session-2',
        user_id='user-123',
        state='SUGGESTION',
        preferred_language='EN',
        messages=[
            {'role': 'user', 'content': 'I want adventure beach trip for 5 days, 2 people, $500, leaving March 15'}
        ]
    )
    session.discovery_fields = {
        'mood': 'adventure',
        'environment': 'beach',
        'duration': 5,
        'people': 2,
        'budget': 500,
        'departure': '2025-03-15'
    }
    return session

@pytest.fixture
def session_ready_for_booking():
    """Session ready for booking confirmation"""
    session = ConversationState(
        session_id='test-session-3',
        user_id='user-123',
        state='BOOKING',
        preferred_language='EN',
        selected_trip_id='trip-1',
        selected_trip_name='Angkor Adventure'
    )
    return session

@pytest.fixture
def session_in_payment():
    """Session in payment stage"""
    session = ConversationState(
        session_id='test-session-4',
        user_id='user-123',
        state='PAYMENT',
        preferred_language='EN',
        booking_id='booking-123',
        booking_ref='DLG-2025-0001',
        payment_intent_id='pi_test_123',
        reserved_until=datetime.utcnow() + timedelta(minutes=10)
    )
    return session
```


**Mocking Strategies:**

```python
# Mock backend HTTP calls
@pytest.fixture
def mock_httpx_client(monkeypatch):
    """Mock httpx async client for backend calls"""
    async def mock_post(*args, **kwargs):
        url = args[0] if args else kwargs.get('url')
        
        if 'get-trip-suggestions' in url:
            return MockResponse(200, {'trips': [...]})
        elif 'create-booking' in url:
            return MockResponse(200, {'booking_id': 'booking-123'})
        elif 'generate-payment-qr' in url:
            return MockResponse(200, {'payment_intent_id': 'pi_123', 'qr_code': 'data:image...'})
        
        return MockResponse(404, {'error': 'Not found'})
    
    monkeypatch.setattr('httpx.AsyncClient.post', mock_post)

# Mock Redis operations
@pytest.fixture
def mock_redis_operations(monkeypatch):
    """Mock Redis get/set operations"""
    storage = {}
    
    async def mock_get(key):
        return storage.get(key)
    
    async def mock_setex(key, ttl, value):
        storage[key] = value
    
    monkeypatch.setattr('redis.asyncio.Redis.get', mock_get)
    monkeypatch.setattr('redis.asyncio.Redis.setex', mock_setex)

# Mock datetime for time-dependent tests
@pytest.fixture
def frozen_time():
    """Freeze time for testing expiration logic"""
    from freezegun import freeze_time
    with freeze_time('2025-01-15 14:00:00'):
        yield datetime(2025, 1, 15, 14, 0, 0)
```

**Test Helpers:**

```python
def create_session_with_user(user_id, state='DISCOVERY'):
    """Helper to create session with specific user"""
    return ConversationState(
        session_id=f'session-{user_id}',
        user_id=user_id,
        state=state,
        preferred_language='EN',
        messages=[],
        created_at=datetime.utcnow(),
        last_active=datetime.utcnow()
    )

def create_payment_success_webhook(payment_intent_id):
    """Helper to create payment success webhook event"""
    return {
        'type': 'payment_intent.succeeded',
        'data': {
            'object': {
                'id': payment_intent_id,
                'status': 'succeeded',
                'amount': 8900,
                'currency': 'usd'
            }
        }
    }

def assert_tool_called(response, tool_name):
    """Helper to assert tool was called"""
    assert tool_name in response.tool_calls, \
        f"Expected {tool_name} to be called, but got {list(response.tool_calls.keys())}"

def assert_state_transition(session, expected_state):
    """Helper to assert state transition"""
    assert session.state == expected_state, \
        f"Expected state {expected_state}, but got {session.state}"
```


### CI/CD Integration for Automated Testing

**GitHub Actions Workflow (.github/workflows/ai-agent-tests.yml):**

```yaml
name: AI Agent Tests

on:
  push:
    branches: [main, develop]
    paths:
      - 'llm_agentic_chatbot/**'
  pull_request:
    branches: [main, develop]
    paths:
      - 'llm_agentic_chatbot/**'

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Python 3.11
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      
      - name: Cache dependencies
        uses: actions/cache@v3
        with:
          path: ~/.cache/pip
          key: ${{ runner.os }}-pip-${{ hashFiles('**/requirements.txt') }}
      
      - name: Install dependencies
        run: |
          cd llm_agentic_chatbot
          pip install -r requirements.txt
          pip install pytest pytest-asyncio pytest-cov pytest-mock hypothesis fakeredis freezegun
      
      - name: Run unit tests
        run: |
          cd llm_agentic_chatbot
          pytest tests/unit/ -v --cov=agent --cov-report=xml --cov-report=term
      
      - name: Run integration tests
        env:
          REDIS_URL: redis://localhost:6379/0
          BACKEND_URL: http://mock-backend:3001
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          cd llm_agentic_chatbot
          pytest tests/integration/ -v
      
      - name: Run property-based tests
        run: |
          cd llm_agentic_chatbot
          pytest tests/property/ -v --hypothesis-show-statistics
      
      - name: Run regression tests
        run: |
          cd llm_agentic_chatbot
          pytest tests/regression/ -v
      
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          file: ./llm_agentic_chatbot/coverage.xml
          flags: ai-agent
          name: ai-agent-coverage
      
      - name: Check coverage threshold
        run: |
          cd llm_agentic_chatbot
          coverage report --fail-under=80
```

**pytest.ini Configuration:**

```ini
[pytest]
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
asyncio_mode = auto
markers =
    unit: Unit tests
    integration: Integration tests
    property: Property-based tests
    regression: Regression tests
    slow: Slow-running tests
addopts = 
    -v
    --strict-markers
    --tb=short
    --disable-warnings
```

**Coverage Configuration (.coveragerc):**

```ini
[run]
source = agent
omit = 
    */tests/*
    */conftest.py
    */__pycache__/*

[report]
precision = 2
show_missing = True
skip_covered = False

[html]
directory = htmlcov
```


## Summary

This design document provides a comprehensive approach to fixing 30 critical bugs in the DerLg AI Agent across 8 categories. The implementation strategy follows the bug condition methodology with systematic validation through exploratory testing, fix checking, and preservation checking.

**Key Implementation Areas:**
- Discovery stage validation and multi-field extraction
- Tool call guards and mandatory verification
- State machine persistence and transition logic
- Payment flow validation and race condition prevention
- Session memory serialization and TTL management
- Multi-language and currency conversion support
- Edge case handling for authentication and empty results

**Testing Strategy:**
- 30 exploratory tests to surface counterexamples on unfixed code
- 30 fix verification tests to confirm bugs are resolved
- 15 preservation tests to ensure existing behavior unchanged
- Property-based tests for state serialization and tool validation
- Integration tests for WebSocket, Redis, and backend communication
- Comprehensive regression suite with 80%+ code coverage
- CI/CD automation with GitHub Actions

**Expected Outcomes:**
- All 30 bugs fixed with verified test coverage
- No regression in existing correct behaviors
- Improved reliability for discovery, booking, and payment flows
- Better error handling and user experience
- Stronger guarantees through property-based testing
- Automated testing in CI/CD pipeline

The fixes will be implemented incrementally by category, with each category fully tested before moving to the next. This ensures systematic progress and early detection of any unintended side effects.
