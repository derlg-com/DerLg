# System Admin Panel - Combined Task Specification

> This document combines all 39 tasks from the implementation plan with their associated requirements (acceptance criteria) and design patterns.
> Generated from: `tasks.md` + `requirements.md` + `design.md`

---

# Requirements Reference

## Requirement 1: Authentication and Authorization

1. 1. WHEN an administrator provides valid credentials, THE Admin_Panel SHALL authenticate via Backend_API POST /v1/auth/login and receive JWT tokens in httpOnly cookies
2. 2. THE Admin_Panel SHALL verify that the authenticated user has role set to ADMIN or SUPPORT in the users table
3. 3. THE Admin_Panel SHALL store admin-specific role permissions (SUPER_ADMIN, OPERATIONS_MANAGER, SUPPORT_AGENT, FLEET_MANAGER) in a new admin_users table linked to users.id
4. 4. WHEN an authenticated user accesses a feature, THE Admin_Panel SHALL verify the user has the required admin role permissions from admin_users table
5. 5. IF a user attempts to access a feature without proper permissions, THEN THE Admin_Panel SHALL deny access and display an authorization error message
6. 6. WHEN a JWT access token expires after 15 minutes, THE Admin_Panel SHALL automatically refresh using the refresh token via POST /v1/auth/refresh
7. 7. THE Admin_Panel SHALL maintain session state across page navigation within the token validity period using Zustand store

## Requirement 2: Driver Management Interface

1. 1. THE Admin_Panel SHALL display a list of all drivers from a new drivers table via GET /v1/admin/drivers with columns: id, driver_name, driver_id, telegram_id, phone, vehicle_id (FK to transportation_vehicles.id), status (AVAILABLE, BUSY, OFFLINE), and last_status_update
2. 2. WHEN a Fleet Manager creates a new driver profile, THE Admin_Panel SHALL call POST /v1/admin/drivers to store driver_name, driver_id, telegram_id, phone, and vehicle_id in the drivers table
3. 3. WHEN a Fleet Manager edits a driver profile, THE Admin_Panel SHALL call PATCH /v1/admin/drivers/:id to update driver information in the drivers table
4. 4. WHEN a Fleet Manager deactivates a driver, THE Admin_Panel SHALL call PATCH /v1/admin/drivers/:id to set status to OFFLINE and prevent future assignments
5. 5. THE Admin_Panel SHALL establish a WebSocket connection to receive real-time driver status updates published to Redis channel driver_status_changed:{driver_id}
6. 6. WHEN filtering drivers by status, THE Admin_Panel SHALL display only drivers matching the selected status (AVAILABLE, BUSY, or OFFLINE)
7. 7. THE Admin_Panel SHALL display the last_status_update timestamp for each driver showing when their status was last changed

## Requirement 3: Vehicle Fleet Management

1. 1. THE Admin_Panel SHALL display a list of all vehicles from transportation_vehicles table via GET /v1/admin/vehicles with columns: id, name, category (VAN, BUS, TUK_TUK), capacity, tier (STANDARD, VIP), price_per_day, price_per_km, features, and images
2. 2. WHEN a Fleet Manager adds a new vehicle, THE Admin_Panel SHALL call POST /v1/admin/vehicles to store name, category, capacity, tier, price_per_day, price_per_km, features, and images in transportation_vehicles table
3. 3. WHEN a Fleet Manager edits vehicle details, THE Admin_Panel SHALL call PATCH /v1/admin/vehicles/:id to update the vehicle information in transportation_vehicles table
4. 4. WHEN a Fleet Manager marks a vehicle for maintenance, THE Admin_Panel SHALL call POST /v1/admin/maintenance to create a record in vehicle_maintenance table with vehicle_id, maintenance_type, scheduled_date, and status set to SCHEDULED
5. 5. THE Admin_Panel SHALL display which driver is currently assigned to each vehicle by joining drivers table on vehicle_id
6. 6. WHEN a Fleet Manager searches for vehicles, THE Admin_Panel SHALL filter by name, category (VAN, BUS, TUK_TUK), or tier (STANDARD, VIP)
7. 7. THE Admin_Panel SHALL display vehicle availability status based on assigned driver's status and active maintenance records

## Requirement 4: Driver Status Synchronization

1. 1. WHEN a driver sends `/online vehicle_id: <VEHICLE_ID> driver_name: <NAME>` via Telegram_Bot, THE Telegram_Bot SHALL call Backend_API webhook POST /v1/telegram/driver-status with telegram_id, vehicle_id, driver_name, and status AVAILABLE
2. 2. WHEN Backend_API receives the webhook, THE Backend_API SHALL update or create the driver record in drivers table with status AVAILABLE and last_status_update set to current timestamp
3. 3. WHEN a driver is assigned to a booking via POST /v1/admin/assignments, THE Backend_API SHALL update the driver's status to BUSY in drivers table
4. 4. WHEN a driver completes a trip via PATCH /v1/admin/assignments/:id/complete, THE Backend_API SHALL update the driver's status to AVAILABLE in drivers table
5. 5. THE Backend_API SHALL publish driver status changes to Redis channel driver_status_changed:{driver_id}
6. 6. THE Admin_Panel SHALL subscribe to Redis pub/sub and receive real-time status updates via WebSocket within 5 seconds
7. 7. THE Admin_Panel SHALL create audit_logs records for all driver status changes with admin_user_id, action_type DRIVER_STATUS_UPDATE, affected_resource_id (driver_id), and changed_fields JSON

## Requirement 5: Driver Assignment to Customer Bookings

1. 1. WHEN an Operations Manager assigns a driver to a booking, THE Admin_Panel SHALL call POST /v1/admin/assignments with driver_id, booking_id, and vehicle_id to create a record in driver_assignments table
2. 2. THE Backend_API SHALL verify the driver's status is AVAILABLE in drivers table before allowing assignment
3. 3. IF a driver's status is not AVAILABLE, THEN THE Backend_API SHALL return 409 Conflict error and Admin_Panel SHALL display an error message
4. 4. WHEN a driver is successfully assigned, THE Backend_API SHALL update the driver's status to BUSY in drivers table and set assignment_timestamp in driver_assignments table
5. 5. THE Admin_Panel SHALL display a filtered list of AVAILABLE drivers when selecting a driver for assignment via GET /v1/admin/drivers?status=AVAILABLE
6. 6. WHEN assigning a driver, THE Admin_Panel SHALL verify the vehicle capacity from transportation_vehicles table matches the booking's num_adults plus num_children
7. 7. WHEN a booking is completed or cancelled, THE Admin_Panel SHALL call PATCH /v1/admin/assignments/:id/complete to set completion_timestamp and update driver status back to AVAILABLE

## Requirement 6: Hotel Inventory Management

1. 1. THE Admin_Panel SHALL display a list of all hotels from hotels table via GET /v1/admin/hotels with columns: id, name, description, location (JSON), rating, review_count, amenities, check_in_time, check_out_time, and cancellation_policy
2. 2. WHEN an Operations Manager views hotel rooms, THE Admin_Panel SHALL call GET /v1/admin/hotels/:id/rooms to display hotel_rooms with room name, description, capacity, price_per_night, images, and amenities
3. 3. WHEN an Operations Manager adds a new hotel, THE Admin_Panel SHALL call POST /v1/admin/hotels to store name, description, location, images, rating, amenities, check_in_time, check_out_time, and cancellation_policy in hotels table
4. 4. WHEN an Operations Manager adds a room to a hotel, THE Admin_Panel SHALL call POST /v1/admin/hotels/:id/rooms to store room details in hotel_rooms table with hotel_id foreign key
5. 5. WHEN an Operations Manager edits hotel or room details, THE Admin_Panel SHALL call PATCH /v1/admin/hotels/:id or PATCH /v1/admin/hotels/:hotelId/rooms/:roomId to update the respective tables
6. 6. THE Admin_Panel SHALL display room availability by querying bookings table for records with booking_type HOTEL_ONLY or PACKAGE, status CONFIRMED or RESERVED, and hotel_room_id matching the room
7. 7. THE Admin_Panel SHALL prevent double-booking by checking for overlapping date ranges in bookings table before confirming new hotel reservations

## Requirement 7: Tour Guide Management

1. 1. THE Admin_Panel SHALL display a list of all tour guides from guides table via GET /v1/admin/guides with columns: id, name, bio, profile_picture, languages (TEXT[]), specialties (TEXT[]), experience_years, certifications (TEXT[]), rating, review_count, price_per_hour, and price_per_day
2. 2. WHEN an Operations Manager creates a tour guide profile, THE Admin_Panel SHALL call POST /v1/admin/guides to store name, bio, profile_picture, languages, specialties, experience_years, certifications, price_per_hour, and price_per_day in guides table
3. 3. WHEN an Operations Manager edits a guide profile, THE Admin_Panel SHALL call PATCH /v1/admin/guides/:id to update the guide information in guides table
4. 4. THE Admin_Panel SHALL display guide assignments by querying bookings table for records with booking_type GUIDE_ONLY or PACKAGE, status CONFIRMED, and guide_id matching the guide
5. 5. THE Admin_Panel SHALL display guide performance metrics by aggregating reviews table records where target_type is GUIDE and target_id matches the guide_id
6. 6. WHEN filtering guides, THE Admin_Panel SHALL filter by languages array contains value or specialties array contains value
7. 7. THE Admin_Panel SHALL check guide availability by querying bookings table for overlapping date ranges with status CONFIRMED or RESERVED before allowing new assignments

## Requirement 8: Booking Operations Dashboard

1. 1. THE Admin_Panel SHALL display a unified list of all bookings from bookings table via GET /v1/admin/bookings with columns: id, booking_ref, user_id, booking_type (PACKAGE, HOTEL_ONLY, TRANSPORT_ONLY, GUIDE_ONLY), status (RESERVED, CONFIRMED, CANCELLED, COMPLETED, REFUNDED), travel_date, and total_usd
2. 2. WHEN a Support Agent searches for bookings, THE Admin_Panel SHALL filter by booking_ref, user email (join users table), date range on travel_date, or booking_type
3. 3. WHEN a Support Agent views booking details, THE Admin_Panel SHALL call GET /v1/admin/bookings/:id to display complete booking information including trip, hotel_room, transport_vehicle, guide (via foreign keys), payment status from payments table, and customizations JSON
4. 4. WHEN a Support Agent modifies a booking, THE Admin_Panel SHALL call PATCH /v1/admin/bookings/:id to update travel_date, end_date, num_adults, num_children, or customizations in bookings table
5. 5. WHEN a Support Agent cancels a booking, THE Admin_Panel SHALL call POST /v1/bookings/:id/cancel which updates status to CANCELLED, processes refund via Stripe, and releases assigned resources (driver, hotel room, guide)
6. 6. THE Admin_Panel SHALL display booking status values from BookingStatus enum: RESERVED, CONFIRMED, CANCELLED, COMPLETED, REFUNDED
7. 7. WHEN a booking requires refund processing, THE Admin_Panel SHALL display refunded_amount_usd from payments table and allow Support Agent to initiate additional refunds via POST /v1/payments/:bookingId/refund

## Requirement 9: Analytics and Reporting

1. 1. THE Admin_Panel SHALL display total revenue by booking_type (PACKAGE, HOTEL_ONLY, TRANSPORT_ONLY, GUIDE_ONLY) for a selected date range via GET /v1/admin/analytics/revenue aggregating total_usd from bookings table where status is CONFIRMED or COMPLETED
2. 2. THE Admin_Panel SHALL display booking statistics via GET /v1/admin/analytics/bookings including total count, count by status (CONFIRMED, COMPLETED, CANCELLED, REFUNDED), and cancellation rate calculated as CANCELLED count divided by total count
3. 3. THE Admin_Panel SHALL display driver performance metrics via GET /v1/admin/analytics/drivers aggregating driver_assignments table for total trips per driver and joining reviews table for average ratings
4. 4. THE Admin_Panel SHALL display popular destinations by aggregating bookings table joined with trips table, grouping by trip province, and ordering by booking count
5. 5. THE Admin_Panel SHALL display hotel occupancy rate by calculating (booked room-nights / total available room-nights) from bookings table where booking_type includes hotel and status is CONFIRMED
6. 6. THE Admin_Panel SHALL display tour guide utilization rate by calculating percentage of days guides have assignments from driver_assignments table grouped by guide_id
7. 7. WHEN a Super Admin exports a report, THE Admin_Panel SHALL call GET /v1/admin/analytics/export with date range and metric type to generate a CSV or PDF file with the selected data

## Requirement 10: User and Role Management

1. 1. THE Admin_Panel SHALL display a list of all administrator users via GET /v1/admin/users joining users table with admin_users table showing email, name, role from users table, and admin_role (SUPER_ADMIN, OPERATIONS_MANAGER, SUPPORT_AGENT, FLEET_MANAGER) and permissions JSON from admin_users table
2. 2. WHEN a Super Admin creates a new administrator, THE Admin_Panel SHALL call POST /v1/admin/users to create a record in users table with role ADMIN and a linked record in admin_users table with admin_role and permissions JSON
3. 3. WHEN a Super Admin assigns an admin role, THE Admin_Panel SHALL call PATCH /v1/admin/users/:id to update admin_role in admin_users table to SUPER_ADMIN, OPERATIONS_MANAGER, SUPPORT_AGENT, or FLEET_MANAGER
4. 4. THE Admin_Panel SHALL enforce role-based permissions where FLEET_MANAGER can only access GET /v1/admin/drivers, GET /v1/admin/vehicles, and GET /v1/admin/maintenance endpoints
5. 5. THE Admin_Panel SHALL enforce role-based permissions where SUPPORT_AGENT can only access GET /v1/admin/bookings and PATCH /v1/admin/bookings/:id but cannot access driver or vehicle management endpoints
6. 6. WHEN a Super Admin deactivates an administrator account, THE Admin_Panel SHALL call PATCH /v1/admin/users/:id to set is_active to false in admin_users table and increment token_version in users table to revoke all tokens
7. 7. THE Admin_Panel SHALL create audit_logs records for all administrative actions with admin_user_id, action_type, affected_resource_id, resource_type, changed_fields JSON, and timestamp

## Requirement 11: Emergency Alert Management

1. 1. THE Admin_Panel SHALL display a list of all emergency alerts from emergency_alerts table via GET /v1/admin/emergency with columns: id, user_id, booking_id, latitude, longitude, alert_type (SOS, MEDICAL, THEFT, LOST), status (SENT, ACKNOWLEDGED, RESOLVED), message, and created_at
2. 2. WHEN an emergency alert is received, THE Admin_Panel SHALL display a prominent notification banner and play a sound alert via browser Notification API
3. 3. WHEN an Operations Manager views an emergency alert, THE Admin_Panel SHALL call GET /v1/admin/emergency/:id to display user contact from users table, current location coordinates, alert_type, message, and associated booking details from bookings table
4. 4. WHEN an Operations Manager responds to an emergency, THE Admin_Panel SHALL call PATCH /v1/admin/emergency/:id to update status to ACKNOWLEDGED, set acknowledged_at timestamp, and record responder admin_user_id
5. 5. WHEN an emergency is resolved, THE Admin_Panel SHALL call PATCH /v1/admin/emergency/:id to update status to RESOLVED, set resolved_at timestamp, and store resolution_notes
6. 6. THE Admin_Panel SHALL display real-time location tracking by rendering latitude and longitude on a Leaflet.js map component for alerts with status SENT or ACKNOWLEDGED
7. 7. THE Admin_Panel SHALL display user phone number from users table and assigned driver phone from drivers table (via driver_assignments) to allow Operations Manager to initiate contact

## Requirement 12: Real-Time Updates and Notifications

1. 1. THE Admin_Panel SHALL establish a WebSocket connection to Backend_API at wss://api.derlg.com/v1/admin/ws for real-time updates using the useWebSocket custom hook
2. 2. WHEN a new booking is created, THE Backend_API SHALL publish to Redis channel admin_events and Admin_Panel SHALL display a notification within 5 seconds
3. 3. WHEN a driver updates their status via Telegram_Bot, THE Backend_API SHALL publish to Redis channel driver_status_changed:{driver_id} and Admin_Panel SHALL update the Real_Time_Dashboard within 5 seconds without page refresh
4. 4. WHEN a booking status changes from RESERVED to CONFIRMED (payment success), THE Backend_API SHALL publish to Redis and Admin_Panel SHALL update the booking list using React Query cache invalidation
5. 5. WHEN an emergency alert is triggered, THE Admin_Panel SHALL receive WebSocket message with type EMERGENCY_ALERT and display an urgent notification with browser sound alert via Notification API
6. 6. IF the WebSocket connection is lost, THE Admin_Panel SHALL attempt to reconnect every 10 seconds using exponential backoff and display a connection status indicator in the top navigation bar
7. 7. THE Admin_Panel SHALL display a notification counter badge showing unread count for new bookings, driver status changes, and emergency alerts stored in Zustand notification store

## Requirement 13: Discount Code Management

