# Requirements Document: DerLg.com Backend (NestJS + Supabase)

## Introduction

This document specifies the requirements for implementing the DerLg.com backend system using NestJS framework with Supabase (PostgreSQL) database. DerLg.com is a travel booking platform for Cambodia tourism that enables travelers to book trips, hotels, transportation, tour guides, and access emergency services. The backend serves as the single source of truth for all data and business logic, exposing REST APIs to the Next.js frontend and dedicated tool endpoints for the Python AI agent chatbot.

The system handles authentication, booking management, payment processing via Stripe, emergency alerts, student discount verification, loyalty points, notifications, and currency exchange services. All business logic resides in the backend to ensure data integrity and security.

For development, the entire stack runs in Docker containers including PostgreSQL, Redis, the NestJS backend, Next.js frontend, and Python AI chatbot. This provides a consistent, reproducible development environment. Production deployments use managed services (Supabase for PostgreSQL, Upstash for Redis) for scalability and reliability.

## Glossary

- **Backend**: The NestJS application server that processes all business logic and database operations
- **Supabase**: Managed PostgreSQL database hosting service with built-in authentication and storage (used in production)
- **Prisma**: TypeScript ORM used for type-safe database queries and migrations
- **Redis**: In-memory data store used for caching, session management, and pub/sub (Upstash in production, Docker container in development)
- **Stripe**: Payment processing service for card payments and webhooks
- **Frontend**: Next.js web application that consumes the Backend REST API
- **AI_Agent**: Python-based chatbot that calls Backend tool endpoints using service key authentication
- **Booking**: A reservation record for trips, hotels, transportation, or guides
- **Payment_Intent**: Stripe object representing a payment in progress
- **JWT**: JSON Web Token used for user authentication
- **Service_Key**: Secret authentication key used by AI_Agent to access tool endpoints
- **RLS**: Row-Level Security policies in Supabase for data isolation
- **Webhook**: HTTP callback from Stripe to Backend when payment events occur
- **QR_Payment**: Bakong/ABA Pay QR code payment method popular in Cambodia
- **Loyalty_Points**: Reward points earned from completed bookings
- **Emergency_Alert**: GPS-tracked safety alert sent by travelers
- **Student_Verification**: Process to verify student status for discount eligibility
- **Booking_Hold**: 15-minute reservation period during payment processing
- **Docker_Compose**: Tool for defining and running multi-container Docker applications
- **PostgreSQL_Container**: Docker container running PostgreSQL 15 database for development
- **Redis_Container**: Docker container running Redis 7 for development caching and sessions
- **Backend_Container**: Docker container running the NestJS Backend application
- **Frontend_Container**: Docker container running the Next.js Frontend application
- **Agentic_LLM_Chatbot_Container**: Docker container running the Python AI chatbot application
- **Hot_Reload**: Development feature that automatically restarts application when code changes
- **Volume_Mount**: Docker mechanism to share files between host and container
- **Health_Check**: Docker mechanism to verify container is running correctly
- **Bridge_Network**: Docker network type that allows containers to communicate

## Requirements

### Requirement 1: Project Structure and Configuration

**User Story:** As a developer, I want a well-organized NestJS project structure with proper configuration management, so that the codebase is maintainable and scalable.

#### Acceptance Criteria

