# Implementation Plan: DerLg.com Backend (NestJS + Supabase)

## Overview

This implementation plan covers the complete NestJS backend system for DerLg.com, a Cambodia travel booking platform. The backend serves as the single source of truth, providing REST APIs for the Next.js frontend and dedicated tool endpoints for the Python AI chatbot. The system handles authentication, booking management, payment processing via Stripe, emergency services, loyalty programs, and comprehensive business logic across 18 database models.

The implementation follows a modular architecture with 16 feature modules, uses Prisma ORM for type-safe database access, Redis for caching and session management, and includes Docker containerization for local development. All 81 correctness properties from the design document will be validated through property-based tests using fast-check.

## Tasks

- [ ] 1. Project setup and core infrastructure
  - Initialize NestJS project with TypeScript strict mode
  - Configure Prisma with Supabase PostgreSQL connection
  - Set up Redis client for Upstash integration
  - Create centralized configuration module with environment validation
  - Implement global exception filters (HTTP and Prisma errors)
  - Set up global validation pipe with class-validator
  - Configure CORS with whitelist for production domains
  - Set up Winston logger with structured logging
  - Integrate Sentry for error tracking
  - Create health check endpoint at /health
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 25.1, 25.3, 25.4, 25.5, 25.6_

- [ ] 2. Database schema and Prisma setup
  - [ ] 2.1 Define Prisma schema with all 18 models
    - Create User model with Supabase Auth integration
    - Create Trip, Place, Hotel, HotelRoom models for catalog
    - Create TransportationVehicle and Guide models
    - Create Booking model with all relationships
    - Create Payment model with Stripe integration fields
    - Create Review, Festival, DiscountCode models
    - Create LoyaltyTransaction, EmergencyAlert, StudentVerification models
    - Create Notification, AISession, AuditLog models
    - Define all ENUM types (UserRole, Language, BookingStatus, PaymentStatus, etc.)
    - Add indexes on frequently queried columns
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9_

  - [ ]* 2.2 Write property test for Prisma schema
    - **Property 54: JSON validation on parse**
    - **Validates: Requirements 26.1, 26.2, 26.3, 26.8**

  - [ ] 2.3 Generate Prisma migrations
    - Run prisma migrate dev to create initial migration
    - Verify all tables, indexes, and constraints created
    - _Requirements: 2.10_


- [ ] 3. Common utilities and middleware
  - [ ] 3.1 Create shared decorators
    - Implement @CurrentUser() decorator for extracting user from JWT
    - Implement @Roles() decorator for role-based authorization
    - Implement @ServiceKey() decorator for AI agent authentication
    - _Requirements: 3.7, 3.13_

  - [ ] 3.2 Create authentication guards
    - Implement JwtAuthGuard extending Passport JWT strategy
    - Implement RolesGuard for admin-only endpoints
    - Implement ServiceKeyGuard for AI tools endpoints
    - _Requirements: 3.12, 3.13, 19.2, 19.3_

  - [ ] 3.3 Create interceptors
    - Implement ResponseTransformInterceptor for standard envelope format
    - Implement LoggingInterceptor for request/response logging
    - Implement AuditInterceptor for sensitive operations
    - _Requirements: 23.1, 23.2, 36.6_

  - [ ] 3.4 Create exception filters
    - Implement HttpExceptionFilter with error code mapping
    - Implement PrismaExceptionFilter for database errors
    - _Requirements: 1.8, 23.3, 23.5_

  - [ ]* 3.5 Write property tests for error handling
    - **Property 59: Rate limit response format**
    - **Property 60: Expired token error code**
    - **Validates: Requirements 34.9, 34.10**

- [ ] 4. Authentication module
  - [ ] 4.1 Implement authentication service
    - Create register() method with Supabase Auth integration
    - Create login() method with JWT token generation
    - Create refreshAccessToken() method with token version validation
    - Create logout() method with token version increment
    - Implement Google OAuth login flow with Passport strategy
    - Implement password reset flow using Supabase Auth
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11_

  - [ ] 4.2 Create authentication controller
    - POST /v1/auth/register endpoint
    - POST /v1/auth/login endpoint
    - POST /v1/auth/refresh endpoint
    - POST /v1/auth/logout endpoint
    - POST /v1/auth/google endpoint
    - POST /v1/auth/reset-password endpoint
    - Apply rate limiting (5 requests per 5 minutes per IP)
    - _Requirements: 3.14_

  - [ ] 4.3 Implement JWT strategies
    - Create JwtStrategy for access token validation
    - Create GoogleStrategy for OAuth integration
    - Configure token expiry (15 min access, 7 day refresh)
    - _Requirements: 3.4, 3.5, 3.10_

  - [ ]* 4.4 Write property tests for authentication
    - **Property 1: Registration creates complete user account**
    - **Property 2: Login generates valid token pair**
    - **Property 3: Access tokens contain required claims**
    - **Property 4: Token refresh round-trip**
    - **Property 5: Logout invalidates all tokens**
    - **Property 6: Protected routes require authentication**
    - **Property 7: Admin routes enforce role authorization**
    - **Property 8: Authentication rate limiting**
    - **Validates: Requirements 3.1, 3.2, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.12, 3.13, 3.14**

- [ ] 5. User management module
  - [ ] 5.1 Implement users service
    - Create getProfile() method returning user with loyalty and student data
    - Create updateProfile() method with protected field validation
    - Create uploadAvatar() method with Supabase Storage integration
    - Enforce 5MB file size limit for avatars
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

  - [ ] 5.2 Create users controller
    - GET /v1/users/profile endpoint with JWT auth
    - PATCH /v1/users/profile endpoint
    - POST /v1/users/avatar endpoint with multipart/form-data
    - _Requirements: 4.1, 4.2, 4.7_

  - [ ]* 5.3 Write property tests for user management
    - **Property 9: Profile updates persist correctly**
    - **Property 10: Protected fields are immutable**
    - **Property 11: Profile responses include loyalty and student data**
    - **Property 12: Avatar upload round-trip**
    - **Validates: Requirements 4.2, 4.4, 4.5, 4.6, 4.7**