1. 1. THE Admin_Panel SHALL display active discount codes from discount_codes table via GET /v1/admin/discounts with columns: id, code, discount_percentage, valid_from, valid_until, max_usage, usage_count, and is_active
2. 2. WHEN an Operations Manager creates a discount code, THE Admin_Panel SHALL call POST /v1/admin/discounts to store code, discount_percentage, valid_from, valid_until, max_usage, and is_active in discount_codes table
3. 3. WHEN an Operations Manager deactivates a discount code, THE Admin_Panel SHALL call PATCH /v1/admin/discounts/:id to set is_active to false preventing future usage
4. 4. THE Admin_Panel SHALL display student discount verification requests from student_verifications table via GET /v1/admin/student-verifications with columns: id, user_id, student_id_image_url, face_selfie_url, status (PENDING, APPROVED, REJECTED), submitted_at
5. 5. WHEN an Operations Manager reviews a student verification, THE Admin_Panel SHALL display the uploaded images from Supabase Storage using student_id_image_url and face_selfie_url
6. 6. WHEN an Operations Manager approves a student discount, THE Admin_Panel SHALL call PATCH /v1/admin/student-verifications/:id to update status to APPROVED, set reviewed_at timestamp, and update users table setting is_student to true and student_verified_at to current timestamp
7. 7. WHEN an Operations Manager rejects a student verification, THE Admin_Panel SHALL call PATCH /v1/admin/student-verifications/:id to update status to REJECTED and set reviewed_at timestamp

## Requirement 14: Vehicle Maintenance Scheduling

1. 1. THE Admin_Panel SHALL display a maintenance schedule calendar via GET /v1/admin/maintenance showing all records from vehicle_maintenance table with columns: id, vehicle_id, maintenance_type, scheduled_date, completion_date, maintenance_cost, maintenance_notes, and status (SCHEDULED, IN_MAINTENANCE, COMPLETED)
2. 2. WHEN a Fleet Manager schedules maintenance, THE Admin_Panel SHALL call POST /v1/admin/maintenance to store vehicle_id (FK to transportation_vehicles.id), maintenance_type, scheduled_date, maintenance_notes, and status SCHEDULED in vehicle_maintenance table
3. 3. WHEN a maintenance date approaches within 3 days, THE Admin_Panel SHALL display a reminder notification by filtering vehicle_maintenance records where scheduled_date is between now and now + 3 days
4. 4. WHEN a vehicle enters maintenance, THE Admin_Panel SHALL call PATCH /v1/admin/maintenance/:id to update status to IN_MAINTENANCE and prevent the vehicle from being assigned by checking vehicle_maintenance status before driver assignments
5. 5. WHEN maintenance is completed, THE Admin_Panel SHALL call PATCH /v1/admin/maintenance/:id to update status to COMPLETED, set completion_date to current timestamp, and record maintenance_cost
6. 6. THE Admin_Panel SHALL display maintenance history for each vehicle by querying vehicle_maintenance table filtered by vehicle_id and ordered by scheduled_date descending
7. 7. THE Admin_Panel SHALL calculate total maintenance cost per vehicle for a selected date range by summing maintenance_cost from vehicle_maintenance table grouped by vehicle_id

## Requirement 15: Customer Support Interface

1. 1. THE Admin_Panel SHALL display a searchable list of customers from users table via GET /v1/admin/customers with columns: id, name, email, phone, role, loyalty_points, is_student, and created_at
2. 2. WHEN a Support Agent searches for a customer, THE Admin_Panel SHALL filter by name (ILIKE), email (ILIKE), or phone (exact match)
3. 3. WHEN a Support Agent views a customer profile, THE Admin_Panel SHALL call GET /v1/admin/customers/:id to display complete user information and booking history from bookings table ordered by created_at descending
4. 4. THE Admin_Panel SHALL display customer loyalty_points balance from users table and transaction history from loyalty_transactions table showing type (EARNED, REDEEMED, ADJUSTED), points, description, and created_at
5. 5. WHEN a Support Agent views customer feedback, THE Admin_Panel SHALL query reviews table where user_id matches the customer showing rating, title, content, target_type, target_id, and created_at
6. 6. THE Admin_Panel SHALL display customer emergency alerts from emergency_alerts table showing alert_type, status, latitude, longitude, message, and created_at
7. 7. WHEN a Support Agent manually adjusts loyalty points, THE Admin_Panel SHALL call POST /v1/admin/loyalty/adjust to update users.loyalty_points and create a loyalty_transactions record with type ADJUSTED

## Requirement 16: AI Agent Booking Monitoring

1. 1. THE Admin_Panel SHALL display a flag indicating which bookings were created via AI_Agent by checking if the booking was created through POST /v1/ai-tools/create-booking endpoint (tracked via metadata JSON field in bookings table)
2. 2. WHEN an Operations Manager filters bookings by source, THE Admin_Panel SHALL filter bookings table by metadata JSON field containing ai_assisted: true or ai_assisted: false
3. 3. THE Admin_Panel SHALL display the AI session_id associated with each AI_Agent booking from the metadata JSON field in bookings table
4. 4. WHEN an Operations Manager views an AI_Agent booking, THE Admin_Panel SHALL call GET /v1/admin/ai-sessions/:sessionId to retrieve conversation history from Redis (if still available within 7-day TTL) or display "Session expired"
5. 5. THE Admin_Panel SHALL calculate AI_Agent booking success rate via GET /v1/admin/analytics/ai-bookings as (count of bookings with status CONFIRMED or COMPLETED and ai_assisted true) / (total count of bookings with ai_assisted true)
6. 6. WHEN an AI_Agent booking has validation errors, THE Admin_Panel SHALL display the error details from metadata JSON field and allow Operations Manager to manually correct via PATCH /v1/admin/bookings/:id
7. 7. THE Admin_Panel SHALL display AI_Agent performance metrics via GET /v1/admin/analytics/ai-performance including average booking creation time and customer satisfaction from reviews table where booking metadata contains ai_assisted true

## Requirement 17: Multi-Language Support

1. 1. THE Admin_Panel SHALL support English (EN), Chinese (ZH), and Khmer (KM) language interfaces using next-intl library with translation files in public/locales/
2. 2. WHEN an administrator selects a language preference, THE Admin_Panel SHALL update the Zustand language store and re-render all interface text using the selected locale
3. 3. THE Admin_Panel SHALL store the administrator's preferred_language in users table via PATCH /v1/users/profile
4. 4. WHEN an administrator logs in, THE Admin_Panel SHALL load the interface in their preferred_language from users table and initialize next-intl with that locale
5. 5. THE Admin_Panel SHALL display customer data (name, email, phone, addresses) in the original language without translation
6. 6. THE Admin_Panel SHALL display system messages, notifications, and UI labels in the administrator's selected language by loading translations from public/locales/{locale}/admin.json
7. 7. WHEN displaying dates and times, THE Admin_Panel SHALL format according to the selected language locale using Intl.DateTimeFormat with the appropriate locale code

## Requirement 18: Data Export and Backup

1. 1. THE Admin_Panel SHALL allow Super Admin to export booking data via GET /v1/admin/export/bookings with query parameters start_date, end_date, and format (CSV or JSON) returning a downloadable file
2. 2. WHEN a Super Admin exports driver data, THE Admin_Panel SHALL call GET /v1/admin/export/drivers to generate a file containing all driver profiles from drivers table, performance metrics from driver_assignments table, and ratings from reviews table
3. 3. WHEN a Super Admin exports financial data, THE Admin_Panel SHALL call GET /v1/admin/export/payments to generate a file containing all payment records from payments table including amount_usd, status, payment_method, refunded_amount_usd, and created_at
4. 4. THE Admin_Panel SHALL allow Super Admin to trigger database backup via POST /v1/admin/backup which creates a Supabase database dump and stores it in Supabase Storage with timestamp
5. 5. WHEN a backup is created, THE Backend_API SHALL store backup metadata in a backups table with columns: id, backup_file_url, backup_size_bytes, created_at, created_by_admin_id
6. 6. THE Admin_Panel SHALL display a list of available backups via GET /v1/admin/backups showing created_at, backup_size_bytes, and download link to Supabase Storage URL
7. 7. THE Admin_Panel SHALL encrypt exported files containing sensitive customer data (email, phone, payment details) using AES-256 encryption before download and provide decryption key separately

## Requirement 19: Audit Logging

1. 1. THE Admin_Panel SHALL display audit logs from audit_logs table via GET /v1/admin/audit-logs with columns: id, admin_user_id, action_type, affected_resource_id, resource_type, changed_fields (JSON), and timestamp
2. 2. WHEN a Super Admin views audit logs, THE Admin_Panel SHALL filter by date range on timestamp, admin_user_id (join with users table to show admin name), or action_type (DRIVER_ASSIGNMENT, BOOKING_MODIFICATION, PRICING_CHANGE, USER_ROLE_CHANGE, etc.)
3. 3. THE Admin_Panel SHALL log driver assignments by creating audit_logs records with action_type DRIVER_ASSIGNMENT, affected_resource_id (driver_id), resource_type DRIVER, and changed_fields JSON containing booking_id, vehicle_id, and assignment_timestamp
4. 4. THE Admin_Panel SHALL log booking modifications by creating audit_logs records with action_type BOOKING_MODIFICATION, affected_resource_id (booking_id), resource_type BOOKING, and changed_fields JSON containing old and new values for modified fields
5. 5. THE Admin_Panel SHALL log pricing changes by creating audit_logs records with action_type PRICING_CHANGE, affected_resource_id (vehicle_id, hotel_id, or guide_id), resource_type (VEHICLE, HOTEL, GUIDE), and changed_fields JSON containing old_price and new_price
6. 6. THE Backend_API SHALL retain audit logs for at least 365 days in audit_logs table with no automatic deletion
7. 7. WHEN a Super Admin exports audit logs, THE Admin_Panel SHALL call GET /v1/admin/audit-logs/export with date range parameters to generate a CSV file with all log entries including admin name from users table join

## Requirement 20: Dashboard Overview

1. 1. THE Admin_Panel SHALL display a dashboard via GET /v1/admin/dashboard showing total_bookings_today (count from bookings table where created_at is today), total_revenue_today (sum of total_usd from bookings where status is CONFIRMED and created_at is today), and active_drivers_count (count from drivers table where status is AVAILABLE or BUSY)
2. 2. THE Admin_Panel SHALL display a chart showing booking trends for the past 30 days by aggregating bookings table grouped by DATE(created_at) and counting records per day
3. 3. THE Admin_Panel SHALL display a list of pending_actions including unassigned bookings (bookings with booking_type TRANSPORT_ONLY and no record in driver_assignments table) and pending_maintenance (vehicle_maintenance records with status SCHEDULED and scheduled_date within 7 days)
4. 4. THE Admin_Panel SHALL display recent_emergency_alerts from emergency_alerts table where status is SENT or ACKNOWLEDGED, ordered by created_at descending, showing alert_type, user name from users table join, and time_since_alert calculated as current timestamp minus created_at
5. 5. THE Admin_Panel SHALL display driver_availability_summary showing count of drivers grouped by status (AVAILABLE, BUSY, OFFLINE) from drivers table
6. 6. THE Admin_Panel SHALL display upcoming_bookings for the next 24 hours by querying bookings table where travel_date is between now and now + 24 hours, status is CONFIRMED, showing booking_ref, travel_date, booking_type, and customer name from users table join
7. 7. THE Admin_Panel SHALL refresh dashboard metrics automatically every 60 seconds using React Query with refetchInterval option without requiring page reload

---

# Design Reference

## AdminLayout

(`frontend/components/layout/AdminLayout.tsx`)
- Sidebar navigation with role-based menu items
- Top bar with admin user info, language selector, notification bell
- Connection status indicator for WebSocket
- Responsive design (collapsible sidebar on mobile)

## AdminSidebar

(`frontend/components/admin/AdminSidebar.tsx`)
- Navigation menu filtered by admin role permissions
- Active route highlighting
- Icons from lucide-react

## AdminUserForm

(`frontend/components/admin/users/AdminUserForm.tsx`)
- Form for creating/editing admin users
- Fields: email, name, admin_role (dropdown), permissions (checkboxes)
- Role-based permission presets

##

## AdminUserList

(`frontend/components/admin/users/AdminUserList.tsx`)
- Data table with columns: name, email, admin_role, permissions, is_active
- Actions: Edit Role, Deactivate

## AnalyticsDashboard

(`frontend/components/admin/analytics/AnalyticsDashboard.tsx`)
- Revenue charts by booking type
- Booking statistics (total, by status, cancellation rate)
- Driver performance metrics
- Popular destinations chart
- Hotel occupancy rate
- Guide utilization rate
- Date range selector
- Export button

## Architecture

## Architecture

#

## AuditLogViewer

(`frontend/components/admin/audit/AuditLogViewer.tsx`)
- Data table with columns: timestamp, admin_user, action_type, resource_type, affected_resource_id
- Filters: date range, admin_user, action_type
- Expandable rows showing changed_fields JSON
- Export button

## Backend Module Structure

### Backend Module Structure

```
backend/src/
├── admin/                      # New admin module
│   ├── admin.module.ts
│   ├── controllers/
│   │   ├── admin-dashboard.controller.ts
│   │   ├── admin-drivers.controller.ts
│   │   ├── admin-vehicles.controller.ts
│   │   ├── admin-bookings.controller.ts
│   │   ├── admin-hotels.controller.ts
│   │   ├── admin-guides.controller.ts
│   │   ├── admin-emergency.controller.ts
│   │   ├── admin-customers.controller.ts
│   │   ├── admin-discounts.controller.ts
│   │   ├── admin-analytics.controller.ts
│   │   ├── admin-users.controller.ts
│   │   └── admin-audit.controller.ts
│   ├── services/
│   │   ├── admin-dashboard.service.ts
│   │   ├── admin-drivers.service.ts
│   │   ├── admin-vehicles.service.ts
│   │   ├── admin-bookings.service.ts
│   │   ├── admin-hotels.service.ts
│   │   ├── admin-guides.service.ts
│   │   ├── admin-emergency.service.ts
│   │   ├── admin-customers.service.ts
│   │   ├── admin-discounts.service.ts
│   │   ├── admin-analytics.service.ts
│   │   ├── admin-users.service.ts
│   │   └── admin-audit.service.ts
│   ├── dto/
│   │   ├── create-driver.dto.ts
│   │   ├── update-driver.dto.ts
│   │   ├── create-vehicle.dto.ts
│   │   ├── driver-assignment.dto.ts
│   │   ├── maintenance-schedule.dto.ts
│   │   └── [other DTOs]
│   ├── guards/
│   │   └── admin-role.guard.ts
│   └── websocket/
│       └── admin-gateway.ts    # WebSocket gateway for real-time updates
├── telegram/                   # New telegram module
│   ├── telegram.module.ts
│   ├── telegram.controller.ts  # Webhook endpoint
│   └── telegram.service.ts
└── common/
    └── decorators/
        └── admin-roles.decorator.ts
```

## BookingDetailView

(`frontend/components/admin/bookings/BookingDetailView.tsx`)
- Complete booking information
- Customer details (from users table)
- Trip/hotel/vehicle/guide details (via foreign keys)
- Payment status and history
- Driver assignment section
- Modification and cancellation actions

## BookingList

(`frontend/components/admin/bookings/BookingList.tsx`)
- Data table with columns: booking_ref, customer, type, status, travel_date, total
- Filters: booking_type, status, date range, AI-assisted flag
- Search by booking_ref or customer email
- Real-time updates for new bookings

## BookingModificationForm

(`frontend/components/admin/bookings/BookingModificationForm.tsx`)
- Form to modify booking details
- Fields: travel_date, end_date, num_adults, num_children, customizations
- Validation and price recalculation


##

## BookingTrendChart

(`frontend/components/admin/dashboard/BookingTrendChart.tsx`)
- Line chart showing daily booking counts
- Uses recharts library
- Responsive design

##

## CustomerList

(`frontend/components/admin/customers/CustomerList.tsx`)
- Data table with columns: name, email, phone, loyalty_points, is_student
- Search by name, email, or phone
- Actions: View Profile

## CustomerProfileView

(`frontend/components/admin/customers/CustomerProfileView.tsx`)
- Customer information
- Booking history table
- Loyalty points balance and transaction history
- Reviews and feedback
- Emergency alerts history
- Loyalty points adjustment form

##

## DashboardOverview

(`frontend/components/admin/dashboard/DashboardOverview.tsx`)
- Key metrics cards (bookings today, revenue today, active drivers)
- Booking trend chart (30-day line chart using recharts)
- Pending actions list
- Recent emergency alerts

## DiscountCodeForm

(`frontend/components/admin/discounts/DiscountCodeForm.tsx`)
- Form for creating/editing discount codes
- Fields: code, discount_percentage, valid_from, valid_until, max_usage
- Validation: code uniqueness, date range validity

## DiscountCodeList

(`frontend/components/admin/discounts/DiscountCodeList.tsx`)
- Data table with columns: code, discount_percentage, valid_from, valid_until, usage_count, max_usage, is_active
- Actions: Edit, Deactivate

## DriverAssignmentPanel

(`frontend/components/admin/bookings/DriverAssignmentPanel.tsx`)
- Dropdown to select available driver
- Vehicle capacity validation
- Assign button calls POST /v1/admin/assignments
- Shows current assignment if exists

## DriverDetailView

(`frontend/components/admin/drivers/DriverDetailView.tsx`)
- Driver profile information
- Assigned vehicle details
- Assignment history table
- Performance metrics (total trips, average rating)

##

## DriverForm

(`frontend/components/admin/drivers/DriverForm.tsx`)
- Form for creating/editing driver profiles
- Fields: driver_name, driver_id, telegram_id, phone, vehicle_id (dropdown)
- Validation using React Hook Form + Zod
- Submit calls POST/PATCH /v1/admin/drivers

