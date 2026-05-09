# Implementation Plan

## Test Infrastructure Setup

- [ ] 0.1 Set up test infrastructure
  - Install pytest 7.4+, pytest-asyncio 0.21+, pytest-mock 3.11+
  - Install hypothesis 6.82+ for property-based testing
  - Install httpx, fakeredis, freezegun for mocking
  - Create test directory structure: unit/, integration/, property/, regression/
  - Create conftest.py with shared fixtures
  - Configure pytest.ini with test markers and asyncio mode
  - Configure .coveragerc for 80% coverage threshold
  - Set up GitHub Actions workflow for CI/CD
  - _Requirements: Testing Strategy from design_

## Category 1: Discovery Stage Bugs (4 bugs)

- [ ] 1. Write bug condition exploration tests for Discovery Stage
  - **Property 1: Fault Condition** - Discovery Stage Bugs (1.1-1.4)
  - **CRITICAL**: These tests MUST FAIL on unfixed code - failure confirms the bugs exist
  - **DO NOT attempt to fix the tests or the code when they fail**
  - **NOTE**: These tests encode the expected behavior - they will validate the fixes when they pass after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bugs exist
  - Test Bug 1.1: Incomplete field collection (4 of 6 fields provided, getTripSuggestions called prematurely)
  - Test Bug 1.2: Vague budget handling ("affordable" → specific value assumed without clarification)
  - Test Bug 1.3: Multi-field extraction failure ("$200, 2 people, 5 days" → only last field extracted)
  - Test Bug 1.4: Unnecessary clarification (all 6 fields provided → still asks questions)
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests FAIL (this is correct - it proves the bugs exist)
  - Document counterexamples found to understand root cause
  - Mark task complete when tests are written, run, and failures are documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4_


- [ ] 2. Write preservation property tests for Discovery Stage (BEFORE implementing fix)
  - **Property 2: Preservation** - Valid Discovery Flow
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for valid complete discovery inputs (all 6 fields)
  - Write property-based test: for all valid complete discovery inputs, getTripSuggestions is called with correct parameters
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1_

