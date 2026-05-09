# Requirements Document

## Introduction

The System Admin Panel is a comprehensive web-based administrative interface for managing all operational aspects of the DerLg Cambodia travel booking platform. This panel enables administrators to manage transportation fleet, hotel inventory, tour guide assignments, bookings, emergency alerts, student discount verifications, discount codes, and real-time driver operations through integration with a Telegram Bot system. The admin panel is built as a new route group within the existing Next.js 14 frontend application, shares the same Supabase PostgreSQL database as the main DerLg application, and communicates with the NestJS backend API for all data operations. The panel provides role-based access control for different administrative functions.

## Glossary

- **Admin_Panel**: The web-based administrative interface for managing DerLg platform operations, implemented as a route group in the Next.js frontend
- **Driver**: A transportation service provider who operates vehicles and communicates via Telegram_Bot to update availability status
- **Transportation_Vehicle**: A transportation asset (VAN, BUS, TUK_TUK) from the transportation_vehicles table available for customer bookings
- **Telegram_Bot**: An external bot system that drivers use to update their availability status, which calls Backend_API webhooks
- **Driver_Status**: The current availability state of a driver (AVAILABLE, BUSY, OFFLINE) stored in the drivers table
- **Fleet_Manager**: An administrator role responsible for managing vehicles and drivers
- **Operations_Manager**: An administrator role with access to bookings, drivers, and inventory management
- **Support_Agent**: An administrator role limited to viewing bookings and handling customer requests
- **Super_Admin**: An administrator role with full access to all system features including user management and audit logs
- **Booking**: A customer reservation record from the bookings table with booking_type (PACKAGE, HOTEL_ONLY, TRANSPORT_ONLY, GUIDE_ONLY)
- **Driver_Assignment**: The process of allocating a driver to a customer booking, stored in the driver_assignments table
- **Backend_API**: The NestJS API server at /v1/* endpoints that the Admin_Panel communicates with
- **Real_Time_Dashboard**: A live-updating interface showing current driver status and booking information using WebSocket connections
- **Audit_Log**: A record in the audit_logs table tracking all administrative actions with admin_user_id, action_type, affected_resource_id, and changed_fields

## Requirements

### Requirement 1: Authentication and Authorization

**User Story:** As a system administrator, I want to log in with role-based access control, so that I can access only the features appropriate to my role.

#### Acceptance Criteria

1. WHEN an administrator provides valid credentials, THE Admin_Panel SHALL authenticate via Backend_API POST /v1/auth/login and receive JWT tokens in httpOnly cookies
2. THE Admin_Panel SHALL verify that the authenticated user has role set to ADMIN or SUPPORT in the users table
3. THE Admin_Panel SHALL store admin-specific role permissions (SUPER_ADMIN, OPERATIONS_MANAGER, SUPPORT_AGENT, FLEET_MANAGER) in a new admin_users table linked to users.id
4. WHEN an authenticated user accesses a feature, THE Admin_Panel SHALL verify the user has the required admin role permissions from admin_users table
5. IF a user attempts to access a feature without proper permissions, THEN THE Admin_Panel SHALL deny access and display an authorization error message
6. WHEN a JWT access token expires after 15 minutes, THE Admin_Panel SHALL automatically refresh using the refresh token via POST /v1/auth/refresh
7. THE Admin_Panel SHALL maintain session state across page navigation within the token validity period using Zustand store

### Requirement 2: Driver Management Interface

**User Story:** As a Fleet Manager, I want to manage driver profiles and view their real-time status, so that I can coordinate transportation operations effectively.

#### Acceptance Criteria

1. THE Admin_Panel SHALL display a list of all drivers from a new drivers table via GET /v1/admin/drivers with columns: id, driver_name, driver_id, telegram_id, phone, vehicle_id (FK to transportation_vehicles.id), status (AVAILABLE, BUSY, OFFLINE), and last_status_update
2. WHEN a Fleet Manager creates a new driver profile, THE Admin_Panel SHALL call POST /v1/admin/drivers to store driver_name, driver_id, telegram_id, phone, and vehicle_id in the drivers table
3. WHEN a Fleet Manager edits a driver profile, THE Admin_Panel SHALL call PATCH /v1/admin/drivers/:id to update driver information in the drivers table
4. WHEN a Fleet Manager deactivates a driver, THE Admin_Panel SHALL call PATCH /v1/admin/drivers/:id to set status to OFFLINE and prevent future assignments
5. THE Admin_Panel SHALL establish a WebSocket connection to receive real-time driver status updates published to Redis channel driver_status_changed:{driver_id}
6. WHEN filtering drivers by status, THE Admin_Panel SHALL display only drivers matching the selected status (AVAILABLE, BUSY, or OFFLINE)
7. THE Admin_Panel SHALL display the last_status_update timestamp for each driver showing when their status was last changed

### Requirement 3: Vehicle Fleet Management

**User Story:** As a Fleet Manager, I want to manage the vehicle fleet inventory, so that I can track available transportation assets.

#### Acceptance Criteria

1. THE Admin_Panel SHALL display a list of all vehicles from transportation_vehicles table via GET /v1/admin/vehicles with columns: id, name, category (VAN, BUS, TUK_TUK), capacity, tier (STANDARD, VIP), price_per_day, price_per_km, features, and images
2. WHEN a Fleet Manager adds a new vehicle, THE Admin_Panel SHALL call POST /v1/admin/vehicles to store name, category, capacity, tier, price_per_day, price_per_km, features, and images in transportation_vehicles table
3. WHEN a Fleet Manager edits vehicle details, THE Admin_Panel SHALL call PATCH /v1/admin/vehicles/:id to update the vehicle information in transportation_vehicles table
4. WHEN a Fleet Manager marks a vehicle for maintenance, THE Admin_Panel SHALL call POST /v1/admin/maintenance to create a record in vehicle_maintenance table with vehicle_id, maintenance_type, scheduled_date, and status set to SCHEDULED
5. THE Admin_Panel SHALL display which driver is currently assigned to each vehicle by joining drivers table on vehicle_id
6. WHEN a Fleet Manager searches for vehicles, THE Admin_Panel SHALL filter by name, category (VAN, BUS, TUK_TUK), or tier (STANDARD, VIP)
7. THE Admin_Panel SHALL display vehicle availability status based on assigned driver's status and active maintenance records

### Requirement 4: Driver Status Synchronization

**User Story:** As an Operations Manager, I want the system to synchronize driver status from Telegram Bot updates, so that I have accurate real-time availability information.

#### Acceptance Criteria

1. WHEN a driver sends `/online vehicle_id: <VEHICLE_ID> driver_name: <NAME>` via Telegram_Bot, THE Telegram_Bot SHALL call Backend_API webhook POST /v1/telegram/driver-status with telegram_id, vehicle_id, driver_name, and status AVAILABLE
2. WHEN Backend_API receives the webhook, THE Backend_API SHALL update or create the driver record in drivers table with status AVAILABLE and last_status_update set to current timestamp
3. WHEN a driver is assigned to a booking via POST /v1/admin/assignments, THE Backend_API SHALL update the driver's status to BUSY in drivers table
4. WHEN a driver completes a trip via PATCH /v1/admin/assignments/:id/complete, THE Backend_API SHALL update the driver's status to AVAILABLE in drivers table
5. THE Backend_API SHALL publish driver status changes to Redis channel driver_status_changed:{driver_id}
6. THE Admin_Panel SHALL subscribe to Redis pub/sub and receive real-time status updates via WebSocket within 5 seconds
7. THE Admin_Panel SHALL create audit_logs records for all driver status changes with admin_user_id, action_type DRIVER_STATUS_UPDATE, affected_resource_id (driver_id), and changed_fields JSON

### Requirement 5: Driver Assignment to Customer Bookings

**User Story:** As an Operations Manager, I want to assign available drivers to customer bookings, so that transportation bookings can be fulfilled efficiently.

#### Acceptance Criteria

1. WHEN an Operations Manager assigns a driver to a booking, THE Admin_Panel SHALL call POST /v1/admin/assignments with driver_id, booking_id, and vehicle_id to create a record in driver_assignments table
2. THE Backend_API SHALL verify the driver's status is AVAILABLE in drivers table before allowing assignment
3. IF a driver's status is not AVAILABLE, THEN THE Backend_API SHALL return 409 Conflict error and Admin_Panel SHALL display an error message
4. WHEN a driver is successfully assigned, THE Backend_API SHALL update the driver's status to BUSY in drivers table and set assignment_timestamp in driver_assignments table
5. THE Admin_Panel SHALL display a filtered list of AVAILABLE drivers when selecting a driver for assignment via GET /v1/admin/drivers?status=AVAILABLE
6. WHEN assigning a driver, THE Admin_Panel SHALL verify the vehicle capacity from transportation_vehicles table matches the booking's num_adults plus num_children
7. WHEN a booking is completed or cancelled, THE Admin_Panel SHALL call PATCH /v1/admin/assignments/:id/complete to set completion_timestamp and update driver status back to AVAILABLE

### Requirement 6: Hotel Inventory Management

**User Story:** As an Operations Manager, I want to manage hotel inventory and room availability, so that I can coordinate accommodation services.

#### Acceptance Criteria

1. THE Admin_Panel SHALL display a list of all hotels from hotels table via GET /v1/admin/hotels with columns: id, name, description, location (JSON), rating, review_count, amenities, check_in_time, check_out_time, and cancellation_policy
2. WHEN an Operations Manager views hotel rooms, THE Admin_Panel SHALL call GET /v1/admin/hotels/:id/rooms to display hotel_rooms with room name, description, capacity, price_per_night, images, and amenities
3. WHEN an Operations Manager adds a new hotel, THE Admin_Panel SHALL call POST /v1/admin/hotels to store name, description, location, images, rating, amenities, check_in_time, check_out_time, and cancellation_policy in hotels table
4. WHEN an Operations Manager adds a room to a hotel, THE Admin_Panel SHALL call POST /v1/admin/hotels/:id/rooms to store room details in hotel_rooms table with hotel_id foreign key
5. WHEN an Operations Manager edits hotel or room details, THE Admin_Panel SHALL call PATCH /v1/admin/hotels/:id or PATCH /v1/admin/hotels/:hotelId/rooms/:roomId to update the respective tables
6. THE Admin_Panel SHALL display room availability by querying bookings table for records with booking_type HOTEL_ONLY or PACKAGE, status CONFIRMED or RESERVED, and hotel_room_id matching the room
7. THE Admin_Panel SHALL prevent double-booking by checking for overlapping date ranges in bookings table before confirming new hotel reservations

### Requirement 7: Tour Guide Management

**User Story:** As an Operations Manager, I want to manage tour guide profiles and assignments, so that I can coordinate guided tour services.

#### Acceptance Criteria

1. THE Admin_Panel SHALL display a list of all tour guides from guides table via GET /v1/admin/guides with columns: id, name, bio, profile_picture, languages (TEXT[]), specialties (TEXT[]), experience_years, certifications (TEXT[]), rating, review_count, price_per_hour, and price_per_day
2. WHEN an Operations Manager creates a tour guide profile, THE Admin_Panel SHALL call POST /v1/admin/guides to store name, bio, profile_picture, languages, specialties, experience_years, certifications, price_per_hour, and price_per_day in guides table
3. WHEN an Operations Manager edits a guide profile, THE Admin_Panel SHALL call PATCH /v1/admin/guides/:id to update the guide information in guides table
4. THE Admin_Panel SHALL display guide assignments by querying bookings table for records with booking_type GUIDE_ONLY or PACKAGE, status CONFIRMED, and guide_id matching the guide
5. THE Admin_Panel SHALL display guide performance metrics by aggregating reviews table records where target_type is GUIDE and target_id matches the guide_id
6. WHEN filtering guides, THE Admin_Panel SHALL filter by languages array contains value or specialties array contains value
7. THE Admin_Panel SHALL check guide availability by querying bookings table for overlapping date ranges with status CONFIRMED or RESERVED before allowing new assignments

### Requirement 8: Booking Operations Dashboard

**User Story:** As a Support Agent, I want to view and manage all customer bookings, so that I can handle customer requests and modifications.

#### Acceptance Criteria

1. THE Admin_Panel SHALL display a unified list of all bookings from bookings table via GET /v1/admin/bookings with columns: id, booking_ref, user_id, booking_type (PACKAGE, HOTEL_ONLY, TRANSPORT_ONLY, GUIDE_ONLY), status (RESERVED, CONFIRMED, CANCELLED, COMPLETED, REFUNDED), travel_date, and total_usd
2. WHEN a Support Agent searches for bookings, THE Admin_Panel SHALL filter by booking_ref, user email (join users table), date range on travel_date, or booking_type
3. WHEN a Support Agent views booking details, THE Admin_Panel SHALL call GET /v1/admin/bookings/:id to display complete booking information including trip, hotel_room, transport_vehicle, guide (via foreign keys), payment status from payments table, and customizations JSON
4. WHEN a Support Agent modifies a booking, THE Admin_Panel SHALL call PATCH /v1/admin/bookings/:id to update travel_date, end_date, num_adults, num_children, or customizations in bookings table
5. WHEN a Support Agent cancels a booking, THE Admin_Panel SHALL call POST /v1/bookings/:id/cancel which updates status to CANCELLED, processes refund via Stripe, and releases assigned resources (driver, hotel room, guide)
6. THE Admin_Panel SHALL display booking status values from BookingStatus enum: RESERVED, CONFIRMED, CANCELLED, COMPLETED, REFUNDED
7. WHEN a booking requires refund processing, THE Admin_Panel SHALL display refunded_amount_usd from payments table and allow Support Agent to initiate additional refunds via POST /v1/payments/:bookingId/refund

### Requirement 9: Analytics and Reporting

**User Story:** As a Super Admin, I want to view analytics and reports, so that I can monitor business performance and make data-driven decisions.

#### Acceptance Criteria

1. THE Admin_Panel SHALL display total revenue by booking_type (PACKAGE, HOTEL_ONLY, TRANSPORT_ONLY, GUIDE_ONLY) for a selected date range via GET /v1/admin/analytics/revenue aggregating total_usd from bookings table where status is CONFIRMED or COMPLETED
2. THE Admin_Panel SHALL display booking statistics via GET /v1/admin/analytics/bookings including total count, count by status (CONFIRMED, COMPLETED, CANCELLED, REFUNDED), and cancellation rate calculated as CANCELLED count divided by total count
3. THE Admin_Panel SHALL display driver performance metrics via GET /v1/admin/analytics/drivers aggregating driver_assignments table for total trips per driver and joining reviews table for average ratings
4. THE Admin_Panel SHALL display popular destinations by aggregating bookings table joined with trips table, grouping by trip province, and ordering by booking count
5. THE Admin_Panel SHALL display hotel occupancy rate by calculating (booked room-nights / total available room-nights) from bookings table where booking_type includes hotel and status is CONFIRMED
6. THE Admin_Panel SHALL display tour guide utilization rate by calculating percentage of days guides have assignments from driver_assignments table grouped by guide_id
7. WHEN a Super Admin exports a report, THE Admin_Panel SHALL call GET /v1/admin/analytics/export with date range and metric type to generate a CSV or PDF file with the selected data

### Requirement 10: User and Role Management

**User Story:** As a Super Admin, I want to manage administrator accounts and permissions, so that I can control access to the Admin Panel.

#### Acceptance Criteria

1. THE Admin_Panel SHALL display a list of all administrator users via GET /v1/admin/users joining users table with admin_users table showing email, name, role from users table, and admin_role (SUPER_ADMIN, OPERATIONS_MANAGER, SUPPORT_AGENT, FLEET_MANAGER) and permissions JSON from admin_users table
2. WHEN a Super Admin creates a new administrator, THE Admin_Panel SHALL call POST /v1/admin/users to create a record in users table with role ADMIN and a linked record in admin_users table with admin_role and permissions JSON
3. WHEN a Super Admin assigns an admin role, THE Admin_Panel SHALL call PATCH /v1/admin/users/:id to update admin_role in admin_users table to SUPER_ADMIN, OPERATIONS_MANAGER, SUPPORT_AGENT, or FLEET_MANAGER
4. THE Admin_Panel SHALL enforce role-based permissions where FLEET_MANAGER can only access GET /v1/admin/drivers, GET /v1/admin/vehicles, and GET /v1/admin/maintenance endpoints
5. THE Admin_Panel SHALL enforce role-based permissions where SUPPORT_AGENT can only access GET /v1/admin/bookings and PATCH /v1/admin/bookings/:id but cannot access driver or vehicle management endpoints
6. WHEN a Super Admin deactivates an administrator account, THE Admin_Panel SHALL call PATCH /v1/admin/users/:id to set is_active to false in admin_users table and increment token_version in users table to revoke all tokens
7. THE Admin_Panel SHALL create audit_logs records for all administrative actions with admin_user_id, action_type, affected_resource_id, resource_type, changed_fields JSON, and timestamp

### Requirement 11: Emergency Alert Management

**User Story:** As an Operations Manager, I want to manage emergency alerts and incidents, so that I can respond to traveler safety concerns.

#### Acceptance Criteria

1. THE Admin_Panel SHALL display a list of all emergency alerts from emergency_alerts table via GET /v1/admin/emergency with columns: id, user_id, booking_id, latitude, longitude, alert_type (SOS, MEDICAL, THEFT, LOST), status (SENT, ACKNOWLEDGED, RESOLVED), message, and created_at
2. WHEN an emergency alert is received, THE Admin_Panel SHALL display a prominent notification banner and play a sound alert via browser Notification API
3. WHEN an Operations Manager views an emergency alert, THE Admin_Panel SHALL call GET /v1/admin/emergency/:id to display user contact from users table, current location coordinates, alert_type, message, and associated booking details from bookings table
4. WHEN an Operations Manager responds to an emergency, THE Admin_Panel SHALL call PATCH /v1/admin/emergency/:id to update status to ACKNOWLEDGED, set acknowledged_at timestamp, and record responder admin_user_id
5. WHEN an emergency is resolved, THE Admin_Panel SHALL call PATCH /v1/admin/emergency/:id to update status to RESOLVED, set resolved_at timestamp, and store resolution_notes
6. THE Admin_Panel SHALL display real-time location tracking by rendering latitude and longitude on a Leaflet.js map component for alerts with status SENT or ACKNOWLEDGED
7. THE Admin_Panel SHALL display user phone number from users table and assigned driver phone from drivers table (via driver_assignments) to allow Operations Manager to initiate contact

### Requirement 12: Real-Time Updates and Notifications

**User Story:** As an Operations Manager, I want to receive real-time updates on bookings and driver status, so that I can respond quickly to operational changes.

#### Acceptance Criteria

1. THE Admin_Panel SHALL establish a WebSocket connection to Backend_API at wss://api.derlg.com/v1/admin/ws for real-time updates using the useWebSocket custom hook
2. WHEN a new booking is created, THE Backend_API SHALL publish to Redis channel admin_events and Admin_Panel SHALL display a notification within 5 seconds
3. WHEN a driver updates their status via Telegram_Bot, THE Backend_API SHALL publish to Redis channel driver_status_changed:{driver_id} and Admin_Panel SHALL update the Real_Time_Dashboard within 5 seconds without page refresh
4. WHEN a booking status changes from RESERVED to CONFIRMED (payment success), THE Backend_API SHALL publish to Redis and Admin_Panel SHALL update the booking list using React Query cache invalidation
5. WHEN an emergency alert is triggered, THE Admin_Panel SHALL receive WebSocket message with type EMERGENCY_ALERT and display an urgent notification with browser sound alert via Notification API
6. IF the WebSocket connection is lost, THE Admin_Panel SHALL attempt to reconnect every 10 seconds using exponential backoff and display a connection status indicator in the top navigation bar
7. THE Admin_Panel SHALL display a notification counter badge showing unread count for new bookings, driver status changes, and emergency alerts stored in Zustand notification store

### Requirement 13: Discount Code Management

**User Story:** As an Operations Manager, I want to manage discount codes and student verifications, so that I can control promotional pricing and student benefits.

#### Acceptance Criteria

1. THE Admin_Panel SHALL display active discount codes from discount_codes table via GET /v1/admin/discounts with columns: id, code, discount_percentage, valid_from, valid_until, max_usage, usage_count, and is_active
2. WHEN an Operations Manager creates a discount code, THE Admin_Panel SHALL call POST /v1/admin/discounts to store code, discount_percentage, valid_from, valid_until, max_usage, and is_active in discount_codes table
3. WHEN an Operations Manager deactivates a discount code, THE Admin_Panel SHALL call PATCH /v1/admin/discounts/:id to set is_active to false preventing future usage
4. THE Admin_Panel SHALL display student discount verification requests from student_verifications table via GET /v1/admin/student-verifications with columns: id, user_id, student_id_image_url, face_selfie_url, status (PENDING, APPROVED, REJECTED), submitted_at
5. WHEN an Operations Manager reviews a student verification, THE Admin_Panel SHALL display the uploaded images from Supabase Storage using student_id_image_url and face_selfie_url
6. WHEN an Operations Manager approves a student discount, THE Admin_Panel SHALL call PATCH /v1/admin/student-verifications/:id to update status to APPROVED, set reviewed_at timestamp, and update users table setting is_student to true and student_verified_at to current timestamp
7. WHEN an Operations Manager rejects a student verification, THE Admin_Panel SHALL call PATCH /v1/admin/student-verifications/:id to update status to REJECTED and set reviewed_at timestamp

### Requirement 14: Vehicle Maintenance Scheduling

**User Story:** As a Fleet Manager, I want to schedule vehicle maintenance, so that I can ensure fleet reliability and safety.

#### Acceptance Criteria

1. THE Admin_Panel SHALL display a maintenance schedule calendar via GET /v1/admin/maintenance showing all records from vehicle_maintenance table with columns: id, vehicle_id, maintenance_type, scheduled_date, completion_date, maintenance_cost, maintenance_notes, and status (SCHEDULED, IN_MAINTENANCE, COMPLETED)
2. WHEN a Fleet Manager schedules maintenance, THE Admin_Panel SHALL call POST /v1/admin/maintenance to store vehicle_id (FK to transportation_vehicles.id), maintenance_type, scheduled_date, maintenance_notes, and status SCHEDULED in vehicle_maintenance table
3. WHEN a maintenance date approaches within 3 days, THE Admin_Panel SHALL display a reminder notification by filtering vehicle_maintenance records where scheduled_date is between now and now + 3 days
4. WHEN a vehicle enters maintenance, THE Admin_Panel SHALL call PATCH /v1/admin/maintenance/:id to update status to IN_MAINTENANCE and prevent the vehicle from being assigned by checking vehicle_maintenance status before driver assignments
5. WHEN maintenance is completed, THE Admin_Panel SHALL call PATCH /v1/admin/maintenance/:id to update status to COMPLETED, set completion_date to current timestamp, and record maintenance_cost
6. THE Admin_Panel SHALL display maintenance history for each vehicle by querying vehicle_maintenance table filtered by vehicle_id and ordered by scheduled_date descending
7. THE Admin_Panel SHALL calculate total maintenance cost per vehicle for a selected date range by summing maintenance_cost from vehicle_maintenance table grouped by vehicle_id

### Requirement 15: Customer Support Interface

**User Story:** As a Support Agent, I want to view customer profiles and booking history, so that I can provide personalized assistance.

#### Acceptance Criteria

1. THE Admin_Panel SHALL display a searchable list of customers from users table via GET /v1/admin/customers with columns: id, name, email, phone, role, loyalty_points, is_student, and created_at
2. WHEN a Support Agent searches for a customer, THE Admin_Panel SHALL filter by name (ILIKE), email (ILIKE), or phone (exact match)
3. WHEN a Support Agent views a customer profile, THE Admin_Panel SHALL call GET /v1/admin/customers/:id to display complete user information and booking history from bookings table ordered by created_at descending
4. THE Admin_Panel SHALL display customer loyalty_points balance from users table and transaction history from loyalty_transactions table showing type (EARNED, REDEEMED, ADJUSTED), points, description, and created_at
5. WHEN a Support Agent views customer feedback, THE Admin_Panel SHALL query reviews table where user_id matches the customer showing rating, title, content, target_type, target_id, and created_at
6. THE Admin_Panel SHALL display customer emergency alerts from emergency_alerts table showing alert_type, status, latitude, longitude, message, and created_at
7. WHEN a Support Agent manually adjusts loyalty points, THE Admin_Panel SHALL call POST /v1/admin/loyalty/adjust to update users.loyalty_points and create a loyalty_transactions record with type ADJUSTED

### Requirement 16: AI Agent Booking Monitoring

**User Story:** As an Operations Manager, I want to monitor bookings created through the AI agent, so that I can ensure AI-assisted bookings are processed correctly.

#### Acceptance Criteria

1. THE Admin_Panel SHALL display a flag indicating which bookings were created via AI_Agent by checking if the booking was created through POST /v1/ai-tools/create-booking endpoint (tracked via metadata JSON field in bookings table)
2. WHEN an Operations Manager filters bookings by source, THE Admin_Panel SHALL filter bookings table by metadata JSON field containing ai_assisted: true or ai_assisted: false
3. THE Admin_Panel SHALL display the AI session_id associated with each AI_Agent booking from the metadata JSON field in bookings table
4. WHEN an Operations Manager views an AI_Agent booking, THE Admin_Panel SHALL call GET /v1/admin/ai-sessions/:sessionId to retrieve conversation history from Redis (if still available within 7-day TTL) or display "Session expired"
5. THE Admin_Panel SHALL calculate AI_Agent booking success rate via GET /v1/admin/analytics/ai-bookings as (count of bookings with status CONFIRMED or COMPLETED and ai_assisted true) / (total count of bookings with ai_assisted true)
6. WHEN an AI_Agent booking has validation errors, THE Admin_Panel SHALL display the error details from metadata JSON field and allow Operations Manager to manually correct via PATCH /v1/admin/bookings/:id
7. THE Admin_Panel SHALL display AI_Agent performance metrics via GET /v1/admin/analytics/ai-performance including average booking creation time and customer satisfaction from reviews table where booking metadata contains ai_assisted true

### Requirement 17: Multi-Language Support

**User Story:** As a Super Admin, I want the Admin Panel to support multiple languages, so that administrators can use the interface in their preferred language.

#### Acceptance Criteria

1. THE Admin_Panel SHALL support English (EN), Chinese (ZH), and Khmer (KM) language interfaces using next-intl library with translation files in public/locales/
2. WHEN an administrator selects a language preference, THE Admin_Panel SHALL update the Zustand language store and re-render all interface text using the selected locale
3. THE Admin_Panel SHALL store the administrator's preferred_language in users table via PATCH /v1/users/profile
4. WHEN an administrator logs in, THE Admin_Panel SHALL load the interface in their preferred_language from users table and initialize next-intl with that locale
5. THE Admin_Panel SHALL display customer data (name, email, phone, addresses) in the original language without translation
6. THE Admin_Panel SHALL display system messages, notifications, and UI labels in the administrator's selected language by loading translations from public/locales/{locale}/admin.json
7. WHEN displaying dates and times, THE Admin_Panel SHALL format according to the selected language locale using Intl.DateTimeFormat with the appropriate locale code

### Requirement 18: Data Export and Backup

**User Story:** As a Super Admin, I want to export data and create backups, so that I can preserve business records and perform external analysis.

#### Acceptance Criteria

1. THE Admin_Panel SHALL allow Super Admin to export booking data via GET /v1/admin/export/bookings with query parameters start_date, end_date, and format (CSV or JSON) returning a downloadable file
2. WHEN a Super Admin exports driver data, THE Admin_Panel SHALL call GET /v1/admin/export/drivers to generate a file containing all driver profiles from drivers table, performance metrics from driver_assignments table, and ratings from reviews table
3. WHEN a Super Admin exports financial data, THE Admin_Panel SHALL call GET /v1/admin/export/payments to generate a file containing all payment records from payments table including amount_usd, status, payment_method, refunded_amount_usd, and created_at
4. THE Admin_Panel SHALL allow Super Admin to trigger database backup via POST /v1/admin/backup which creates a Supabase database dump and stores it in Supabase Storage with timestamp
5. WHEN a backup is created, THE Backend_API SHALL store backup metadata in a backups table with columns: id, backup_file_url, backup_size_bytes, created_at, created_by_admin_id
6. THE Admin_Panel SHALL display a list of available backups via GET /v1/admin/backups showing created_at, backup_size_bytes, and download link to Supabase Storage URL
7. THE Admin_Panel SHALL encrypt exported files containing sensitive customer data (email, phone, payment details) using AES-256 encryption before download and provide decryption key separately

### Requirement 19: Audit Logging

**User Story:** As a Super Admin, I want to view audit logs of all administrative actions, so that I can track system usage and investigate issues.

#### Acceptance Criteria

1. THE Admin_Panel SHALL display audit logs from audit_logs table via GET /v1/admin/audit-logs with columns: id, admin_user_id, action_type, affected_resource_id, resource_type, changed_fields (JSON), and timestamp
2. WHEN a Super Admin views audit logs, THE Admin_Panel SHALL filter by date range on timestamp, admin_user_id (join with users table to show admin name), or action_type (DRIVER_ASSIGNMENT, BOOKING_MODIFICATION, PRICING_CHANGE, USER_ROLE_CHANGE, etc.)
3. THE Admin_Panel SHALL log driver assignments by creating audit_logs records with action_type DRIVER_ASSIGNMENT, affected_resource_id (driver_id), resource_type DRIVER, and changed_fields JSON containing booking_id, vehicle_id, and assignment_timestamp
4. THE Admin_Panel SHALL log booking modifications by creating audit_logs records with action_type BOOKING_MODIFICATION, affected_resource_id (booking_id), resource_type BOOKING, and changed_fields JSON containing old and new values for modified fields
5. THE Admin_Panel SHALL log pricing changes by creating audit_logs records with action_type PRICING_CHANGE, affected_resource_id (vehicle_id, hotel_id, or guide_id), resource_type (VEHICLE, HOTEL, GUIDE), and changed_fields JSON containing old_price and new_price
6. THE Backend_API SHALL retain audit logs for at least 365 days in audit_logs table with no automatic deletion
7. WHEN a Super Admin exports audit logs, THE Admin_Panel SHALL call GET /v1/admin/audit-logs/export with date range parameters to generate a CSV file with all log entries including admin name from users table join

### Requirement 20: Dashboard Overview

**User Story:** As an administrator, I want to see a dashboard overview when I log in, so that I can quickly assess current operational status.

#### Acceptance Criteria

1. THE Admin_Panel SHALL display a dashboard via GET /v1/admin/dashboard showing total_bookings_today (count from bookings table where created_at is today), total_revenue_today (sum of total_usd from bookings where status is CONFIRMED and created_at is today), and active_drivers_count (count from drivers table where status is AVAILABLE or BUSY)
2. THE Admin_Panel SHALL display a chart showing booking trends for the past 30 days by aggregating bookings table grouped by DATE(created_at) and counting records per day
3. THE Admin_Panel SHALL display a list of pending_actions including unassigned bookings (bookings with booking_type TRANSPORT_ONLY and no record in driver_assignments table) and pending_maintenance (vehicle_maintenance records with status SCHEDULED and scheduled_date within 7 days)
4. THE Admin_Panel SHALL display recent_emergency_alerts from emergency_alerts table where status is SENT or ACKNOWLEDGED, ordered by created_at descending, showing alert_type, user name from users table join, and time_since_alert calculated as current timestamp minus created_at
5. THE Admin_Panel SHALL display driver_availability_summary showing count of drivers grouped by status (AVAILABLE, BUSY, OFFLINE) from drivers table
6. THE Admin_Panel SHALL display upcoming_bookings for the next 24 hours by querying bookings table where travel_date is between now and now + 24 hours, status is CONFIRMED, showing booking_ref, travel_date, booking_type, and customer name from users table join
7. THE Admin_Panel SHALL refresh dashboard metrics automatically every 60 seconds using React Query with refetchInterval option without requiring page reload
