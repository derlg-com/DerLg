# Requirements Document

## Introduction

The Telegram Transportation Management System is a Telegram Bot interface that enables transportation drivers to manage their availability status and trip assignments directly from their mobile phones without requiring a dedicated mobile application. Drivers interact with the bot through simple text commands and inline buttons to update their status (AVAILABLE, UNAVAILABLE, BUSY), view assigned trips, accept or reject trip assignments, and mark trips as complete. The system integrates with the existing DerLg backend NestJS API and shares the Supabase PostgreSQL database, ensuring real-time synchronization between driver status updates and the admin panel's fleet management interface. The bot provides a lightweight, accessible solution for drivers who may have limited smartphone capabilities or prefer not to install additional s.

## Glossary

- **Telegram_Bot**: A Telegram bot application that drivers interact with via the Telegram messaging platform to manage their work status and trip assignments
- **Driver**: A transportation service provider registered in the drivers table who operates vehicles and uses Telegram_Bot to update availability
- **Driver_Status**: The current availability state of a driver stored in drivers table with values: AVAILABLE (ready for assignments), UNAVAILABLE (off-duty), BUSY (currently on a trip)
- **Driver_Registration**: The process of linking a driver's Telegram account (telegram_id) to their driver profile in the drivers table
- **Trip_Assignment**: A booking allocation stored in driver_assignments table linking a driver_id to a booking_id with assignment details
- **Backend_API**: The NestJS API server that processes Telegram webhook requests and manages driver data via /v1/telegram/* endpoints
- **Webhook**: An HTTP POST endpoint that Telegram servers call when drivers send messages or interact with the bot
- **Inline_Keyboard**: Interactive buttons displayed in Telegram messages that drivers can tap to perform actions without typing commands
- **Command**: A text message starting with "/" that triggers specific bot actions (e.g., /start, /status, /online)
- **Callback_Query**: A response triggered when a driver taps an inline keyboard button, containing action data
- **Redis_PubSub**: A publish-subscribe messaging system used to broadcast driver status changes to the admin panel in real-time
- **Vehicle_Assignment**: The association between a driver and a specific vehicle from transportation_vehicles table stored in drivers.vehicle_id
- **Booking**: A customer reservation record from bookings table that can be assigned to drivers for fulfillment
- **Admin_Panel**: The web-based administrative interface that displays real-time driver status and manages assignments
- **Authentication_PIN**: A 4-6 digit personal identification number used to verify driver identity during registration
- **Session_State**: Temporary conversation context stored in Redis with key telegram_session:{telegram_id} to track multi-step interactions


## Requirements

### Requirement 1: Driver Registration and Authentication

**User Story:** As a driver, I want to register my Telegram account with the system using my driver ID and PIN, so that I can securely access the bot and manage my work status.

#### Acceptance Criteria

1. WHEN a driver sends `/start` command to Telegram_Bot for the first time, THE bot SHALL respond with a welcome message and prompt for driver_id and authentication_pin
2. THE driver SHALL send their credentials in format: `driver_id: <ID> pin: <PIN>` (e.g., "driver_id: DRV001 pin: 1234")
3. THE Telegram_Bot SHALL call Backend_API POST /v1/telegram/register with telegram_id, driver_id, and pin in request body
4. THE Backend_API SHALL verify the driver_id exists in drivers table and the pin matches drivers.auth_pin column
5. IF credentials are valid, THE Backend_API SHALL update drivers.telegram_id with the user's telegram_id and return success response
6. IF credentials are invalid, THE Backend_API SHALL return 401 Unauthorized and bot SHALL display error message "Invalid driver ID or PIN. Please try again."
7. WHEN registration succeeds, THE bot SHALL display confirmation message with driver name, assigned vehicle, and current status
8. THE Backend_API SHALL store the telegram_id to driver_id mapping in Redis with key telegram_driver:{telegram_id} for 30 days
9. WHEN a registered driver sends `/start` again, THE bot SHALL display their current status dashboard instead of registration prompt
10. THE Backend_API SHALL create an audit_logs record with action_type DRIVER_TELEGRAM_REGISTERED when registration completes


### Requirement 2: Driver Status Management

**User Story:** As a driver, I want to update my availability status through simple commands, so that the dispatch team knows when I am available for trip assignments.

#### Acceptance Criteria

1. WHEN a registered driver sends `/online` command, THE Telegram_Bot SHALL call Backend_API POST /v1/telegram/status with telegram_id and status: "AVAILABLE"
2. THE Backend_API SHALL update drivers.status to AVAILABLE and drivers.last_status_update to current timestamp
3. THE Backend_API SHALL publish message to Redis channel driver_status_changed:{driver_id} with payload {driver_id, status: "AVAILABLE", timestamp}
4. THE bot SHALL respond with confirmation message: "✅ You are now ONLINE and available for trips"
5. WHEN a driver sends `/offline` command, THE Telegram_Bot SHALL call Backend_API POST /v1/telegram/status with status: "UNAVAILABLE"
6. THE Backend_API SHALL verify the driver has no active assignments in driver_assignments table with completion_timestamp IS NULL
7. IF driver has active assignments, THE Backend_API SHALL return 409 Conflict and bot SHALL display "❌ Cannot go offline. You have an active trip. Complete it first."
8. IF no active assignments, THE Backend_API SHALL update status to UNAVAILABLE and bot SHALL confirm "✅ You are now OFFLINE"
9. WHEN a driver sends `/status` command, THE bot SHALL call Backend_API GET /v1/telegram/driver-info?telegram_id={telegram_id}
10. THE bot SHALL display current status, assigned vehicle name, and last status update time
11. THE bot SHALL include inline keyboard buttons: [Go Online] [Go Offline] [View Trips]
12. WHEN a driver taps inline button, THE bot SHALL process the callback_query and execute corresponding action without requiring text command
13. THE Backend_API SHALL create audit_logs records for all status changes with action_type DRIVER_STATUS_CHANGE


### Requirement 3: Trip Assignment Notifications

**User Story:** As a driver, I want to receive instant notifications when I am assigned to a trip, so that I can accept or reject the assignment promptly.

#### Acceptance Criteria

1. WHEN an admin assigns a driver to a booking via Admin_Panel POST /v1/admin/assignments, THE Backend_API SHALL create record in driver_assignments table
2. THE Backend_API SHALL retrieve the driver's telegram_id from drivers table
3. THE Backend_API SHALL send Telegram notification via Telegram Bot API sendMessage to the driver's telegram_id
4. THE notification message SHALL include: pickup location, destination, pickup time, customer name, number of passengers, and booking reference
5. THE notification SHALL include inline keyboard with buttons: [Accept Trip] [Reject Trip]
6. WHEN driver taps [Accept Trip], THE bot SHALL call Backend_API POST /v1/telegram/assignments/:assignment_id/accept
7. THE Backend_API SHALL update driver_assignments.status to ACCEPTED and drivers.status to BUSY
8. THE bot SHALL send confirmation: "✅ Trip accepted. Customer has been notified. Pickup at {location} at {time}"
9. WHEN driver taps [Reject Trip], THE bot SHALL call Backend_API POST /v1/telegram/assignments/:assignment_id/reject with optional reason
10. THE Backend_API SHALL update driver_assignments.status to REJECTED and drivers.status back to AVAILABLE
11. THE Backend_API SHALL notify Admin_Panel via WebSocket that assignment was rejected
12. THE bot SHALL send confirmation: "❌ Trip rejected. Dispatch has been notified."
13. IF driver does not respond within 5 minutes, THE Backend_API SHALL auto-reject and notify admin via WebSocket
14. THE Backend_API SHALL create audit_logs records for accept/reject actions with action_type TRIP_ACCEPTED or TRIP_REJECTED


### Requirement 4: Active Trip Management

**User Story:** As a driver, I want to view my current trip details and mark trips as complete, so that I can manage my assignments and become available for new trips.

#### Acceptance Criteria

1. WHEN a driver sends `/mytrip` command, THE bot SHALL call Backend_API GET /v1/telegram/assignments/active?telegram_id={telegram_id}
2. THE Backend_API SHALL query driver_assignments table for records with driver's driver_id, status ACCEPTED, and completion_timestamp IS NULL
3. IF an active trip exists, THE bot SHALL display: booking reference, customer name, pickup location, destination, pickup time, customer phone, and special requests
4. THE bot SHALL include inline keyboard buttons: [Start Trip] [Complete Trip] [Contact Support]
5. IF no active trip exists, THE bot SHALL display "No active trips. Status: {current_status}" with [Go Online] button if status is UNAVAILABLE
6. WHEN driver taps [Start Trip], THE bot SHALL call Backend_API POST /v1/telegram/assignments/:assignment_id/start
7. THE Backend_API SHALL update driver_assignments.trip_start_time to current timestamp and bookings.status to IN_PROGRESS
8. THE bot SHALL confirm "🚗 Trip started. Drive safely!" and display trip details with [Complete Trip] button
9. WHEN driver taps [Complete Trip], THE bot SHALL call Backend_API POST /v1/telegram/assignments/:assignment_id/complete
10. THE Backend_API SHALL update driver_assignments.completion_timestamp, bookings.status to COMPLETED, and drivers.status to AVAILABLE
11. THE bot SHALL display "✅ Trip completed! You are now available for new assignments." with trip summary (duration, distance if available)
12. THE Backend_API SHALL publish to Redis channel driver_status_changed:{driver_id} with status AVAILABLE
13. THE Backend_API SHALL create audit_logs records for trip start and completion with action_type TRIP_STARTED and TRIP_COMPLETED


### Requirement 5: Trip History and Earnings

**User Story:** As a driver, I want to view my completed trips and earnings summary, so that I can track my work performance and income.

#### Acceptance Criteria

1. WHEN a driver sends `/history` command, THE bot SHALL call Backend_API GET /v1/telegram/assignments/history?telegram_id={telegram_id}&limit=10
2. THE Backend_API SHALL query driver_assignments table for records with driver's driver_id and completion_timestamp IS NOT NULL, ordered by completion_timestamp DESC
3. THE bot SHALL display list of last 10 completed trips with: date, booking reference, route (pickup → destination), and duration
4. THE bot SHALL include inline keyboard buttons: [Today's Summary] [This Week] [This Month]
5. WHEN driver taps [Today's Summary], THE bot SHALL call Backend_API GET /v1/telegram/earnings/today?telegram_id={telegram_id}
6. THE Backend_API SHALL calculate total trips completed today, total hours worked, and estimated earnings from driver_assignments joined with bookings
7. THE bot SHALL display: "📊 Today's Summary\n✅ Trips: {count}\n⏱ Hours: {hours}\n💰 Earnings: ${amount}"
8. WHEN driver taps [This Week] or [This Month], THE bot SHALL call corresponding endpoints with date range filters
9. THE Backend_API SHALL aggregate data from driver_assignments table filtered by completion_timestamp within the requested period
10. THE bot SHALL display weekly/monthly summary with same format as daily summary
11. IF no trips found for the period, THE bot SHALL display "No trips completed in this period."
12. THE bot SHALL include [View Details] button that shows breakdown of each trip's earnings


### Requirement 6: Emergency and Support Features

**User Story:** As a driver, I want to quickly contact support or report emergencies during trips, so that I can get help when needed.

#### Acceptance Criteria

1. WHEN a driver sends `/help` command, THE bot SHALL display list of available commands with descriptions
2. THE help message SHALL include: /start, /online, /offline, /status, /mytrip, /history, /emergency, /support
3. WHEN a driver sends `/emergency` command, THE bot SHALL call Backend_API POST /v1/telegram/emergency with telegram_id, current location (if shared), and timestamp
4. THE Backend_API SHALL create record in emergency_alerts table with driver_id, alert_type DRIVER_EMERGENCY, and status ACTIVE
5. THE Backend_API SHALL immediately notify Admin_Panel via WebSocket with driver details and last known location
6. THE bot SHALL respond: "🚨 Emergency alert sent to dispatch. They will contact you immediately. Stay safe!"
7. THE bot SHALL display emergency contact numbers: "Police: 117 | Ambulance: 119 | Tourist Police: 012 942 484"
8. WHEN a driver sends `/support` command, THE bot SHALL prompt: "Please describe your issue or question:"
9. THE bot SHALL store the next message in Redis session state with key telegram_session:{telegram_id}:support_request
10. WHEN driver sends the issue description, THE bot SHALL call Backend_API POST /v1/telegram/support with telegram_id, message, and current trip context
11. THE Backend_API SHALL create support ticket in a support_tickets table with driver_id, message, status OPEN, and priority based on keywords
12. THE bot SHALL confirm: "✅ Support ticket #{ticket_id} created. Our team will respond within 30 minutes."
13. THE Admin_Panel SHALL display new support tickets in real-time via WebSocket notification


### Requirement 7: Location Sharing and Tracking

**User Story:** As a driver, I want to share my live location during trips, so that dispatch and customers can track my progress.

#### Acceptance Criteria

1. WHEN a driver starts a trip, THE bot SHALL prompt: "📍 Share your live location for this trip?" with inline buttons [Share Location] [Skip]
2. WHEN driver taps [Share Location], THE bot SHALL request Telegram live location sharing permission
3. IF driver grants permission, THE Telegram platform SHALL send location updates to the bot webhook every 60 seconds
4. THE bot SHALL call Backend_API POST /v1/telegram/location with telegram_id, latitude, longitude, and timestamp for each update
5. THE Backend_API SHALL store location in Redis with key driver_location:{driver_id} with 5-minute TTL
6. THE Backend_API SHALL publish location update to Redis channel driver_location_updated:{driver_id}
7. THE Admin_Panel SHALL subscribe to location updates and display driver position on real-time map
8. WHEN trip is completed, THE bot SHALL automatically stop requesting location updates
9. WHEN a driver sends `/location` command during active trip, THE bot SHALL display map with current location and destination
10. THE bot SHALL show estimated time to destination and distance remaining (calculated by Backend_API using Google Maps API)
11. IF driver has not shared location, THE bot SHALL prompt to enable location sharing with [Share Now] button
12. THE Backend_API SHALL NOT store historical location data beyond current trip for privacy compliance


### Requirement 8: Multi-language Support

**User Story:** As a driver, I want to use the bot in my preferred language (Khmer, English, or Chinese), so that I can understand all messages and instructions clearly.

#### Acceptance Criteria

1. WHEN a driver first registers, THE bot SHALL detect Telegram client language from telegram_user.language_code
2. IF language_code is "km", THE bot SHALL set default language to Khmer; if "zh", set to Chinese; otherwise set to English
3. THE bot SHALL store language preference in drivers.preferred_language column
4. WHEN a driver sends `/language` command, THE bot SHALL display inline keyboard with options: [🇰🇭 ខ្មែរ] [🇬🇧 English] [🇨🇳 中文]
5. WHEN driver selects a language, THE bot SHALL call Backend_API PATCH /v1/telegram/settings with telegram_id and preferred_language
6. THE Backend_API SHALL update drivers.preferred_language and confirm change
7. THE bot SHALL respond in the newly selected language: "✅ Language changed to {language}"
8. ALL subsequent bot messages SHALL be displayed in the driver's preferred_language
9. THE bot SHALL load translations from JSON files: telegram_bot_km.json, telegram_bot_en.json, telegram_bot_zh.json
10. THE translation files SHALL include all command responses, button labels, error messages, and notification templates
11. THE bot SHALL use i18n library (e.g., node-telegram-bot-api with i18next) to manage translations
12. IF a translation is missing for a specific language, THE bot SHALL fall back to English


### Requirement 9: Webhook Security and Rate Limiting

**User Story:** As a system administrator, I want the Telegram webhook to be secure and rate-limited, so that the system is protected from unauthorized access and abuse.

#### Acceptance Criteria

1. THE Backend_API SHALL expose webhook endpoint POST /v1/telegram/webhook to receive updates from Telegram servers
2. THE Backend_API SHALL verify webhook requests using Telegram Bot API secret token in X-Telegram-Bot-Api-Secret-Token header
3. IF the secret token is invalid or missing, THE Backend_API SHALL return 403 Forbidden and reject the request
4. THE Backend_API SHALL validate webhook payload structure matches Telegram Update object schema
5. IF payload is malformed, THE Backend_API SHALL return 400 Bad Request and log the error
6. THE Backend_API SHALL implement rate limiting of 30 requests per minute per telegram_id using Redis
7. IF rate limit is exceeded, THE Backend_API SHALL return 429 Too Many Requests and bot SHALL display "⚠️ Too many requests. Please wait a moment."
8. THE Backend_API SHALL set webhook URL using Telegram Bot API setWebhook with secret_token parameter during application startup
9. THE webhook URL SHALL use HTTPS with valid SSL certificate (required by Telegram)
10. THE Backend_API SHALL process webhook updates asynchronously using Bull queue to prevent blocking
11. THE Backend_API SHALL acknowledge webhook requests with 200 OK within 1 second, then process in background
12. THE Backend_API SHALL log all webhook requests with telegram_id, update_type, and timestamp for audit purposes
13. THE Backend_API SHALL implement idempotency by checking update_id in Redis to prevent duplicate processing


### Requirement 10: Admin Broadcast Messaging

**User Story:** As an Operations Manager, I want to send broadcast messages to all drivers or specific driver groups, so that I can communicate important updates efficiently.

#### Acceptance Criteria

1. THE Admin_Panel SHALL provide a "Send Broadcast" interface accessible to OPERATIONS_MANAGER and SUPER_ADMIN roles
2. THE Admin_Panel SHALL allow admin to compose message with text, optional image, and target audience selection
3. THE target audience options SHALL include: All Drivers, Online Drivers Only, Offline Drivers, Drivers by Vehicle Type (VAN, BUS, TUK_TUK)
4. WHEN admin sends broadcast, THE Admin_Panel SHALL call Backend_API POST /v1/admin/telegram/broadcast with message, target_filter, and admin_user_id
5. THE Backend_API SHALL query drivers table based on target_filter to get list of telegram_ids
6. THE Backend_API SHALL create broadcast_messages table record with message_id, content, target_filter, sent_by (admin_user_id), and status PENDING
7. THE Backend_API SHALL queue broadcast job in Bull queue with telegram_ids array
8. THE background job SHALL send message to each telegram_id using Telegram Bot API sendMessage with rate limit of 30 messages per second
9. THE job SHALL update broadcast_messages.sent_count after each successful send and broadcast_messages.failed_count for failures
10. WHEN broadcast completes, THE job SHALL update broadcast_messages.status to COMPLETED and broadcast_messages.completed_at timestamp
11. THE Admin_Panel SHALL display broadcast history with sent_count, failed_count, and delivery status
12. THE bot SHALL display broadcast messages with header: "📢 Message from DerLg Dispatch:" to distinguish from regular notifications
13. THE Backend_API SHALL create audit_logs record with action_type BROADCAST_SENT including message content and recipient count


## Non-Functional Requirements

### Performance

1. THE Telegram_Bot SHALL respond to driver commands within 2 seconds under normal load
2. THE Backend_API webhook endpoint SHALL process incoming updates within 1 second and return 200 OK
3. THE system SHALL support up to 500 concurrent active drivers without performance degradation
4. THE Redis pub/sub SHALL deliver driver status updates to Admin_Panel within 5 seconds
5. THE broadcast messaging system SHALL send messages at rate of 30 messages per second to comply with Telegram API limits

### Reliability

1. THE Telegram_Bot SHALL have 99.5% uptime availability
2. THE Backend_API SHALL implement retry logic with exponential backoff for failed Telegram API calls (max 3 retries)
3. THE system SHALL queue webhook updates in Bull queue with Redis persistence to prevent message loss during downtime
4. THE system SHALL automatically reconnect to Telegram webhook if connection is lost
5. THE system SHALL log all errors to Sentry for monitoring and alerting

### Security

1. THE Backend_API SHALL validate all webhook requests using Telegram secret token
2. THE system SHALL NOT store driver passwords or sensitive personal information in plain text
3. THE authentication PIN SHALL be hashed using bcrypt with salt rounds of 10 before storage in drivers.auth_pin
4. THE system SHALL implement rate limiting of 30 requests per minute per telegram_id to prevent abuse
5. THE system SHALL use HTTPS for all webhook communications with valid SSL certificate
6. THE system SHALL sanitize all user inputs to prevent injection attacks

### Scalability

1. THE system SHALL be designed to scale horizontally by adding more Backend_API instances behind load balancer
2. THE Redis instance SHALL be configured with persistence (AOF) to prevent data loss
3. THE Bull queue SHALL support multiple worker processes for parallel message processing
4. THE system SHALL use database connection pooling with max 20 connections per Backend_API instance

### Usability

1. THE bot interface SHALL be intuitive with clear command descriptions and inline keyboard buttons
2. THE bot SHALL provide helpful error messages with suggested actions when commands fail
3. THE bot SHALL support multi-language interface (Khmer, English, Chinese) with automatic language detection
4. THE bot SHALL use emojis and formatting (bold, italic) to improve message readability
5. THE bot SHALL provide contextual help with /help command showing all available commands

### Maintainability

1. THE Telegram_Bot code SHALL be organized in modular structure with separate handlers for each command
2. THE Backend_API SHALL follow NestJS module structure with telegram module containing all bot-related logic
3. THE system SHALL use environment variables for configuration (bot token, webhook URL, secret token)
4. THE system SHALL include comprehensive logging for debugging and monitoring
5. THE translation files SHALL be stored in JSON format for easy updates without code changes


## Database Schema Changes

### New Tables

#### drivers
```sql
CREATE TABLE drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id VARCHAR(50) UNIQUE NOT NULL,
  driver_name VARCHAR(255) NOT NULL,
  telegram_id BIGINT UNIQUE,
  phone VARCHAR(20) NOT NULL,
  auth_pin VARCHAR(255) NOT NULL, -- bcrypt hashed
  vehicle_id UUID REFERENCES transportation_vehicles(id),
  status VARCHAR(20) DEFAULT 'UNAVAILABLE' CHECK (status IN ('AVAILABLE', 'UNAVAILABLE', 'BUSY')),
  preferred_language VARCHAR(5) DEFAULT 'en' CHECK (preferred_language IN ('en', 'km', 'zh')),
  last_status_update TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_drivers_telegram_id ON drivers(telegram_id);
CREATE INDEX idx_drivers_status ON drivers(status);
CREATE INDEX idx_drivers_vehicle_id ON drivers(vehicle_id);
```

#### driver_assignments
```sql
CREATE TABLE driver_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES drivers(id),
  booking_id UUID NOT NULL REFERENCES bookings(id),
  vehicle_id UUID NOT NULL REFERENCES transportation_vehicles(id),
  status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'COMPLETED', 'CANCELLED')),
  assignment_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  response_timestamp TIMESTAMP WITH TIME ZONE,
  trip_start_time TIMESTAMP WITH TIME ZONE,
  completion_timestamp TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_driver_assignments_driver_id ON driver_assignments(driver_id);
CREATE INDEX idx_driver_assignments_booking_id ON driver_assignments(booking_id);
CREATE INDEX idx_driver_assignments_status ON driver_assignments(status);
```

#### support_tickets
```sql
CREATE TABLE support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id VARCHAR(20) UNIQUE NOT NULL,
  driver_id UUID NOT NULL REFERENCES drivers(id),
  message TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')),
  priority VARCHAR(20) DEFAULT 'NORMAL' CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
  assigned_to UUID REFERENCES users(id),
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_support_tickets_driver_id ON support_tickets(driver_id);
CREATE INDEX idx_support_tickets_status ON support_tickets(status);
```

#### broadcast_messages
```sql
CREATE TABLE broadcast_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id VARCHAR(50) UNIQUE NOT NULL,
  content TEXT NOT NULL,
  image_url VARCHAR(500),
  target_filter JSONB NOT NULL, -- {type: 'all' | 'online' | 'offline' | 'vehicle_type', value: 'VAN' | 'BUS' | 'TUK_TUK'}
  sent_by UUID NOT NULL REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED')),
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_broadcast_messages_sent_by ON broadcast_messages(sent_by);
CREATE INDEX idx_broadcast_messages_status ON broadcast_messages(status);
```

### Modified Tables

#### emergency_alerts (add driver support)
```sql
ALTER TABLE emergency_alerts ADD COLUMN driver_id UUID REFERENCES drivers(id);
CREATE INDEX idx_emergency_alerts_driver_id ON emergency_alerts(driver_id);
```


## API Endpoints

### Telegram Webhook Endpoints (Backend)

#### POST /v1/telegram/webhook
Receives updates from Telegram servers (messages, callback queries, location updates)
- **Auth**: Telegram secret token in X-Telegram-Bot-Api-Secret-Token header
- **Request Body**: Telegram Update object
- **Response**: 200 OK (immediate acknowledgment)

#### POST /v1/telegram/register
Registers driver's Telegram account with driver profile
- **Auth**: None (public endpoint)
- **Request Body**: `{ telegram_id: number, driver_id: string, pin: string }`
- **Response**: `{ success: boolean, driver: { id, name, vehicle, status } }`

#### POST /v1/telegram/status
Updates driver availability status
- **Auth**: Telegram ID validation
- **Request Body**: `{ telegram_id: number, status: 'AVAILABLE' | 'UNAVAILABLE' }`
- **Response**: `{ success: boolean, status: string, timestamp: string }`

#### GET /v1/telegram/driver-info
Retrieves driver profile and current status
- **Auth**: Telegram ID validation
- **Query Params**: `telegram_id: number`
- **Response**: `{ driver_id, name, vehicle, status, last_update, active_trip }`

#### GET /v1/telegram/assignments/active
Gets driver's current active trip assignment
- **Auth**: Telegram ID validation
- **Query Params**: `telegram_id: number`
- **Response**: `{ assignment_id, booking, pickup, destination, customer, time }`

#### POST /v1/telegram/assignments/:id/accept
Accepts trip assignment
- **Auth**: Telegram ID validation
- **Response**: `{ success: boolean, trip_details }`

#### POST /v1/telegram/assignments/:id/reject
Rejects trip assignment
- **Auth**: Telegram ID validation
- **Request Body**: `{ reason?: string }`
- **Response**: `{ success: boolean }`

#### POST /v1/telegram/assignments/:id/start
Marks trip as started
- **Auth**: Telegram ID validation
- **Response**: `{ success: boolean, start_time: string }`

#### POST /v1/telegram/assignments/:id/complete
Marks trip as completed
- **Auth**: Telegram ID validation
- **Response**: `{ success: boolean, completion_time: string, summary }`

#### GET /v1/telegram/assignments/history
Gets driver's trip history
- **Auth**: Telegram ID validation
- **Query Params**: `telegram_id: number, limit?: number, offset?: number`
- **Response**: `{ trips: Array<Assignment>, total: number }`

#### GET /v1/telegram/earnings/today
Gets today's earnings summary
- **Auth**: Telegram ID validation
- **Query Params**: `telegram_id: number`
- **Response**: `{ trips_count, hours_worked, estimated_earnings }`

#### GET /v1/telegram/earnings/week
Gets weekly earnings summary
- **Auth**: Telegram ID validation
- **Query Params**: `telegram_id: number`
- **Response**: `{ trips_count, hours_worked, estimated_earnings, breakdown }`

#### POST /v1/telegram/location
Updates driver's current location
- **Auth**: Telegram ID validation
- **Request Body**: `{ telegram_id: number, latitude: number, longitude: number }`
- **Response**: `{ success: boolean }`

#### POST /v1/telegram/emergency
Creates emergency alert
- **Auth**: Telegram ID validation
- **Request Body**: `{ telegram_id: number, location?: { lat, lng } }`
- **Response**: `{ success: boolean, alert_id: string }`

#### POST /v1/telegram/support
Creates support ticket
- **Auth**: Telegram ID validation
- **Request Body**: `{ telegram_id: number, message: string }`
- **Response**: `{ success: boolean, ticket_id: string }`

#### PATCH /v1/telegram/settings
Updates driver preferences
- **Auth**: Telegram ID validation
- **Request Body**: `{ telegram_id: number, preferred_language?: string }`
- **Response**: `{ success: boolean }`

### Admin Panel Endpoints (Backend)

#### POST /v1/admin/telegram/broadcast
Sends broadcast message to drivers
- **Auth**: JWT (OPERATIONS_MANAGER or SUPER_ADMIN)
- **Request Body**: `{ message: string, image_url?: string, target_filter: object }`
- **Response**: `{ success: boolean, message_id: string, queued_count: number }`

#### GET /v1/admin/telegram/broadcasts
Lists broadcast message history
- **Auth**: JWT (OPERATIONS_MANAGER or SUPER_ADMIN)
- **Query Params**: `limit?: number, offset?: number`
- **Response**: `{ broadcasts: Array<BroadcastMessage>, total: number }`

#### GET /v1/admin/drivers
Lists all drivers with status
- **Auth**: JWT (FLEET_MANAGER or higher)
- **Query Params**: `status?: string, vehicle_type?: string`
- **Response**: `{ drivers: Array<Driver>, total: number }`

#### POST /v1/admin/drivers
Creates new driver profile
- **Auth**: JWT (FLEET_MANAGER or higher)
- **Request Body**: `{ driver_id, driver_name, phone, vehicle_id, auth_pin }`
- **Response**: `{ success: boolean, driver: Driver }`

#### PATCH /v1/admin/drivers/:id
Updates driver profile
- **Auth**: JWT (FLEET_MANAGER or higher)
- **Request Body**: `{ driver_name?, phone?, vehicle_id?, status? }`
- **Response**: `{ success: boolean, driver: Driver }`

#### POST /v1/admin/assignments
Creates trip assignment for driver
- **Auth**: JWT (OPERATIONS_MANAGER or higher)
- **Request Body**: `{ driver_id, booking_id, vehicle_id }`
- **Response**: `{ success: boolean, assignment: Assignment }`


## Technical Architecture

### System Components

```
┌─────────────────┐
│  Telegram App   │ (Driver's phone)
│   (Driver UI)   │
└────────┬────────┘
         │ HTTPS
         ▼
┌─────────────────┐
│ Telegram Server │
│   (Bot API)     │
└────────┬────────┘
         │ Webhook (HTTPS)
         ▼
┌─────────────────────────────────────────┐
│         NestJS Backend API              │
│  ┌───────────────────────────────────┐  │
│  │   Telegram Module                 │  │
│  │  - Webhook Handler                │  │
│  │  - Command Processors             │  │
│  │  - Message Sender                 │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │   Driver Service                  │  │
│  │  - Status Management              │  │
│  │  - Assignment Logic               │  │
│  └───────────────────────────────────┘  │
└────┬──────────────┬──────────────┬──────┘
     │              │              │
     ▼              ▼              ▼
┌─────────┐   ┌─────────┐   ┌──────────┐
│ Supabase│   │  Redis  │   │   Bull   │
│   DB    │   │ Cache & │   │  Queue   │
│         │   │ Pub/Sub │   │          │
└─────────┘   └─────────┘   └──────────┘
                    │
                    │ WebSocket
                    ▼
            ┌──────────────┐
            │ Admin Panel  │
            │  (Next.js)   │
            └──────────────┘
```

### Technology Stack

#### Telegram Bot
- **Library**: `node-telegram-bot-api` (Node.js Telegram Bot API wrapper)
- **Alternative**: `telegraf` (modern Telegram bot framework)
- **Language**: TypeScript
- **Runtime**: Node.js 18+

#### Backend Integration
- **Framework**: NestJS 11 (existing)
- **Module**: New `telegram` module in `backend/src/telegram/`
- **Queue**: Bull (Redis-based job queue for async processing)
- **WebSocket**: Socket.io (for real-time updates to Admin Panel)

#### Database
- **Primary**: Supabase PostgreSQL (existing)
- **Cache**: Redis (Upstash) for session state, rate limiting, pub/sub
- **ORM**: Prisma 5 (existing)

#### External Services
- **Telegram Bot API**: https://api.telegram.org/bot{token}/
- **Webhook**: HTTPS endpoint on Backend API
- **SSL**: Let's Encrypt or Railway/Vercel automatic SSL

### Module Structure

```
backend/src/telegram/
├── telegram.module.ts
├── telegram.controller.ts       # Webhook endpoint
├── telegram.service.ts          # Core bot logic
├── handlers/
│   ├── command.handler.ts       # /start, /status, /online, etc.
│   ├── callback.handler.ts      # Inline button callbacks
│   ├── location.handler.ts      # Location updates
│   └── message.handler.ts       # Text messages
├── services/
│   ├── bot-sender.service.ts    # Send messages to drivers
│   ├── driver-status.service.ts # Status management
│   ├── assignment.service.ts    # Trip assignment logic
│   └── broadcast.service.ts     # Broadcast messaging
├── dto/
│   ├── webhook.dto.ts
│   ├── register.dto.ts
│   ├── status-update.dto.ts
│   └── assignment.dto.ts
├── guards/
│   └── telegram-auth.guard.ts   # Validate telegram_id
└── jobs/
    ├── broadcast.processor.ts   # Process broadcast queue
    └── assignment-timeout.processor.ts
```

### Redis Data Structures

#### Session State
```
Key: telegram_session:{telegram_id}
Type: Hash
TTL: 1 hour
Fields: { state, data, language, last_command }
```

#### Driver Location
```
Key: driver_location:{driver_id}
Type: Hash
TTL: 5 minutes
Fields: { latitude, longitude, timestamp, accuracy }
```

#### Rate Limiting
```
Key: telegram_rate:{telegram_id}
Type: String (counter)
TTL: 1 minute
Value: request count
```

#### Driver Mapping
```
Key: telegram_driver:{telegram_id}
Type: String
TTL: 30 days
Value: driver_id (UUID)
```

#### Pub/Sub Channels
```
driver_status_changed:{driver_id}
driver_location_updated:{driver_id}
assignment_created:{driver_id}
```

### Environment Variables

```env
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
TELEGRAM_WEBHOOK_URL=https://your-domain.com/v1/telegram/webhook
TELEGRAM_SECRET_TOKEN=random_32_char_secret
TELEGRAM_WEBHOOK_MAX_CONNECTIONS=40

# Redis Configuration (existing)
REDIS_URL=redis://...
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# Feature Flags
TELEGRAM_BOT_ENABLED=true
TELEGRAM_LOCATION_TRACKING_ENABLED=true
TELEGRAM_BROADCAST_ENABLED=true
```

## Dependencies

### New NPM Packages (Backend)

```json
{
  "dependencies": {
    "node-telegram-bot-api": "^0.64.0",
    "@bull-board/api": "^5.10.0",
    "@bull-board/nestjs": "^5.10.0",
    "bull": "^4.11.5",
    "i18next": "^23.7.6",
    "i18next-fs-backend": "^2.3.0"
  },
  "devDependencies": {
    "@types/node-telegram-bot-api": "^0.64.0"
  }
}
```

### Translation Files

```
backend/src/telegram/locales/
├── en.json
├── km.json
└── zh.json
```

### Prisma Schema Updates

Add to `backend/prisma/schema.prisma`:

```prisma
model Driver {
  id                 String              @id @default(uuid()) @db.Uuid
  driverId           String              @unique @map("driver_id") @db.VarChar(50)
  driverName         String              @map("driver_name") @db.VarChar(255)
  telegramId         BigInt?             @unique @map("telegram_id")
  phone              String              @db.VarChar(20)
  authPin            String              @map("auth_pin") @db.VarChar(255)
  vehicleId          String?             @map("vehicle_id") @db.Uuid
  status             DriverStatus        @default(UNAVAILABLE)
  preferredLanguage  String              @default("en") @map("preferred_language") @db.VarChar(5)
  lastStatusUpdate   DateTime?           @map("last_status_update") @db.Timestamptz
  createdAt          DateTime            @default(now()) @map("created_at") @db.Timestamptz
  updatedAt          DateTime            @updatedAt @map("updated_at") @db.Timestamptz

  vehicle            TransportationVehicle? @relation(fields: [vehicleId], references: [id])
  assignments        DriverAssignment[]
  supportTickets     SupportTicket[]
  emergencyAlerts    EmergencyAlert[]

  @@index([telegramId])
  @@index([status])
  @@index([vehicleId])
  @@map("drivers")
}

enum DriverStatus {
  AVAILABLE
  UNAVAILABLE
  BUSY
}

model DriverAssignment {
  id                   String              @id @default(uuid()) @db.Uuid
  driverId             String              @map("driver_id") @db.Uuid
  bookingId            String              @map("booking_id") @db.Uuid
  vehicleId            String              @map("vehicle_id") @db.Uuid
  status               AssignmentStatus    @default(PENDING)
  assignmentTimestamp  DateTime            @default(now()) @map("assignment_timestamp") @db.Timestamptz
  responseTimestamp    DateTime?           @map("response_timestamp") @db.Timestamptz
  tripStartTime        DateTime?           @map("trip_start_time") @db.Timestamptz
  completionTimestamp  DateTime?           @map("completion_timestamp") @db.Timestamptz
  rejectionReason      String?             @map("rejection_reason") @db.Text
  createdAt            DateTime            @default(now()) @map("created_at") @db.Timestamptz
  updatedAt            DateTime            @updatedAt @map("updated_at") @db.Timestamptz

  driver               Driver              @relation(fields: [driverId], references: [id])
  booking              Booking             @relation(fields: [bookingId], references: [id])
  vehicle              TransportationVehicle @relation(fields: [vehicleId], references: [id])

  @@index([driverId])
  @@index([bookingId])
  @@index([status])
  @@map("driver_assignments")
}

enum AssignmentStatus {
  PENDING
  ACCEPTED
  REJECTED
  COMPLETED
  CANCELLED
}

model SupportTicket {
  id          String              @id @default(uuid()) @db.Uuid
  ticketId    String              @unique @map("ticket_id") @db.VarChar(20)
  driverId    String              @map("driver_id") @db.Uuid
  message     String              @db.Text
  status      TicketStatus        @default(OPEN)
  priority    TicketPriority      @default(NORMAL)
  assignedTo  String?             @map("assigned_to") @db.Uuid
  resolvedAt  DateTime?           @map("resolved_at") @db.Timestamptz
  createdAt   DateTime            @default(now()) @map("created_at") @db.Timestamptz
  updatedAt   DateTime            @updatedAt @map("updated_at") @db.Timestamptz

  driver      Driver              @relation(fields: [driverId], references: [id])
  assignee    User?               @relation(fields: [assignedTo], references: [id])

  @@index([driverId])
  @@index([status])
  @@map("support_tickets")
}

enum TicketStatus {
  OPEN
  IN_PROGRESS
  RESOLVED
  CLOSED
}

enum TicketPriority {
  LOW
  NORMAL
  HIGH
  URGENT
}

model BroadcastMessage {
  id            String              @id @default(uuid()) @db.Uuid
  messageId     String              @unique @map("message_id") @db.VarChar(50)
  content       String              @db.Text
  imageUrl      String?             @map("image_url") @db.VarChar(500)
  targetFilter  Json                @map("target_filter")
  sentBy        String              @map("sent_by") @db.Uuid
  status        BroadcastStatus     @default(PENDING)
  sentCount     Int                 @default(0) @map("sent_count")
  failedCount   Int                 @default(0) @map("failed_count")
  completedAt   DateTime?           @map("completed_at") @db.Timestamptz
  createdAt     DateTime            @default(now()) @map("created_at") @db.Timestamptz

  sender        User                @relation(fields: [sentBy], references: [id])

  @@index([sentBy])
  @@index([status])
  @@map("broadcast_messages")
}

enum BroadcastStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
  FAILED
}
```


## Implementation Phases

### Phase 1: Core Bot Setup and Authentication (Week 1)
- Set up Telegram bot with BotFather
- Create telegram module in NestJS backend
- Implement webhook endpoint with security validation
- Build driver registration flow (/start command)
- Create drivers table and Prisma models
- Implement authentication with driver_id and PIN
- Set up Redis for session management
- Test basic bot commands and responses

**Deliverables:**
- Working Telegram bot that responds to /start
- Driver registration and authentication working
- Webhook receiving and processing updates
- Database schema deployed

### Phase 2: Status Management and Real-time Updates (Week 2)
- Implement /online, /offline, /status commands
- Build driver status update logic in backend
- Set up Redis pub/sub for status changes
- Integrate WebSocket connection to Admin Panel
- Create real-time driver status dashboard in Admin Panel
- Implement inline keyboard buttons for status changes
- Add audit logging for status changes
- Test real-time synchronization between bot and admin panel

**Deliverables:**
- Drivers can update status via bot
- Admin panel shows real-time driver status
- Status changes logged in audit_logs
- WebSocket notifications working

### Phase 3: Trip Assignment and Management (Week 3)
- Create driver_assignments table
- Implement trip assignment notification system
- Build accept/reject trip flow with inline buttons
- Implement /mytrip command to view active trip
- Add trip start and completion functionality
- Build assignment timeout logic (5-minute auto-reject)
- Create assignment management UI in Admin Panel
- Test full trip lifecycle from assignment to completion

**Deliverables:**
- Drivers receive trip assignment notifications
- Accept/reject functionality working
- Trip start and completion tracking
- Admin can assign drivers to bookings
- Automatic status updates (BUSY when assigned, AVAILABLE when completed)

### Phase 4: Location Tracking and History (Week 4)
- Implement location sharing request on trip start
- Build location update handler for live tracking
- Store location in Redis with TTL
- Display driver location on Admin Panel map
- Implement /history command for trip history
- Build earnings summary endpoints (today, week, month)
- Create trip history view in bot
- Test location tracking accuracy and performance

**Deliverables:**
- Live location tracking during trips
- Admin can see driver location on map
- Drivers can view trip history
- Earnings summary available

### Phase 5: Support and Emergency Features (Week 5)
- Create support_tickets table
- Implement /help command with command list
- Build /emergency command and alert system
- Create /support command for ticket creation
- Implement support ticket management in Admin Panel
- Add emergency alert notifications to Admin Panel
- Test emergency flow end-to-end
- Add emergency contact information display

**Deliverables:**
- Emergency alert system functional
- Support ticket creation and management
- Admin receives real-time emergency notifications
- Help documentation accessible in bot

### Phase 6: Multi-language and Broadcast (Week 6)
- Set up i18next with translation files (en, km, zh)
- Implement /language command for language switching
- Translate all bot messages to Khmer and Chinese
- Create broadcast_messages table
- Build broadcast messaging system with Bull queue
- Implement broadcast UI in Admin Panel
- Add rate limiting for Telegram API compliance
- Test broadcasts to different driver segments

**Deliverables:**
- Bot supports English, Khmer, and Chinese
- Language switching working
- Broadcast messaging functional
- Admin can send targeted broadcasts

### Phase 7: Testing, Optimization, and Documentation (Week 7)
- Write unit tests for all telegram handlers
- Write integration tests for webhook processing
- Perform load testing with 100+ concurrent drivers
- Optimize Redis usage and database queries
- Add comprehensive error handling and logging
- Write API documentation for all endpoints
- Create driver onboarding guide
- Create admin user guide for telegram features

**Deliverables:**
- Test coverage > 80%
- Performance benchmarks met
- Complete documentation
- Production-ready system

## Testing Strategy

### Unit Tests

#### Backend Services
```typescript
// telegram.service.spec.ts
describe('TelegramService', () => {
  it('should register driver with valid credentials', async () => {
    const result = await telegramService.registerDriver({
      telegram_id: 123456789,
      driver_id: 'DRV001',
      pin: '1234'
    });
    expect(result.success).toBe(true);
    expect(result.driver.telegram_id).toBe(123456789);
  });

  it('should reject registration with invalid PIN', async () => {
    await expect(
      telegramService.registerDriver({
        telegram_id: 123456789,
        driver_id: 'DRV001',
        pin: 'wrong'
      })
    ).rejects.toThrow('Invalid credentials');
  });
});

// driver-status.service.spec.ts
describe('DriverStatusService', () => {
  it('should update driver status to AVAILABLE', async () => {
    const result = await driverStatusService.updateStatus('driver-uuid', 'AVAILABLE');
    expect(result.status).toBe('AVAILABLE');
    expect(result.last_status_update).toBeDefined();
  });

  it('should prevent going offline with active trip', async () => {
    await expect(
      driverStatusService.updateStatus('driver-with-active-trip', 'UNAVAILABLE')
    ).rejects.toThrow('Cannot go offline with active trip');
  });
});
```

#### Command Handlers
```typescript
// command.handler.spec.ts
describe('CommandHandler', () => {
  it('should handle /start command for new driver', async () => {
    const response = await commandHandler.handleStart(mockTelegramUpdate);
    expect(response.text).toContain('Welcome to DerLg Driver Bot');
    expect(response.text).toContain('driver_id');
  });

  it('should handle /status command', async () => {
    const response = await commandHandler.handleStatus(mockRegisteredDriver);
    expect(response.text).toContain('Current Status');
    expect(response.reply_markup).toBeDefined();
  });
});
```

### Integration Tests

#### Webhook Processing
```typescript
describe('Telegram Webhook (e2e)', () => {
  it('POST /v1/telegram/webhook should process message update', () => {
    return request(app.getHttpServer())
      .post('/v1/telegram/webhook')
      .set('X-Telegram-Bot-Api-Secret-Token', process.env.TELEGRAM_SECRET_TOKEN)
      .send(mockTelegramUpdate)
      .expect(200);
  });

  it('should reject webhook without secret token', () => {
    return request(app.getHttpServer())
      .post('/v1/telegram/webhook')
      .send(mockTelegramUpdate)
      .expect(403);
  });
});
```

#### Driver Registration Flow
```typescript
describe('Driver Registration Flow (e2e)', () => {
  it('should complete full registration flow', async () => {
    // Step 1: Send /start
    await sendTelegramMessage('/start');
    
    // Step 2: Send credentials
    const response = await sendTelegramMessage('driver_id: DRV001 pin: 1234');
    expect(response).toContain('Registration successful');
    
    // Step 3: Verify database
    const driver = await prisma.driver.findUnique({
      where: { telegram_id: mockTelegramId }
    });
    expect(driver).toBeDefined();
    expect(driver.driver_id).toBe('DRV001');
  });
});
```

### Manual Testing Checklist

#### Driver Bot Testing
- [ ] Send /start as new driver and complete registration
- [ ] Send /start as registered driver and see dashboard
- [ ] Send /online and verify status changes to AVAILABLE
- [ ] Send /offline and verify status changes to UNAVAILABLE
- [ ] Try /offline with active trip and verify error message
- [ ] Send /status and verify current status display
- [ ] Tap inline buttons and verify they work without typing commands
- [ ] Receive trip assignment notification
- [ ] Accept trip and verify status changes to BUSY
- [ ] Reject trip and verify status returns to AVAILABLE
- [ ] Send /mytrip during active trip and see details
- [ ] Start trip and verify trip_start_time recorded
- [ ] Complete trip and verify status returns to AVAILABLE
- [ ] Send /history and see past trips
- [ ] Tap earnings summary buttons and verify calculations
- [ ] Share location during trip and verify it's tracked
- [ ] Send /emergency and verify alert created
- [ ] Send /support and create ticket
- [ ] Send /language and switch to Khmer, verify all messages in Khmer
- [ ] Switch to Chinese and verify translations
- [ ] Send /help and verify command list displayed

#### Admin Panel Testing
- [ ] View real-time driver status dashboard
- [ ] See driver status change in real-time when driver goes online
- [ ] Assign driver to booking and verify notification sent
- [ ] See driver location on map during trip
- [ ] View driver trip history
- [ ] Create broadcast message to all drivers
- [ ] Create broadcast to only online drivers
- [ ] View broadcast delivery status
- [ ] View support tickets from drivers
- [ ] View emergency alerts in real-time

### Performance Testing

#### Load Test Scenarios
```javascript
// k6 load test script
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 100 }, // Ramp up to 100 drivers
    { duration: '5m', target: 100 }, // Stay at 100 drivers
    { duration: '2m', target: 0 },   // Ramp down
  ],
};

export default function () {
  // Simulate driver status update
  let response = http.post('https://api.derlg.com/v1/telegram/status', 
    JSON.stringify({
      telegram_id: __VU, // Virtual user ID as telegram_id
      status: 'AVAILABLE'
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 2s': (r) => r.timings.duration < 2000,
  });
  
  sleep(1);
}
```

#### Performance Targets
- Webhook response time: < 1 second (p95)
- Status update processing: < 2 seconds (p95)
- Broadcast message delivery: 30 messages/second
- Concurrent active drivers: 500+
- Database query time: < 100ms (p95)
- Redis operations: < 10ms (p95)

### Security Testing

#### Security Test Cases
- [ ] Verify webhook rejects requests without secret token
- [ ] Verify webhook rejects requests with invalid secret token
- [ ] Verify rate limiting blocks excessive requests (>30/min)
- [ ] Verify driver cannot access another driver's data
- [ ] Verify SQL injection protection on all inputs
- [ ] Verify XSS protection on broadcast messages
- [ ] Verify auth PIN is hashed in database (bcrypt)
- [ ] Verify location data is not stored beyond trip completion
- [ ] Verify HTTPS is enforced on webhook endpoint
- [ ] Verify sensitive data is not logged (PINs, tokens)

## Deployment Checklist

### Pre-Deployment
- [ ] Create Telegram bot with BotFather and obtain token
- [ ] Set up environment variables in Railway/Vercel
- [ ] Run Prisma migrations to create new tables
- [ ] Set up Redis instance (Upstash) if not already configured
- [ ] Configure webhook URL with HTTPS
- [ ] Generate and set TELEGRAM_SECRET_TOKEN
- [ ] Test webhook connectivity from Telegram servers
- [ ] Upload translation files to backend
- [ ] Configure Bull queue with Redis connection
- [ ] Set up monitoring and error tracking (Sentry)

### Deployment Steps
1. Deploy backend with telegram module to Railway
2. Run database migrations: `npx prisma migrate deploy`
3. Set webhook URL: `POST https://api.telegram.org/bot{token}/setWebhook`
4. Verify webhook is active: `GET https://api.telegram.org/bot{token}/getWebhookInfo`
5. Deploy Admin Panel updates to Vercel
6. Test bot with test driver account
7. Monitor logs for errors
8. Gradually onboard drivers in batches

### Post-Deployment
- [ ] Monitor webhook success rate (should be >99%)
- [ ] Monitor Redis memory usage
- [ ] Monitor Bull queue processing times
- [ ] Set up alerts for failed broadcasts
- [ ] Set up alerts for emergency notifications
- [ ] Create driver onboarding documentation
- [ ] Train operations team on new features
- [ ] Collect driver feedback after first week

## Success Metrics

### Adoption Metrics
- **Driver Registration Rate**: Target 80% of active drivers registered within 2 weeks
- **Daily Active Drivers**: Target 60% of registered drivers using bot daily
- **Status Update Frequency**: Average 5+ status updates per driver per day

### Performance Metrics
- **Webhook Success Rate**: >99.5%
- **Average Response Time**: <2 seconds
- **Trip Assignment Acceptance Rate**: >85%
- **Emergency Alert Response Time**: <30 seconds from alert to admin notification

### Business Impact
- **Operational Efficiency**: 30% reduction in manual driver coordination time
- **Driver Satisfaction**: >4.0/5.0 rating in post-implementation survey
- **Trip Fulfillment Rate**: >95% of assignments accepted
- **Support Ticket Resolution Time**: <2 hours average


## Admin Panel Integration Requirements

### Requirement 11: Fleet Manager Driver Creation with Telegram Support

**User Story:** As a Fleet Manager in the Admin Panel, I want to create driver profiles with Telegram credentials, so that drivers can register their Telegram accounts and start using the bot.

#### Acceptance Criteria

1. WHEN a Fleet Manager creates a new driver via Admin Panel at `/admin/drivers`, THE form SHALL include fields: driver_name, driver_id (auto-generated or manual), phone, vehicle_id (dropdown), and auth_pin (4-digit)
2. THE Admin Panel SHALL provide "Generate PIN" button that creates random 4-digit PIN
3. WHEN driver profile is saved, THE Backend_API SHALL hash the auth_pin using bcrypt with 10 salt rounds before storing in drivers.auth_pin
4. THE Admin Panel SHALL display "Copy Credentials" button that copies driver_id and PIN to clipboard in format: "driver_id: {ID}\npin: {PIN}"
5. THE Admin Panel SHALL show telegram_id field as read-only, populated after driver registers via Telegram bot
6. THE DriverList component SHALL display Telegram registration status badge: ✅ Registered or ❌ Not Registered
7. THE DriverList component SHALL include filter dropdown: "All Drivers", "Telegram Registered", "Not Registered"
8. WHEN filtering by "Telegram Registered", THE Admin Panel SHALL call GET /v1/admin/drivers?telegram_registered=true

### Requirement 12: Real-Time Driver Status Dashboard

**User Story:** As an Operations Manager, I want to see real-time driver status updates in the Admin Panel when drivers change status via Telegram, so that I can monitor fleet availability instantly.

#### Acceptance Criteria

1. WHEN Admin Panel loads `/admin/drivers` page, THE frontend SHALL establish WebSocket connection to Backend_API at /admin namespace
2. THE WebSocket connection SHALL subscribe to driver status change events
3. WHEN a driver updates status via Telegram bot, THE Backend_API SHALL publish event to Redis channel driver_status_changed:{driver_id}
4. THE AdminGateway WebSocket SHALL receive Redis pub/sub event and broadcast to all connected admin clients
5. THE DriverList component SHALL receive WebSocket event driver:status:changed with payload {driver_id, status, timestamp}
6. THE DriverList component SHALL update driver status in React Query cache optimistically without refetching
7. THE Admin Panel SHALL display toast notification: "Driver {name} is now {status}"
8. THE DriverStatusBadge component SHALL show pulsing animation for 2 seconds after status change
9. THE Admin Panel SHALL display "Last Activity" column showing last_telegram_activity timestamp
10. IF WebSocket connection is lost, THE Admin Panel SHALL show "Disconnected" indicator and attempt reconnection with exponential backoff

### Requirement 13: Trip Assignment with Telegram Notification

**User Story:** As an Operations Manager, I want to assign drivers to bookings and have them instantly notified via Telegram, so that trip assignments are communicated immediately.

#### Acceptance Criteria

1. WHEN Operations Manager assigns driver to booking via `/admin/bookings/{id}` page, THE DriverAssignmentPanel component SHALL display dropdown of AVAILABLE drivers
2. THE dropdown SHALL only show drivers with status AVAILABLE and telegram_id IS NOT NULL
3. WHEN Operations Manager clicks "Assign Driver" button, THE Admin Panel SHALL call POST /v1/admin/assignments with driver_id, booking_id, vehicle_id
4. THE Backend_API SHALL create driver_assignments record with status PENDING
5. THE Backend_API SHALL immediately send Telegram notification to driver's telegram_id with trip details and [Accept] [Reject] buttons
6. THE Backend_API SHALL set driver_assignments.telegram_notification_sent to TRUE
7. THE Admin Panel SHALL display "Notification Sent" status with countdown timer (5 minutes)
8. WHEN driver responds via Telegram, THE Backend_API SHALL publish to Redis channel assignment_response:{assignment_id}
9. THE Admin Panel SHALL receive WebSocket event assignment:response with payload {assignment_id, status, rejection_reason}
10. THE DriverAssignmentNotification component SHALL update status to "Accepted" (green) or "Rejected" (red) with reason
11. IF driver does not respond within 5 minutes, THE Backend_API SHALL auto-reject assignment and update Admin Panel via WebSocket
12. THE Admin Panel SHALL create audit_log record with action_type DRIVER_ASSIGNED_VIA_TELEGRAM

### Requirement 14: Broadcast Messaging Interface

**User Story:** As an Operations Manager, I want to send broadcast messages to all drivers or specific groups via the Admin Panel, so that I can communicate important updates efficiently.

#### Acceptance Criteria

1. THE Admin Panel SHALL provide new page at `/admin/telegram/broadcast` accessible to OPERATIONS_MANAGER and SUPER_ADMIN roles
2. THE BroadcastComposer component SHALL include rich text editor for message content (max 4096 characters per Telegram limit)
3. THE BroadcastComposer component SHALL include image uploader for optional image attachment
4. THE AudienceSelector component SHALL provide radio buttons: "All Drivers", "Online Drivers Only", "Offline Drivers", "By Vehicle Type"
5. WHEN "By Vehicle Type" is selected, THE component SHALL show checkboxes: VAN, BUS, TUK_TUK
6. THE PreviewPanel component SHALL show message preview with recipient count estimate
7. WHEN Operations Manager clicks "Send Broadcast", THE Admin Panel SHALL call POST /v1/admin/telegram/broadcast with message, image_url, target_filter
8. THE Backend_API SHALL create broadcast_messages record with status PENDING
9. THE Backend_API SHALL queue broadcast job in Bull queue with telegram_ids array based on target_filter
10. THE BroadcastHistory component SHALL display table with columns: timestamp, message (truncated), target, sent_count, failed_count, status
11. THE Admin Panel SHALL receive WebSocket event broadcast:status with real-time delivery progress
12. THE BroadcastHistory component SHALL update sent_count and failed_count in real-time
13. WHEN broadcast completes, THE Admin Panel SHALL show toast notification: "Broadcast sent to {sent_count} drivers, {failed_count} failed"

### Requirement 15: Driver Location Tracking on Admin Map

**User Story:** As an Operations Manager, I want to see driver locations on a map in real-time when they share location during trips, so that I can monitor trip progress and respond to issues.

#### Acceptance Criteria

1. THE Admin Panel SHALL provide map view at `/admin/drivers/map` using Leaflet.js
2. THE map SHALL display all drivers with status BUSY as markers with driver name and vehicle type
3. WHEN a driver shares live location via Telegram during trip, THE Backend_API SHALL store location in Redis with key driver_location:{driver_id} and 5-minute TTL
4. THE Backend_API SHALL publish to Redis channel driver_location_updated:{driver_id}
5. THE Admin Panel SHALL receive WebSocket event driver:location:updated with payload {driver_id, latitude, longitude, timestamp}
6. THE map SHALL update driver marker position in real-time without page refresh
7. THE marker SHALL show popup on click with: driver name, vehicle, current trip destination, last update time
8. THE map SHALL show route line from pickup to destination for active trips
9. IF driver has not shared location, THE marker SHALL show gray color; if location is active, show green color
10. THE Admin Panel SHALL display "Last Location Update" timestamp for each driver
11. THE map SHALL auto-center on driver marker when Operations Manager clicks driver name in DriverList

### Requirement 16: Support Ticket Management Dashboard

**User Story:** As a Support Agent, I want to view and respond to support tickets created by drivers via Telegram, so that I can provide timely assistance.

#### Acceptance Criteria

1. THE Admin Panel SHALL provide new page at `/admin/telegram/support` accessible to SUPPORT_AGENT role and higher
2. THE SupportTicketList component SHALL display table with columns: ticket_id, driver_name, message (truncated), status, priority, created_at
3. THE table SHALL include filters: status (OPEN, IN_PROGRESS, RESOLVED, CLOSED), priority (LOW, NORMAL, HIGH, URGENT)
4. WHEN a driver creates support ticket via Telegram /support command, THE Backend_API SHALL create support_tickets record
5. THE Backend_API SHALL publish to Redis channel driver_support_ticket:{ticket_id}
6. THE Admin Panel SHALL receive WebSocket event driver:support:ticket with payload {ticket_id, driver_id, message, timestamp}
7. THE Admin Panel SHALL show browser notification and play sound for new support tickets
8. THE SupportTicketList component SHALL add new ticket to top of table in real-time
9. WHEN Support Agent clicks ticket, THE Admin Panel SHALL navigate to `/admin/telegram/support/{ticket_id}` detail page
10. THE SupportTicketDetail component SHALL display full message, driver contact info, and current trip context if applicable
11. THE component SHALL include "Assign to Me" button that updates support_tickets.assigned_to
12. THE component SHALL include status dropdown to update ticket status
13. WHEN Support Agent updates ticket status to RESOLVED, THE Backend_API SHALL send Telegram message to driver: "Your support ticket #{ticket_id} has been resolved."

### Requirement 17: Emergency Alert Integration

**User Story:** As an Operations Manager, I want to receive instant notifications in the Admin Panel when drivers send emergency alerts via Telegram, so that I can respond immediately.

#### Acceptance Criteria

1. WHEN a driver sends /emergency command via Telegram, THE Backend_API SHALL create emergency_alerts record with driver_id and alert_type DRIVER_EMERGENCY
2. THE Backend_API SHALL publish to Redis channel driver_emergency:{driver_id}
3. THE Admin Panel SHALL receive WebSocket event driver:emergency with payload {driver_id, alert_id, location, timestamp}
4. THE Admin Panel SHALL show browser notification with sound alert
5. THE Admin Panel SHALL display modal overlay with emergency details: driver name, phone, vehicle, location (if shared), current trip
6. THE EmergencyAlertList component at `/admin/emergency` SHALL add new alert to top of table with red highlight
7. THE modal SHALL include "Acknowledge" button that updates emergency_alerts.status to ACKNOWLEDGED
8. THE modal SHALL include "Call Driver" button that opens phone dialer with driver's phone number
9. THE modal SHALL display map with driver's last known location if available
10. THE Admin Panel SHALL send WebSocket event to all connected admin clients to ensure all managers see the alert
11. WHEN Operations Manager acknowledges alert, THE Admin Panel SHALL send Telegram message to driver: "Emergency acknowledged. Help is on the way."

### Requirement 18: Telegram Analytics Dashboard

**User Story:** As a Fleet Manager, I want to view analytics about Telegram bot usage and driver engagement, so that I can measure adoption and identify issues.

#### Acceptance Criteria

1. THE Admin Panel SHALL provide new page at `/admin/telegram/analytics` accessible to FLEET_MANAGER role and higher
2. THE TelegramAnalyticsDashboard component SHALL display metric cards: Total Registered Drivers, Active Today, Average Response Time, Command Usage
3. THE component SHALL display line chart showing daily active drivers over last 30 days
4. THE component SHALL display pie chart showing command usage breakdown (/online, /offline, /status, /mytrip, etc.)
5. THE component SHALL display bar chart showing assignment acceptance rate by driver
6. THE component SHALL display table with columns: driver_name, last_activity, total_commands, avg_response_time, acceptance_rate
7. THE component SHALL include date range selector to filter analytics by period
8. THE component SHALL call GET /v1/admin/telegram/analytics?start_date={date}&end_date={date}
9. THE Backend_API SHALL aggregate data from drivers.last_telegram_activity, driver_assignments, and audit_logs tables
10. THE component SHALL include "Export CSV" button to download analytics data