- [ ] 3. Fix Discovery Stage Bugs

  - [ ] 3.1 Implement discovery field validation and extraction
    - Add validate_discovery_fields() function to check all 6 required fields
    - Implement multi-field extraction to capture all fields from single message
    - Add clarification logic to ask for missing fields one at a time
    - Implement vague budget detection and clarification with specific anchors
    - Add completeness check before calling getTripSuggestions
    - _Bug_Condition: isBugCondition_1_1, isBugCondition_1_2, isBugCondition_1_3, isBugCondition_1_4 from design_
    - _Expected_Behavior: expectedBehavior from requirements 2.1, 2.2, 2.3, 2.4_
    - _Preservation: Valid discovery flows from requirement 3.1_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1_

  - [ ] 3.2 Verify bug condition exploration tests now pass
    - **Property 1: Expected Behavior** - Discovery Stage Fixed
    - **IMPORTANT**: Re-run the SAME tests from task 1 - do NOT write new tests
    - The tests from task 1 encode the expected behavior
    - When these tests pass, it confirms the expected behavior is satisfied
    - Run bug condition exploration tests from step 1
    - **EXPECTED OUTCOME**: Tests PASS (confirms bugs are fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Valid Discovery Flow Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

## Category 2: Tool Calling Bugs (6 bugs)

- [ ] 4. Write bug condition exploration tests for Tool Calling
  - **Property 1: Fault Condition** - Tool Calling Bugs (1.5-1.10)
  - **CRITICAL**: These tests MUST FAIL on unfixed code - failure confirms the bugs exist
  - **DO NOT attempt to fix the tests or the code when they fail**
  - **GOAL**: Surface counterexamples that demonstrate the bugs exist
  - Test Bug 1.5: Hallucinated customization prices (customizeTrip not called)
  - Test Bug 1.6: Ambiguous booking confirmation ("Looks good" → booking created)
  - Test Bug 1.7: Fake booking references (createBooking fails → fake "DLG-2025-XXXX" generated)
  - Test Bug 1.8: Payment status guessing (status query → no checkPaymentStatus call)
  - Test Bug 1.9: Duplicate QR generation (payment_intent_id exists → generatePaymentQR called again)
  - Test Bug 1.10: Concurrent session contamination (Alice's booking → Bob's account)
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests FAIL (this is correct - it proves the bugs exist)
  - Document counterexamples found
  - _Requirements: 1.5, 1.6, 1.7, 1.8, 1.9, 1.10_

- [ ] 5. Write preservation property tests for Tool Calling (BEFORE implementing fix)
  - **Property 2: Preservation** - Valid Tool Execution
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for valid tool calls with proper parameters
  - Write property-based tests: for all valid tool calls, tools execute successfully and return results
  - Test explicit booking confirmations ("Yes, book it" → createBooking called)
  - Test factual queries (destination questions → appropriate tools called)
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (confirms baseline behavior)
  - _Requirements: 3.2, 3.6, 3.7_

- [ ] 6. Fix Tool Calling Bugs

  - [ ] 6.1 Implement tool call guards and validation
    - Add payment_intent_id existence check before generatePaymentQR
    - Add booking expiration validation before payment operations
    - Add payment_attempts count check before retry
    - Implement explicit booking confirmation validation (reject ambiguous phrases)
    - Add mandatory customizeTrip call for customization price queries
    - Add mandatory checkPaymentStatus call for payment verification queries
    - _Bug_Condition: isBugCondition_1_5 through isBugCondition_1_10 from design_
    - _Expected_Behavior: expectedBehavior from requirements 2.5-2.10_
    - _Preservation: Valid tool execution from requirements 3.2, 3.6, 3.7_
    - _Requirements: 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 3.2, 3.6, 3.7_

  - [ ] 6.2 Implement session isolation for concurrent users
    - Pass session_id explicitly to all tool calls
    - Extract user_id from session context, not global state
    - Add session isolation tests with concurrent WebSocket connections
    - _Bug_Condition: isBugCondition_1_10 from design_
    - _Expected_Behavior: expectedBehavior from requirement 2.10_
    - _Requirements: 2.10_

  - [ ] 6.3 Implement graceful error handling for tool failures
    - Catch createBooking failures and report errors without fake references
    - Handle network errors with retry logic and exponential backoff
    - Handle empty getTripSuggestions results gracefully
    - _Bug_Condition: isBugCondition_1_7, isBugCondition_1_29 from design_
    - _Expected_Behavior: expectedBehavior from requirements 2.7, 2.29_
    - _Requirements: 2.7, 2.29_

  - [ ] 6.4 Verify bug condition exploration tests now pass
    - **Property 1: Expected Behavior** - Tool Calling Fixed
    - **IMPORTANT**: Re-run the SAME tests from task 4 - do NOT write new tests
    - Run bug condition exploration tests from step 4
    - **EXPECTED OUTCOME**: Tests PASS (confirms bugs are fixed)
    - _Requirements: 2.5, 2.6, 2.7, 2.8, 2.9, 2.10_

  - [ ] 6.5 Verify preservation tests still pass
    - **Property 2: Preservation** - Valid Tool Execution Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 5 - do NOT write new tests
    - Run preservation property tests from step 5
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)

## Category 3: State Machine Bugs (5 bugs)

- [ ] 7. Write bug condition exploration tests for State Machine
  - **Property 1: Fault Condition** - State Machine Bugs (1.11-1.15)
  - **CRITICAL**: These tests MUST FAIL on unfixed code - failure confirms the bugs exist
  - **GOAL**: Surface counterexamples that demonstrate the bugs exist
  - Test Bug 1.11: State transition persistence failure (BOOKING→PAYMENT in memory, not in Redis)
  - Test Bug 1.12: Skipped customization stage (EXPLORATION→BOOKING, skips CUSTOMIZATION)
  - Test Bug 1.13: Backward transition data loss ("change hotel" → selected_trip_id cleared)
  - Test Bug 1.14: Post-booking state reversion (POST_BOOKING + general question → DISCOVERY)
  - Test Bug 1.15: Expired booking hold detection (reserved_until expired → QR still shown)
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests FAIL (this is correct - it proves the bugs exist)
  - Document counterexamples found
  - _Requirements: 1.11, 1.12, 1.13, 1.14, 1.15_