## DriverList

(`frontend/components/admin/drivers/DriverList.tsx`)
- Data table with columns: name, driver_id, vehicle, status, last_update
- Status filter dropdown (AVAILABLE, BUSY, OFFLINE)
- Search by name or driver_id
- Real-time status updates via WebSocket
- Actions: Edit, View Details

## DriverStatusBadge

(`frontend/components/admin/drivers/DriverStatusBadge.tsx`)
- Color-coded badge: green (AVAILABLE), yellow (BUSY), gray (OFFLINE)
- Pulsing animation for real-time updates

## EmergencyAlertList

(`frontend/components/admin/emergency/EmergencyAlertList.tsx`)
- Data table with columns: alert_type, customer, location, status, time
- Filter by status (SENT, ACKNOWLEDGED, RESOLVED) and alert_type
- Urgent visual styling for SENT alerts
- Sound notification for new alerts

## EmergencyDetailView

(`frontend/components/admin/emergency/EmergencyDetailView.tsx`)
- Alert details (type, message, timestamp)
- Customer contact information
- Assigned driver contact (if applicable)
- Location map using Leaflet.js
- Action buttons: Acknowledge, Resolve
- Resolution notes textarea

## EmergencyMap

(`frontend/components/admin/emergency/EmergencyMap.tsx`)
- Leaflet.js map showing alert location
- Marker with alert type icon
- Nearby hotels/hospitals/police stations

##

## Frontend Route Structure

### Frontend Route Structure

```
frontend/app/
├── (admin)/                    # Admin route group
│   ├── layout.tsx              # Admin layout with sidebar navigation
│   ├── admin/
│   │   ├── dashboard/
│   │   │   └── page.tsx        # Dashboard overview
│   │   ├── drivers/
│   │   │   ├── page.tsx        # Driver list and management
│   │   │   └── [id]/
│   │   │       └── page.tsx    # Driver detail view
│   │   ├── vehicles/
│   │   │   ├── page.tsx        # Vehicle fleet management
│   │   │   └── [id]/
│   │   │       └── page.tsx    # Vehicle detail and maintenance
│   │   ├── bookings/
│   │   │   ├── page.tsx        # Booking operations dashboard
│   │   │   └── [id]/
│   │   │       └── page.tsx    # Booking detail and modification
│   │   ├── hotels/
│   │   │   ├── page.tsx        # Hotel inventory list
│   │   │   └── [id]/
│   │   │       ├── page.tsx    # Hotel detail
│   │   │       └── rooms/
│   │   │           └── page.tsx # Room management
│   │   ├── guides/
│   │   │   ├── page.tsx        # Tour guide management
│   │   │   └── [id]/
│   │   │       └── page.tsx    # Guide detail and assignments
│   │   ├── emergency/
│   │   │   ├── page.tsx        # Emergency alerts dashboard
│   │   │   └── [id]/
│   │   │       └── page.tsx    # Emergency detail with map
│   │   ├── customers/
│   │   │   ├── page.tsx        # Customer support interface
│   │   │   └── [id]/
│   │   │       └── page.tsx    # Customer profile and history
│   │   ├── discounts/
│   │   │   ├── page.tsx        # Discount code management
│   │   │   └── student-verifications/
│   │   │       └── page.tsx    # Student verification queue
│   │   ├── analytics/
│   │   │   └── page.tsx        # Analytics and reporting
│   │   ├── users/
│   │   │   └── page.tsx        # Admin user management
│   │   └── audit-logs/
│   │       └── page.tsx        # Audit log viewer
```

## HotelForm

(`frontend/components/admin/hotels/HotelForm.tsx`)
- Form for creating/editing hotels
- Fields: name, description, location (JSON with lat/lng), images, rating, amenities, check_in_time, check_out_time, cancellation_policy
- Location picker using Leaflet.js map

## HotelList

(`frontend/components/admin/hotels/HotelList.tsx`)
- Data table with columns: name, location, rating, room_count
- Search by name or location
- Actions: Edit, Manage Rooms

## MaintenanceHistory

(`frontend/components/admin/vehicles/MaintenanceHistory.tsx`)
- Table of past maintenance records
- Columns: date, type, cost, notes, status
- Total cost calculation

##

## MaintenanceScheduler

(`frontend/components/admin/vehicles/MaintenanceScheduler.tsx`)
- Calendar view of scheduled maintenance
- Form to schedule new maintenance
- Fields: vehicle_id, maintenance_type, scheduled_date, notes
- Reminder notifications for upcoming maintenance

## MetricCard

(`frontend/components/admin/dashboard/MetricCard.tsx`)
- Reusable card for displaying single metric
- Props: title, value, icon, trend (up/down percentage)

## NotificationBell

(`frontend/components/admin/NotificationBell.tsx`)
- Badge showing unread notification count
- Dropdown with recent notifications (bookings, driver status, emergencies)
- Click to mark as read

##

## PerformanceMetrics

(`frontend/components/admin/analytics/PerformanceMetrics.tsx`)
- Table of driver/guide performance
- Columns: name, total_trips, average_rating, revenue_generated

##

## RevenueChart

(`frontend/components/admin/analytics/RevenueChart.tsx`)
- Bar chart showing revenue by booking type
- Uses recharts library

## RoomForm

(`frontend/components/admin/hotels/RoomForm.tsx`)
- Form for creating/editing rooms
- Fields: name, description, capacity, price_per_night, images, amenities
- Image upload to Supabase Storage

##

## RoomManagement

(`frontend/components/admin/hotels/RoomManagement.tsx`)
- List of rooms for a hotel
- Add/Edit/Delete room actions
- Room availability calendar

## StudentVerificationQueue

(`frontend/components/admin/discounts/StudentVerificationQueue.tsx`)
- List of pending student verifications
- Columns: student_name, submitted_at, status
- Actions: Review

## StudentVerificationReview

(`frontend/components/admin/discounts/StudentVerificationReview.tsx`)
- Display uploaded student ID and selfie images
- Side-by-side comparison
- Approve/Reject buttons with confirmation
- Rejection reason textarea

##

## VehicleForm

(`frontend/components/admin/vehicles/VehicleForm.tsx`)
- Form for creating/editing vehicles
- Fields: name, category, capacity, tier, price_per_day, price_per_km, features (multi-select), images (upload)
- Image upload to Supabase Storage

## VehicleList

(`frontend/components/admin/vehicles/VehicleList.tsx`)
- Data table with columns: name, category, capacity, tier, price, assigned_driver
- Filter by category (VAN, BUS, TUK_TUK) and tier (STANDARD, VIP)
- Search by name
- Actions: Edit, Schedule Maintenance

---

# All Tasks

## Task 1: Database schema extensions

**Status:** ⬜

### Sub-steps

* ⬜ 1.1: Add new Prisma models for admin functionality
* ⬜ 1.2: Generate and apply Prisma migrations

### Requirements

* **2.1**: 1. THE Admin_Panel SHALL display a list of all drivers from a new drivers table via GET /v1/admin/drivers with columns: id, driver_name, driver_id, telegram_id, phone, vehicle_id (FK to transportation_vehicles.id), status (AVAILABLE, BUSY, OFFLINE), and last_status_update
* **2.2**: 2. WHEN a Fleet Manager creates a new driver profile, THE Admin_Panel SHALL call POST /v1/admin/drivers to store driver_name, driver_id, telegram_id, phone, and vehicle_id in the drivers table
* **3.1**: 1. THE Admin_Panel SHALL display a list of all vehicles from transportation_vehicles table via GET /v1/admin/vehicles with columns: id, name, category (VAN, BUS, TUK_TUK), capacity, tier (STANDARD, VIP), price_per_day, price_per_km, features, and images
* **4.1**: 1. WHEN a driver sends `/online vehicle_id: <VEHICLE_ID> driver_name: <NAME>` via Telegram_Bot, THE Telegram_Bot SHALL call Backend_API webhook POST /v1/telegram/driver-status with telegram_id, vehicle_id, driver_name, and status AVAILABLE
* **5.1**: 1. WHEN an Operations Manager assigns a driver to a booking, THE Admin_Panel SHALL call POST /v1/admin/assignments with driver_id, booking_id, and vehicle_id to create a record in driver_assignments table
* **14.1**: 1. THE Admin_Panel SHALL display a maintenance schedule calendar via GET /v1/admin/maintenance showing all records from vehicle_maintenance table with columns: id, vehicle_id, maintenance_type, scheduled_date, completion_date, maintenance_cost, maintenance_notes, and status (SCHEDULED, IN_MAINTENANCE, COMPLETED)

### Design Patterns

* **Architecture**:
  * Pattern: ## Architecture
* **Backend Module Structure**:
  * Pattern: ### Backend Module Structure

### Implementation

```
// Task 1: Database schema extensions
// Implement all sub-steps above
// Satisfy all referenced acceptance criteria
// Follow design.md patterns for file structure and architecture
```

### Verification

* [ ] All referenced acceptance criteria satisfied
* [ ] Design patterns followed (file structure, naming, tech stack)
* [ ] Sub-steps completed with tests passing
* [ ] No extra features beyond current task scope

---

## Task 2: Backend: Admin module setup

**Status:** ⬜

### Sub-steps

* ⬜ 2.1: Create admin module structure
* ⬜ 2.2: Implement AdminRoleGuard

### Requirements

* **1.1**: 1. WHEN an administrator provides valid credentials, THE Admin_Panel SHALL authenticate via Backend_API POST /v1/auth/login and receive JWT tokens in httpOnly cookies
* **1.2**: 2. THE Admin_Panel SHALL verify that the authenticated user has role set to ADMIN or SUPPORT in the users table

### Design Patterns

* **Architecture**:
  * Pattern: ## Architecture
* **Backend Module Structure**:
  * Pattern: ### Backend Module Structure

### Implementation

```
// Task 2: Backend: Admin module setup
// Implement all sub-steps above
// Satisfy all referenced acceptance criteria
// Follow design.md patterns for file structure and architecture
```

### Verification

* [ ] All referenced acceptance criteria satisfied
* [ ] Design patterns followed (file structure, naming, tech stack)
* [ ] Sub-steps completed with tests passing
* [ ] No extra features beyond current task scope

---

## Task 3: Backend: Driver management endpoints

**Status:** ⬜

### Sub-steps

* ⬜ 3.1: Implement AdminDriversService
* ⬜ 3.2: Create AdminDriversController
* ⬜ 3.3: Create driver DTOs

### Requirements

* **2.1**: 1. THE Admin_Panel SHALL display a list of all drivers from a new drivers table via GET /v1/admin/drivers with columns: id, driver_name, driver_id, telegram_id, phone, vehicle_id (FK to transportation_vehicles.id), status (AVAILABLE, BUSY, OFFLINE), and last_status_update
* **2.2**: 2. WHEN a Fleet Manager creates a new driver profile, THE Admin_Panel SHALL call POST /v1/admin/drivers to store driver_name, driver_id, telegram_id, phone, and vehicle_id in the drivers table
* **2.3**: 3. WHEN a Fleet Manager edits a driver profile, THE Admin_Panel SHALL call PATCH /v1/admin/drivers/:id to update driver information in the drivers table
* **2.4**: 4. WHEN a Fleet Manager deactivates a driver, THE Admin_Panel SHALL call PATCH /v1/admin/drivers/:id to set status to OFFLINE and prevent future assignments
* **2.5**: 5. THE Admin_Panel SHALL establish a WebSocket connection to receive real-time driver status updates published to Redis channel driver_status_changed:{driver_id}
* **2.7**: 7. THE Admin_Panel SHALL display the last_status_update timestamp for each driver showing when their status was last changed

### Design Patterns

* **DriverList**:
  * Files: frontend/components/admin/drivers/DriverList.tsx
  * Pattern: **DriverList** (`frontend/components/admin/drivers/DriverList.tsx`)
* **DriverForm**:
  * Files: frontend/components/admin/drivers/DriverForm.tsx
  * Pattern: **DriverForm** (`frontend/components/admin/drivers/DriverForm.tsx`)
* **DriverStatusBadge**:
  * Files: frontend/components/admin/drivers/DriverStatusBadge.tsx
  * Pattern: **DriverStatusBadge** (`frontend/components/admin/drivers/DriverStatusBadge.tsx`)
* **DriverDetailView**:
  * Files: frontend/components/admin/drivers/DriverDetailView.tsx
  * Pattern: **DriverDetailView** (`frontend/components/admin/drivers/DriverDetailView.tsx`)

### Implementation

```
// Task 3: Backend: Driver management endpoints
// Implement all sub-steps above
// Satisfy all referenced acceptance criteria
// Follow design.md patterns for file structure and architecture
```

### Verification

* [ ] All referenced acceptance criteria satisfied
* [ ] Design patterns followed (file structure, naming, tech stack)
* [ ] Sub-steps completed with tests passing
* [ ] No extra features beyond current task scope

---

## Task 4: Backend: Vehicle fleet management endpoints

**Status:** ⬜

### Sub-steps

* ⬜ 4.1: Implement AdminVehiclesService
* ⬜ 4.2: Create AdminVehiclesController
* ⬜ 4.3: Create vehicle DTOs

### Requirements

* **3.1**: 1. THE Admin_Panel SHALL display a list of all vehicles from transportation_vehicles table via GET /v1/admin/vehicles with columns: id, name, category (VAN, BUS, TUK_TUK), capacity, tier (STANDARD, VIP), price_per_day, price_per_km, features, and images
* **3.2**: 2. WHEN a Fleet Manager adds a new vehicle, THE Admin_Panel SHALL call POST /v1/admin/vehicles to store name, category, capacity, tier, price_per_day, price_per_km, features, and images in transportation_vehicles table
* **3.3**: 3. WHEN a Fleet Manager edits vehicle details, THE Admin_Panel SHALL call PATCH /v1/admin/vehicles/:id to update the vehicle information in transportation_vehicles table
* **3.6**: 6. WHEN a Fleet Manager searches for vehicles, THE Admin_Panel SHALL filter by name, category (VAN, BUS, TUK_TUK), or tier (STANDARD, VIP)
* **3.7**: 7. THE Admin_Panel SHALL display vehicle availability status based on assigned driver's status and active maintenance records

### Design Patterns

* **VehicleList**:
  * Files: frontend/components/admin/vehicles/VehicleList.tsx
  * Pattern: **VehicleList** (`frontend/components/admin/vehicles/VehicleList.tsx`)
* **VehicleForm**:
  * Files: frontend/components/admin/vehicles/VehicleForm.tsx
  * Pattern: **VehicleForm** (`frontend/components/admin/vehicles/VehicleForm.tsx`)

### Implementation

```
// Task 4: Backend: Vehicle fleet management endpoints
// Implement all sub-steps above
// Satisfy all referenced acceptance criteria
// Follow design.md patterns for file structure and architecture
```

### Verification

* [ ] All referenced acceptance criteria satisfied
* [ ] Design patterns followed (file structure, naming, tech stack)
* [ ] Sub-steps completed with tests passing
* [ ] No extra features beyond current task scope

---

## Task 5: Backend: Vehicle maintenance endpoints

**Status:** ⬜

### Sub-steps

* ⬜ 5.1: Implement AdminMaintenanceService
* ⬜ 5.2: Create AdminMaintenanceController
* ⬜ 5.3: Create maintenance DTOs

### Requirements

* **14.1**: 1. THE Admin_Panel SHALL display a maintenance schedule calendar via GET /v1/admin/maintenance showing all records from vehicle_maintenance table with columns: id, vehicle_id, maintenance_type, scheduled_date, completion_date, maintenance_cost, maintenance_notes, and status (SCHEDULED, IN_MAINTENANCE, COMPLETED)
* **14.2**: 2. WHEN a Fleet Manager schedules maintenance, THE Admin_Panel SHALL call POST /v1/admin/maintenance to store vehicle_id (FK to transportation_vehicles.id), maintenance_type, scheduled_date, maintenance_notes, and status SCHEDULED in vehicle_maintenance table
* **14.3**: 3. WHEN a maintenance date approaches within 3 days, THE Admin_Panel SHALL display a reminder notification by filtering vehicle_maintenance records where scheduled_date is between now and now + 3 days
* **14.4**: 4. WHEN a vehicle enters maintenance, THE Admin_Panel SHALL call PATCH /v1/admin/maintenance/:id to update status to IN_MAINTENANCE and prevent the vehicle from being assigned by checking vehicle_maintenance status before driver assignments
* **14.5**: 5. WHEN maintenance is completed, THE Admin_Panel SHALL call PATCH /v1/admin/maintenance/:id to update status to COMPLETED, set completion_date to current timestamp, and record maintenance_cost
* **14.6**: 6. THE Admin_Panel SHALL display maintenance history for each vehicle by querying vehicle_maintenance table filtered by vehicle_id and ordered by scheduled_date descending
* **14.7**: 7. THE Admin_Panel SHALL calculate total maintenance cost per vehicle for a selected date range by summing maintenance_cost from vehicle_maintenance table grouped by vehicle_id

### Design Patterns

* **MaintenanceScheduler**:
  * Files: frontend/components/admin/vehicles/MaintenanceScheduler.tsx
  * Pattern: **MaintenanceScheduler** (`frontend/components/admin/vehicles/MaintenanceScheduler.tsx`)
* **MaintenanceHistory**:
  * Files: frontend/components/admin/vehicles/MaintenanceHistory.tsx
  * Pattern: **MaintenanceHistory** (`frontend/components/admin/vehicles/MaintenanceHistory.tsx`)