1. THE Backend SHALL use NestJS 10 framework with TypeScript
2. THE Backend SHALL organize code into feature modules (auth, users, trips, bookings, payments, transportation, hotels, guides, explore, festivals, emergency, student-discount, loyalty, notifications, currency, ai-tools)
3. THE Backend SHALL use a centralized config module that reads environment variables
4. THE Backend SHALL store all sensitive configuration in environment variables (DATABASE_URL, DIRECT_URL, SUPABASE_SERVICE_ROLE_KEY, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, AI_SERVICE_KEY, REDIS_URL)
5. THE Backend SHALL use Prisma as the ORM with schema defined in prisma/schema.prisma
6. THE Backend SHALL connect to Supabase PostgreSQL using connection pooler for runtime queries
7. THE Backend SHALL connect to Supabase PostgreSQL using direct connection for migrations
8. THE Backend SHALL implement global exception filters for HTTP and Prisma errors
9. THE Backend SHALL implement global validation pipe using class-validator
10. THE Backend SHALL enable CORS for whitelisted origins only (https://derlg.com, https://www.derlg.com)

### Requirement 2: Database Schema Implementation

**User Story:** As a developer, I want a complete database schema with all required tables and relationships, so that all application data can be stored and queried efficiently.

#### Acceptance Criteria

1. THE Backend SHALL define 18 database models in Prisma schema (users, trips, places, hotels, hotel_rooms, transportation_vehicles, guides, bookings, payments, reviews, festivals, discount_codes, loyalty_transactions, emergency_alerts, student_verifications, notifications, ai_sessions, audit_logs)
2. THE Backend SHALL use UUID as primary key type for all tables
3. THE Backend SHALL define proper foreign key relationships between tables
4. THE Backend SHALL create indexes on frequently queried columns (email, booking_ref, user_id, status, travel_date, supabase_uid)
5. THE Backend SHALL use ENUM types for constrained values (UserRole, Language, Environment, BookingStatus, BookingType, PaymentStatus, PaymentMethod)
6. THE Backend SHALL store monetary values as DECIMAL(10,2) type
7. THE Backend SHALL use JSONB type for flexible data structures (itinerary, includes, excludes, cancellation_policy, customizations)
8. THE Backend SHALL use TEXT[] arrays for multi-value fields (mood_tags, highlights, amenities, features, languages)
9. THE Backend SHALL use TIMESTAMPTZ for all timestamp fields with automatic created_at and updated_at
10. THE Backend SHALL generate Prisma migrations for all schema changes

### Requirement 3: Authentication System

**User Story:** As a traveler, I want to register and log in securely, so that I can access my bookings and personal information.

#### Acceptance Criteria

1. WHEN a user registers, THE Backend SHALL create a Supabase Auth account with email and password
2. WHEN a user registers, THE Backend SHALL create a corresponding user record in the users table with supabase_uid linked
3. WHEN a user registers, THE Backend SHALL require email verification before first login
4. WHEN a user logs in with valid credentials, THE Backend SHALL generate a JWT access token with 15-minute expiry
5. WHEN a user logs in with valid credentials, THE Backend SHALL generate a JWT refresh token with 7-day expiry
6. THE Backend SHALL store refresh tokens in httpOnly Secure SameSite=Strict cookies
7. THE Backend SHALL include user claims in access token payload (sub: user_id, role, email, preferred_language)
8. WHEN a refresh token is presented, THE Backend SHALL validate token version and issue new access token
9. WHEN a user logs out, THE Backend SHALL increment token version to invalidate all existing tokens
10. THE Backend SHALL support Google OAuth login flow using Passport strategy
11. THE Backend SHALL implement password reset flow using Supabase Auth resetPasswordForEmail
12. THE Backend SHALL apply JWT authentication guard to all protected routes
13. THE Backend SHALL apply role-based authorization guard for admin-only routes
14. THE Backend SHALL rate-limit authentication endpoints to 5 requests per 5 minutes per IP

### Requirement 4: User Management

**User Story:** As a traveler, I want to manage my profile information and preferences, so that I can personalize my experience.

#### Acceptance Criteria

1. WHEN authenticated, THE Backend SHALL return current user profile data
2. WHEN a user updates profile, THE Backend SHALL validate and save changes to users table
3. THE Backend SHALL allow users to update name, phone, avatar_url, preferred_language, emergency_contact_name, emergency_contact_phone
4. THE Backend SHALL prevent users from modifying loyalty_points, is_student, student_verified_at, role directly
5. THE Backend SHALL return loyalty points balance in user profile response
6. THE Backend SHALL return student verification status in user profile response
7. WHEN a user uploads avatar, THE Backend SHALL store image in Supabase Storage and save URL
8. THE Backend SHALL enforce maximum file size of 5MB for avatar uploads
9. THE Backend SHALL support three language preferences (EN, KH, ZH)

### Requirement 5: Trip Catalog Management

**User Story:** As a traveler, I want to browse available trip packages with filters, so that I can find trips that match my interests.

#### Acceptance Criteria

1. THE Backend SHALL return list of active trips with pagination support
2. THE Backend SHALL filter trips by environment type (MOUNTAIN, BEACH, CITY, FOREST, ISLAND, TEMPLE)
3. THE Backend SHALL filter trips by duration range (min_days, max_days)
4. THE Backend SHALL filter trips by price range (min_price_usd, max_price_usd)
5. THE Backend SHALL filter trips by province/destination
6. THE Backend SHALL sort trips by price, rating, or duration
7. THE Backend SHALL return trip details including title in requested language (title_kh, title_zh)
8. THE Backend SHALL return featured trips ordered by average rating
9. THE Backend SHALL include hotel, transport, and itinerary details in trip response
10. THE Backend SHALL only return trips where is_active is true

### Requirement 6: Booking Creation and Management

**User Story:** As a traveler, I want to create and manage bookings for trips, hotels, transportation, and guides, so that I can plan my Cambodia travel.

#### Acceptance Criteria

1. WHEN a booking is created, THE Backend SHALL generate unique booking_ref in format DLG-YYYY-NNNN
2. WHEN a booking is created, THE Backend SHALL set status to RESERVED
3. WHEN a booking is created, THE Backend SHALL set reserved_until to current time plus 15 minutes
4. WHEN a booking is created, THE Backend SHALL calculate subtotal from base prices
5. WHEN a booking is created, THE Backend SHALL apply discount codes if provided and valid
6. WHEN a booking is created, THE Backend SHALL apply loyalty points discount if requested
7. WHEN a booking is created, THE Backend SHALL apply student discount if user is verified student
8. WHEN a booking is created, THE Backend SHALL calculate final total_usd after all discounts
9. WHEN a booking is created, THE Backend SHALL store booking_hold key in Redis with 15-minute TTL
10. WHEN a booking payment succeeds, THE Backend SHALL update status to CONFIRMED
11. WHEN a booking hold expires without payment, THE Backend SHALL update status to CANCELLED
12. THE Backend SHALL allow users to view their own bookings only
13. THE Backend SHALL allow users to cancel CONFIRMED bookings according to cancellation policy
14. THE Backend SHALL support booking types (PACKAGE, HOTEL_ONLY, TRANSPORT_ONLY, GUIDE_ONLY)
15. THE Backend SHALL validate availability before creating booking

### Requirement 7: Transportation Booking System

**User Story:** As a traveler, I want to book vehicles (vans, buses, tuk-tuks) for my travel, so that I have reliable transportation in Cambodia.

#### Acceptance Criteria

1. THE Backend SHALL return list of vehicles filtered by category (VAN, BUS, TUK_TUK)
2. THE Backend SHALL filter vehicles by minimum capacity requirement
3. THE Backend SHALL filter vehicles by tier (STANDARD, VIP)
4. WHEN checking availability, THE Backend SHALL query existing bookings for date conflicts
5. WHEN checking availability, THE Backend SHALL return available status and calculated price
6. WHEN creating transport booking, THE Backend SHALL validate vehicle availability
7. WHEN creating transport booking, THE Backend SHALL calculate price based on duration and vehicle rate
8. THE Backend SHALL support per-day pricing for vans and buses
9. THE Backend SHALL support per-km pricing for tuk-tuks
10. THE Backend SHALL include vehicle features and images in response

### Requirement 8: Hotel Booking System

**User Story:** As a traveler, I want to book hotel rooms for my stay, so that I have accommodation during my trip.

#### Acceptance Criteria

1. THE Backend SHALL return list of hotels filtered by province
2. THE Backend SHALL return list of hotel rooms filtered by room_type, capacity, and price range
3. WHEN checking room availability, THE Backend SHALL query existing bookings for date conflicts
4. WHEN creating hotel booking, THE Backend SHALL validate room availability for requested dates
5. WHEN creating hotel booking, THE Backend SHALL calculate total price based on number of nights
6. THE Backend SHALL include hotel amenities, star_rating, and images in response
7. THE Backend SHALL include room-specific amenities and capacity in room response
8. THE Backend SHALL enforce check-in and check-out time policies

### Requirement 9: Tour Guide Booking System

**User Story:** As a traveler, I want to book tour guides who speak my language, so that I can have a knowledgeable local guide.

#### Acceptance Criteria

1. THE Backend SHALL return list of guides filtered by languages spoken
2. THE Backend SHALL filter guides by specialties (temple tours, history, nature)
3. THE Backend SHALL filter guides by province availability
4. WHEN checking guide availability, THE Backend SHALL query existing bookings for date conflicts
5. WHEN creating guide booking, THE Backend SHALL validate guide availability
6. THE Backend SHALL calculate guide booking price based on number of days
7. THE Backend SHALL only return guides where is_verified is true and is_available is true
8. THE Backend SHALL include guide bio in requested language, certifications, and ratings in response

### Requirement 10: Payment Processing with Stripe

**User Story:** As a traveler, I want to pay for my bookings securely using card or QR payment, so that I can confirm my reservations.

#### Acceptance Criteria

1. WHEN creating payment intent, THE Backend SHALL validate booking exists and is in RESERVED status
2. WHEN creating payment intent, THE Backend SHALL verify reserved_until has not expired
3. WHEN creating payment intent, THE Backend SHALL calculate amount independently from booking total
4. WHEN creating payment intent, THE Backend SHALL create Stripe Payment Intent with booking metadata
5. WHEN creating payment intent, THE Backend SHALL create payment record with status PENDING
6. WHEN creating payment intent, THE Backend SHALL return client_secret to frontend
7. WHEN generating QR payment, THE Backend SHALL create payment intent with QR-compatible payment method
8. WHEN generating QR payment, THE Backend SHALL generate QR code image URL
9. WHEN generating QR payment, THE Backend SHALL set QR expiry to match booking hold time
10. THE Backend SHALL expose webhook endpoint at /v1/payments/webhook without JWT authentication
11. WHEN receiving Stripe webhook, THE Backend SHALL verify webhook signature using STRIPE_WEBHOOK_SECRET
12. WHEN receiving Stripe webhook, THE Backend SHALL check stripe_event_id for idempotency
13. WHEN payment_intent.succeeded event received, THE Backend SHALL update booking status to CONFIRMED
14. WHEN payment_intent.succeeded event received, THE Backend SHALL update payment status to SUCCEEDED
15. WHEN payment_intent.succeeded event received, THE Backend SHALL award loyalty points
16. WHEN payment_intent.succeeded event received, THE Backend SHALL send booking confirmation notification
17. WHEN payment_intent.succeeded event received, THE Backend SHALL publish payment success event to Redis
18. WHEN payment_intent.payment_failed event received, THE Backend SHALL update payment status to FAILED
19. WHEN charge.refunded event received, THE Backend SHALL update payment and booking to REFUNDED status
20. THE Backend SHALL rate-limit payment intent creation to 3 requests per minute per user

### Requirement 11: Refund Processing

**User Story:** As a traveler, I want to receive refunds when I cancel bookings according to the cancellation policy, so that I am treated fairly.

#### Acceptance Criteria

1. WHEN processing refund, THE Backend SHALL fetch cancellation_policy from booking
2. WHEN processing refund, THE Backend SHALL calculate days until travel_date
3. WHEN cancellation is 7+ days before travel, THE Backend SHALL refund 100% of total
4. WHEN cancellation is 1-7 days before travel, THE Backend SHALL refund 50% of total
5. WHEN cancellation is less than 24 hours before travel, THE Backend SHALL refund 0%
6. WHEN refund is approved, THE Backend SHALL create Stripe refund with calculated amount
7. WHEN refund is processed, THE Backend SHALL update payment status to REFUNDED or PARTIALLY_REFUNDED
8. WHEN refund is processed, THE Backend SHALL update booking status to CANCELLED
9. WHEN refund is processed, THE Backend SHALL deduct loyalty points that were earned from booking
10. WHEN refund is processed, THE Backend SHALL send refund confirmation notification

### Requirement 12: Emergency Alert System

**User Story:** As a traveler, I want to send emergency alerts with my GPS location, so that I can get help when in danger.

#### Acceptance Criteria

1. WHEN emergency alert is created, THE Backend SHALL capture GPS coordinates (latitude, longitude, accuracy)
2. WHEN emergency alert is created, THE Backend SHALL store alert_type (SOS, MEDICAL, THEFT, LOST)
3. WHEN emergency alert is created, THE Backend SHALL set status to SENT
4. WHEN emergency alert is created, THE Backend SHALL send push notification to support team
5. WHEN emergency alert is created, THE Backend SHALL send SMS to support emergency line
6. WHEN emergency alert is created, THE Backend SHALL return support contact numbers to user
7. WHEN emergency alert is created, THE Backend SHALL return local police number based on GPS location
8. WHEN emergency alert is created, THE Backend SHALL return nearest hospital information
9. THE Backend SHALL allow support staff to update alert status to ACKNOWLEDGED or RESOLVED
10. THE Backend SHALL store emergency alert records permanently for safety and legal purposes
11. THE Backend SHALL return province-specific emergency contacts for all 25 Cambodia provinces
12. THE Backend SHALL support location sharing sessions between travelers and guides with TTL

### Requirement 13: Student Discount Verification

**User Story:** As a student traveler, I want to verify my student status, so that I can receive discounts on bookings.

#### Acceptance Criteria

1. WHEN student verification is started, THE Backend SHALL accept student_id_image upload
2. WHEN student verification is started, THE Backend SHALL accept face_selfie upload
3. WHEN student verification is started, THE Backend SHALL store images in Supabase Storage
4. WHEN student verification is started, THE Backend SHALL create verification record with status PENDING
5. THE Backend SHALL allow admin to review verification and update status to APPROVED or REJECTED
6. WHEN verification is approved, THE Backend SHALL update user is_student to true
7. WHEN verification is approved, THE Backend SHALL set student_verified_at timestamp
8. WHEN verification is approved, THE Backend SHALL set expires_at to one year from approval
9. WHEN creating booking, THE Backend SHALL apply student discount if user is verified student
10. THE Backend SHALL enforce maximum file size of 10MB for student ID uploads

### Requirement 14: Loyalty Points System

**User Story:** As a traveler, I want to earn and redeem loyalty points, so that I can save money on future bookings.

#### Acceptance Criteria

1. WHEN booking is confirmed, THE Backend SHALL calculate loyalty points as 2 points per USD spent
2. WHEN booking is confirmed, THE Backend SHALL add earned points to user loyalty_points balance
3. WHEN booking is confirmed, THE Backend SHALL create loyalty_transaction record with type EARNED
4. WHEN creating booking, THE Backend SHALL allow redemption of loyalty points at rate of 100 points = 1 USD
5. WHEN redeeming points, THE Backend SHALL verify user has sufficient points balance
6. WHEN redeeming points, THE Backend SHALL deduct points from user balance
7. WHEN redeeming points, THE Backend SHALL create loyalty_transaction record with type REDEEMED
8. WHEN booking is refunded, THE Backend SHALL reverse earned points
9. WHEN booking is refunded, THE Backend SHALL create loyalty_transaction record with type ADJUSTED
10. THE Backend SHALL return loyalty points balance and transaction history to user

### Requirement 15: Notification System

**User Story:** As a traveler, I want to receive notifications about my bookings and important events, so that I stay informed.

#### Acceptance Criteria

1. WHEN booking is confirmed, THE Backend SHALL send email confirmation using Resend
2. WHEN booking is confirmed, THE Backend SHALL send push notification using FCM
3. WHEN travel date is 24 hours away, THE Backend SHALL send reminder notification
4. WHEN payment fails, THE Backend SHALL send payment failure notification
5. WHEN booking is cancelled, THE Backend SHALL send cancellation confirmation notification
6. WHEN refund is processed, THE Backend SHALL send refund confirmation notification
7. WHEN emergency alert is sent, THE Backend SHALL send acknowledgment notification to user
8. WHEN festival is upcoming, THE Backend SHALL send festival alert notification
9. THE Backend SHALL store notification records with delivery status
10. THE Backend SHALL support notification templates in multiple languages (EN, KH, ZH)

### Requirement 16: Explore Places Module

**User Story:** As a traveler, I want to explore Cambodian places and cultural sites, so that I can learn about destinations.

#### Acceptance Criteria

1. THE Backend SHALL return list of places filtered by province
2. THE Backend SHALL filter places by category (TEMPLE, MUSEUM, NATURE, MARKET, BEACH, MOUNTAIN)
3. THE Backend SHALL return place details in requested language (name_kh, name_zh, description_kh, description_zh)
4. THE Backend SHALL include GPS coordinates for all places
5. THE Backend SHALL include visitor tips, dress code, and entry fees
6. THE Backend SHALL include opening hours as structured data
7. THE Backend SHALL support text search across place names and descriptions
8. THE Backend SHALL mark places as offline_available for offline map caching
9. THE Backend SHALL include multiple image URLs for each place

### Requirement 17: Festival Calendar

**User Story:** As a traveler, I want to see upcoming Cambodian festivals, so that I can plan my trip around cultural events.

#### Acceptance Criteria

1. THE Backend SHALL return list of festivals filtered by date range
2. THE Backend SHALL return upcoming festivals ordered by start_date
3. THE Backend SHALL return festival details in requested language (name_kh, name_zh, description_kh, description_zh)
4. THE Backend SHALL link festivals to places where they occur
5. WHEN festival has discount, THE Backend SHALL generate discount code automatically
6. THE Backend SHALL return festival-specific discount codes with validity period
7. THE Backend SHALL only return festivals where is_active is true

### Requirement 18: Currency Exchange Service

**User Story:** As a traveler, I want to see prices in my preferred currency, so that I understand costs in familiar terms.

#### Acceptance Criteria

1. THE Backend SHALL fetch exchange rates from ExchangeRate-API
2. THE Backend SHALL cache exchange rates in Redis with 1-hour TTL
3. THE Backend SHALL support USD, KHR, and CNY currencies
4. THE Backend SHALL return current exchange rates for all supported currencies
5. WHEN cache expires, THE Backend SHALL refresh rates from external API

### Requirement 19: AI Tools API

**User Story:** As an AI agent, I want to access backend functionality through dedicated tool endpoints, so that I can assist users with bookings and information.

#### Acceptance Criteria

1. THE Backend SHALL expose AI tool endpoints under /v1/ai-tools/ prefix
2. THE Backend SHALL protect AI tool endpoints with Service Key authentication guard
3. WHEN AI tool request is received, THE Backend SHALL validate X-Service-Key header
4. THE Backend SHALL provide trip suggestion tool that queries trips based on preferences
5. THE Backend SHALL provide booking creation tool that creates bookings with validation
6. THE Backend SHALL provide booking cancellation tool that processes cancellations
7. THE Backend SHALL provide payment QR generation tool that creates QR codes
8. THE Backend SHALL provide booking status check tool that returns current status
9. THE Backend SHALL provide place search tool that queries explore places
10. THE Backend SHALL return standardized error codes for AI agent parsing

### Requirement 20: Redis Integration

**User Story:** As a developer, I want Redis integration for caching and session management, so that the system performs efficiently.

#### Acceptance Criteria

1. THE Backend SHALL connect to Upstash Redis using REDIS_URL
2. THE Backend SHALL store booking holds with 15-minute TTL using key pattern booking_hold:{booking_id}
3. THE Backend SHALL store AI session state with 7-day TTL using key pattern session:{session_id}
4. THE Backend SHALL cache currency exchange rates with 1-hour TTL using key currency:rates
5. THE Backend SHALL cache weather data with 1-hour TTL using key pattern weather:{city}
6. THE Backend SHALL store refresh token versions using key pattern refresh_token_version:{user_id}
7. THE Backend SHALL implement rate limiting using Redis counters
8. THE Backend SHALL publish payment events to Redis pub/sub channel payment_events:{user_id}
9. THE Backend SHALL implement Redis service with methods (get, set, del, setex, publish, subscribe)

### Requirement 21: Background Jobs

**User Story:** As a system administrator, I want automated background jobs to handle recurring tasks, so that the system maintains itself.

#### Acceptance Criteria

1. THE Backend SHALL run booking cleanup job every 5 minutes using NestJS Cron
2. WHEN booking cleanup runs, THE Backend SHALL cancel bookings where status is RESERVED and reserved_until is past
3. THE Backend SHALL run travel reminder job daily at 9am Cambodia time
4. WHEN travel reminder runs, THE Backend SHALL send notifications to users with bookings starting tomorrow
5. THE Backend SHALL run festival alert job daily at 8am
6. WHEN festival alert runs, THE Backend SHALL notify users about festivals starting in 1-3 days

### Requirement 22: Security and Validation

**User Story:** As a system administrator, I want comprehensive security measures, so that user data and payments are protected.

#### Acceptance Criteria

1. THE Backend SHALL validate all request DTOs using class-validator decorators
2. THE Backend SHALL reject requests with invalid data with 400 Bad Request and field-specific errors
3. THE Backend SHALL sanitize all user input to prevent SQL injection
4. THE Backend SHALL use Prisma parameterized queries for all database operations
5. THE Backend SHALL rate-limit all endpoints using @nestjs/throttler with Redis backend
6. THE Backend SHALL enforce HTTPS for all API endpoints
7. THE Backend SHALL never trust payment status from frontend or AI agent
8. THE Backend SHALL verify all Stripe webhook signatures before processing
9. THE Backend SHALL log all financial events with timestamp, user_id, amount, and IP address
10. THE Backend SHALL implement audit logging interceptor for sensitive operations
11. THE Backend SHALL never expose service role keys or secrets in responses or logs
12. THE Backend SHALL implement CORS whitelist for allowed origins only

### Requirement 23: API Response Standards

**User Story:** As a frontend developer, I want consistent API response formats, so that I can handle responses predictably.

#### Acceptance Criteria

1. THE Backend SHALL wrap all successful responses in envelope with success: true, data, message fields
2. THE Backend SHALL wrap all error responses in envelope with success: false, data: null, message, error fields
3. THE Backend SHALL include machine-readable error codes in error responses
4. THE Backend SHALL include pagination metadata for list endpoints (page, per_page, total)
5. THE Backend SHALL use HTTP status codes correctly (200 OK, 201 Created, 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 500 Internal Server Error)
6. THE Backend SHALL implement response transform interceptor globally

### Requirement 24: Testing and Documentation

**User Story:** As a developer, I want comprehensive tests and API documentation, so that the system is reliable and easy to understand.

#### Acceptance Criteria

1. THE Backend SHALL generate Swagger/OpenAPI documentation at /api-docs endpoint
2. THE Backend SHALL include request/response examples in Swagger documentation
3. THE Backend SHALL document all authentication requirements in Swagger
4. THE Backend SHALL implement end-to-end tests for critical flows (auth, booking, payment)
5. THE Backend SHALL implement unit tests for service layer business logic

### Requirement 25: Deployment and Monitoring

**User Story:** As a system administrator, I want proper deployment configuration and monitoring, so that the system runs reliably in production.

#### Acceptance Criteria

1. THE Backend SHALL listen on port 3001 in production
2. THE Backend SHALL enable compression middleware for response optimization
3. THE Backend SHALL implement Winston logger for structured logging
4. THE Backend SHALL integrate with Sentry for error tracking
5. THE Backend SHALL expose health check endpoint at /health
6. THE Backend SHALL log all unhandled exceptions with full stack traces
7. THE Backend SHALL use connection pooling for database connections
8. THE Backend SHALL handle graceful shutdown on SIGTERM signal

### Requirement 26: Parser and Serializer Requirements

**User Story:** As a developer, I want reliable parsing and serialization of structured data, so that data integrity is maintained.

#### Acceptance Criteria

1. WHEN parsing booking customizations JSON, THE Backend SHALL validate against expected schema
2. WHEN parsing trip itinerary JSON, THE Backend SHALL validate against expected schema
3. WHEN parsing cancellation policy JSON, THE Backend SHALL validate against expected schema
4. THE Backend SHALL serialize booking data to JSON for API responses
5. THE Backend SHALL serialize payment data to JSON for API responses
6. FOR ALL valid booking objects, parsing then serializing then parsing SHALL produce equivalent object (round-trip property)
7. FOR ALL valid payment objects, parsing then serializing then parsing SHALL produce equivalent object (round-trip property)
8. WHEN parsing fails, THE Backend SHALL return descriptive error with field location
9. THE Backend SHALL validate JSON structure before database insertion
10. THE Backend SHALL use class-transformer for DTO serialization

### Requirement 27: AI Budget Planner

**User Story:** As a traveler, I want to estimate the total cost of my Cambodia trip before booking, so that I can make informed budget decisions.

#### Acceptance Criteria

1. WHEN budget estimation is requested, THE Backend SHALL calculate cost based on duration, group size, accommodation tier, and transport type
2. WHEN calculating budget, THE Backend SHALL return MIN and MAX range values
3. THE Backend SHALL include breakdown for accommodation, transport, guide, meals, entry fees, and extras
4. THE Backend SHALL support currency conversion to USD, KHR, and CNY
5. THE Backend SHALL refresh exchange rates hourly from cache
6. WHEN accommodation tier changes, THE Backend SHALL recalculate estimate within 5 seconds
7. THE Backend SHALL provide province-specific cost adjustments
8. THE Backend SHALL include entry fee calculations for Angkor passes
9. THE Backend SHALL return meal cost estimates at 15-20 USD per person per day
10. THE Backend SHALL generate budget estimates accessible via AI tools endpoint

### Requirement 28: Offline Map Data Management

**User Story:** As a traveler, I want to download province maps for offline use, so that I can navigate without internet connection.

#### Acceptance Criteria

1. THE Backend SHALL provide map data download endpoints for each province
2. THE Backend SHALL include place markers with categories (temple, hotel, emergency, restaurant)
3. THE Backend SHALL return GPS coordinates for all places in province
4. THE Backend SHALL include emergency service locations in map data
5. THE Backend SHALL return map data size in MB before download
6. THE Backend SHALL compress map data using gzip compression
7. THE Backend SHALL version map data with last_updated timestamp
8. WHEN map data is requested, THE Backend SHALL return GeoJSON format
9. THE Backend SHALL include DerLg booking locations in map data
10. THE Backend SHALL cache map data in Redis with 7-day TTL

### Requirement 29: Enhanced Multi-Language Support

**User Story:** As a traveler, I want all content in my preferred language, so that I can use the platform naturally.

#### Acceptance Criteria

1. THE Backend SHALL support three languages (EN, KH, ZH) for all content
2. WHEN language header is provided, THE Backend SHALL return content in requested language
3. THE Backend SHALL store translations for trip titles (title_en, title_kh, title_zh)
4. THE Backend SHALL store translations for place descriptions (description_en, description_kh, description_zh)
5. THE Backend SHALL store translations for festival content
6. THE Backend SHALL return error messages in user preferred language
7. THE Backend SHALL send email notifications in user preferred language
8. THE Backend SHALL include language preference in user profile
9. WHEN language is not specified, THE Backend SHALL default to English
10. THE Backend SHALL validate Accept-Language header format

### Requirement 30: Booking Itinerary Management

**User Story:** As a traveler, I want to access detailed itineraries for my bookings, so that I know what to expect each day.

#### Acceptance Criteria

1. THE Backend SHALL store day-by-day itinerary in booking record
2. THE Backend SHALL include pickup times, locations, and activities for each day
3. THE Backend SHALL return driver contact information 24 hours before departure
4. THE Backend SHALL generate shareable itinerary links with format derlg.com/trip/{booking_ref}
5. WHEN itinerary link is accessed, THE Backend SHALL return public booking details without authentication
6. THE Backend SHALL include hotel check-in and check-out times in itinerary
7. THE Backend SHALL return guide contact information when assigned
8. THE Backend SHALL support calendar export in iCal format
9. THE Backend SHALL include weather forecast for travel dates in itinerary
10. THE Backend SHALL return itinerary in user preferred language

### Requirement 31: Location Sharing and Tracking

**User Story:** As a traveler, I want to share my live location with family, so that they can track my safety during the trip.

#### Acceptance Criteria

1. WHEN location sharing is enabled, THE Backend SHALL generate unique tracking link
2. THE Backend SHALL store location updates with 5-minute intervals
3. THE Backend SHALL support tracking link expiry options (24 hours, 3 days, trip duration)
4. WHEN tracking link is accessed, THE Backend SHALL return latest GPS coordinates
5. THE Backend SHALL store location history for active tracking sessions
6. WHEN tracking expires, THE Backend SHALL delete location data
7. THE Backend SHALL rate-limit location updates to 1 per minute per user
8. THE Backend SHALL validate GPS coordinate format and accuracy
9. THE Backend SHALL return tracking status (active, expired, cancelled)
10. THE Backend SHALL allow user to cancel tracking session early

### Requirement 32: Review and Rating System

**User Story:** As a traveler, I want to leave reviews for completed trips, so that I can share my experience with others.

#### Acceptance Criteria

1. WHEN trip is completed, THE Backend SHALL allow user to submit review
2. THE Backend SHALL verify user completed the booking before accepting review
3. THE Backend SHALL accept star rating from 1 to 5
4. THE Backend SHALL accept review text with maximum 1000 characters
5. THE Backend SHALL accept optional review photos with maximum 5 images
6. WHEN review is submitted, THE Backend SHALL award 50 loyalty points
7. THE Backend SHALL calculate average rating for trips, hotels, guides, and vehicles
8. THE Backend SHALL return 5 most recent reviews for each entity
9. THE Backend SHALL prevent duplicate reviews for same booking
10. THE Backend SHALL allow user to edit review within 7 days of submission

### Requirement 33: Referral Program

**User Story:** As a user, I want to refer friends and earn rewards, so that I benefit from sharing the platform.

#### Acceptance Criteria

1. WHEN user account is created, THE Backend SHALL generate unique referral code
2. THE Backend SHALL format referral code as DERLG-{username_prefix}{random_digit}
3. WHEN new user signs up with referral code, THE Backend SHALL link referrer to referee
4. WHEN referee completes first booking, THE Backend SHALL award 500 points to referrer
5. WHEN referee completes first booking, THE Backend SHALL award 500 points to referee
6. THE Backend SHALL track referral status (pending, completed)
7. THE Backend SHALL return referral statistics (total referrals, completed referrals, points earned)
8. THE Backend SHALL prevent self-referral by checking email and device fingerprint
9. THE Backend SHALL generate shareable referral link with format derlg.com/ref/{code}
10. THE Backend SHALL validate referral code format before accepting

### Requirement 34: Advanced Error Handling and Edge Cases

**User Story:** As a developer, I want comprehensive error handling for all edge cases, so that the system is robust and reliable.

#### Acceptance Criteria

1. WHEN database connection fails, THE Backend SHALL retry 3 times with exponential backoff
2. WHEN Stripe API is unavailable, THE Backend SHALL return 503 Service Unavailable with retry-after header
3. WHEN booking hold expires during payment, THE Backend SHALL return specific error code BOOKING_EXPIRED
4. WHEN concurrent booking attempts occur for same resource, THE Backend SHALL use database transactions with row locking
5. WHEN payment webhook is received multiple times, THE Backend SHALL check stripe_event_id for idempotency
6. WHEN user attempts to redeem more loyalty points than available, THE Backend SHALL return error with current balance
7. WHEN GPS coordinates are invalid or out of Cambodia bounds, THE Backend SHALL reject emergency alert with validation error
8. WHEN file upload exceeds size limit, THE Backend SHALL return 413 Payload Too Large before processing
9. WHEN rate limit is exceeded, THE Backend SHALL return 429 Too Many Requests with retry-after header
10. WHEN JWT token is expired, THE Backend SHALL return 401 Unauthorized with error code TOKEN_EXPIRED
11. WHEN refresh token version mismatch occurs, THE Backend SHALL invalidate token and require re-login
12. WHEN booking cancellation is attempted after travel date, THE Backend SHALL reject with error code TRIP_ALREADY_STARTED
13. WHEN student verification image is corrupted, THE Backend SHALL return error code INVALID_IMAGE_FORMAT
14. WHEN discount code is expired or invalid, THE Backend SHALL return error with expiry date
15. WHEN availability check fails due to date conflicts, THE Backend SHALL return conflicting booking dates

### Requirement 35: Performance and Scalability

**User Story:** As a system administrator, I want the backend to handle high traffic efficiently, so that users have fast response times.

#### Acceptance Criteria

1. THE Backend SHALL respond to health check requests within 100ms
2. THE Backend SHALL cache frequently accessed data in Redis with appropriate TTL
3. THE Backend SHALL use database connection pooling with minimum 10 and maximum 100 connections
4. THE Backend SHALL implement query result pagination with default 20 items per page
5. THE Backend SHALL use database indexes on all foreign keys and frequently queried columns
6. THE Backend SHALL compress API responses larger than 1KB using gzip
7. THE Backend SHALL implement lazy loading for related entities in Prisma queries
8. WHEN search queries are performed, THE Backend SHALL use full-text search indexes
9. THE Backend SHALL batch notification sends to avoid overwhelming email service
10. THE Backend SHALL implement request timeout of 30 seconds for all endpoints
11. THE Backend SHALL use Redis pub/sub for real-time updates instead of polling
12. THE Backend SHALL implement database query logging for queries exceeding 1 second
13. THE Backend SHALL use CDN for static asset delivery
14. THE Backend SHALL implement horizontal scaling support with stateless architecture
15. THE Backend SHALL use Redis for distributed rate limiting across multiple instances

### Requirement 36: Data Privacy and Compliance

**User Story:** As a user, I want my personal data to be protected and handled responsibly, so that my privacy is respected.

#### Acceptance Criteria

1. THE Backend SHALL encrypt sensitive data at rest using AES-256
2. THE Backend SHALL hash passwords using bcrypt with salt rounds of 12
3. THE Backend SHALL mask credit card numbers in logs and responses
4. THE Backend SHALL implement data retention policy deleting inactive accounts after 3 years
5. WHEN user requests account deletion, THE Backend SHALL anonymize personal data within 7 days
6. THE Backend SHALL maintain audit log of all data access and modifications
7. THE Backend SHALL implement GDPR-compliant data export functionality
8. THE Backend SHALL require re-authentication for sensitive operations
9. THE Backend SHALL implement IP-based geolocation for fraud detection
10. THE Backend SHALL comply with PCI-DSS requirements for payment data handling
11. THE Backend SHALL never log or store full credit card numbers
12. THE Backend SHALL implement session timeout of 15 minutes for inactive users
13. THE Backend SHALL use secure random token generation for all tokens
14. THE Backend SHALL implement CSRF protection for state-changing operations
15. THE Backend SHALL validate and sanitize all file uploads for malware

### Requirement 37: Webhook Reliability and Idempotency

**User Story:** As a developer, I want webhook processing to be reliable and idempotent, so that payment events are never missed or duplicated.

#### Acceptance Criteria

1. WHEN webhook is received, THE Backend SHALL verify signature before processing
2. WHEN webhook processing fails, THE Backend SHALL return 500 to trigger Stripe retry
3. THE Backend SHALL store webhook event ID to prevent duplicate processing
4. WHEN duplicate webhook is received, THE Backend SHALL return 200 without reprocessing
5. THE Backend SHALL process webhooks in background job queue
6. THE Backend SHALL implement webhook retry logic with exponential backoff
7. THE Backend SHALL log all webhook events with timestamp and payload
8. WHEN webhook processing succeeds, THE Backend SHALL return 200 within 5 seconds
9. THE Backend SHALL handle out-of-order webhook delivery gracefully
10. THE Backend SHALL implement dead letter queue for failed webhooks after 5 retries

### Requirement 38: Availability and Conflict Detection

**User Story:** As a traveler, I want accurate availability information, so that I don't book resources that are already taken.

#### Acceptance Criteria

1. WHEN checking availability, THE Backend SHALL query all confirmed and reserved bookings
2. THE Backend SHALL use database transactions to prevent race conditions
3. WHEN date range overlaps with existing booking, THE Backend SHALL return unavailable status
4. THE Backend SHALL consider booking holds when checking availability
5. THE Backend SHALL implement pessimistic locking for booking creation
6. WHEN multiple users attempt to book same resource, THE Backend SHALL process requests sequentially
7. THE Backend SHALL validate travel dates are in the future
8. THE Backend SHALL validate check-out date is after check-in date
9. THE Backend SHALL prevent bookings more than 2 years in advance
10. THE Backend SHALL return alternative available dates when requested dates are unavailable

### Requirement 39: Notification Delivery and Retry

**User Story:** As a traveler, I want to receive all important notifications reliably, so that I don't miss critical information.

#### Acceptance Criteria

1. WHEN notification send fails, THE Backend SHALL retry 3 times with exponential backoff
2. THE Backend SHALL implement fallback from push notification to email
3. WHEN email delivery fails, THE Backend SHALL log failure and alert support team
4. THE Backend SHALL track notification delivery status (sent, delivered, failed, opened)
5. THE Backend SHALL implement notification queue with priority levels
6. THE Backend SHALL batch non-urgent notifications to avoid spam
7. WHEN user has notifications disabled, THE Backend SHALL respect preference
8. THE Backend SHALL implement notification templates with variable substitution
9. THE Backend SHALL validate email addresses before sending
10. THE Backend SHALL implement unsubscribe functionality for marketing notifications

### Requirement 40: Discount Code Validation and Stacking

**User Story:** As a traveler, I want to apply discount codes correctly, so that I get the best price.

#### Acceptance Criteria

1. WHEN discount code is applied, THE Backend SHALL validate code exists and is active
2. THE Backend SHALL validate discount code is within valid date range
3. THE Backend SHALL validate discount code usage limit has not been exceeded
4. THE Backend SHALL validate discount code applies to booking type
5. THE Backend SHALL prevent stacking of multiple discount codes
6. THE Backend SHALL allow combining discount code with loyalty points
7. THE Backend SHALL allow combining discount code with student discount
8. WHEN discount code is invalid, THE Backend SHALL return specific error reason
9. THE Backend SHALL track discount code usage count per user
10. THE Backend SHALL calculate discount percentage or fixed amount correctly
11. THE Backend SHALL enforce minimum booking amount for discount codes
12. THE Backend SHALL validate discount code is not expired before applying
13. THE Backend SHALL prevent applying same discount code multiple times to same booking
14. THE Backend SHALL return discount amount in booking summary
15. THE Backend SHALL store applied discount code in booking record

### Requirement 41: Docker Development Environment

**User Story:** As a developer, I want all services to run in Docker containers for development, so that I have a consistent and reproducible local environment.

#### Acceptance Criteria

1. THE Backend SHALL provide a docker-compose.yml file that orchestrates all development services
2. THE Backend SHALL define a Dockerfile for the NestJS application with multi-stage build
3. THE Backend SHALL run PostgreSQL 15 in a Docker container for development
4. THE Backend SHALL run Redis 7 in a Docker container for development
5. THE Backend SHALL run the NestJS backend in a Docker container for development
6. THE Backend SHALL configure Docker Compose to create a shared network for all containers
7. THE Backend SHALL use named Docker volumes for PostgreSQL data persistence
8. THE Backend SHALL use named Docker volumes for Redis data persistence
9. THE Backend SHALL expose PostgreSQL on port 5432 for local database tools
10. THE Backend SHALL expose Redis on port 6379 for local Redis clients
11. THE Backend SHALL expose NestJS backend on port 3001 for API access
12. THE Backend SHALL configure environment variables through docker-compose.yml or .env file
13. THE Backend SHALL use Docker Compose depends_on with health checks to ensure services start in correct order
14. THE Backend SHALL provide a .dockerignore file to exclude node_modules and build artifacts
15. THE Backend SHALL document Docker setup and usage in README.md

### Requirement 42: Docker Hot Reload and Development Workflow

**User Story:** As a developer, I want hot reload to work in Docker containers, so that I can see code changes immediately without rebuilding.

#### Acceptance Criteria

1. THE Backend SHALL mount source code directory as a volume in the NestJS container
2. THE Backend SHALL mount node_modules as a named volume to avoid conflicts with host
3. THE Backend SHALL use nodemon or nest start --watch for automatic restart on file changes
4. THE Backend SHALL preserve TypeScript compilation in watch mode inside container
5. THE Backend SHALL sync package.json changes and trigger npm install inside container
6. THE Backend SHALL expose debugging port 9229 for Node.js debugging
7. THE Backend SHALL configure VS Code launch.json for attaching to Docker container debugger
8. THE Backend SHALL log container output to stdout for docker-compose logs visibility
9. THE Backend SHALL support running Prisma migrations inside the container
10. THE Backend SHALL support running database seeds inside the container

### Requirement 43: Docker Service Configuration

**User Story:** As a developer, I want properly configured Docker services with appropriate settings, so that the development environment matches production behavior.

#### Acceptance Criteria

1. THE PostgreSQL_Container SHALL use official postgres:15-alpine image
2. THE PostgreSQL_Container SHALL set POSTGRES_USER, POSTGRES_PASSWORD, and POSTGRES_DB environment variables
3. THE PostgreSQL_Container SHALL expose port 5432 to host
4. THE PostgreSQL_Container SHALL mount volume postgres_data to /var/lib/postgresql/data
5. THE PostgreSQL_Container SHALL implement health check using pg_isready command
6. THE Redis_Container SHALL use official redis:7-alpine image
7. THE Redis_Container SHALL expose port 6379 to host
8. THE Redis_Container SHALL mount volume redis_data to /data
9. THE Redis_Container SHALL implement health check using redis-cli ping command
10. THE Redis_Container SHALL enable Redis persistence with appendonly yes configuration
11. THE Backend_Container SHALL use Node.js 20-alpine as base image
12. THE Backend_Container SHALL set NODE_ENV to development
13. THE Backend_Container SHALL wait for PostgreSQL and Redis health checks before starting
14. THE Backend_Container SHALL run as non-root user for security
15. THE Backend_Container SHALL set working directory to /app

### Requirement 44: Docker Compose Service Integration

**User Story:** As a developer, I want all application services to communicate seamlessly in Docker, so that the full stack works together locally.

#### Acceptance Criteria

1. THE Docker_Compose SHALL define services for postgres, redis, backend, frontend, and agentic-llm-chatbot
2. THE Backend_Container SHALL connect to PostgreSQL using hostname postgres and port 5432
3. THE Backend_Container SHALL connect to Redis using hostname redis and port 6379
4. THE Frontend_Container SHALL connect to Backend using hostname backend and port 3001
5. THE Agentic_LLM_Chatbot_Container SHALL connect to Backend using hostname backend and port 3001
6. THE Docker_Compose SHALL create a custom bridge network named derlg-network
7. THE Docker_Compose SHALL assign all services to the derlg-network
8. THE Frontend_Container SHALL expose port 3000 to host for browser access
9. THE Agentic_LLM_Chatbot_Container SHALL expose appropriate port for chatbot interface
10. THE Docker_Compose SHALL use service names as DNS hostnames for inter-container communication

### Requirement 45: Docker Environment Variables and Secrets

**User Story:** As a developer, I want secure environment variable management in Docker, so that sensitive credentials are not exposed.

#### Acceptance Criteria

1. THE Backend SHALL provide a .env.example file with all required environment variables
2. THE Docker_Compose SHALL load environment variables from .env file
3. THE Backend_Container SHALL set DATABASE_URL to postgresql://user:password@postgres:5432/derlg_dev
4. THE Backend_Container SHALL set REDIS_URL to redis://redis:6379
5. THE Backend_Container SHALL use development-specific values for JWT secrets
6. THE Backend_Container SHALL use Stripe test API keys for development
7. THE Docker_Compose SHALL not commit .env file to version control
8. THE Backend SHALL document all required environment variables in README.md
9. THE Backend_Container SHALL validate required environment variables on startup
10. THE Backend_Container SHALL provide clear error messages for missing environment variables

### Requirement 46: Docker Database Initialization

**User Story:** As a developer, I want the database to be automatically initialized with schema and seed data, so that I can start development immediately.

#### Acceptance Criteria

1. THE Backend_Container SHALL run Prisma migrations automatically on first startup
2. THE Backend_Container SHALL run database seed script after migrations complete
3. THE PostgreSQL_Container SHALL create database derlg_dev if it does not exist
4. THE Backend SHALL provide a seed script that creates sample users, trips, hotels, and guides
5. THE Backend SHALL provide a reset script that drops and recreates the database
6. THE Backend_Container SHALL log migration and seed status to console
7. WHEN database schema changes, THE Backend SHALL support running migrations without rebuilding container
8. THE Backend SHALL provide npm scripts for database operations (migrate, seed, reset, studio)
9. THE Backend_Container SHALL support running Prisma Studio on port 5555 for database inspection
10. THE Backend SHALL document database setup commands in README.md

### Requirement 47: Docker Build Optimization

**User Story:** As a developer, I want fast Docker builds and minimal image sizes, so that development workflow is efficient.

#### Acceptance Criteria

1. THE Backend_Dockerfile SHALL use multi-stage build with separate build and runtime stages
2. THE Backend_Dockerfile SHALL copy package.json and package-lock.json before source code for layer caching
3. THE Backend_Dockerfile SHALL run npm ci instead of npm install for reproducible builds
4. THE Backend_Dockerfile SHALL use .dockerignore to exclude node_modules, dist, .git, and .env files
5. THE Backend_Dockerfile SHALL install only production dependencies in final stage
6. THE Backend_Dockerfile SHALL use alpine-based images to minimize size
7. THE Backend_Dockerfile SHALL set appropriate labels for image metadata
8. THE Docker_Compose SHALL use build cache for faster rebuilds
9. THE Backend_Dockerfile SHALL combine RUN commands to reduce layer count
10. THE Backend_Dockerfile SHALL remove build artifacts and cache after compilation

### Requirement 48: Docker Development vs Production Separation

**User Story:** As a developer, I want clear separation between development and production Docker configurations, so that production deployments remain secure and optimized.

#### Acceptance Criteria

1. THE Backend SHALL provide separate docker-compose.yml for development and docker-compose.prod.yml for production
2. THE Development_Configuration SHALL use local PostgreSQL and Redis containers
3. THE Production_Configuration SHALL use managed Supabase PostgreSQL and Upstash Redis
4. THE Development_Configuration SHALL enable hot reload and debugging features
5. THE Production_Configuration SHALL use optimized production builds without dev dependencies
6. THE Development_Configuration SHALL expose all ports for debugging and inspection
7. THE Production_Configuration SHALL expose only necessary ports with proper security
8. THE Development_Configuration SHALL use verbose logging for debugging
9. THE Production_Configuration SHALL use structured logging with appropriate log levels
10. THE Backend SHALL document differences between development and production configurations

### Requirement 49: Docker Networking and Port Management

**User Story:** As a developer, I want predictable port assignments and network configuration, so that services don't conflict with other local applications.

#### Acceptance Criteria

1. THE Docker_Compose SHALL map PostgreSQL container port 5432 to host port 5432
2. THE Docker_Compose SHALL map Redis container port 6379 to host port 6379
3. THE Docker_Compose SHALL map Backend container port 3001 to host port 3001
4. THE Docker_Compose SHALL map Frontend container port 3000 to host port 3000
5. THE Docker_Compose SHALL document port assignments in README.md
6. THE Docker_Compose SHALL allow port overrides through environment variables
7. THE Backend_Container SHALL bind to 0.0.0.0 to accept connections from other containers
8. THE Docker_Compose SHALL configure network mode as bridge for isolation
9. THE Docker_Compose SHALL enable IPv4 forwarding for container networking
10. THE Docker_Compose SHALL document how to resolve port conflicts

### Requirement 50: Docker Logging and Monitoring

**User Story:** As a developer, I want comprehensive logging from Docker containers, so that I can debug issues effectively.

#### Acceptance Criteria

1. THE Backend_Container SHALL log all HTTP requests with method, path, status, and duration
2. THE Backend_Container SHALL log database queries in development mode
3. THE Backend_Container SHALL log Redis operations in development mode
4. THE PostgreSQL_Container SHALL log slow queries exceeding 1 second
5. THE Docker_Compose SHALL configure logging driver as json-file with rotation
6. THE Docker_Compose SHALL limit log file size to 10MB per container
7. THE Docker_Compose SHALL keep maximum 3 log files per container
8. THE Backend_Container SHALL use colored console output for better readability
9. THE Backend_Container SHALL log container startup time and health status
10. THE Backend SHALL provide docker-compose logs commands in README.md for troubleshooting

### Requirement 51: Docker Health Checks and Restart Policies

**User Story:** As a developer, I want containers to automatically recover from failures, so that the development environment is resilient.

#### Acceptance Criteria

1. THE PostgreSQL_Container SHALL implement health check that runs every 10 seconds
2. THE Redis_Container SHALL implement health check that runs every 10 seconds
3. THE Backend_Container SHALL implement health check using /health endpoint
4. THE Backend_Container SHALL wait for PostgreSQL and Redis to be healthy before starting
5. THE Docker_Compose SHALL set restart policy to unless-stopped for all services
6. WHEN container health check fails 3 consecutive times, THE Docker_Compose SHALL mark container as unhealthy
7. THE Backend_Container SHALL exit with non-zero code on fatal errors to trigger restart
8. THE Docker_Compose SHALL set health check timeout to 5 seconds
9. THE Docker_Compose SHALL set health check start period to 30 seconds for initial startup
10. THE Backend SHALL log health check status to console

### Requirement 52: Docker Volume Management and Data Persistence

**User Story:** As a developer, I want database data to persist across container restarts, so that I don't lose development data.

#### Acceptance Criteria

1. THE Docker_Compose SHALL create named volume postgres_data for PostgreSQL data
2. THE Docker_Compose SHALL create named volume redis_data for Redis data
3. THE Docker_Compose SHALL mount postgres_data to /var/lib/postgresql/data in PostgreSQL container
4. THE Docker_Compose SHALL mount redis_data to /data in Redis container
5. THE Backend SHALL provide commands to backup and restore PostgreSQL data
6. THE Backend SHALL provide commands to clear all volumes for fresh start
7. THE Docker_Compose SHALL use bind mounts for source code to enable hot reload
8. THE Docker_Compose SHALL use named volumes for node_modules to avoid host conflicts
9. THE Backend SHALL document volume management commands in README.md
10. THE Docker_Compose SHALL configure volume drivers for optimal performance

### Requirement 53: Docker Frontend and Chatbot Integration

**User Story:** As a developer, I want the Next.js frontend and Python chatbot to run in Docker alongside the backend, so that the entire stack is containerized.

#### Acceptance Criteria

1. THE Docker_Compose SHALL define a frontend service for Next.js application
2. THE Docker_Compose SHALL define an agentic-llm-chatbot service for Python chatbot
3. THE Frontend_Container SHALL use Node.js 20-alpine base image
4. THE Frontend_Container SHALL mount source code for hot reload
5. THE Frontend_Container SHALL set NEXT_PUBLIC_API_URL to http://backend:3001
6. THE Frontend_Container SHALL expose port 3000 for browser access
7. THE Agentic_LLM_Chatbot_Container SHALL use Python 3.11-slim base image
8. THE Agentic_LLM_Chatbot_Container SHALL mount source code for development
9. THE Agentic_LLM_Chatbot_Container SHALL set BACKEND_API_URL to http://backend:3001
10. THE Agentic_LLM_Chatbot_Container SHALL set AI_SERVICE_KEY environment variable for authentication
11. THE Frontend_Container SHALL wait for Backend health check before starting
12. THE Agentic_LLM_Chatbot_Container SHALL wait for Backend health check before starting
13. THE Docker_Compose SHALL document how to access frontend and chatbot in README.md
14. THE Frontend_Container SHALL support Next.js fast refresh in Docker
15. THE Agentic_LLM_Chatbot_Container SHALL support Python hot reload using watchdog or similar

### Requirement 54: Docker Development Commands and Scripts

**User Story:** As a developer, I want convenient commands to manage the Docker environment, so that common tasks are easy to perform.

#### Acceptance Criteria

1. THE Backend SHALL provide npm script "docker:up" that runs docker-compose up -d
2. THE Backend SHALL provide npm script "docker:down" that runs docker-compose down
3. THE Backend SHALL provide npm script "docker:logs" that runs docker-compose logs -f
4. THE Backend SHALL provide npm script "docker:build" that rebuilds all containers
5. THE Backend SHALL provide npm script "docker:reset" that removes volumes and rebuilds
6. THE Backend SHALL provide npm script "docker:migrate" that runs Prisma migrations in container
7. THE Backend SHALL provide npm script "docker:seed" that runs database seed in container
8. THE Backend SHALL provide npm script "docker:studio" that opens Prisma Studio
9. THE Backend SHALL provide npm script "docker:shell" that opens bash shell in backend container
10. THE Backend SHALL provide npm script "docker:psql" that opens PostgreSQL client
11. THE Backend SHALL provide npm script "docker:redis-cli" that opens Redis client
12. THE Backend SHALL document all Docker commands in README.md with examples
13. THE Backend SHALL provide Makefile as alternative to npm scripts for Docker operations
14. THE Backend SHALL provide docker-compose.override.yml for local customizations
15. THE Backend SHALL add docker-compose.override.yml to .gitignore