- [ ] 8. Write preservation property tests for State Machine (BEFORE implementing fix)
  - **Property 2: Preservation** - Valid State Transitions
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for valid state transitions
  - Write property-based tests: for all valid state transition sequences, transitions follow correct path
  - Test standard flow: DISCOVERY→SUGGESTION→EXPLORATION→CUSTOMIZATION→BOOKING→PAYMENT→POST_BOOKING
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (confirms baseline behavior)
  - _Requirements: 3.4_

- [ ] 9. Fix State Machine Bugs

  - [ ] 9.1 Implement immediate state persistence
    - Add await session_manager.save(session) after every state transition
    - Ensure state is persisted to Redis before continuing execution
    - Add tests to verify Redis state matches in-memory state
    - _Bug_Condition: isBugCondition_1_11 from design_
    - _Expected_Behavior: expectedBehavior from requirement 2.11_
    - _Preservation: Valid state transitions from requirement 3.4_
    - _Requirements: 2.11, 3.4_

  - [ ] 9.2 Add CUSTOMIZATION stage to state machine flow
    - Update state transition logic to include CUSTOMIZATION between EXPLORATION and BOOKING
    - Add customization prompt and tool call logic
    - Test that trip selection triggers CUSTOMIZATION stage
    - _Bug_Condition: isBugCondition_1_12 from design_
    - _Expected_Behavior: expectedBehavior from requirement 2.12_
    - _Requirements: 2.12_

  - [ ] 9.3 Implement selective data preservation for backward transitions
    - Preserve selected_trip_id and customizations when going back
    - Implement selective field clearing instead of full session reset
    - Test backward navigation maintains relevant data
    - _Bug_Condition: isBugCondition_1_13 from design_
    - _Expected_Behavior: expectedBehavior from requirement 2.13_
    - _Requirements: 2.13_

  - [ ] 9.4 Add POST_BOOKING state stability guard
    - Add state guard to keep POST_BOOKING state for general questions
    - Only transition to DISCOVERY on explicit new trip intent
    - Test general questions in POST_BOOKING don't revert state
    - _Bug_Condition: isBugCondition_1_14 from design_
    - _Expected_Behavior: expectedBehavior from requirement 2.14_
    - _Requirements: 2.14_

  - [ ] 9.5 Implement booking expiration detection in PAYMENT stage
    - Check session.reserved_until < datetime.utcnow() before displaying QR
    - Inform user of expiration and offer to re-reserve
    - Test expired booking detection and user notification
    - _Bug_Condition: isBugCondition_1_15 from design_
    - _Expected_Behavior: expectedBehavior from requirement 2.15_
    - _Requirements: 2.15_

  - [ ] 9.6 Verify bug condition exploration tests now pass
    - **Property 1: Expected Behavior** - State Machine Fixed
    - **IMPORTANT**: Re-run the SAME tests from task 7 - do NOT write new tests
    - Run bug condition exploration tests from step 7
    - **EXPECTED OUTCOME**: Tests PASS (confirms bugs are fixed)
    - _Requirements: 2.11, 2.12, 2.13, 2.14, 2.15_

  - [ ] 9.7 Verify preservation tests still pass
    - **Property 2: Preservation** - Valid State Transitions Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 8 - do NOT write new tests
    - Run preservation property tests from step 8
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)

## Category 4: Payment Flow Bugs (5 bugs)