### Implementation

```
// Task 5: Backend: Vehicle maintenance endpoints
// Implement all sub-steps above
// Satisfy all referenced acceptance criteria
// Follow design.md patterns for file structure and architecture
```

### Verification

* [ ] All referenced acceptance criteria satisfied
* [ ] Design patterns followed (file structure, naming, tech stack)
* [ ] Sub-steps completed with tests passing
* [ ] No extra features beyond current task scope

---

## Task 6: Backend: Driver assignment endpoints

**Status:** ⬜

### Sub-steps

* ⬜ 6.1: Implement AdminAssignmentsService
* ⬜ 6.2: Create AdminAssignmentsController
* ⬜ 6.3: Create assignment DTOs

### Requirements

* **5.1**: 1. WHEN an Operations Manager assigns a driver to a booking, THE Admin_Panel SHALL call POST /v1/admin/assignments with driver_id, booking_id, and vehicle_id to create a record in driver_assignments table
* **5.2**: 2. THE Backend_API SHALL verify the driver's status is AVAILABLE in drivers table before allowing assignment
* **5.3**: 3. IF a driver's status is not AVAILABLE, THEN THE Backend_API SHALL return 409 Conflict error and Admin_Panel SHALL display an error message
* **5.4**: 4. WHEN a driver is successfully assigned, THE Backend_API SHALL update the driver's status to BUSY in drivers table and set assignment_timestamp in driver_assignments table
* **5.5**: 5. THE Admin_Panel SHALL display a filtered list of AVAILABLE drivers when selecting a driver for assignment via GET /v1/admin/drivers?status=AVAILABLE
* **5.6**: 6. WHEN assigning a driver, THE Admin_Panel SHALL verify the vehicle capacity from transportation_vehicles table matches the booking's num_adults plus num_children
* **5.7**: 7. WHEN a booking is completed or cancelled, THE Admin_Panel SHALL call PATCH /v1/admin/assignments/:id/complete to set completion_timestamp and update driver status back to AVAILABLE

### Design Patterns

* **DriverAssignmentPanel**:
  * Files: frontend/components/admin/bookings/DriverAssignmentPanel.tsx
  * Pattern: **DriverAssignmentPanel** (`frontend/components/admin/bookings/DriverAssignmentPanel.tsx`)

### Implementation

```
// Task 6: Backend: Driver assignment endpoints
// Implement all sub-steps above
// Satisfy all referenced acceptance criteria
// Follow design.md patterns for file structure and architecture
```

### Verification

* [ ] All referenced acceptance criteria satisfied
* [ ] Design patterns followed (file structure, naming, tech stack)
* [ ] Sub-steps completed with tests passing
* [ ] No extra features beyond current task scope

---

## Task 7: Backend: Telegram webhook endpoint

**Status:** ⬜

### Sub-steps

* ⬜ 7.1: Create Telegram module
* ⬜ 7.2: Implement TelegramService
* ⬜ 7.3: Create TelegramController
* ⬜ 7.4: Create telegram DTOs

### Requirements

* **4.1**: 1. WHEN a driver sends `/online vehicle_id: <VEHICLE_ID> driver_name: <NAME>` via Telegram_Bot, THE Telegram_Bot SHALL call Backend_API webhook POST /v1/telegram/driver-status with telegram_id, vehicle_id, driver_name, and status AVAILABLE
* **4.2**: 2. WHEN Backend_API receives the webhook, THE Backend_API SHALL update or create the driver record in drivers table with status AVAILABLE and last_status_update set to current timestamp

### Design Patterns

* **Architecture**:
  * Pattern: ## Architecture

### Implementation

```
// Task 7: Backend: Telegram webhook endpoint
// Implement all sub-steps above
// Satisfy all referenced acceptance criteria
// Follow design.md patterns for file structure and architecture
```

### Verification

* [ ] All referenced acceptance criteria satisfied
* [ ] Design patterns followed (file structure, naming, tech stack)
* [ ] Sub-steps completed with tests passing
* [ ] No extra features beyond current task scope

---

## Task 8: Backend: Booking operations endpoints

**Status:** ⬜

### Sub-steps

* ⬜ 8.1: Implement AdminBookingsService
* ⬜ 8.2: Create AdminBookingsController
* ⬜ 8.3: Create booking admin DTOs

### Requirements

* **8.1**: 1. THE Admin_Panel SHALL display a unified list of all bookings from bookings table via GET /v1/admin/bookings with columns: id, booking_ref, user_id, booking_type (PACKAGE, HOTEL_ONLY, TRANSPORT_ONLY, GUIDE_ONLY), status (RESERVED, CONFIRMED, CANCELLED, COMPLETED, REFUNDED), travel_date, and total_usd
* **8.2**: 2. WHEN a Support Agent searches for bookings, THE Admin_Panel SHALL filter by booking_ref, user email (join users table), date range on travel_date, or booking_type
* **8.3**: 3. WHEN a Support Agent views booking details, THE Admin_Panel SHALL call GET /v1/admin/bookings/:id to display complete booking information including trip, hotel_room, transport_vehicle, guide (via foreign keys), payment status from payments table, and customizations JSON
* **8.4**: 4. WHEN a Support Agent modifies a booking, THE Admin_Panel SHALL call PATCH /v1/admin/bookings/:id to update travel_date, end_date, num_adults, num_children, or customizations in bookings table
* **8.5**: 5. WHEN a Support Agent cancels a booking, THE Admin_Panel SHALL call POST /v1/bookings/:id/cancel which updates status to CANCELLED, processes refund via Stripe, and releases assigned resources (driver, hotel room, guide)

### Design Patterns

* **BookingList**:
  * Files: frontend/components/admin/bookings/BookingList.tsx
  * Pattern: **BookingList** (`frontend/components/admin/bookings/BookingList.tsx`)
* **BookingDetailView**:
  * Files: frontend/components/admin/bookings/BookingDetailView.tsx
  * Pattern: **BookingDetailView** (`frontend/components/admin/bookings/BookingDetailView.tsx`)
* **BookingModificationForm**:
  * Files: frontend/components/admin/bookings/BookingModificationForm.tsx
  * Pattern: **BookingModificationForm** (`frontend/components/admin/bookings/BookingModificationForm.tsx`)

### Implementation

```
// Task 8: Backend: Booking operations endpoints
// Implement all sub-steps above
// Satisfy all referenced acceptance criteria
// Follow design.md patterns for file structure and architecture
```

### Verification

* [ ] All referenced acceptance criteria satisfied
* [ ] Design patterns followed (file structure, naming, tech stack)
* [ ] Sub-steps completed with tests passing
* [ ] No extra features beyond current task scope

---

## Task 9: Backend: Hotel inventory management endpoints

**Status:** ⬜

### Sub-steps

* ⬜ 9.1: Implement AdminHotelsService
* ⬜ 9.2: Create AdminHotelsController
* ⬜ 9.3: Create hotel admin DTOs

### Requirements

* **6.1**: 1. THE Admin_Panel SHALL display a list of all hotels from hotels table via GET /v1/admin/hotels with columns: id, name, description, location (JSON), rating, review_count, amenities, check_in_time, check_out_time, and cancellation_policy
* **6.2**: 2. WHEN an Operations Manager views hotel rooms, THE Admin_Panel SHALL call GET /v1/admin/hotels/:id/rooms to display hotel_rooms with room name, description, capacity, price_per_night, images, and amenities
* **6.3**: 3. WHEN an Operations Manager adds a new hotel, THE Admin_Panel SHALL call POST /v1/admin/hotels to store name, description, location, images, rating, amenities, check_in_time, check_out_time, and cancellation_policy in hotels table
* **6.4**: 4. WHEN an Operations Manager adds a room to a hotel, THE Admin_Panel SHALL call POST /v1/admin/hotels/:id/rooms to store room details in hotel_rooms table with hotel_id foreign key
* **6.5**: 5. WHEN an Operations Manager edits hotel or room details, THE Admin_Panel SHALL call PATCH /v1/admin/hotels/:id or PATCH /v1/admin/hotels/:hotelId/rooms/:roomId to update the respective tables
* **6.6**: 6. THE Admin_Panel SHALL display room availability by querying bookings table for records with booking_type HOTEL_ONLY or PACKAGE, status CONFIRMED or RESERVED, and hotel_room_id matching the room
* **6.7**: 7. THE Admin_Panel SHALL prevent double-booking by checking for overlapping date ranges in bookings table before confirming new hotel reservations

### Design Patterns

* **HotelList**:
  * Files: frontend/components/admin/hotels/HotelList.tsx
  * Pattern: **HotelList** (`frontend/components/admin/hotels/HotelList.tsx`)
* **HotelForm**:
  * Files: frontend/components/admin/hotels/HotelForm.tsx
  * Pattern: **HotelForm** (`frontend/components/admin/hotels/HotelForm.tsx`)
* **RoomManagement**:
  * Files: frontend/components/admin/hotels/RoomManagement.tsx
  * Pattern: **RoomManagement** (`frontend/components/admin/hotels/RoomManagement.tsx`)
* **RoomForm**:
  * Files: frontend/components/admin/hotels/RoomForm.tsx
  * Pattern: **RoomForm** (`frontend/components/admin/hotels/RoomForm.tsx`)

### Implementation

```
// Task 9: Backend: Hotel inventory management endpoints
// Implement all sub-steps above
// Satisfy all referenced acceptance criteria
// Follow design.md patterns for file structure and architecture
```

### Verification

* [ ] All referenced acceptance criteria satisfied
* [ ] Design patterns followed (file structure, naming, tech stack)
* [ ] Sub-steps completed with tests passing
* [ ] No extra features beyond current task scope

---

## Task 10: Backend: Tour guide management endpoints

**Status:** ⬜

### Sub-steps

* ⬜ 10.1: Implement AdminGuidesService
* ⬜ 10.2: Create AdminGuidesController
* ⬜ 10.3: Create guide admin DTOs

### Requirements

* **7.1**: 1. THE Admin_Panel SHALL display a list of all tour guides from guides table via GET /v1/admin/guides with columns: id, name, bio, profile_picture, languages (TEXT[]), specialties (TEXT[]), experience_years, certifications (TEXT[]), rating, review_count, price_per_hour, and price_per_day
* **7.2**: 2. WHEN an Operations Manager creates a tour guide profile, THE Admin_Panel SHALL call POST /v1/admin/guides to store name, bio, profile_picture, languages, specialties, experience_years, certifications, price_per_hour, and price_per_day in guides table
* **7.3**: 3. WHEN an Operations Manager edits a guide profile, THE Admin_Panel SHALL call PATCH /v1/admin/guides/:id to update the guide information in guides table
* **7.4**: 4. THE Admin_Panel SHALL display guide assignments by querying bookings table for records with booking_type GUIDE_ONLY or PACKAGE, status CONFIRMED, and guide_id matching the guide
* **7.5**: 5. THE Admin_Panel SHALL display guide performance metrics by aggregating reviews table records where target_type is GUIDE and target_id matches the guide_id
* **7.6**: 6. WHEN filtering guides, THE Admin_Panel SHALL filter by languages array contains value or specialties array contains value
* **7.7**: 7. THE Admin_Panel SHALL check guide availability by querying bookings table for overlapping date ranges with status CONFIRMED or RESERVED before allowing new assignments

### Design Patterns


### Implementation

```
// Task 10: Backend: Tour guide management endpoints
// Implement all sub-steps above
// Satisfy all referenced acceptance criteria
// Follow design.md patterns for file structure and architecture
```

### Verification

* [ ] All referenced acceptance criteria satisfied
* [ ] Design patterns followed (file structure, naming, tech stack)
* [ ] Sub-steps completed with tests passing
* [ ] No extra features beyond current task scope

---

## Task 11: Backend: Emergency alert management endpoints

**Status:** ⬜

### Sub-steps

* ⬜ 11.1: Implement AdminEmergencyService
* ⬜ 11.2: Create AdminEmergencyController
* ⬜ 11.3: Create emergency admin DTOs

### Requirements

* **11.1**: 1. THE Admin_Panel SHALL display a list of all emergency alerts from emergency_alerts table via GET /v1/admin/emergency with columns: id, user_id, booking_id, latitude, longitude, alert_type (SOS, MEDICAL, THEFT, LOST), status (SENT, ACKNOWLEDGED, RESOLVED), message, and created_at
* **11.2**: 2. WHEN an emergency alert is received, THE Admin_Panel SHALL display a prominent notification banner and play a sound alert via browser Notification API
* **11.3**: 3. WHEN an Operations Manager views an emergency alert, THE Admin_Panel SHALL call GET /v1/admin/emergency/:id to display user contact from users table, current location coordinates, alert_type, message, and associated booking details from bookings table
* **11.4**: 4. WHEN an Operations Manager responds to an emergency, THE Admin_Panel SHALL call PATCH /v1/admin/emergency/:id to update status to ACKNOWLEDGED, set acknowledged_at timestamp, and record responder admin_user_id
* **11.5**: 5. WHEN an emergency is resolved, THE Admin_Panel SHALL call PATCH /v1/admin/emergency/:id to update status to RESOLVED, set resolved_at timestamp, and store resolution_notes
* **11.6**: 6. THE Admin_Panel SHALL display real-time location tracking by rendering latitude and longitude on a Leaflet.js map component for alerts with status SENT or ACKNOWLEDGED
* **11.7**: 7. THE Admin_Panel SHALL display user phone number from users table and assigned driver phone from drivers table (via driver_assignments) to allow Operations Manager to initiate contact

### Design Patterns

* **EmergencyAlertList**:
  * Files: frontend/components/admin/emergency/EmergencyAlertList.tsx
  * Pattern: **EmergencyAlertList** (`frontend/components/admin/emergency/EmergencyAlertList.tsx`)
* **EmergencyDetailView**:
  * Files: frontend/components/admin/emergency/EmergencyDetailView.tsx
  * Pattern: **EmergencyDetailView** (`frontend/components/admin/emergency/EmergencyDetailView.tsx`)
* **EmergencyMap**:
  * Files: frontend/components/admin/emergency/EmergencyMap.tsx
  * Pattern: **EmergencyMap** (`frontend/components/admin/emergency/EmergencyMap.tsx`)

### Implementation

```
// Task 11: Backend: Emergency alert management endpoints
// Implement all sub-steps above
// Satisfy all referenced acceptance criteria
// Follow design.md patterns for file structure and architecture
```

### Verification

* [ ] All referenced acceptance criteria satisfied
* [ ] Design patterns followed (file structure, naming, tech stack)
* [ ] Sub-steps completed with tests passing
* [ ] No extra features beyond current task scope

---

## Task 12: Backend: Customer support endpoints

**Status:** ⬜

### Sub-steps

* ⬜ 12.1: Implement AdminCustomersService
* ⬜ 12.2: Create AdminCustomersController
* ⬜ 12.3: Create customer admin DTOs

### Requirements

* **15.1**: 1. THE Admin_Panel SHALL display a searchable list of customers from users table via GET /v1/admin/customers with columns: id, name, email, phone, role, loyalty_points, is_student, and created_at
* **15.2**: 2. WHEN a Support Agent searches for a customer, THE Admin_Panel SHALL filter by name (ILIKE), email (ILIKE), or phone (exact match)
* **15.3**: 3. WHEN a Support Agent views a customer profile, THE Admin_Panel SHALL call GET /v1/admin/customers/:id to display complete user information and booking history from bookings table ordered by created_at descending
* **15.4**: 4. THE Admin_Panel SHALL display customer loyalty_points balance from users table and transaction history from loyalty_transactions table showing type (EARNED, REDEEMED, ADJUSTED), points, description, and created_at
* **15.5**: 5. WHEN a Support Agent views customer feedback, THE Admin_Panel SHALL query reviews table where user_id matches the customer showing rating, title, content, target_type, target_id, and created_at
* **15.6**: 6. THE Admin_Panel SHALL display customer emergency alerts from emergency_alerts table showing alert_type, status, latitude, longitude, message, and created_at
* **15.7**: 7. WHEN a Support Agent manually adjusts loyalty points, THE Admin_Panel SHALL call POST /v1/admin/loyalty/adjust to update users.loyalty_points and create a loyalty_transactions record with type ADJUSTED

### Design Patterns

* **CustomerList**:
  * Files: frontend/components/admin/customers/CustomerList.tsx
  * Pattern: **CustomerList** (`frontend/components/admin/customers/CustomerList.tsx`)
* **CustomerProfileView**:
  * Files: frontend/components/admin/customers/CustomerProfileView.tsx
  * Pattern: **CustomerProfileView** (`frontend/components/admin/customers/CustomerProfileView.tsx`)

### Implementation

```
// Task 12: Backend: Customer support endpoints
// Implement all sub-steps above
// Satisfy all referenced acceptance criteria
// Follow design.md patterns for file structure and architecture
```

### Verification

* [ ] All referenced acceptance criteria satisfied
* [ ] Design patterns followed (file structure, naming, tech stack)
* [ ] Sub-steps completed with tests passing
* [ ] No extra features beyond current task scope

---

## Task 13: Backend: Discount code management endpoints

**Status:** ⬜

### Sub-steps

* ⬜ 13.1: Implement AdminDiscountsService
* ⬜ 13.2: Create AdminDiscountsController
* ⬜ 13.3: Create discount admin DTOs

### Requirements