- [ ] 6. Trip catalog module
  - [ ] 6.1 Implement trips service
    - Create getTrips() method with pagination and filters
    - Implement environment filter (MOUNTAIN, BEACH, CITY, etc.)
    - Implement duration range filter (min_days, max_days)
    - Implement price range filter (min_price_usd, max_price_usd)
    - Implement province filter
    - Implement sorting (price, rating, duration)
    - Create getTripById() method with full details
    - Create getFeaturedTrips() method ordered by rating
    - Filter only active trips (is_active = true)
    - Support multi-language content (title_kh, title_zh)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10_

  - [ ] 6.2 Create trips controller
    - GET /v1/trips endpoint with query parameters
    - GET /v1/trips/:id endpoint
    - GET /v1/trips/featured endpoint
    - Support Accept-Language header for content localization
    - _Requirements: 5.1, 5.7_

  - [ ]* 6.3 Write property tests for trip catalog
    - **Property 13: Trip pagination consistency**
    - **Property 14: Environment filter accuracy**
    - **Property 15: Duration filter boundaries**
    - **Property 16: Price filter boundaries**
    - **Property 17: Province filter accuracy**
    - **Property 18: Sort order correctness**
    - **Property 19: Language-specific content**
    - **Property 20: Active trips only**
    - **Property 21: Trip response completeness**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.9, 5.10**

- [ ] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.


- [ ] 8. Booking management module
  - [ ] 8.1 Implement bookings service core logic
    - Create generateBookingRef() method (format: DLG-YYYY-NNNN)
    - Create calculateBookingPrice() method with subtotal calculation
    - Create applyDiscounts() method for discount codes, loyalty points, student discount
    - Implement booking hold mechanism with Redis (15-minute TTL)
    - Create checkAvailability() method with date overlap detection
    - Implement pessimistic locking for booking creation using Prisma transactions
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.15_

  - [ ] 8.2 Implement booking lifecycle methods
    - Create createBooking() method with validation and hold creation
    - Create confirmBooking() method for payment success
    - Create cancelBooking() method with refund processing
    - Create getUserBookings() method with filters and pagination
    - Create getBookingByRef() method with user isolation
    - _Requirements: 6.10, 6.11, 6.12, 6.13_

  - [ ] 8.3 Create bookings controller
    - POST /v1/bookings endpoint with JWT auth
    - GET /v1/bookings endpoint with filters
    - GET /v1/bookings/:bookingRef endpoint
    - POST /v1/bookings/:id/cancel endpoint
    - GET /v1/bookings/:id/availability endpoint
    - _Requirements: 6.1, 6.12, 6.13, 6.15_

  - [ ]* 8.4 Write property tests for booking management
    - **Property 22: Booking reference format**
    - **Property 23: New bookings are reserved**
    - **Property 24: Booking price calculation accuracy**
    - **Property 25: Discount application correctness**
    - **Property 26: Booking hold in Redis**
    - **Property 27: Payment confirmation updates booking**
    - **Property 28: Expired holds are cancelled**
    - **Property 29: Booking isolation per user**
    - **Property 30: Availability prevents double booking**
    - **Property 55: Booking serialization round-trip**
    - **Property 57: Concurrent booking prevention**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 6.11, 6.12, 6.15, 26.6, 34.4**

- [ ] 9. Transportation booking module
  - [ ] 9.1 Implement transportation service
    - Create getVehicles() method with category filter (VAN, BUS, TUK_TUK)
    - Implement capacity and tier filters
    - Create checkVehicleAvailability() method with date conflict detection
    - Create calculateTransportPrice() method (per-day for vans/buses, per-km for tuk-tuks)
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10_

  - [ ] 9.2 Create transportation controller
    - GET /v1/transportation/vehicles endpoint
    - POST /v1/transportation/check-availability endpoint
    - _Requirements: 7.1, 7.4_

- [ ] 10. Hotel booking module
  - [ ] 10.1 Implement hotels service
    - Create getHotels() method with province filter
    - Create getHotelRooms() method with room_type, capacity, price filters
    - Create checkRoomAvailability() method with date conflict detection
    - Create calculateHotelPrice() method based on number of nights
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8_

  - [ ] 10.2 Create hotels controller
    - GET /v1/hotels endpoint
    - GET /v1/hotels/:id/rooms endpoint
    - POST /v1/hotels/check-availability endpoint
    - _Requirements: 8.1, 8.2, 8.3_

- [ ] 11. Tour guide booking module
  - [ ] 11.1 Implement guides service
    - Create getGuides() method with language and specialty filters
    - Implement province availability filter
    - Create checkGuideAvailability() method with date conflict detection
    - Create calculateGuidePrice() method based on number of days
    - Filter only verified and available guides
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8_

  - [ ] 11.2 Create guides controller
    - GET /v1/guides endpoint
    - POST /v1/guides/check-availability endpoint
    - _Requirements: 9.1, 9.4_