- [ ] 10. Write bug condition exploration tests for Payment Flow
  - **Property 1: Fault Condition** - Payment Flow Bugs (1.16-1.20)
  - **CRITICAL**: These tests MUST FAIL on unfixed code - failure confirms the bugs exist
  - **GOAL**: Surface counterexamples that demonstrate the bugs exist
  - Test Bug 1.16: Unverified payment confirmation ("I paid" → booking confirmed without checkPaymentStatus)
  - Test Bug 1.17: Expired booking payment generation (reserved_until expired → QR generated)
  - Test Bug 1.18: Excessive payment retry attempts (3 failed payments → 4th QR generated)
  - Test Bug 1.19: Payment webhook race condition (webhook during chat → duplicate confirmations)
  - Test Bug 1.20: Premature loyalty points deduction (points deducted before payment confirmation)
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests FAIL (this is correct - it proves the bugs exist)
  - Document counterexamples found
  - _Requirements: 1.16, 1.17, 1.18, 1.19, 1.20_

- [ ] 11. Write preservation property tests for Payment Flow (BEFORE implementing fix)
  - **Property 2: Preservation** - Valid Payment Flow
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for valid payment flows
  - Write property-based tests: for all valid payment webhooks with SUCCEEDED status, transition to POST_BOOKING occurs
  - Test successful booking and payment storage (booking_id, booking_ref, payment_intent_id)
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (confirms baseline behavior)
  - _Requirements: 3.3, 3.8_

- [ ] 12. Fix Payment Flow Bugs

  - [ ] 12.1 Implement payment status verification
    - Add mandatory checkPaymentStatus call for user payment claims
    - Never trust user claims without API verification
    - Call Stripe API to check actual payment status
    - _Bug_Condition: isBugCondition_1_16 from design_
    - _Expected_Behavior: expectedBehavior from requirement 2.16_
    - _Preservation: Valid payment flow from requirements 3.3, 3.8_
    - _Requirements: 2.16, 3.3, 3.8_

  - [ ] 12.2 Implement booking expiration validation for payment operations
    - Check session.reserved_until < datetime.utcnow() before generatePaymentQR
    - Inform user of expiration and offer to re-reserve
    - Block payment QR generation for expired bookings
    - _Bug_Condition: isBugCondition_1_17 from design_
    - _Expected_Behavior: expectedBehavior from requirement 2.17_
    - _Requirements: 2.17_

  - [ ] 12.3 Implement payment retry limit enforcement
    - Check session.payment_attempts >= 3 before generating QR
    - Block 4th attempt and provide support contact
    - Test retry limit enforcement
    - _Bug_Condition: isBugCondition_1_18 from design_
    - _Expected_Behavior: expectedBehavior from requirement 2.18_
    - _Requirements: 2.18_

  - [ ] 12.4 Implement webhook coordination with Redis locking
    - Add Redis-based lock using SET NX EX for payment confirmation
    - Use locks to prevent race conditions between webhook and WebSocket messages
    - Automatic lock expiration after 30 seconds
    - Queue messages to prevent duplicate confirmations
    - _Bug_Condition: isBugCondition_1_19 from design_
    - _Expected_Behavior: expectedBehavior from requirement 2.19_
    - _Requirements: 2.19_

  - [ ] 12.5 Defer loyalty points deduction until payment confirmation
    - Track points_to_use in session without deducting from balance
    - Only deduct from user balance on payment webhook success
    - Test points are not deducted before payment confirmation
    - _Bug_Condition: isBugCondition_1_20 from design_
    - _Expected_Behavior: expectedBehavior from requirement 2.20_
    - _Requirements: 2.20_

  - [ ] 12.6 Verify bug condition exploration tests now pass
    - **Property 1: Expected Behavior** - Payment Flow Fixed
    - **IMPORTANT**: Re-run the SAME tests from task 10 - do NOT write new tests
    - Run bug condition exploration tests from step 10
    - **EXPECTED OUTCOME**: Tests PASS (confirms bugs are fixed)
    - _Requirements: 2.16, 2.17, 2.18, 2.19, 2.20_

  - [ ] 12.7 Verify preservation tests still pass
    - **Property 2: Preservation** - Valid Payment Flow Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 11 - do NOT write new tests
    - Run preservation property tests from step 11
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)