* **13.1**: 1. THE Admin_Panel SHALL display active discount codes from discount_codes table via GET /v1/admin/discounts with columns: id, code, discount_percentage, valid_from, valid_until, max_usage, usage_count, and is_active
* **13.2**: 2. WHEN an Operations Manager creates a discount code, THE Admin_Panel SHALL call POST /v1/admin/discounts to store code, discount_percentage, valid_from, valid_until, max_usage, and is_active in discount_codes table
* **13.3**: 3. WHEN an Operations Manager deactivates a discount code, THE Admin_Panel SHALL call PATCH /v1/admin/discounts/:id to set is_active to false preventing future usage
* **13.4**: 4. THE Admin_Panel SHALL display student discount verification requests from student_verifications table via GET /v1/admin/student-verifications with columns: id, user_id, student_id_image_url, face_selfie_url, status (PENDING, APPROVED, REJECTED), submitted_at
* **13.5**: 5. WHEN an Operations Manager reviews a student verification, THE Admin_Panel SHALL display the uploaded images from Supabase Storage using student_id_image_url and face_selfie_url
* **13.6**: 6. WHEN an Operations Manager approves a student discount, THE Admin_Panel SHALL call PATCH /v1/admin/student-verifications/:id to update status to APPROVED, set reviewed_at timestamp, and update users table setting is_student to true and student_verified_at to current timestamp
* **13.7**: 7. WHEN an Operations Manager rejects a student verification, THE Admin_Panel SHALL call PATCH /v1/admin/student-verifications/:id to update status to REJECTED and set reviewed_at timestamp

### Design Patterns

* **DiscountCodeList**:
  * Files: frontend/components/admin/discounts/DiscountCodeList.tsx
  * Pattern: **DiscountCodeList** (`frontend/components/admin/discounts/DiscountCodeList.tsx`)
* **DiscountCodeForm**:
  * Files: frontend/components/admin/discounts/DiscountCodeForm.tsx
  * Pattern: **DiscountCodeForm** (`frontend/components/admin/discounts/DiscountCodeForm.tsx`)
* **StudentVerificationQueue**:
  * Files: frontend/components/admin/discounts/StudentVerificationQueue.tsx
  * Pattern: **StudentVerificationQueue** (`frontend/components/admin/discounts/StudentVerificationQueue.tsx`)
* **StudentVerificationReview**:
  * Files: frontend/components/admin/discounts/StudentVerificationReview.tsx
  * Pattern: **StudentVerificationReview** (`frontend/components/admin/discounts/StudentVerificationReview.tsx`)

### Implementation

```
// Task 13: Backend: Discount code management endpoints
// Implement all sub-steps above
// Satisfy all referenced acceptance criteria
// Follow design.md patterns for file structure and architecture
```

### Verification

* [ ] All referenced acceptance criteria satisfied
* [ ] Design patterns followed (file structure, naming, tech stack)
* [ ] Sub-steps completed with tests passing
* [ ] No extra features beyond current task scope

---

## Task 14: Backend: Analytics and reporting endpoints

**Status:** ⬜

### Sub-steps

* ⬜ 14.1: Implement AdminAnalyticsService
* ⬜ 14.2: Create AdminAnalyticsController
* ⬜ 14.3: Create analytics DTOs

### Requirements

* **9.1**: 1. THE Admin_Panel SHALL display total revenue by booking_type (PACKAGE, HOTEL_ONLY, TRANSPORT_ONLY, GUIDE_ONLY) for a selected date range via GET /v1/admin/analytics/revenue aggregating total_usd from bookings table where status is CONFIRMED or COMPLETED
* **9.2**: 2. THE Admin_Panel SHALL display booking statistics via GET /v1/admin/analytics/bookings including total count, count by status (CONFIRMED, COMPLETED, CANCELLED, REFUNDED), and cancellation rate calculated as CANCELLED count divided by total count
* **9.3**: 3. THE Admin_Panel SHALL display driver performance metrics via GET /v1/admin/analytics/drivers aggregating driver_assignments table for total trips per driver and joining reviews table for average ratings
* **9.4**: 4. THE Admin_Panel SHALL display popular destinations by aggregating bookings table joined with trips table, grouping by trip province, and ordering by booking count
* **9.5**: 5. THE Admin_Panel SHALL display hotel occupancy rate by calculating (booked room-nights / total available room-nights) from bookings table where booking_type includes hotel and status is CONFIRMED
* **9.6**: 6. THE Admin_Panel SHALL display tour guide utilization rate by calculating percentage of days guides have assignments from driver_assignments table grouped by guide_id
* **9.7**: 7. WHEN a Super Admin exports a report, THE Admin_Panel SHALL call GET /v1/admin/analytics/export with date range and metric type to generate a CSV or PDF file with the selected data
* **16.5**: 5. THE Admin_Panel SHALL calculate AI_Agent booking success rate via GET /v1/admin/analytics/ai-bookings as (count of bookings with status CONFIRMED or COMPLETED and ai_assisted true) / (total count of bookings with ai_assisted true)
* **16.6**: 6. WHEN an AI_Agent booking has validation errors, THE Admin_Panel SHALL display the error details from metadata JSON field and allow Operations Manager to manually correct via PATCH /v1/admin/bookings/:id
* **16.7**: 7. THE Admin_Panel SHALL display AI_Agent performance metrics via GET /v1/admin/analytics/ai-performance including average booking creation time and customer satisfaction from reviews table where booking metadata contains ai_assisted true

### Design Patterns

* **AnalyticsDashboard**:
  * Files: frontend/components/admin/analytics/AnalyticsDashboard.tsx
  * Pattern: **AnalyticsDashboard** (`frontend/components/admin/analytics/AnalyticsDashboard.tsx`)
* **RevenueChart**:
  * Files: frontend/components/admin/analytics/RevenueChart.tsx
  * Pattern: **RevenueChart** (`frontend/components/admin/analytics/RevenueChart.tsx`)
* **PerformanceMetrics**:
  * Files: frontend/components/admin/analytics/PerformanceMetrics.tsx
  * Pattern: **PerformanceMetrics** (`frontend/components/admin/analytics/PerformanceMetrics.tsx`)

### Implementation

```
// Task 14: Backend: Analytics and reporting endpoints
// Implement all sub-steps above
// Satisfy all referenced acceptance criteria
// Follow design.md patterns for file structure and architecture
```

### Verification

* [ ] All referenced acceptance criteria satisfied
* [ ] Design patterns followed (file structure, naming, tech stack)
* [ ] Sub-steps completed with tests passing
* [ ] No extra features beyond current task scope

---

## Task 15: Backend: Admin user management endpoints

**Status:** ⬜

### Sub-steps

* ⬜ 15.1: Implement AdminUsersService
* ⬜ 15.2: Create AdminUsersController
* ⬜ 15.3: Create admin user DTOs

### Requirements

* **10.1**: 1. THE Admin_Panel SHALL display a list of all administrator users via GET /v1/admin/users joining users table with admin_users table showing email, name, role from users table, and admin_role (SUPER_ADMIN, OPERATIONS_MANAGER, SUPPORT_AGENT, FLEET_MANAGER) and permissions JSON from admin_users table
* **10.2**: 2. WHEN a Super Admin creates a new administrator, THE Admin_Panel SHALL call POST /v1/admin/users to create a record in users table with role ADMIN and a linked record in admin_users table with admin_role and permissions JSON
* **10.3**: 3. WHEN a Super Admin assigns an admin role, THE Admin_Panel SHALL call PATCH /v1/admin/users/:id to update admin_role in admin_users table to SUPER_ADMIN, OPERATIONS_MANAGER, SUPPORT_AGENT, or FLEET_MANAGER
* **10.6**: 6. WHEN a Super Admin deactivates an administrator account, THE Admin_Panel SHALL call PATCH /v1/admin/users/:id to set is_active to false in admin_users table and increment token_version in users table to revoke all tokens

### Design Patterns

* **AdminUserList**:
  * Files: frontend/components/admin/users/AdminUserList.tsx
  * Pattern: **AdminUserList** (`frontend/components/admin/users/AdminUserList.tsx`)
* **AdminUserForm**:
  * Files: frontend/components/admin/users/AdminUserForm.tsx
  * Pattern: **AdminUserForm** (`frontend/components/admin/users/AdminUserForm.tsx`)

### Implementation

```
// Task 15: Backend: Admin user management endpoints
// Implement all sub-steps above
// Satisfy all referenced acceptance criteria
// Follow design.md patterns for file structure and architecture
```

### Verification

* [ ] All referenced acceptance criteria satisfied
* [ ] Design patterns followed (file structure, naming, tech stack)
* [ ] Sub-steps completed with tests passing
* [ ] No extra features beyond current task scope

---

## Task 16: Backend: Audit logging endpoints

**Status:** ⬜

### Sub-steps

* ⬜ 16.1: Implement AdminAuditService
* ⬜ 16.2: Create AdminAuditController
* ⬜ 16.3: Create audit DTOs

### Requirements

* **19.1**: 1. THE Admin_Panel SHALL display audit logs from audit_logs table via GET /v1/admin/audit-logs with columns: id, admin_user_id, action_type, affected_resource_id, resource_type, changed_fields (JSON), and timestamp
* **19.2**: 2. WHEN a Super Admin views audit logs, THE Admin_Panel SHALL filter by date range on timestamp, admin_user_id (join with users table to show admin name), or action_type (DRIVER_ASSIGNMENT, BOOKING_MODIFICATION, PRICING_CHANGE, USER_ROLE_CHANGE, etc.)
* **19.3**: 3. THE Admin_Panel SHALL log driver assignments by creating audit_logs records with action_type DRIVER_ASSIGNMENT, affected_resource_id (driver_id), resource_type DRIVER, and changed_fields JSON containing booking_id, vehicle_id, and assignment_timestamp
* **19.4**: 4. THE Admin_Panel SHALL log booking modifications by creating audit_logs records with action_type BOOKING_MODIFICATION, affected_resource_id (booking_id), resource_type BOOKING, and changed_fields JSON containing old and new values for modified fields
* **19.5**: 5. THE Admin_Panel SHALL log pricing changes by creating audit_logs records with action_type PRICING_CHANGE, affected_resource_id (vehicle_id, hotel_id, or guide_id), resource_type (VEHICLE, HOTEL, GUIDE), and changed_fields JSON containing old_price and new_price
* **19.6**: 6. THE Backend_API SHALL retain audit logs for at least 365 days in audit_logs table with no automatic deletion
* **19.7**: 7. WHEN a Super Admin exports audit logs, THE Admin_Panel SHALL call GET /v1/admin/audit-logs/export with date range parameters to generate a CSV file with all log entries including admin name from users table join

### Design Patterns

* **AuditLogViewer**:
  * Files: frontend/components/admin/audit/AuditLogViewer.tsx
  * Pattern: **AuditLogViewer** (`frontend/components/admin/audit/AuditLogViewer.tsx`)

### Implementation

```
// Task 16: Backend: Audit logging endpoints
// Implement all sub-steps above
// Satisfy all referenced acceptance criteria
// Follow design.md patterns for file structure and architecture
```

### Verification

* [ ] All referenced acceptance criteria satisfied
* [ ] Design patterns followed (file structure, naming, tech stack)
* [ ] Sub-steps completed with tests passing
* [ ] No extra features beyond current task scope

---

## Task 17: Backend: Dashboard overview endpoint

**Status:** ⬜

### Sub-steps

* ⬜ 17.1: Implement AdminDashboardService
* ⬜ 17.2: Create AdminDashboardController
* ⬜ 17.3: Create dashboard DTOs

### Requirements

* **20.1**: 1. THE Admin_Panel SHALL display a dashboard via GET /v1/admin/dashboard showing total_bookings_today (count from bookings table where created_at is today), total_revenue_today (sum of total_usd from bookings where status is CONFIRMED and created_at is today), and active_drivers_count (count from drivers table where status is AVAILABLE or BUSY)
* **20.2**: 2. THE Admin_Panel SHALL display a chart showing booking trends for the past 30 days by aggregating bookings table grouped by DATE(created_at) and counting records per day
* **20.3**: 3. THE Admin_Panel SHALL display a list of pending_actions including unassigned bookings (bookings with booking_type TRANSPORT_ONLY and no record in driver_assignments table) and pending_maintenance (vehicle_maintenance records with status SCHEDULED and scheduled_date within 7 days)
* **20.4**: 4. THE Admin_Panel SHALL display recent_emergency_alerts from emergency_alerts table where status is SENT or ACKNOWLEDGED, ordered by created_at descending, showing alert_type, user name from users table join, and time_since_alert calculated as current timestamp minus created_at
* **20.5**: 5. THE Admin_Panel SHALL display driver_availability_summary showing count of drivers grouped by status (AVAILABLE, BUSY, OFFLINE) from drivers table
* **20.6**: 6. THE Admin_Panel SHALL display upcoming_bookings for the next 24 hours by querying bookings table where travel_date is between now and now + 24 hours, status is CONFIRMED, showing booking_ref, travel_date, booking_type, and customer name from users table join

### Design Patterns

* **DashboardOverview**:
  * Files: frontend/components/admin/dashboard/DashboardOverview.tsx
  * Pattern: **DashboardOverview** (`frontend/components/admin/dashboard/DashboardOverview.tsx`)
* **MetricCard**:
  * Files: frontend/components/admin/dashboard/MetricCard.tsx
  * Interface: title, value, icon, trend (up/down percentage)
  * Pattern: **MetricCard** (`frontend/components/admin/dashboard/MetricCard.tsx`)
* **BookingTrendChart**:
  * Files: frontend/components/admin/dashboard/BookingTrendChart.tsx
  * Pattern: **BookingTrendChart** (`frontend/components/admin/dashboard/BookingTrendChart.tsx`)

### Implementation

```
// Task 17: Backend: Dashboard overview endpoint
// Implement all sub-steps above
// Satisfy all referenced acceptance criteria
// Follow design.md patterns for file structure and architecture
```

### Verification

* [ ] All referenced acceptance criteria satisfied
* [ ] Design patterns followed (file structure, naming, tech stack)
* [ ] Sub-steps completed with tests passing
* [ ] No extra features beyond current task scope

---

## Task 18: Backend: Data export and backup endpoints

**Status:** ⬜

### Sub-steps

* ⬜ 18.1: Implement AdminExportService
* ⬜ 18.2: Create AdminExportController
* ⬜ 18.3: Create export DTOs

### Requirements

* **18.1**: 1. THE Admin_Panel SHALL allow Super Admin to export booking data via GET /v1/admin/export/bookings with query parameters start_date, end_date, and format (CSV or JSON) returning a downloadable file
* **18.2**: 2. WHEN a Super Admin exports driver data, THE Admin_Panel SHALL call GET /v1/admin/export/drivers to generate a file containing all driver profiles from drivers table, performance metrics from driver_assignments table, and ratings from reviews table
* **18.3**: 3. WHEN a Super Admin exports financial data, THE Admin_Panel SHALL call GET /v1/admin/export/payments to generate a file containing all payment records from payments table including amount_usd, status, payment_method, refunded_amount_usd, and created_at
* **18.4**: 4. THE Admin_Panel SHALL allow Super Admin to trigger database backup via POST /v1/admin/backup which creates a Supabase database dump and stores it in Supabase Storage with timestamp
* **18.5**: 5. WHEN a backup is created, THE Backend_API SHALL store backup metadata in a backups table with columns: id, backup_file_url, backup_size_bytes, created_at, created_by_admin_id
* **18.6**: 6. THE Admin_Panel SHALL display a list of available backups via GET /v1/admin/backups showing created_at, backup_size_bytes, and download link to Supabase Storage URL
* **18.7**: 7. THE Admin_Panel SHALL encrypt exported files containing sensitive customer data (email, phone, payment details) using AES-256 encryption before download and provide decryption key separately

### Design Patterns

* **Architecture**:
  * Pattern: ## Architecture

### Implementation

```
// Task 18: Backend: Data export and backup endpoints
// Implement all sub-steps above
// Satisfy all referenced acceptance criteria
// Follow design.md patterns for file structure and architecture
```

### Verification

* [ ] All referenced acceptance criteria satisfied
* [ ] Design patterns followed (file structure, naming, tech stack)
* [ ] Sub-steps completed with tests passing
* [ ] No extra features beyond current task scope

---

## Task 19: Backend: AI agent booking monitoring endpoints

**Status:** ⬜

### Sub-steps

* ⬜ 19.1: Implement AdminAIMonitoringService
* ⬜ 19.2: Create AdminAIMonitoringController

### Requirements

* **16.1**: 1. THE Admin_Panel SHALL display a flag indicating which bookings were created via AI_Agent by checking if the booking was created through POST /v1/ai-tools/create-booking endpoint (tracked via metadata JSON field in bookings table)
* **16.2**: 2. WHEN an Operations Manager filters bookings by source, THE Admin_Panel SHALL filter bookings table by metadata JSON field containing ai_assisted: true or ai_assisted: false
* **16.3**: 3. THE Admin_Panel SHALL display the AI session_id associated with each AI_Agent booking from the metadata JSON field in bookings table
* **16.4**: 4. WHEN an Operations Manager views an AI_Agent booking, THE Admin_Panel SHALL call GET /v1/admin/ai-sessions/:sessionId to retrieve conversation history from Redis (if still available within 7-day TTL) or display "Session expired"
* **16.5**: 5. THE Admin_Panel SHALL calculate AI_Agent booking success rate via GET /v1/admin/analytics/ai-bookings as (count of bookings with status CONFIRMED or COMPLETED and ai_assisted true) / (total count of bookings with ai_assisted true)
* **16.6**: 6. WHEN an AI_Agent booking has validation errors, THE Admin_Panel SHALL display the error details from metadata JSON field and allow Operations Manager to manually correct via PATCH /v1/admin/bookings/:id
* **16.7**: 7. THE Admin_Panel SHALL display AI_Agent performance metrics via GET /v1/admin/analytics/ai-performance including average booking creation time and customer satisfaction from reviews table where booking metadata contains ai_assisted true