- [ ] 12. Payment processing module
  - [ ] 12.1 Implement payments service core logic
    - Create createPaymentIntent() method with booking validation
    - Verify booking status is RESERVED and not expired
    - Calculate amount independently from booking data
    - Create Stripe Payment Intent with booking metadata
    - Create payment record with status PENDING
    - Extend booking hold TTL in Redis
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

  - [ ] 12.2 Implement QR payment generation
    - Create generateQRPayment() method for Bakong/ABA Pay
    - Generate QR code image and upload to Supabase Storage
    - Set QR expiry to match booking hold time
    - _Requirements: 10.7, 10.8, 10.9_

  - [ ] 12.3 Implement webhook processing
    - Create processWebhook() method with signature verification
    - Implement checkEventProcessed() for idempotency
    - Create handlePaymentSucceeded() with atomic transaction
    - Update booking status to CONFIRMED
    - Update payment status to SUCCEEDED
    - Award loyalty points (2 points per USD)
    - Send booking confirmation notification
    - Publish payment success event to Redis pub/sub
    - Create handlePaymentFailed() method
    - Create handleChargeRefunded() method
    - _Requirements: 10.11, 10.12, 10.13, 10.14, 10.15, 10.16, 10.17, 10.18, 10.19_

  - [ ] 12.4 Create payments controller
    - POST /v1/payments/create-intent endpoint with JWT auth
    - POST /v1/payments/qr-payment endpoint with JWT auth
    - POST /v1/payments/webhook endpoint (no auth, signature verified)
    - POST /v1/payments/:bookingId/refund endpoint
    - Apply rate limiting (3 requests per minute for payment intents)
    - _Requirements: 10.10, 10.20_

  - [ ]* 12.5 Write property tests for payment processing
    - **Property 31: Payment intent requires valid booking**
    - **Property 32: Payment amount independence**
    - **Property 33: Payment intent creates payment record**
    - **Property 34: Payment intent returns client secret**
    - **Property 35: Webhook signature verification**
    - **Property 36: Webhook idempotency**
    - **Property 37: Payment success triggers complete workflow**
    - **Property 38: Payment failure updates status**
    - **Property 39: Refund event updates statuses**
    - **Property 40: Payment rate limiting**
    - **Property 56: Payment serialization round-trip**
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.5, 10.6, 10.11, 10.12, 10.13, 10.14, 10.15, 10.16, 10.17, 10.18, 10.19, 10.20, 26.7**

- [ ] 13. Refund processing
  - [ ] 13.1 Implement refund service
    - Create processRefund() method with cancellation policy
    - Create calculateRefundAmount() method (100% if 7+ days, 50% if 1-7 days, 0% if <24 hours)
    - Create Stripe refund with calculated amount
    - Update payment status (REFUNDED or PARTIALLY_REFUNDED)
    - Update booking status to CANCELLED
    - Deduct loyalty points that were earned
    - Send refund confirmation notification
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9, 11.10_

  - [ ]* 13.2 Write property tests for refund processing
    - **Property 41: Cancellation policy refund calculation**
    - **Property 42: Refund creates Stripe refund**
    - **Property 43: Refund updates payment status**
    - **Property 44: Refund cancels booking**
    - **Property 45: Refund reverses loyalty points**
    - **Property 46: Refund sends notification**
    - **Validates: Requirements 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9, 11.10**

- [ ] 14. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.


- [ ] 15. Emergency alert module
  - [ ] 15.1 Implement emergency service
    - Create createAlert() method capturing GPS coordinates
    - Set initial status to SENT
    - Send push notification to support team
    - Send SMS to support emergency line
    - Implement getEmergencyContacts() method with province detection
    - Implement getNearestHospital() method using GPS coordinates
    - Implement getProvinceFromCoordinates() for all 25 Cambodia provinces
    - Create updateAlertStatus() method for support staff
    - Ensure alerts are never deleted (permanent records)
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 12.9, 12.10, 12.11_

  - [ ] 15.2 Implement location sharing
    - Create location sharing session with unique tracking link
    - Store location updates with 5-minute intervals
    - Support TTL options (24 hours, 3 days, trip duration)
    - Implement automatic expiry and data deletion
    - Rate limit location updates (1 per minute per user)
    - _Requirements: 12.12, 31.1, 31.2, 31.3, 31.4, 31.5, 31.6, 31.7, 31.8, 31.9, 31.10_

  - [ ] 15.3 Create emergency controller
    - POST /v1/emergency/alerts endpoint with JWT auth
    - PATCH /v1/emergency/alerts/:id endpoint (admin only)
    - GET /v1/emergency/contacts endpoint with GPS parameters
    - _Requirements: 12.1, 12.9_

  - [ ]* 15.4 Write property tests for emergency alerts
    - **Property 47: Emergency alert captures GPS data**
    - **Property 48: New alerts have SENT status**
    - **Property 49: Emergency alert notifies support**
    - **Property 50: Emergency alert response completeness**
    - **Property 51: Emergency alerts are permanent**
    - **Property 52: Province-specific emergency contacts**
    - **Property 53: Location sharing expiry**
    - **Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 12.10, 12.11, 12.12**

- [ ] 16. Student discount verification module
  - [ ] 16.1 Implement student discount service
    - Create startVerification() method accepting file uploads
    - Upload student_id_image and face_selfie to Supabase Storage
    - Create verification record with status PENDING
    - Implement reviewVerification() method for admin
    - Update user is_student and student_verified_at on approval
    - Set expires_at to one year from approval
    - Enforce 10MB file size limit
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.10_

  - [ ] 16.2 Create student discount controller
    - POST /v1/student-discount/verify endpoint with multipart/form-data
    - GET /v1/student-discount/status endpoint
    - PATCH /v1/student-discount/:id/review endpoint (admin only)
    - _Requirements: 13.1, 13.5_

- [ ] 17. Loyalty points module
  - [ ] 17.1 Implement loyalty service
    - Create awardPoints() method (2 points per USD spent)
    - Create redeemPoints() method (100 points = 1 USD)
    - Create reversePoints() method for refunds
    - Create getBalance() method
    - Create getTransactionHistory() method with pagination
    - Create loyalty_transaction records for all operations
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8, 14.9, 14.10_

  - [ ] 17.2 Create loyalty controller
    - GET /v1/loyalty/balance endpoint with JWT auth
    - GET /v1/loyalty/transactions endpoint with pagination
    - _Requirements: 14.10_

  - [ ]* 17.3 Write property tests for loyalty points
    - **Property 58: Loyalty points redemption validation**
    - **Validates: Requirements 34.6**