## Category 5: Session Memory Bugs (5 bugs)

- [ ] 13. Write bug condition exploration tests for Session Memory
  - **Property 1: Fault Condition** - Session Memory Bugs (1.21-1.25)
  - **CRITICAL**: These tests MUST FAIL on unfixed code - failure confirms the bugs exist
  - **GOAL**: Surface counterexamples that demonstrate the bugs exist
  - Test Bug 1.21: Corrupted JSON handling (partial JSON → JSONDecodeError crash)
  - Test Bug 1.22: Session TTL not reset (day 6 message → TTL not refreshed)
  - Test Bug 1.23: Context loss from truncation (25 messages → budget info lost)
  - Test Bug 1.24: Datetime deserialization error (reserved_until as string → TypeError)
  - Test Bug 1.25: Tool message structure flattening (tool_result → Claude API error)
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests FAIL (this is correct - it proves the bugs exist)
  - Document counterexamples found
  - _Requirements: 1.21, 1.22, 1.23, 1.24, 1.25_

- [ ] 14. Write preservation property tests for Session Memory (BEFORE implementing fix)
  - **Property 2: Preservation** - Valid Session Operations
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for valid session operations
  - Write property-based tests: for all valid session JSON, deserialization succeeds
  - Test new session creation sets 7-day TTL
  - Test WebSocket connections with valid session_id load sessions correctly
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (confirms baseline behavior)
  - _Requirements: 3.5, 3.13, 3.14_

- [ ] 15. Fix Session Memory Bugs

  - [ ] 15.1 Implement corrupted JSON error handling
    - Wrap json.loads() in try-except block for JSONDecodeError
    - Return None and log error to Sentry on corruption
    - Start fresh DISCOVERY session on corruption
    - _Bug_Condition: isBugCondition_1_21 from design_
    - _Expected_Behavior: expectedBehavior from requirement 2.21_
    - _Preservation: Valid session loading from requirement 3.5_
    - _Requirements: 2.21, 3.5_

  - [ ] 15.2 Implement TTL reset on session save
    - Replace redis.set() with redis.setex(key, 604800, value) for 7-day TTL
    - Ensure active sessions never expire
    - Test TTL is reset on every save
    - _Bug_Condition: isBugCondition_1_22 from design_
    - _Expected_Behavior: expectedBehavior from requirement 2.22_
    - _Requirements: 2.22_

  - [ ] 15.3 Implement context injection on message truncation
    - Extract critical fields (budget, people_count, pickup_location, etc.) from session
    - Add context block to system prompt when messages > 20
    - Test critical context is preserved after truncation
    - _Bug_Condition: isBugCondition_1_23 from design_
    - _Expected_Behavior: expectedBehavior from requirement 2.23_
    - _Requirements: 2.23_

  - [ ] 15.4 Implement proper datetime serialization/deserialization
    - Convert datetime objects to ISO strings on save
    - Convert ISO strings back to datetime objects on load
    - Handle reserved_until, created_at, last_active fields
    - _Bug_Condition: isBugCondition_1_24 from design_
    - _Expected_Behavior: expectedBehavior from requirement 2.24_
    - _Requirements: 2.24_

  - [ ] 15.5 Implement proper tool message structure preservation
    - Use custom JSON encoder for tool_use/tool_result messages
    - Maintain nested content blocks structure
    - Test tool messages serialize/deserialize correctly
    - _Bug_Condition: isBugCondition_1_25 from design_
    - _Expected_Behavior: expectedBehavior from requirement 2.25_
    - _Requirements: 2.25_

  - [ ] 15.6 Verify bug condition exploration tests now pass
    - **Property 1: Expected Behavior** - Session Memory Fixed
    - **IMPORTANT**: Re-run the SAME tests from task 13 - do NOT write new tests
    - Run bug condition exploration tests from step 13
    - **EXPECTED OUTCOME**: Tests PASS (confirms bugs are fixed)
    - _Requirements: 2.21, 2.22, 2.23, 2.24, 2.25_

  - [ ] 15.7 Verify preservation tests still pass
    - **Property 2: Preservation** - Valid Session Operations Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 14 - do NOT write new tests
    - Run preservation property tests from step 14
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)