### Design Patterns

* **Architecture**:
  * Pattern: ## Architecture

### Implementation

```
// Task 19: Backend: AI agent booking monitoring endpoints
// Implement all sub-steps above
// Satisfy all referenced acceptance criteria
// Follow design.md patterns for file structure and architecture
```

### Verification

* [ ] All referenced acceptance criteria satisfied
* [ ] Design patterns followed (file structure, naming, tech stack)
* [ ] Sub-steps completed with tests passing
* [ ] No extra features beyond current task scope

---

## Task 20: Backend: WebSocket gateway for real-time updates

**Status:** ⬜

### Sub-steps

* ⬜ 20.1: Implement AdminGateway
* ⬜ 20.2: Implement Redis pub/sub integration
* ⬜ 20.3: Create WebSocket event DTOs

### Requirements

* **12.1**: 1. THE Admin_Panel SHALL establish a WebSocket connection to Backend_API at wss://api.derlg.com/v1/admin/ws for real-time updates using the useWebSocket custom hook
* **12.2**: 2. WHEN a new booking is created, THE Backend_API SHALL publish to Redis channel admin_events and Admin_Panel SHALL display a notification within 5 seconds
* **12.3**: 3. WHEN a driver updates their status via Telegram_Bot, THE Backend_API SHALL publish to Redis channel driver_status_changed:{driver_id} and Admin_Panel SHALL update the Real_Time_Dashboard within 5 seconds without page refresh
* **12.4**: 4. WHEN a booking status changes from RESERVED to CONFIRMED (payment success), THE Backend_API SHALL publish to Redis and Admin_Panel SHALL update the booking list using React Query cache invalidation
* **12.5**: 5. WHEN an emergency alert is triggered, THE Admin_Panel SHALL receive WebSocket message with type EMERGENCY_ALERT and display an urgent notification with browser sound alert via Notification API
* **12.6**: 6. IF the WebSocket connection is lost, THE Admin_Panel SHALL attempt to reconnect every 10 seconds using exponential backoff and display a connection status indicator in the top navigation bar

### Design Patterns

* **Architecture**:
  * Pattern: ## Architecture

### Implementation

```
// Task 20: Backend: WebSocket gateway for real-time updates
// Implement all sub-steps above
// Satisfy all referenced acceptance criteria
// Follow design.md patterns for file structure and architecture
```

### Verification

* [ ] All referenced acceptance criteria satisfied
* [ ] Design patterns followed (file structure, naming, tech stack)
* [ ] Sub-steps completed with tests passing
* [ ] No extra features beyond current task scope

---

## Task 21: Frontend: Admin layout and navigation

**Status:** ⬜

### Sub-steps

* ⬜ 21.1: Create AdminLayout component
* ⬜ 21.2: Create AdminSidebar component
* ⬜ 21.3: Create NotificationBell component
* ⬜ 21.4: Create admin route group structure

### Requirements

* **1.1**: 1. WHEN an administrator provides valid credentials, THE Admin_Panel SHALL authenticate via Backend_API POST /v1/auth/login and receive JWT tokens in httpOnly cookies
* **1.2**: 2. THE Admin_Panel SHALL verify that the authenticated user has role set to ADMIN or SUPPORT in the users table
* **1.3**: 3. THE Admin_Panel SHALL store admin-specific role permissions (SUPER_ADMIN, OPERATIONS_MANAGER, SUPPORT_AGENT, FLEET_MANAGER) in a new admin_users table linked to users.id
* **1.4**: 4. WHEN an authenticated user accesses a feature, THE Admin_Panel SHALL verify the user has the required admin role permissions from admin_users table
* **12.6**: 6. IF the WebSocket connection is lost, THE Admin_Panel SHALL attempt to reconnect every 10 seconds using exponential backoff and display a connection status indicator in the top navigation bar
* **17.1**: 1. THE Admin_Panel SHALL support English (EN), Chinese (ZH), and Khmer (KM) language interfaces using next-intl library with translation files in public/locales/

### Design Patterns

* **AdminLayout**:
  * Files: frontend/components/layout/AdminLayout.tsx
  * Pattern: **AdminLayout** (`frontend/components/layout/AdminLayout.tsx`)
* **AdminSidebar**:
  * Files: frontend/components/admin/AdminSidebar.tsx
  * Pattern: **AdminSidebar** (`frontend/components/admin/AdminSidebar.tsx`)
* **NotificationBell**:
  * Files: frontend/components/admin/NotificationBell.tsx
  * Pattern: **NotificationBell** (`frontend/components/admin/NotificationBell.tsx`)
* **Frontend Route Structure**:
  * Pattern: ### Frontend Route Structure

### Implementation

```
// Task 21: Frontend: Admin layout and navigation
// Implement all sub-steps above
// Satisfy all referenced acceptance criteria
// Follow design.md patterns for file structure and architecture
```

### Verification

* [ ] All referenced acceptance criteria satisfied
* [ ] Design patterns followed (file structure, naming, tech stack)
* [ ] Sub-steps completed with tests passing
* [ ] No extra features beyond current task scope

---

## Task 22: Frontend: Dashboard page

**Status:** ⬜

### Sub-steps

* ⬜ 22.1: Create DashboardOverview component
* ⬜ 22.2: Create MetricCard component
* ⬜ 22.3: Create BookingTrendChart component
* ⬜ 22.4: Create dashboard page

### Requirements

* **20.1**: 1. THE Admin_Panel SHALL display a dashboard via GET /v1/admin/dashboard showing total_bookings_today (count from bookings table where created_at is today), total_revenue_today (sum of total_usd from bookings where status is CONFIRMED and created_at is today), and active_drivers_count (count from drivers table where status is AVAILABLE or BUSY)
* **20.2**: 2. THE Admin_Panel SHALL display a chart showing booking trends for the past 30 days by aggregating bookings table grouped by DATE(created_at) and counting records per day
* **20.3**: 3. THE Admin_Panel SHALL display a list of pending_actions including unassigned bookings (bookings with booking_type TRANSPORT_ONLY and no record in driver_assignments table) and pending_maintenance (vehicle_maintenance records with status SCHEDULED and scheduled_date within 7 days)
* **20.4**: 4. THE Admin_Panel SHALL display recent_emergency_alerts from emergency_alerts table where status is SENT or ACKNOWLEDGED, ordered by created_at descending, showing alert_type, user name from users table join, and time_since_alert calculated as current timestamp minus created_at
* **20.5**: 5. THE Admin_Panel SHALL display driver_availability_summary showing count of drivers grouped by status (AVAILABLE, BUSY, OFFLINE) from drivers table
* **20.6**: 6. THE Admin_Panel SHALL display upcoming_bookings for the next 24 hours by querying bookings table where travel_date is between now and now + 24 hours, status is CONFIRMED, showing booking_ref, travel_date, booking_type, and customer name from users table join
* **20.7**: 7. THE Admin_Panel SHALL refresh dashboard metrics automatically every 60 seconds using React Query with refetchInterval option without requiring page reload

### Design Patterns

* **DashboardOverview**:
  * Files: frontend/components/admin/dashboard/DashboardOverview.tsx
  * Pattern: **DashboardOverview** (`frontend/components/admin/dashboard/DashboardOverview.tsx`)
* **MetricCard**:
  * Files: frontend/components/admin/dashboard/MetricCard.tsx
  * Interface: title, value, icon, trend (up/down percentage)
  * Pattern: **MetricCard** (`frontend/components/admin/dashboard/MetricCard.tsx`)
* **BookingTrendChart**:
  * Files: frontend/components/admin/dashboard/BookingTrendChart.tsx
  * Pattern: **BookingTrendChart** (`frontend/components/admin/dashboard/BookingTrendChart.tsx`)

### Implementation

```
// Task 22: Frontend: Dashboard page
// Implement all sub-steps above
// Satisfy all referenced acceptance criteria
// Follow design.md patterns for file structure and architecture
```

### Verification

* [ ] All referenced acceptance criteria satisfied
* [ ] Design patterns followed (file structure, naming, tech stack)
* [ ] Sub-steps completed with tests passing
* [ ] No extra features beyond current task scope

---

## Task 23: Frontend: Driver management pages

**Status:** ⬜

### Sub-steps

* ⬜ 23.1: Create DriverList component
* ⬜ 23.2: Create DriverStatusBadge component
* ⬜ 23.3: Create DriverForm component
* ⬜ 23.4: Create DriverDetailView component
* ⬜ 23.5: Create driver pages

### Requirements

* **2.1**: 1. THE Admin_Panel SHALL display a list of all drivers from a new drivers table via GET /v1/admin/drivers with columns: id, driver_name, driver_id, telegram_id, phone, vehicle_id (FK to transportation_vehicles.id), status (AVAILABLE, BUSY, OFFLINE), and last_status_update
* **2.5**: 5. THE Admin_Panel SHALL establish a WebSocket connection to receive real-time driver status updates published to Redis channel driver_status_changed:{driver_id}
* **2.6**: 6. WHEN filtering drivers by status, THE Admin_Panel SHALL display only drivers matching the selected status (AVAILABLE, BUSY, or OFFLINE)

### Design Patterns

* **DriverList**:
  * Files: frontend/components/admin/drivers/DriverList.tsx
  * Pattern: **DriverList** (`frontend/components/admin/drivers/DriverList.tsx`)
* **DriverStatusBadge**:
  * Files: frontend/components/admin/drivers/DriverStatusBadge.tsx
  * Pattern: **DriverStatusBadge** (`frontend/components/admin/drivers/DriverStatusBadge.tsx`)
* **DriverForm**:
  * Files: frontend/components/admin/drivers/DriverForm.tsx
  * Pattern: **DriverForm** (`frontend/components/admin/drivers/DriverForm.tsx`)
* **DriverDetailView**:
  * Files: frontend/components/admin/drivers/DriverDetailView.tsx
  * Pattern: **DriverDetailView** (`frontend/components/admin/drivers/DriverDetailView.tsx`)

### Implementation

```
// Task 23: Frontend: Driver management pages
// Implement all sub-steps above
// Satisfy all referenced acceptance criteria
// Follow design.md patterns for file structure and architecture
```

### Verification

* [ ] All referenced acceptance criteria satisfied
* [ ] Design patterns followed (file structure, naming, tech stack)
* [ ] Sub-steps completed with tests passing
* [ ] No extra features beyond current task scope

---

## Task 24: Frontend: Vehicle management pages

**Status:** ⬜

### Sub-steps

* ⬜ 24.1: Create VehicleList component
* ⬜ 24.2: Create VehicleForm component
* ⬜ 24.3: Create MaintenanceScheduler component
* ⬜ 24.4: Create MaintenanceHistory component
* ⬜ 24.5: Create vehicle pages

### Requirements

* **3.1**: 1. THE Admin_Panel SHALL display a list of all vehicles from transportation_vehicles table via GET /v1/admin/vehicles with columns: id, name, category (VAN, BUS, TUK_TUK), capacity, tier (STANDARD, VIP), price_per_day, price_per_km, features, and images
* **3.6**: 6. WHEN a Fleet Manager searches for vehicles, THE Admin_Panel SHALL filter by name, category (VAN, BUS, TUK_TUK), or tier (STANDARD, VIP)

### Design Patterns

* **VehicleList**:
  * Files: frontend/components/admin/vehicles/VehicleList.tsx
  * Pattern: **VehicleList** (`frontend/components/admin/vehicles/VehicleList.tsx`)
* **VehicleForm**:
  * Files: frontend/components/admin/vehicles/VehicleForm.tsx
  * Pattern: **VehicleForm** (`frontend/components/admin/vehicles/VehicleForm.tsx`)
* **MaintenanceScheduler**:
  * Files: frontend/components/admin/vehicles/MaintenanceScheduler.tsx
  * Pattern: **MaintenanceScheduler** (`frontend/components/admin/vehicles/MaintenanceScheduler.tsx`)
* **MaintenanceHistory**:
  * Files: frontend/components/admin/vehicles/MaintenanceHistory.tsx
  * Pattern: **MaintenanceHistory** (`frontend/components/admin/vehicles/MaintenanceHistory.tsx`)

### Implementation

```
// Task 24: Frontend: Vehicle management pages
// Implement all sub-steps above
// Satisfy all referenced acceptance criteria
// Follow design.md patterns for file structure and architecture
```

### Verification

* [ ] All referenced acceptance criteria satisfied
* [ ] Design patterns followed (file structure, naming, tech stack)
* [ ] Sub-steps completed with tests passing
* [ ] No extra features beyond current task scope

---

## Task 25: Frontend: Booking management pages

**Status:** ⬜

### Sub-steps

* ⬜ 25.1: Create BookingList component
* ⬜ 25.2: Create BookingDetailView component
* ⬜ 25.3: Create DriverAssignmentPanel component
* ⬜ 25.4: Create BookingModificationForm component
* ⬜ 25.5: Create booking pages

### Requirements

* **8.1**: 1. THE Admin_Panel SHALL display a unified list of all bookings from bookings table via GET /v1/admin/bookings with columns: id, booking_ref, user_id, booking_type (PACKAGE, HOTEL_ONLY, TRANSPORT_ONLY, GUIDE_ONLY), status (RESERVED, CONFIRMED, CANCELLED, COMPLETED, REFUNDED), travel_date, and total_usd
* **8.2**: 2. WHEN a Support Agent searches for bookings, THE Admin_Panel SHALL filter by booking_ref, user email (join users table), date range on travel_date, or booking_type
* **12.2**: 2. WHEN a new booking is created, THE Backend_API SHALL publish to Redis channel admin_events and Admin_Panel SHALL display a notification within 5 seconds

### Design Patterns

* **BookingList**:
  * Files: frontend/components/admin/bookings/BookingList.tsx
  * Pattern: **BookingList** (`frontend/components/admin/bookings/BookingList.tsx`)
* **BookingDetailView**:
  * Files: frontend/components/admin/bookings/BookingDetailView.tsx
  * Pattern: **BookingDetailView** (`frontend/components/admin/bookings/BookingDetailView.tsx`)
* **DriverAssignmentPanel**:
  * Files: frontend/components/admin/bookings/DriverAssignmentPanel.tsx
  * Pattern: **DriverAssignmentPanel** (`frontend/components/admin/bookings/DriverAssignmentPanel.tsx`)
* **BookingModificationForm**:
  * Files: frontend/components/admin/bookings/BookingModificationForm.tsx
  * Pattern: **BookingModificationForm** (`frontend/components/admin/bookings/BookingModificationForm.tsx`)

### Implementation

```
// Task 25: Frontend: Booking management pages
// Implement all sub-steps above
// Satisfy all referenced acceptance criteria
// Follow design.md patterns for file structure and architecture
```

### Verification

* [ ] All referenced acceptance criteria satisfied
* [ ] Design patterns followed (file structure, naming, tech stack)
* [ ] Sub-steps completed with tests passing
* [ ] No extra features beyond current task scope

---

## Task 26: Frontend: Hotel management pages

**Status:** ⬜

### Sub-steps

* ⬜ 26.1: Create HotelList component
* ⬜ 26.2: Create HotelForm component
* ⬜ 26.3: Create RoomManagement component
* ⬜ 26.4: Create RoomForm component
* ⬜ 26.5: Create hotel pages

### Requirements

* **6.1**: 1. THE Admin_Panel SHALL display a list of all hotels from hotels table via GET /v1/admin/hotels with columns: id, name, description, location (JSON), rating, review_count, amenities, check_in_time, check_out_time, and cancellation_policy

### Design Patterns

* **HotelList**:
  * Files: frontend/components/admin/hotels/HotelList.tsx
  * Pattern: **HotelList** (`frontend/components/admin/hotels/HotelList.tsx`)
* **HotelForm**:
  * Files: frontend/components/admin/hotels/HotelForm.tsx
  * Pattern: **HotelForm** (`frontend/components/admin/hotels/HotelForm.tsx`)
* **RoomManagement**:
  * Files: frontend/components/admin/hotels/RoomManagement.tsx
  * Pattern: **RoomManagement** (`frontend/components/admin/hotels/RoomManagement.tsx`)
* **RoomForm**:
  * Files: frontend/components/admin/hotels/RoomForm.tsx
  * Pattern: **RoomForm** (`frontend/components/admin/hotels/RoomForm.tsx`)

### Implementation

```
// Task 26: Frontend: Hotel management pages
// Implement all sub-steps above
// Satisfy all referenced acceptance criteria
// Follow design.md patterns for file structure and architecture
```

### Verification

* [ ] All referenced acceptance criteria satisfied
* [ ] Design patterns followed (file structure, naming, tech stack)
* [ ] Sub-steps completed with tests passing
* [ ] No extra features beyond current task scope

---

## Task 27: Frontend: Tour guide management pages

**Status:** ⬜

### Sub-steps

* ⬜ 27.1: Create GuideList component
* ⬜ 27.2: Create GuideForm component
* ⬜ 27.3: Create GuideDetailView component
* ⬜ 27.4: Create guide pages