- [ ] 18. Notification module
  - [ ] 18.1 Implement notification service
    - Create sendBookingConfirmation() method
    - Create sendPaymentFailed() method
    - Create sendTravelReminder() method
    - Create sendRefundConfirmation() method
    - Create sendEmergencyAcknowledgment() method
    - Implement sendEmail() using Resend with templates
    - Implement sendPushNotification() using FCM
    - Implement sendSMS() for emergency alerts
    - Support multi-language templates (EN, KH, ZH)
    - Implement retry logic (3 attempts with exponential backoff)
    - Implement fallback from push to email
    - Store notification records with delivery status
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8, 15.9, 15.10, 39.1, 39.2, 39.3, 39.4, 39.5, 39.6, 39.7, 39.8, 39.9, 39.10_

  - [ ] 18.2 Create notification templates
    - Create booking-confirmation template in 3 languages
    - Create payment-failed template in 3 languages
    - Create travel-reminder template in 3 languages
    - Create refund-confirmation template in 3 languages
    - Implement template variable substitution
    - _Requirements: 15.10, 39.8_

- [ ] 19. Explore places module
  - [ ] 19.1 Implement explore service
    - Create getPlaces() method with province filter
    - Implement category filter (TEMPLE, MUSEUM, NATURE, MARKET, BEACH, MOUNTAIN)
    - Implement text search across names and descriptions
    - Support multi-language content (name_kh, name_zh, description_kh, description_zh)
    - Include GPS coordinates, visitor tips, dress code, entry fees
    - Include opening hours as structured data
    - Mark places as offline_available for offline map caching
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7, 16.8, 16.9_

  - [ ] 19.2 Create explore controller
    - GET /v1/explore/places endpoint with filters
    - GET /v1/explore/places/:id endpoint
    - Support Accept-Language header
    - _Requirements: 16.1, 16.3, 16.7_

- [ ] 20. Festival calendar module
  - [ ] 20.1 Implement festivals service
    - Create getFestivals() method with date range filter
    - Create getUpcomingFestivals() method ordered by start_date
    - Support multi-language content (name_kh, name_zh, description_kh, description_zh)
    - Link festivals to places where they occur
    - Generate discount codes automatically for festivals
    - Filter only active festivals (is_active = true)
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7_

  - [ ] 20.2 Create festivals controller
    - GET /v1/festivals endpoint with date filters
    - GET /v1/festivals/upcoming endpoint
    - Support Accept-Language header
    - _Requirements: 17.1, 17.2_

- [ ] 21. Currency exchange module
  - [ ] 21.1 Implement currency service
    - Create fetchExchangeRates() method using ExchangeRate-API
    - Support USD, KHR, and CNY currencies
    - Cache rates in Redis with 1-hour TTL
    - Implement fallback to default rates on API failure
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5_

  - [ ] 21.2 Create currency controller
    - GET /v1/currency/rates endpoint
    - _Requirements: 18.4_

- [ ] 22. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.


- [ ] 23. AI tools API module
  - [ ] 23.1 Implement AI tools service
    - Create suggestTrips() method based on preferences
    - Create createBookingForAI() method with validation
    - Create cancelBookingForAI() method
    - Create generateQRPaymentForAI() method
    - Create getBookingStatus() method by booking reference
    - Create searchPlaces() method for recommendations
    - Return standardized error codes for AI parsing
    - _Requirements: 19.1, 19.4, 19.5, 19.6, 19.7, 19.8, 19.9, 19.10_

  - [ ] 23.2 Create AI tools controller
    - POST /v1/ai-tools/suggest-trips endpoint with ServiceKeyGuard
    - POST /v1/ai-tools/create-booking endpoint with ServiceKeyGuard
    - POST /v1/ai-tools/cancel-booking endpoint with ServiceKeyGuard
    - POST /v1/ai-tools/generate-qr-payment endpoint with ServiceKeyGuard
    - GET /v1/ai-tools/booking-status/:bookingRef endpoint with ServiceKeyGuard
    - POST /v1/ai-tools/search-places endpoint with ServiceKeyGuard
    - Validate X-Service-Key header on all endpoints
    - _Requirements: 19.1, 19.2, 19.3_

- [ ] 24. Redis integration module
  - [ ] 24.1 Implement Redis service
    - Create get(), set(), setex(), del() methods
    - Create incr() and expire() methods for rate limiting
    - Create publish() and subscribe() methods for pub/sub
    - Connect to Upstash Redis using REDIS_URL
    - _Requirements: 20.1, 20.9_

  - [ ] 24.2 Implement Redis key patterns
    - Implement booking_hold:{bookingId} with 15-minute TTL
    - Implement session:{sessionId} with 7-day TTL for AI sessions
    - Implement currency:rates with 1-hour TTL
    - Implement weather:{city} with 1-hour TTL
    - Implement refresh_token_version:{userId} (permanent)
    - Implement rate_limit:{endpoint}:{userId}:{window} with window TTL
    - _Requirements: 20.2, 20.3, 20.4, 20.5, 20.6, 20.7_

  - [ ] 24.3 Implement Redis pub/sub for payment events
    - Publish to payment_events:{userId} channel on payment success
    - Include event type, bookingId, and amount in message
    - _Requirements: 20.8_

  - [ ] 24.4 Implement rate limiting with Redis
    - Create RedisRateLimiter class with checkRateLimit() method
    - Create RateLimitGuard using Redis counters
    - Apply to authentication endpoints (5 per 5 min)
    - Apply to payment endpoints (3 per 1 min)
    - _Requirements: 20.7, 3.14, 10.20_