## Category 6: Multi-language Bugs (2 bugs)

- [ ] 16. Write bug condition exploration tests for Multi-language
  - **Property 1: Fault Condition** - Multi-language Bugs (1.26-1.27)
  - **CRITICAL**: These tests MUST FAIL on unfixed code - failure confirms the bugs exist
  - **GOAL**: Surface counterexamples that demonstrate the bugs exist
  - Test Bug 1.26: Language switch not persisted ("Show in KHR" → next response still in English)
  - Test Bug 1.27: Non-USD currency conversion failure ("200,000 រៀល" → not converted to USD)
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests FAIL (this is correct - it proves the bugs exist)
  - Document counterexamples found
  - _Requirements: 1.26, 1.27_

- [ ] 17. Write preservation property tests for Multi-language (BEFORE implementing fix)
  - **Property 2: Preservation** - Valid Multi-language Support
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for valid language settings
  - Write property-based tests: for all messages with language set correctly, responses are in correct language
  - Test EN, KH, ZH language responses
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (confirms baseline behavior)
  - _Requirements: 3.10_

- [ ] 18. Fix Multi-language Bugs

  - [ ] 18.1 Implement language switch detection and persistence
    - Detect language switch phrases in user messages ("in Khmer", "in Chinese", "show in KHR", "用中文")
    - Update session.preferred_language when detected
    - Apply new language to all subsequent responses
    - _Bug_Condition: isBugCondition_1_26 from design_
    - _Expected_Behavior: expectedBehavior from requirement 2.26_
    - _Preservation: Valid multi-language support from requirement 3.10_
    - _Requirements: 2.26, 3.10_

  - [ ] 18.2 Implement currency conversion for non-USD budgets
    - Detect KHR, CNY, and other currencies in budget expressions
    - Call currency conversion API or ask for USD equivalent
    - Store budget in USD in session
    - Test currency conversion for "200,000 រៀល" and "500块"
    - _Bug_Condition: isBugCondition_1_27 from design_
    - _Expected_Behavior: expectedBehavior from requirement 2.27_
    - _Requirements: 2.27_

  - [ ] 18.3 Verify bug condition exploration tests now pass
    - **Property 1: Expected Behavior** - Multi-language Fixed
    - **IMPORTANT**: Re-run the SAME tests from task 16 - do NOT write new tests
    - Run bug condition exploration tests from step 16
    - **EXPECTED OUTCOME**: Tests PASS (confirms bugs are fixed)
    - _Requirements: 2.26, 2.27_

  - [ ] 18.4 Verify preservation tests still pass
    - **Property 2: Preservation** - Valid Multi-language Support Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 17 - do NOT write new tests
    - Run preservation property tests from step 17
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)

## Category 7: Edge Case Bugs (3 bugs)

- [ ] 19. Write bug condition exploration tests for Edge Cases
  - **Property 1: Fault Condition** - Edge Case Bugs (1.28-1.30)
  - **CRITICAL**: These tests MUST FAIL on unfixed code - failure confirms the bugs exist
  - **GOAL**: Surface counterexamples that demonstrate the bugs exist
  - Test Bug 1.28: Unauthenticated user booking (user_id=None → createBooking called)
  - Test Bug 1.29: Empty trip suggestions handling (getTripSuggestions returns [] → crash or fabrication)
  - Test Bug 1.30: Large group size handling ("45 students" → parsing failed or total cost not shown)
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests FAIL (this is correct - it proves the bugs exist)
  - Document counterexamples found
  - _Requirements: 1.28, 1.29, 1.30_