### Requirements

* **7.1**: 1. THE Admin_Panel SHALL display a list of all tour guides from guides table via GET /v1/admin/guides with columns: id, name, bio, profile_picture, languages (TEXT[]), specialties (TEXT[]), experience_years, certifications (TEXT[]), rating, review_count, price_per_hour, and price_per_day
* **7.6**: 6. WHEN filtering guides, THE Admin_Panel SHALL filter by languages array contains value or specialties array contains value

### Design Patterns


### Implementation

```
// Task 27: Frontend: Tour guide management pages
// Implement all sub-steps above
// Satisfy all referenced acceptance criteria
// Follow design.md patterns for file structure and architecture
```

### Verification

* [ ] All referenced acceptance criteria satisfied
* [ ] Design patterns followed (file structure, naming, tech stack)
* [ ] Sub-steps completed with tests passing
* [ ] No extra features beyond current task scope

---

## Task 28: Frontend: Emergency alert management pages

**Status:** ⬜

### Sub-steps

* ⬜ 28.1: Create EmergencyAlertList component
* ⬜ 28.2: Create EmergencyDetailView component
* ⬜ 28.3: Create EmergencyMap component
* ⬜ 28.4: Create emergency pages

### Requirements

* **11.1**: 1. THE Admin_Panel SHALL display a list of all emergency alerts from emergency_alerts table via GET /v1/admin/emergency with columns: id, user_id, booking_id, latitude, longitude, alert_type (SOS, MEDICAL, THEFT, LOST), status (SENT, ACKNOWLEDGED, RESOLVED), message, and created_at
* **11.2**: 2. WHEN an emergency alert is received, THE Admin_Panel SHALL display a prominent notification banner and play a sound alert via browser Notification API
* **12.5**: 5. WHEN an emergency alert is triggered, THE Admin_Panel SHALL receive WebSocket message with type EMERGENCY_ALERT and display an urgent notification with browser sound alert via Notification API

### Design Patterns

* **EmergencyAlertList**:
  * Files: frontend/components/admin/emergency/EmergencyAlertList.tsx
  * Pattern: **EmergencyAlertList** (`frontend/components/admin/emergency/EmergencyAlertList.tsx`)
* **EmergencyDetailView**:
  * Files: frontend/components/admin/emergency/EmergencyDetailView.tsx
  * Pattern: **EmergencyDetailView** (`frontend/components/admin/emergency/EmergencyDetailView.tsx`)
* **EmergencyMap**:
  * Files: frontend/components/admin/emergency/EmergencyMap.tsx
  * Pattern: **EmergencyMap** (`frontend/components/admin/emergency/EmergencyMap.tsx`)

### Implementation

```
// Task 28: Frontend: Emergency alert management pages
// Implement all sub-steps above
// Satisfy all referenced acceptance criteria
// Follow design.md patterns for file structure and architecture
```

### Verification

* [ ] All referenced acceptance criteria satisfied
* [ ] Design patterns followed (file structure, naming, tech stack)
* [ ] Sub-steps completed with tests passing
* [ ] No extra features beyond current task scope

---

## Task 29: Frontend: Customer support pages

**Status:** ⬜

### Sub-steps

* ⬜ 29.1: Create CustomerList component
* ⬜ 29.2: Create CustomerProfileView component
* ⬜ 29.3: Create customer pages

### Requirements

* **15.1**: 1. THE Admin_Panel SHALL display a searchable list of customers from users table via GET /v1/admin/customers with columns: id, name, email, phone, role, loyalty_points, is_student, and created_at
* **15.2**: 2. WHEN a Support Agent searches for a customer, THE Admin_Panel SHALL filter by name (ILIKE), email (ILIKE), or phone (exact match)

### Design Patterns

* **CustomerList**:
  * Files: frontend/components/admin/customers/CustomerList.tsx
  * Pattern: **CustomerList** (`frontend/components/admin/customers/CustomerList.tsx`)
* **CustomerProfileView**:
  * Files: frontend/components/admin/customers/CustomerProfileView.tsx
  * Pattern: **CustomerProfileView** (`frontend/components/admin/customers/CustomerProfileView.tsx`)

### Implementation

```
// Task 29: Frontend: Customer support pages
// Implement all sub-steps above
// Satisfy all referenced acceptance criteria
// Follow design.md patterns for file structure and architecture
```

### Verification

* [ ] All referenced acceptance criteria satisfied
* [ ] Design patterns followed (file structure, naming, tech stack)
* [ ] Sub-steps completed with tests passing
* [ ] No extra features beyond current task scope

---

## Task 30: Frontend: Discount code management pages

**Status:** ⬜

### Sub-steps

* ⬜ 30.1: Create DiscountCodeList component
* ⬜ 30.2: Create DiscountCodeForm component
* ⬜ 30.3: Create StudentVerificationQueue component
* ⬜ 30.4: Create StudentVerificationReview component
* ⬜ 30.5: Create discount pages

### Requirements

* **13.1**: 1. THE Admin_Panel SHALL display active discount codes from discount_codes table via GET /v1/admin/discounts with columns: id, code, discount_percentage, valid_from, valid_until, max_usage, usage_count, and is_active

### Design Patterns

* **DiscountCodeList**:
  * Files: frontend/components/admin/discounts/DiscountCodeList.tsx
  * Pattern: **DiscountCodeList** (`frontend/components/admin/discounts/DiscountCodeList.tsx`)
* **DiscountCodeForm**:
  * Files: frontend/components/admin/discounts/DiscountCodeForm.tsx
  * Pattern: **DiscountCodeForm** (`frontend/components/admin/discounts/DiscountCodeForm.tsx`)
* **StudentVerificationQueue**:
  * Files: frontend/components/admin/discounts/StudentVerificationQueue.tsx
  * Pattern: **StudentVerificationQueue** (`frontend/components/admin/discounts/StudentVerificationQueue.tsx`)
* **StudentVerificationReview**:
  * Files: frontend/components/admin/discounts/StudentVerificationReview.tsx
  * Pattern: **StudentVerificationReview** (`frontend/components/admin/discounts/StudentVerificationReview.tsx`)

### Implementation

```
// Task 30: Frontend: Discount code management pages
// Implement all sub-steps above
// Satisfy all referenced acceptance criteria
// Follow design.md patterns for file structure and architecture
```

### Verification

* [ ] All referenced acceptance criteria satisfied
* [ ] Design patterns followed (file structure, naming, tech stack)
* [ ] Sub-steps completed with tests passing
* [ ] No extra features beyond current task scope

---

## Task 31: Frontend: Analytics and reporting pages

**Status:** ⬜

### Sub-steps

* ⬜ 31.1: Create AnalyticsDashboard component
* ⬜ 31.2: Create RevenueChart component
* ⬜ 31.3: Create PerformanceMetrics component
* ⬜ 31.4: Create analytics page

### Requirements

* **9.1**: 1. THE Admin_Panel SHALL display total revenue by booking_type (PACKAGE, HOTEL_ONLY, TRANSPORT_ONLY, GUIDE_ONLY) for a selected date range via GET /v1/admin/analytics/revenue aggregating total_usd from bookings table where status is CONFIRMED or COMPLETED
* **9.2**: 2. THE Admin_Panel SHALL display booking statistics via GET /v1/admin/analytics/bookings including total count, count by status (CONFIRMED, COMPLETED, CANCELLED, REFUNDED), and cancellation rate calculated as CANCELLED count divided by total count
* **9.3**: 3. THE Admin_Panel SHALL display driver performance metrics via GET /v1/admin/analytics/drivers aggregating driver_assignments table for total trips per driver and joining reviews table for average ratings
* **9.4**: 4. THE Admin_Panel SHALL display popular destinations by aggregating bookings table joined with trips table, grouping by trip province, and ordering by booking count
* **9.5**: 5. THE Admin_Panel SHALL display hotel occupancy rate by calculating (booked room-nights / total available room-nights) from bookings table where booking_type includes hotel and status is CONFIRMED
* **9.6**: 6. THE Admin_Panel SHALL display tour guide utilization rate by calculating percentage of days guides have assignments from driver_assignments table grouped by guide_id
* **9.7**: 7. WHEN a Super Admin exports a report, THE Admin_Panel SHALL call GET /v1/admin/analytics/export with date range and metric type to generate a CSV or PDF file with the selected data

### Design Patterns

* **AnalyticsDashboard**:
  * Files: frontend/components/admin/analytics/AnalyticsDashboard.tsx
  * Pattern: **AnalyticsDashboard** (`frontend/components/admin/analytics/AnalyticsDashboard.tsx`)
* **RevenueChart**:
  * Files: frontend/components/admin/analytics/RevenueChart.tsx
  * Pattern: **RevenueChart** (`frontend/components/admin/analytics/RevenueChart.tsx`)
* **PerformanceMetrics**:
  * Files: frontend/components/admin/analytics/PerformanceMetrics.tsx
  * Pattern: **PerformanceMetrics** (`frontend/components/admin/analytics/PerformanceMetrics.tsx`)

### Implementation

```
// Task 31: Frontend: Analytics and reporting pages
// Implement all sub-steps above
// Satisfy all referenced acceptance criteria
// Follow design.md patterns for file structure and architecture
```

### Verification

* [ ] All referenced acceptance criteria satisfied
* [ ] Design patterns followed (file structure, naming, tech stack)
* [ ] Sub-steps completed with tests passing
* [ ] No extra features beyond current task scope

---

## Task 32: Frontend: Admin user management pages

**Status:** ⬜

### Sub-steps

* ⬜ 32.1: Create AdminUserList component
* ⬜ 32.2: Create AdminUserForm component
* ⬜ 32.3: Create admin user page

### Requirements

* **10.1**: 1. THE Admin_Panel SHALL display a list of all administrator users via GET /v1/admin/users joining users table with admin_users table showing email, name, role from users table, and admin_role (SUPER_ADMIN, OPERATIONS_MANAGER, SUPPORT_AGENT, FLEET_MANAGER) and permissions JSON from admin_users table

### Design Patterns

* **AdminUserList**:
  * Files: frontend/components/admin/users/AdminUserList.tsx
  * Pattern: **AdminUserList** (`frontend/components/admin/users/AdminUserList.tsx`)
* **AdminUserForm**:
  * Files: frontend/components/admin/users/AdminUserForm.tsx
  * Pattern: **AdminUserForm** (`frontend/components/admin/users/AdminUserForm.tsx`)

### Implementation

```
// Task 32: Frontend: Admin user management pages
// Implement all sub-steps above
// Satisfy all referenced acceptance criteria
// Follow design.md patterns for file structure and architecture
```

### Verification

* [ ] All referenced acceptance criteria satisfied
* [ ] Design patterns followed (file structure, naming, tech stack)
* [ ] Sub-steps completed with tests passing
* [ ] No extra features beyond current task scope

---

## Task 33: Frontend: Audit log viewer page

**Status:** ⬜

### Sub-steps

* ⬜ 33.1: Create AuditLogViewer component
* ⬜ 33.2: Create audit log page

### Requirements

* **19.1**: 1. THE Admin_Panel SHALL display audit logs from audit_logs table via GET /v1/admin/audit-logs with columns: id, admin_user_id, action_type, affected_resource_id, resource_type, changed_fields (JSON), and timestamp
* **19.2**: 2. WHEN a Super Admin views audit logs, THE Admin_Panel SHALL filter by date range on timestamp, admin_user_id (join with users table to show admin name), or action_type (DRIVER_ASSIGNMENT, BOOKING_MODIFICATION, PRICING_CHANGE, USER_ROLE_CHANGE, etc.)
* **19.7**: 7. WHEN a Super Admin exports audit logs, THE Admin_Panel SHALL call GET /v1/admin/audit-logs/export with date range parameters to generate a CSV file with all log entries including admin name from users table join

### Design Patterns

* **AuditLogViewer**:
  * Files: frontend/components/admin/audit/AuditLogViewer.tsx
  * Pattern: **AuditLogViewer** (`frontend/components/admin/audit/AuditLogViewer.tsx`)

### Implementation

```
// Task 33: Frontend: Audit log viewer page
// Implement all sub-steps above
// Satisfy all referenced acceptance criteria
// Follow design.md patterns for file structure and architecture
```

### Verification

* [ ] All referenced acceptance criteria satisfied
* [ ] Design patterns followed (file structure, naming, tech stack)
* [ ] Sub-steps completed with tests passing
* [ ] No extra features beyond current task scope

---

## Task 34: Frontend: WebSocket integration

**Status:** ⬜

### Sub-steps

* ⬜ 34.1: Create useAdminWebSocket custom hook
* ⬜ 34.2: Create admin notification store
* ⬜ 34.3: Integrate WebSocket in AdminLayout
* ⬜ 34.4: Implement real-time updates in components

### Requirements

* **12.1**: 1. THE Admin_Panel SHALL establish a WebSocket connection to Backend_API at wss://api.derlg.com/v1/admin/ws for real-time updates using the useWebSocket custom hook
* **12.2**: 2. WHEN a new booking is created, THE Backend_API SHALL publish to Redis channel admin_events and Admin_Panel SHALL display a notification within 5 seconds
* **12.3**: 3. WHEN a driver updates their status via Telegram_Bot, THE Backend_API SHALL publish to Redis channel driver_status_changed:{driver_id} and Admin_Panel SHALL update the Real_Time_Dashboard within 5 seconds without page refresh
* **12.4**: 4. WHEN a booking status changes from RESERVED to CONFIRMED (payment success), THE Backend_API SHALL publish to Redis and Admin_Panel SHALL update the booking list using React Query cache invalidation
* **12.5**: 5. WHEN an emergency alert is triggered, THE Admin_Panel SHALL receive WebSocket message with type EMERGENCY_ALERT and display an urgent notification with browser sound alert via Notification API
* **12.6**: 6. IF the WebSocket connection is lost, THE Admin_Panel SHALL attempt to reconnect every 10 seconds using exponential backoff and display a connection status indicator in the top navigation bar

### Design Patterns

* **AdminLayout**:
  * Files: frontend/components/layout/AdminLayout.tsx
  * Pattern: **AdminLayout** (`frontend/components/layout/AdminLayout.tsx`)
* **NotificationBell**:
  * Files: frontend/components/admin/NotificationBell.tsx
  * Pattern: **NotificationBell** (`frontend/components/admin/NotificationBell.tsx`)

### Implementation

```
// Task 34: Frontend: WebSocket integration
// Implement all sub-steps above
// Satisfy all referenced acceptance criteria
// Follow design.md patterns for file structure and architecture
```

### Verification

* [ ] All referenced acceptance criteria satisfied
* [ ] Design patterns followed (file structure, naming, tech stack)
* [ ] Sub-steps completed with tests passing
* [ ] No extra features beyond current task scope

---

## Task 35: Frontend: Multi-language support

**Status:** ⬜

### Sub-steps

* ⬜ 35.1: Create admin translation files
* ⬜ 35.2: Integrate next-intl in admin pages
* ⬜ 35.3: Implement language preference

### Requirements

* **17.1**: 1. THE Admin_Panel SHALL support English (EN), Chinese (ZH), and Khmer (KM) language interfaces using next-intl library with translation files in public/locales/
* **17.2**: 2. WHEN an administrator selects a language preference, THE Admin_Panel SHALL update the Zustand language store and re-render all interface text using the selected locale
* **17.6**: 6. THE Admin_Panel SHALL display system messages, notifications, and UI labels in the administrator's selected language by loading translations from public/locales/{locale}/admin.json

### Design Patterns

* **Frontend Route Structure**:
  * Pattern: ### Frontend Route Structure

### Implementation

```
// Task 35: Frontend: Multi-language support
// Implement all sub-steps above
// Satisfy all referenced acceptance criteria
// Follow design.md patterns for file structure and architecture
```

### Verification

* [ ] All referenced acceptance criteria satisfied
* [ ] Design patterns followed (file structure, naming, tech stack)
* [ ] Sub-steps completed with tests passing
* [ ] No extra features beyond current task scope

---

## Task 36: Frontend: Authentication and authorization

**Status:** ⬜

### Sub-steps

* ⬜ 36.1: Create admin route protection
* ⬜ 36.2: Implement role-based UI rendering
* ⬜ 36.3: Handle token refresh in admin panel

### Requirements

* **1.1**: 1. WHEN an administrator provides valid credentials, THE Admin_Panel SHALL authenticate via Backend_API POST /v1/auth/login and receive JWT tokens in httpOnly cookies
* **1.2**: 2. THE Admin_Panel SHALL verify that the authenticated user has role set to ADMIN or SUPPORT in the users table
* **1.3**: 3. THE Admin_Panel SHALL store admin-specific role permissions (SUPER_ADMIN, OPERATIONS_MANAGER, SUPPORT_AGENT, FLEET_MANAGER) in a new admin_users table linked to users.id

### Design Patterns

* **AdminLayout**:
  * Files: frontend/components/layout/AdminLayout.tsx
  * Pattern: **AdminLayout** (`frontend/components/layout/AdminLayout.tsx`)
* **Frontend Route Structure**:
  * Pattern: ### Frontend Route Structure

### Implementation

```
// Task 36: Frontend: Authentication and authorization
// Implement all sub-steps above
// Satisfy all referenced acceptance criteria
// Follow design.md patterns for file structure and architecture
```

### Verification