- [ ] 25. Background jobs module
  - [ ] 25.1 Implement jobs service
    - Create cleanupExpiredBookings() cron job (every 5 minutes)
    - Cancel bookings where status=RESERVED and reserved_until is past
    - Delete booking_hold keys from Redis
    - Create sendTravelReminders() cron job (daily at 9am Cambodia time)
    - Send notifications for bookings starting tomorrow
    - Create sendFestivalAlerts() cron job (daily at 8am Cambodia time)
    - Notify users about festivals starting in 1-3 days
    - _Requirements: 21.1, 21.2, 21.3, 21.4, 21.5, 21.6_

  - [ ] 25.2 Configure cron scheduling
    - Use @nestjs/schedule module
    - Set timezone to Asia/Phnom_Penh for Cambodia time
    - Log job execution status
    - _Requirements: 21.1, 21.4, 21.5_

- [ ] 26. Additional features implementation
  - [ ] 26.1 Implement AI budget planner
    - Create calculateBudgetEstimate() method
    - Calculate based on duration, group size, accommodation tier, transport type
    - Return MIN and MAX range values
    - Include breakdown for accommodation, transport, guide, meals, entry fees, extras
    - Support currency conversion (USD, KHR, CNY)
    - Provide province-specific cost adjustments
    - Include Angkor pass entry fee calculations
    - Estimate meals at 15-20 USD per person per day
    - Make accessible via AI tools endpoint
    - _Requirements: 27.1, 27.2, 27.3, 27.4, 27.5, 27.6, 27.7, 27.8, 27.9, 27.10_

  - [ ] 26.2 Implement offline map data management
    - Create getMapData() method for province downloads
    - Include place markers with categories (temple, hotel, emergency, restaurant)
    - Return GPS coordinates for all places in province
    - Include emergency service locations
    - Return map data size in MB before download
    - Compress map data using gzip
    - Version map data with last_updated timestamp
    - Return GeoJSON format
    - Include DerLg booking locations
    - Cache map data in Redis with 7-day TTL
    - _Requirements: 28.1, 28.2, 28.3, 28.4, 28.5, 28.6, 28.7, 28.8, 28.9, 28.10_

  - [ ] 26.3 Implement booking itinerary management
    - Store day-by-day itinerary in booking record
    - Include pickup times, locations, and activities
    - Return driver contact information 24 hours before departure
    - Generate shareable itinerary links (derlg.com/trip/{booking_ref})
    - Create public endpoint for itinerary access (no auth)
    - Include hotel check-in/check-out times
    - Return guide contact information when assigned
    - Support calendar export in iCal format
    - Include weather forecast for travel dates
    - Return itinerary in user preferred language
    - _Requirements: 30.1, 30.2, 30.3, 30.4, 30.5, 30.6, 30.7, 30.8, 30.9, 30.10_

  - [ ] 26.4 Implement review and rating system
    - Create submitReview() method for completed trips
    - Verify user completed the booking before accepting review
    - Accept star rating (1-5) and review text (max 1000 chars)
    - Accept optional review photos (max 5 images)
    - Award 50 loyalty points on review submission
    - Calculate average rating for trips, hotels, guides, vehicles
    - Return 5 most recent reviews for each entity
    - Prevent duplicate reviews for same booking
    - Allow review editing within 7 days
    - _Requirements: 32.1, 32.2, 32.3, 32.4, 32.5, 32.6, 32.7, 32.8, 32.9, 32.10_

  - [ ] 26.5 Implement referral program
    - Generate unique referral code on user account creation
    - Format referral code as DERLG-{username_prefix}{random_digit}
    - Link referrer to referee on signup with referral code
    - Award 500 points to referrer when referee completes first booking
    - Award 500 points to referee when they complete first booking
    - Track referral status (pending, completed)
    - Return referral statistics (total referrals, completed, points earned)
    - Prevent self-referral by checking email and device fingerprint
    - Generate shareable referral link (derlg.com/ref/{code})
    - Validate referral code format before accepting
    - _Requirements: 33.1, 33.2, 33.3, 33.4, 33.5, 33.6, 33.7, 33.8, 33.9, 33.10_


- [ ] 27. Advanced error handling and validation
  - [ ] 27.1 Implement retry logic with exponential backoff
    - Create withRetry() utility function
    - Retry database connections 3 times with exponential backoff
    - Return 503 Service Unavailable when Stripe API is unavailable
    - Include retry-after header in 503 responses
    - _Requirements: 34.1, 34.2_

  - [ ] 27.2 Implement specific error codes
    - Return BOOKING_EXPIRED when hold expires during payment
    - Return INSUFFICIENT_POINTS when loyalty points insufficient
    - Return INVALID_DISCOUNT_CODE with expiry date
    - Return TRIP_ALREADY_STARTED when cancelling after travel date
    - Return INVALID_IMAGE_FORMAT for corrupted uploads
    - Return TOKEN_EXPIRED for expired JWT tokens
    - _Requirements: 34.3, 34.6, 34.10, 34.12, 34.13, 34.14_

  - [ ] 27.3 Implement validation for edge cases
    - Validate GPS coordinates within Cambodia bounds
    - Reject file uploads exceeding size limits before processing (413 Payload Too Large)
    - Validate refresh token version matches user's current version
    - Return conflicting booking dates when availability check fails
    - _Requirements: 34.7, 34.8, 34.11, 34.15_

  - [ ]* 27.4 Write property tests for error handling
    - **Property 61: Token version mismatch rejection**
    - **Property 62: Post-travel cancellation rejection**
    - **Property 63: Invalid discount code error details**
    - **Property 64: Availability conflict details**
    - **Validates: Requirements 34.11, 34.12, 34.14, 34.15**

- [ ] 28. Availability and date validation
  - [ ] 28.1 Implement comprehensive availability checking
    - Query all CONFIRMED and unexpired RESERVED bookings
    - Use database transactions to prevent race conditions
    - Detect date range overlaps
    - Consider booking holds when checking availability
    - Implement pessimistic locking for booking creation
    - Process concurrent booking requests sequentially
    - _Requirements: 38.1, 38.2, 38.3, 38.4, 38.5, 38.6_

  - [ ] 28.2 Implement date validation
    - Validate travel dates are in the future
    - Validate check-out date is after check-in date
    - Prevent bookings more than 2 years in advance
    - Return alternative available dates when requested dates unavailable
    - _Requirements: 38.7, 38.8, 38.9, 38.10_

  - [ ]* 28.3 Write property tests for availability
    - **Property 65: Date overlap detection**
    - **Property 66: Future date validation**
    - **Property 67: Date range validation**
    - **Property 68: Maximum advance booking**
    - **Property 69: Alternative dates suggestion**
    - **Validates: Requirements 38.3, 38.7, 38.8, 38.9, 38.10**