- [ ] 20. Write preservation property tests for Edge Cases (BEFORE implementing fix)
  - **Property 2: Preservation** - Valid Edge Case Handling
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for valid authenticated users
  - Write property-based tests: for all authenticated users with valid data, booking flows work correctly
  - Test standard group sizes (1-10 people) work correctly
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (confirms baseline behavior)
  - _Requirements: 3.1, 3.2_

- [ ] 21. Fix Edge Case Bugs

  - [ ] 21.1 Implement authentication validation before booking
    - Check session.user_id is not None before calling createBooking
    - Redirect to login/register if unauthenticated
    - Test unauthenticated users are blocked from booking
    - _Bug_Condition: isBugCondition_1_28 from design_
    - _Expected_Behavior: expectedBehavior from requirement 2.28_
    - _Preservation: Valid authenticated booking from requirements 3.1, 3.2_
    - _Requirements: 2.28, 3.1, 3.2_

  - [ ] 21.2 Implement graceful empty trip results handling
    - Check result count before processing getTripSuggestions response
    - Present available results and ask user to adjust preferences
    - Never fabricate fake trip options
    - _Bug_Condition: isBugCondition_1_29 from design_
    - _Expected_Behavior: expectedBehavior from requirement 2.29_
    - _Requirements: 2.29_

  - [ ] 21.3 Implement large group size parsing and total cost calculation
    - Support parsing numbers >= 20 for people_count
    - Calculate and display total cost for large groups
    - Format large numbers with proper separators
    - Test "45 students" is parsed correctly and total cost shown
    - _Bug_Condition: isBugCondition_1_30 from design_
    - _Expected_Behavior: expectedBehavior from requirement 2.30_
    - _Requirements: 2.30_

  - [ ] 21.4 Verify bug condition exploration tests now pass
    - **Property 1: Expected Behavior** - Edge Cases Fixed
    - **IMPORTANT**: Re-run the SAME tests from task 19 - do NOT write new tests
    - Run bug condition exploration tests from step 19
    - **EXPECTED OUTCOME**: Tests PASS (confirms bugs are fixed)
    - _Requirements: 2.28, 2.29, 2.30_

  - [ ] 21.5 Verify preservation tests still pass
    - **Property 2: Preservation** - Valid Edge Case Handling Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 20 - do NOT write new tests
    - Run preservation property tests from step 20
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)

## Integration and Regression Testing

- [ ] 22. Write integration tests
  - Write WebSocket flow integration test (complete booking flow from discovery to payment)
  - Write Redis persistence integration test (session persists across reconnections)
  - Write backend tool integration test (tool calls to backend API with real HTTP)
  - Test concurrent user sessions with proper isolation
  - Test payment webhook coordination with active chat
  - _Requirements: All requirements_

- [ ] 23. Write comprehensive regression test suite
  - Test valid discovery flow unchanged (all 6 fields → getTripSuggestions)
  - Test explicit booking confirmation unchanged ("Yes, book it" → createBooking)
  - Test payment webhook success unchanged (SUCCEEDED → POST_BOOKING)
  - Test multi-language responses unchanged (EN, KH, ZH work correctly)
  - Test parallel tool calls unchanged (both tools execute)
  - Test discount code application unchanged (applyDiscountCode works)
  - Test WebSocket connection unchanged (valid session_id loads session)
  - Test new session TTL unchanged (7-day TTL set)
  - Test response time unchanged (2-3 seconds for valid requests)
  - _Requirements: 3.1-3.15_

- [ ] 24. Checkpoint - Ensure all tests pass
  - Run full test suite: pytest tests/ -v --cov=agent --cov-report=term
  - Verify 80%+ code coverage
  - Verify all 30 bug fix tests pass
  - Verify all 15 preservation tests pass
  - Verify integration tests pass
  - Verify regression tests pass
  - Ask the user if questions arise