* [ ] All referenced acceptance criteria satisfied
* [ ] Design patterns followed (file structure, naming, tech stack)
* [ ] Sub-steps completed with tests passing
* [ ] No extra features beyond current task scope

---

## Task 37: Frontend: Shared admin components

**Status:** ⬜

### Sub-steps

* ⬜ 37.1: Create DataTable component
* ⬜ 37.2: Create SearchInput component
* ⬜ 37.3: Create FilterDropdown component
* ⬜ 37.4: Create ConfirmDialog component
* ⬜ 37.5: Create ImageUpload component

### Requirements

* **1.4**: 4. WHEN an authenticated user accesses a feature, THE Admin_Panel SHALL verify the user has the required admin role permissions from admin_users table
* **1.5**: 5. IF a user attempts to access a feature without proper permissions, THEN THE Admin_Panel SHALL deny access and display an authorization error message
* **2.1**: 1. THE Admin_Panel SHALL display a list of all drivers from a new drivers table via GET /v1/admin/drivers with columns: id, driver_name, driver_id, telegram_id, phone, vehicle_id (FK to transportation_vehicles.id), status (AVAILABLE, BUSY, OFFLINE), and last_status_update
* **3.1**: 1. THE Admin_Panel SHALL display a list of all vehicles from transportation_vehicles table via GET /v1/admin/vehicles with columns: id, name, category (VAN, BUS, TUK_TUK), capacity, tier (STANDARD, VIP), price_per_day, price_per_km, features, and images
* **6.1**: 1. THE Admin_Panel SHALL display a list of all hotels from hotels table via GET /v1/admin/hotels with columns: id, name, description, location (JSON), rating, review_count, amenities, check_in_time, check_out_time, and cancellation_policy
* **7.1**: 1. THE Admin_Panel SHALL display a list of all tour guides from guides table via GET /v1/admin/guides with columns: id, name, bio, profile_picture, languages (TEXT[]), specialties (TEXT[]), experience_years, certifications (TEXT[]), rating, review_count, price_per_hour, and price_per_day
* **8.1**: 1. THE Admin_Panel SHALL display a unified list of all bookings from bookings table via GET /v1/admin/bookings with columns: id, booking_ref, user_id, booking_type (PACKAGE, HOTEL_ONLY, TRANSPORT_ONLY, GUIDE_ONLY), status (RESERVED, CONFIRMED, CANCELLED, COMPLETED, REFUNDED), travel_date, and total_usd
* **9.1**: 1. THE Admin_Panel SHALL display total revenue by booking_type (PACKAGE, HOTEL_ONLY, TRANSPORT_ONLY, GUIDE_ONLY) for a selected date range via GET /v1/admin/analytics/revenue aggregating total_usd from bookings table where status is CONFIRMED or COMPLETED
* **10.1**: 1. THE Admin_Panel SHALL display a list of all administrator users via GET /v1/admin/users joining users table with admin_users table showing email, name, role from users table, and admin_role (SUPER_ADMIN, OPERATIONS_MANAGER, SUPPORT_AGENT, FLEET_MANAGER) and permissions JSON from admin_users table
* **11.1**: 1. THE Admin_Panel SHALL display a list of all emergency alerts from emergency_alerts table via GET /v1/admin/emergency with columns: id, user_id, booking_id, latitude, longitude, alert_type (SOS, MEDICAL, THEFT, LOST), status (SENT, ACKNOWLEDGED, RESOLVED), message, and created_at
* **13.1**: 1. THE Admin_Panel SHALL display active discount codes from discount_codes table via GET /v1/admin/discounts with columns: id, code, discount_percentage, valid_from, valid_until, max_usage, usage_count, and is_active
* **15.1**: 1. THE Admin_Panel SHALL display a searchable list of customers from users table via GET /v1/admin/customers with columns: id, name, email, phone, role, loyalty_points, is_student, and created_at
* **19.1**: 1. THE Admin_Panel SHALL display audit logs from audit_logs table via GET /v1/admin/audit-logs with columns: id, admin_user_id, action_type, affected_resource_id, resource_type, changed_fields (JSON), and timestamp
* **20.1**: 1. THE Admin_Panel SHALL display a dashboard via GET /v1/admin/dashboard showing total_bookings_today (count from bookings table where created_at is today), total_revenue_today (sum of total_usd from bookings where status is CONFIRMED and created_at is today), and active_drivers_count (count from drivers table where status is AVAILABLE or BUSY)

### Design Patterns

* **AdminLayout**:
  * Files: frontend/components/layout/AdminLayout.tsx
  * Pattern: **AdminLayout** (`frontend/components/layout/AdminLayout.tsx`)

### Implementation

```
// Task 37: Frontend: Shared admin components
// Implement all sub-steps above
// Satisfy all referenced acceptance criteria
// Follow design.md patterns for file structure and architecture
```

### Verification

* [ ] All referenced acceptance criteria satisfied
* [ ] Design patterns followed (file structure, naming, tech stack)
* [ ] Sub-steps completed with tests passing
* [ ] No extra features beyond current task scope

---

## Task 38: Testing and quality assurance

**Status:** ⬜

### Sub-steps

* ⬜ 38.1: Write unit tests for backend services
* ⬜ 38.2: Write integration tests for backend endpoints
* ⬜ 38.3: Write frontend component tests
* ⬜ 38.4: Write end-to-end tests

### Requirements

* **1.1**: 1. WHEN an administrator provides valid credentials, THE Admin_Panel SHALL authenticate via Backend_API POST /v1/auth/login and receive JWT tokens in httpOnly cookies
* **1.2**: 2. THE Admin_Panel SHALL verify that the authenticated user has role set to ADMIN or SUPPORT in the users table
* **2.1**: 1. THE Admin_Panel SHALL display a list of all drivers from a new drivers table via GET /v1/admin/drivers with columns: id, driver_name, driver_id, telegram_id, phone, vehicle_id (FK to transportation_vehicles.id), status (AVAILABLE, BUSY, OFFLINE), and last_status_update
* **3.1**: 1. THE Admin_Panel SHALL display a list of all vehicles from transportation_vehicles table via GET /v1/admin/vehicles with columns: id, name, category (VAN, BUS, TUK_TUK), capacity, tier (STANDARD, VIP), price_per_day, price_per_km, features, and images
* **4.1**: 1. WHEN a driver sends `/online vehicle_id: <VEHICLE_ID> driver_name: <NAME>` via Telegram_Bot, THE Telegram_Bot SHALL call Backend_API webhook POST /v1/telegram/driver-status with telegram_id, vehicle_id, driver_name, and status AVAILABLE
* **5.1**: 1. WHEN an Operations Manager assigns a driver to a booking, THE Admin_Panel SHALL call POST /v1/admin/assignments with driver_id, booking_id, and vehicle_id to create a record in driver_assignments table
* **6.1**: 1. THE Admin_Panel SHALL display a list of all hotels from hotels table via GET /v1/admin/hotels with columns: id, name, description, location (JSON), rating, review_count, amenities, check_in_time, check_out_time, and cancellation_policy
* **7.1**: 1. THE Admin_Panel SHALL display a list of all tour guides from guides table via GET /v1/admin/guides with columns: id, name, bio, profile_picture, languages (TEXT[]), specialties (TEXT[]), experience_years, certifications (TEXT[]), rating, review_count, price_per_hour, and price_per_day
* **8.1**: 1. THE Admin_Panel SHALL display a unified list of all bookings from bookings table via GET /v1/admin/bookings with columns: id, booking_ref, user_id, booking_type (PACKAGE, HOTEL_ONLY, TRANSPORT_ONLY, GUIDE_ONLY), status (RESERVED, CONFIRMED, CANCELLED, COMPLETED, REFUNDED), travel_date, and total_usd
* **9.1**: 1. THE Admin_Panel SHALL display total revenue by booking_type (PACKAGE, HOTEL_ONLY, TRANSPORT_ONLY, GUIDE_ONLY) for a selected date range via GET /v1/admin/analytics/revenue aggregating total_usd from bookings table where status is CONFIRMED or COMPLETED
* **10.1**: 1. THE Admin_Panel SHALL display a list of all administrator users via GET /v1/admin/users joining users table with admin_users table showing email, name, role from users table, and admin_role (SUPER_ADMIN, OPERATIONS_MANAGER, SUPPORT_AGENT, FLEET_MANAGER) and permissions JSON from admin_users table
* **11.1**: 1. THE Admin_Panel SHALL display a list of all emergency alerts from emergency_alerts table via GET /v1/admin/emergency with columns: id, user_id, booking_id, latitude, longitude, alert_type (SOS, MEDICAL, THEFT, LOST), status (SENT, ACKNOWLEDGED, RESOLVED), message, and created_at
* **12.1**: 1. THE Admin_Panel SHALL establish a WebSocket connection to Backend_API at wss://api.derlg.com/v1/admin/ws for real-time updates using the useWebSocket custom hook
* **13.1**: 1. THE Admin_Panel SHALL display active discount codes from discount_codes table via GET /v1/admin/discounts with columns: id, code, discount_percentage, valid_from, valid_until, max_usage, usage_count, and is_active
* **14.1**: 1. THE Admin_Panel SHALL display a maintenance schedule calendar via GET /v1/admin/maintenance showing all records from vehicle_maintenance table with columns: id, vehicle_id, maintenance_type, scheduled_date, completion_date, maintenance_cost, maintenance_notes, and status (SCHEDULED, IN_MAINTENANCE, COMPLETED)
* **15.1**: 1. THE Admin_Panel SHALL display a searchable list of customers from users table via GET /v1/admin/customers with columns: id, name, email, phone, role, loyalty_points, is_student, and created_at
* **16.1**: 1. THE Admin_Panel SHALL display a flag indicating which bookings were created via AI_Agent by checking if the booking was created through POST /v1/ai-tools/create-booking endpoint (tracked via metadata JSON field in bookings table)
* **17.1**: 1. THE Admin_Panel SHALL support English (EN), Chinese (ZH), and Khmer (KM) language interfaces using next-intl library with translation files in public/locales/
* **18.1**: 1. THE Admin_Panel SHALL allow Super Admin to export booking data via GET /v1/admin/export/bookings with query parameters start_date, end_date, and format (CSV or JSON) returning a downloadable file
* **19.1**: 1. THE Admin_Panel SHALL display audit logs from audit_logs table via GET /v1/admin/audit-logs with columns: id, admin_user_id, action_type, affected_resource_id, resource_type, changed_fields (JSON), and timestamp
* **20.1**: 1. THE Admin_Panel SHALL display a dashboard via GET /v1/admin/dashboard showing total_bookings_today (count from bookings table where created_at is today), total_revenue_today (sum of total_usd from bookings where status is CONFIRMED and created_at is today), and active_drivers_count (count from drivers table where status is AVAILABLE or BUSY)

### Design Patterns

* **Architecture**:
  * Pattern: ## Architecture

### Implementation

```
// Task 38: Testing and quality assurance
// Implement all sub-steps above
// Satisfy all referenced acceptance criteria
// Follow design.md patterns for file structure and architecture
```

### Verification

* [ ] All referenced acceptance criteria satisfied
* [ ] Design patterns followed (file structure, naming, tech stack)
* [ ] Sub-steps completed with tests passing
* [ ] No extra features beyond current task scope

---

## Task 39: Documentation and deployment

**Status:** ⬜

### Sub-steps

* ⬜ 39.1: Write API documentation
* ⬜ 39.2: Write admin panel user guide
* ⬜ 39.3: Create database migration scripts
* ⬜ 39.4: Configure production environment
* ⬜ 39.5: Deploy and monitor

### Requirements

* **1.1**: 1. WHEN an administrator provides valid credentials, THE Admin_Panel SHALL authenticate via Backend_API POST /v1/auth/login and receive JWT tokens in httpOnly cookies
* **1.2**: 2. THE Admin_Panel SHALL verify that the authenticated user has role set to ADMIN or SUPPORT in the users table
* **2.1**: 1. THE Admin_Panel SHALL display a list of all drivers from a new drivers table via GET /v1/admin/drivers with columns: id, driver_name, driver_id, telegram_id, phone, vehicle_id (FK to transportation_vehicles.id), status (AVAILABLE, BUSY, OFFLINE), and last_status_update
* **3.1**: 1. THE Admin_Panel SHALL display a list of all vehicles from transportation_vehicles table via GET /v1/admin/vehicles with columns: id, name, category (VAN, BUS, TUK_TUK), capacity, tier (STANDARD, VIP), price_per_day, price_per_km, features, and images
* **4.1**: 1. WHEN a driver sends `/online vehicle_id: <VEHICLE_ID> driver_name: <NAME>` via Telegram_Bot, THE Telegram_Bot SHALL call Backend_API webhook POST /v1/telegram/driver-status with telegram_id, vehicle_id, driver_name, and status AVAILABLE
* **5.1**: 1. WHEN an Operations Manager assigns a driver to a booking, THE Admin_Panel SHALL call POST /v1/admin/assignments with driver_id, booking_id, and vehicle_id to create a record in driver_assignments table
* **6.1**: 1. THE Admin_Panel SHALL display a list of all hotels from hotels table via GET /v1/admin/hotels with columns: id, name, description, location (JSON), rating, review_count, amenities, check_in_time, check_out_time, and cancellation_policy
* **7.1**: 1. THE Admin_Panel SHALL display a list of all tour guides from guides table via GET /v1/admin/guides with columns: id, name, bio, profile_picture, languages (TEXT[]), specialties (TEXT[]), experience_years, certifications (TEXT[]), rating, review_count, price_per_hour, and price_per_day
* **8.1**: 1. THE Admin_Panel SHALL display a unified list of all bookings from bookings table via GET /v1/admin/bookings with columns: id, booking_ref, user_id, booking_type (PACKAGE, HOTEL_ONLY, TRANSPORT_ONLY, GUIDE_ONLY), status (RESERVED, CONFIRMED, CANCELLED, COMPLETED, REFUNDED), travel_date, and total_usd
* **9.1**: 1. THE Admin_Panel SHALL display total revenue by booking_type (PACKAGE, HOTEL_ONLY, TRANSPORT_ONLY, GUIDE_ONLY) for a selected date range via GET /v1/admin/analytics/revenue aggregating total_usd from bookings table where status is CONFIRMED or COMPLETED
* **10.1**: 1. THE Admin_Panel SHALL display a list of all administrator users via GET /v1/admin/users joining users table with admin_users table showing email, name, role from users table, and admin_role (SUPER_ADMIN, OPERATIONS_MANAGER, SUPPORT_AGENT, FLEET_MANAGER) and permissions JSON from admin_users table
* **11.1**: 1. THE Admin_Panel SHALL display a list of all emergency alerts from emergency_alerts table via GET /v1/admin/emergency with columns: id, user_id, booking_id, latitude, longitude, alert_type (SOS, MEDICAL, THEFT, LOST), status (SENT, ACKNOWLEDGED, RESOLVED), message, and created_at
* **12.1**: 1. THE Admin_Panel SHALL establish a WebSocket connection to Backend_API at wss://api.derlg.com/v1/admin/ws for real-time updates using the useWebSocket custom hook
* **13.1**: 1. THE Admin_Panel SHALL display active discount codes from discount_codes table via GET /v1/admin/discounts with columns: id, code, discount_percentage, valid_from, valid_until, max_usage, usage_count, and is_active
* **14.1**: 1. THE Admin_Panel SHALL display a maintenance schedule calendar via GET /v1/admin/maintenance showing all records from vehicle_maintenance table with columns: id, vehicle_id, maintenance_type, scheduled_date, completion_date, maintenance_cost, maintenance_notes, and status (SCHEDULED, IN_MAINTENANCE, COMPLETED)
* **15.1**: 1. THE Admin_Panel SHALL display a searchable list of customers from users table via GET /v1/admin/customers with columns: id, name, email, phone, role, loyalty_points, is_student, and created_at
* **16.1**: 1. THE Admin_Panel SHALL display a flag indicating which bookings were created via AI_Agent by checking if the booking was created through POST /v1/ai-tools/create-booking endpoint (tracked via metadata JSON field in bookings table)
* **17.1**: 1. THE Admin_Panel SHALL support English (EN), Chinese (ZH), and Khmer (KM) language interfaces using next-intl library with translation files in public/locales/
* **18.1**: 1. THE Admin_Panel SHALL allow Super Admin to export booking data via GET /v1/admin/export/bookings with query parameters start_date, end_date, and format (CSV or JSON) returning a downloadable file
* **19.1**: 1. THE Admin_Panel SHALL display audit logs from audit_logs table via GET /v1/admin/audit-logs with columns: id, admin_user_id, action_type, affected_resource_id, resource_type, changed_fields (JSON), and timestamp
* **20.1**: 1. THE Admin_Panel SHALL display a dashboard via GET /v1/admin/dashboard showing total_bookings_today (count from bookings table where created_at is today), total_revenue_today (sum of total_usd from bookings where status is CONFIRMED and created_at is today), and active_drivers_count (count from drivers table where status is AVAILABLE or BUSY)

### Design Patterns

* **Architecture**:
  * Pattern: ## Architecture

### Implementation

```
// Task 39: Documentation and deployment
// Implement all sub-steps above
// Satisfy all referenced acceptance criteria
// Follow design.md patterns for file structure and architecture
```

### Verification

* [ ] All referenced acceptance criteria satisfied
* [ ] Design patterns followed (file structure, naming, tech stack)
* [ ] Sub-steps completed with tests passing
* [ ] No extra features beyond current task scope

---