- [ ] 29. Discount code system
  - [ ] 29.1 Implement discount code validation
    - Validate code exists and is active
    - Validate current date within valid_from and valid_until range
    - Validate usage_limit not exceeded
    - Validate code applies to booking_type
    - Prevent stacking of multiple discount codes
    - Allow combining discount code with loyalty points
    - Allow combining discount code with student discount
    - _Requirements: 40.1, 40.2, 40.3, 40.4, 40.5, 40.6, 40.7_

  - [ ] 29.2 Implement discount code application
    - Return specific error reason for invalid codes
    - Track discount code usage count per user
    - Calculate discount percentage or fixed amount correctly
    - Enforce minimum booking amount for discount codes
    - Validate discount code not expired before applying
    - Prevent applying same code multiple times to same booking
    - Return discount amount in booking summary
    - Store applied discount code in booking record
    - _Requirements: 40.8, 40.9, 40.10, 40.11, 40.12, 40.13, 40.14, 40.15_

  - [ ]* 29.3 Write property tests for discount codes
    - **Property 70: Discount code validation**
    - **Property 71: Single discount code per booking**
    - **Property 72: Discount stacking with loyalty points**
    - **Property 73: Discount stacking with student discount**
    - **Property 74: Discount code error specificity**
    - **Property 75: Discount code usage tracking**
    - **Property 76: Discount calculation accuracy**
    - **Property 77: Minimum booking amount enforcement**
    - **Property 78: Discount code uniqueness per booking**
    - **Property 79: Discount amount in booking summary**
    - **Property 80: Discount code storage in booking**
    - **Validates: Requirements 40.1-40.15**

- [ ] 30. Security and compliance
  - [ ] 30.1 Implement data encryption and hashing
    - Encrypt sensitive data at rest using AES-256
    - Hash passwords using bcrypt with 12 salt rounds
    - Mask credit card numbers in logs and responses
    - Never log or store full credit card numbers
    - _Requirements: 36.1, 36.2, 36.3, 36.11_

  - [ ] 30.2 Implement data privacy features
    - Implement data retention policy (delete inactive accounts after 3 years)
    - Implement account deletion with data anonymization within 7 days
    - Maintain audit log of all data access and modifications
    - Implement GDPR-compliant data export functionality
    - Require re-authentication for sensitive operations
    - Implement IP-based geolocation for fraud detection
    - _Requirements: 36.4, 36.5, 36.6, 36.7, 36.8, 36.9_

  - [ ] 30.3 Implement session and token security
    - Implement session timeout of 15 minutes for inactive users
    - Use secure random token generation for all tokens
    - Implement CSRF protection for state-changing operations
    - Validate and sanitize all file uploads for malware
    - _Requirements: 36.12, 36.13, 36.14, 36.15_

  - [ ]* 30.4 Write property test for CORS
    - **Property 81: CORS origin whitelist enforcement**
    - **Validates: Requirements 1.10**

- [ ] 31. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.


- [ ] 32. Performance and scalability
  - [ ] 32.1 Implement caching strategy
    - Cache frequently accessed data in Redis with appropriate TTL
    - Cache currency exchange rates (1 hour)
    - Cache weather data (1 hour)
    - Cache map data (7 days)
    - Implement lazy loading for related entities in Prisma queries
    - _Requirements: 35.2, 35.7_

  - [ ] 32.2 Implement database optimizations
    - Configure connection pooling (min 10, max 100 connections)
    - Implement query result pagination (default 20 items per page)
    - Use database indexes on all foreign keys and frequently queried columns
    - Implement database query logging for queries exceeding 1 second
    - Use full-text search indexes for search queries
    - _Requirements: 35.3, 35.4, 35.5, 35.8, 35.12_

  - [ ] 32.3 Implement response optimizations
    - Compress API responses larger than 1KB using gzip
    - Implement request timeout of 30 seconds for all endpoints
    - Batch notification sends to avoid overwhelming email service
    - Use Redis pub/sub for real-time updates instead of polling
    - _Requirements: 35.6, 35.9, 35.10, 35.11_

  - [ ] 32.4 Implement scalability features
    - Ensure stateless architecture for horizontal scaling
    - Use Redis for distributed rate limiting across multiple instances
    - Respond to health check requests within 100ms
    - _Requirements: 35.1, 35.14, 35.15_

- [ ] 33. Webhook reliability
  - [ ] 33.1 Implement webhook processing reliability
    - Verify webhook signature before processing
    - Return 500 on processing failure to trigger Stripe retry
    - Store webhook event ID to prevent duplicate processing
    - Return 200 without reprocessing for duplicate webhooks
    - Process webhooks in background job queue
    - Implement webhook retry logic with exponential backoff
    - Log all webhook events with timestamp and payload
    - Return 200 within 5 seconds on success
    - Handle out-of-order webhook delivery gracefully
    - Implement dead letter queue for failed webhooks after 5 retries
    - _Requirements: 37.1, 37.2, 37.3, 37.4, 37.5, 37.6, 37.7, 37.8, 37.9, 37.10_

- [ ] 34. Notification delivery reliability
  - [ ] 34.1 Implement notification retry and fallback
    - Retry failed notifications 3 times with exponential backoff
    - Implement fallback from push notification to email
    - Log email delivery failures and alert support team
    - Track notification delivery status (sent, delivered, failed, opened)
    - _Requirements: 39.1, 39.2, 39.3, 39.4_

  - [ ] 34.2 Implement notification queue and preferences
    - Implement notification queue with priority levels
    - Batch non-urgent notifications to avoid spam
    - Respect user notification preferences
    - Validate email addresses before sending
    - Implement unsubscribe functionality for marketing notifications
    - _Requirements: 39.5, 39.6, 39.7, 39.9, 39.10_


- [ ] 35. Docker development environment
  - [ ] 35.1 Create Docker configuration files
    - Create Dockerfile for NestJS backend with multi-stage build
    - Use Node.js 20-alpine as base image
    - Copy package.json and package-lock.json for layer caching
    - Run npm ci for reproducible builds
    - Install only production dependencies in final stage
    - Set working directory to /app
    - Run as non-root user for security
    - Create .dockerignore file excluding node_modules, dist, .git, .env
    - _Requirements: 41.2, 41.14, 47.1, 47.2, 47.3, 47.4, 47.5, 47.6, 47.7, 47.9, 47.10, 43.11, 43.14, 43.15_

  - [ ] 35.2 Create docker-compose.yml for development
    - Define postgres service using postgres:15-alpine image
    - Define redis service using redis:7-alpine image
    - Define backend service for NestJS application
    - Create custom bridge network named derlg-network
    - Configure environment variables through .env file
    - Use depends_on with health checks for service ordering
    - Document Docker setup and usage in README.md
    - _Requirements: 41.1, 41.3, 41.4, 41.5, 41.6, 41.12, 41.13, 41.15, 44.1, 44.6, 44.7, 45.2_

  - [ ] 35.3 Configure PostgreSQL container
    - Use official postgres:15-alpine image
    - Set POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB environment variables
    - Expose port 5432 to host
    - Mount volume postgres_data to /var/lib/postgresql/data
    - Implement health check using pg_isready command
    - Health check every 10 seconds with 5 second timeout
    - _Requirements: 41.3, 41.9, 43.1, 43.2, 43.3, 43.4, 43.5, 51.1, 51.4_

  - [ ] 35.4 Configure Redis container
    - Use official redis:7-alpine image
    - Expose port 6379 to host
    - Mount volume redis_data to /data
    - Implement health check using redis-cli ping command
    - Enable Redis persistence with appendonly yes configuration
    - Health check every 10 seconds with 5 second timeout
    - _Requirements: 41.4, 41.10, 43.6, 43.7, 43.8, 43.9, 43.10, 51.2, 51.4_

  - [ ] 35.5 Configure backend container
    - Mount source code directory as volume for hot reload
    - Mount node_modules as named volume to avoid host conflicts
    - Use nest start --watch for automatic restart on file changes
    - Preserve TypeScript compilation in watch mode
    - Expose port 3001 to host for API access
    - Expose debugging port 9229 for Node.js debugging
    - Set NODE_ENV to development
    - Wait for PostgreSQL and Redis health checks before starting
    - Bind to 0.0.0.0 to accept connections from other containers
    - _Requirements: 41.11, 42.1, 42.2, 42.3, 42.4, 42.6, 42.8, 43.12, 43.13, 49.3, 49.7_

  - [ ] 35.6 Configure service networking
    - Backend connects to PostgreSQL using hostname postgres and port 5432
    - Backend connects to Redis using hostname redis and port 6379
    - Use service names as DNS hostnames for inter-container communication
    - Map PostgreSQL port 5432 to host port 5432
    - Map Redis port 6379 to host port 6379
    - Map Backend port 3001 to host port 3001
    - _Requirements: 44.2, 44.3, 44.10, 49.1, 49.2, 49.3_


- [ ] 36. Docker environment and database setup
  - [ ] 36.1 Create environment configuration
    - Create .env.example file with all required environment variables
    - Set DATABASE_URL to postgresql://user:password@postgres:5432/derlg_dev
    - Set REDIS_URL to redis://redis:6379
    - Use development-specific values for JWT secrets
    - Use Stripe test API keys for development
    - Document all required environment variables in README.md
    - Validate required environment variables on startup
    - Provide clear error messages for missing environment variables
    - _Requirements: 45.1, 45.3, 45.4, 45.5, 45.6, 45.8, 45.9, 45.10_

  - [ ] 36.2 Implement database initialization
    - Run Prisma migrations automatically on first startup
    - Run database seed script after migrations complete
    - Create database derlg_dev if it does not exist
    - Provide seed script creating sample users, trips, hotels, guides
    - Provide reset script that drops and recreates database
    - Log migration and seed status to console
    - Support running migrations without rebuilding container
    - Provide npm scripts for database operations (migrate, seed, reset, studio)
    - Support running Prisma Studio on port 5555 for database inspection
    - Document database setup commands in README.md
    - _Requirements: 42.9, 42.10, 46.1, 46.2, 46.3, 46.4, 46.5, 46.6, 46.7, 46.8, 46.9, 46.10_

  - [ ] 36.3 Configure Docker logging
    - Log all HTTP requests with method, path, status, and duration
    - Log database queries in development mode
    - Log Redis operations in development mode
    - Log slow PostgreSQL queries exceeding 1 second
    - Configure logging driver as json-file with rotation
    - Limit log file size to 10MB per container
    - Keep maximum 3 log files per container
    - Use colored console output for better readability
    - Log container startup time and health status
    - Provide docker-compose logs commands in README.md
    - _Requirements: 50.1, 50.2, 50.3, 50.4, 50.5, 50.6, 50.7, 50.8, 50.9, 50.10_

  - [ ] 36.4 Configure health checks and restart policies
    - Implement health check using /health endpoint for backend
    - Set restart policy to unless-stopped for all services
    - Mark container as unhealthy after 3 consecutive health check failures
    - Exit with non-zero code on fatal errors to trigger restart
    - Set health check timeout to 5 seconds
    - Set health check start period to 30 seconds for initial startup
    - Log health check status to console
    - _Requirements: 51.3, 51.4, 51.5, 51.6, 51.7, 51.8, 51.9, 51.10_

  - [ ] 36.5 Configure volume management
    - Create named volume postgres_data for PostgreSQL data
    - Create named volume redis_data for Redis data
    - Mount postgres_data to /var/lib/postgresql/data
    - Mount redis_data to /data in Redis container
    - Provide commands to backup and restore PostgreSQL data
    - Provide commands to clear all volumes for fresh start
    - Use bind mounts for source code to enable hot reload
    - Use named volumes for node_modules to avoid host conflicts
    - Document volume management commands in README.md
    - _Requirements: 52.1, 52.2, 52.3, 52.4, 52.5, 52.6, 52.7, 52.8, 52.9_

- [ ] 37. Docker multi-service integration
  - [ ] 37.1 Configure frontend and chatbot containers
    - Define frontend service for Next.js application in docker-compose
    - Define agentic-llm-chatbot service for Python chatbot
    - Frontend uses Node.js 20-alpine base image
    - Frontend mounts source code for hot reload
    - Frontend sets NEXT_PUBLIC_API_URL to http://backend:3001
    - Frontend exposes port 3000 for browser access
    - Chatbot uses Python 3.11-slim base image
    - Chatbot mounts source code for development
    - Chatbot sets BACKEND_API_URL to http://backend:3001
    - Chatbot sets AI_SERVICE_KEY environment variable
    - Frontend waits for Backend health check before starting
    - Chatbot waits for Backend health check before starting
    - Document how to access frontend and chatbot in README.md
    - _Requirements: 44.4, 44.5, 44.8, 44.9, 53.1, 53.2, 53.3, 53.4, 53.5, 53.6, 53.7, 53.8, 53.9, 53.10, 53.11, 53.12_

  - [ ] 37.2 Create production Docker configuration
    - Create docker-compose.prod.yml for production
    - Production uses managed Supabase PostgreSQL
    - Production uses managed Upstash Redis
    - Production uses optimized builds without dev dependencies
    - Production exposes only necessary ports with proper security
    - Production uses structured logging with appropriate log levels
    - Document differences between development and production configurations
    - _Requirements: 48.1, 48.2, 48.3, 48.5, 48.7, 48.9, 48.10_

- [ ] 38. API documentation and testing setup
  - [ ] 38.1 Set up Swagger/OpenAPI documentation
    - Generate Swagger documentation at /api-docs endpoint
    - Include request/response examples in Swagger
    - Document all authentication requirements
    - Document all error codes and responses
    - _Requirements: 24.1, 24.2, 24.3_

  - [ ] 38.2 Set up testing infrastructure
    - Configure Jest for unit tests
    - Configure fast-check for property-based tests
    - Configure Supertest for integration tests
    - Set up test database with separate connection
    - Create test utilities and mocks
    - Configure test coverage reporting (minimum 80%)
    - _Requirements: 24.4, 24.5_

  - [ ] 38.3 Create VS Code debugging configuration
    - Create launch.json for attaching to Docker container debugger
    - Configure breakpoints and debugging for TypeScript
    - Document debugging workflow in README.md
    - _Requirements: 42.7_

- [ ] 39. Deployment configuration
  - [ ] 39.1 Configure production settings
    - Listen on port 3001 in production
    - Enable compression middleware for response optimization
    - Implement Winston logger for structured logging
    - Integrate with Sentry for error tracking
    - Expose health check endpoint at /health
    - Log all unhandled exceptions with full stack traces
    - Use connection pooling for database connections
    - Handle graceful shutdown on SIGTERM signal
    - _Requirements: 25.1, 25.2, 25.3, 25.4, 25.5, 25.6, 25.7, 25.8_

  - [ ] 39.2 Create deployment documentation
    - Document environment variables for production
    - Document database migration process
    - Document backup and restore procedures
    - Document monitoring and alerting setup
    - Document scaling considerations
    - _Requirements: 25.8_

- [ ] 40. Final integration and testing
  - [ ] 40.1 Create database seed data
    - Create sample users (regular, student, admin)
    - Create sample trips across all provinces
    - Create sample hotels with rooms
    - Create sample transportation vehicles
    - Create sample tour guides
    - Create sample places and festivals
    - Create sample discount codes
    - _Requirements: 46.4_

  - [ ] 40.2 Write end-to-end integration tests
    - Test complete booking and payment flow
    - Test authentication flow (register, login, refresh, logout)
    - Test emergency alert creation and response
    - Test student verification workflow
    - Test loyalty points earning and redemption
    - Test refund processing
    - _Requirements: 24.4_

  - [ ] 40.3 Verify frontend and chatbot integration
    - Test all REST API endpoints from frontend perspective
    - Test all AI tool endpoints from chatbot perspective
    - Verify WebSocket payment events are received by chatbot
    - Test multi-language support across all endpoints
    - Verify CORS configuration allows frontend requests
    - _Requirements: 1.10, 19.1, 19.2, 20.8, 29.1-29.10_

- [ ] 41. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional property-based tests and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at reasonable breaks
- Property tests validate universal correctness properties using fast-check
- Unit tests validate specific examples and edge cases
- All 81 correctness properties from the design document are covered by property tests
- Docker configuration enables consistent development environment across team
- The backend provides all endpoints needed by both Next.js frontend and Python AI chatbot
- Multi-language support (EN/KH/ZH) is implemented throughout all user-facing content
- Security is enforced through JWT authentication, rate limiting, input validation, and webhook verification
- Payment processing uses Stripe with comprehensive webhook handling and idempotency
- Emergency services provide GPS-based support with province-specific contacts
- Loyalty points and student discounts incentivize platform usage
- Background jobs handle booking cleanup, travel reminders, and festival alerts
- Redis provides caching, session management, rate limiting, and pub/sub messaging
- Prisma ORM ensures type-safe database access with automatic migrations
- All business logic resides in the backend to ensure data integrity and security

