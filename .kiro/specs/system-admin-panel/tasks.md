# Implementation Plan: System Admin Panel

## Overview

This implementation plan covers the comprehensive System Admin Panel for managing all operational aspects of the DerLg Cambodia travel booking platform. The admin panel is built as a new route group `(admin)` within the existing Next.js 14 frontend application and communicates with a new NestJS admin module via `/v1/admin/*` endpoints. The system provides role-based access control for four admin roles (SUPER_ADMIN, OPERATIONS_MANAGER, FLEET_MANAGER, SUPPORT_AGENT), real-time driver status updates via WebSocket and Redis pub/sub, Telegram Bot integration for driver availability management, and comprehensive administrative features for managing transportation fleet, hotel inventory, tour guides, bookings, emergency alerts, discount codes, and customer support.

The implementation adds 4 new database tables (drivers, driver_assignments, vehicle_maintenance, admin_users) to the existing Supabase PostgreSQL database, creates 13 new backend controllers and services in the admin module, implements a Telegram webhook endpoint, builds 40+ frontend components for the admin interface, and establishes WebSocket connections for real-time updates. All administrative actions are logged to the audit_logs table for compliance and security tracking.

## Tasks

- [ ] 1. Database schema extensions
  - [ ] 1.1 Add new Prisma models for admin functionality
    - Create Driver model with fields: id, driver_name, driver_id, telegram_id, phone, vehicle_id (FK to TransportationVehicle), status (AVAILABLE, BUSY, OFFLINE), last_status_update, created_at, updated_at
    - Create DriverAssignment model with fields: id, driver_id (FK to Driver), booking_id (FK to Booking), vehicle_id (FK to TransportationVehicle), assignment_timestamp, completion_timestamp, created_at, updated_at
    - Create VehicleMaintenance model with fields: id, vehicle_id (FK to TransportationVehicle), maintenance_type, scheduled_date, completion_date, maintenance_cost, maintenance_notes, status (SCHEDULED, IN_MAINTENANCE, COMPLETED), created_at, updated_at
    - Create AdminUser model with fields: id, user_id (FK to User), admin_role (SUPER_ADMIN, OPERATIONS_MANAGER, SUPPORT_AGENT, FLEET_MANAGER), permissions (JSON), is_active, created_at, updated_at
    - Add indexes on driver.status, driver.vehicle_id, driver_assignment.booking_id, vehicle_maintenance.vehicle_id, admin_user.user_id
    - _Requirements: 2.1, 2.2, 3.1, 4.1, 5.1, 14.1_

  - [ ] 1.2 Generate and apply Prisma migrations
    - Run `npx prisma migrate dev --name add-admin-tables` to create migration
    - Verify all tables, foreign keys, and indexes created correctly
    - Test migration rollback and reapply
    - _Requirements: 2.1_

- [ ] 2. Backend: Admin module setup
  - [ ] 2.1 Create admin module structure
    - Generate admin module: `nest g module admin`
    - Create controllers directory with 13 controller files
    - Create services directory with 13 service files
    - Create dto directory for all admin DTOs
    - Create guards directory for AdminRoleGuard
    - Create websocket directory for AdminGateway
    - _Requirements: 1.1, 1.2_

  - [ ] 2.2 Implement AdminRoleGuard
    - Create guard that checks user.role is ADMIN or SUPPORT
    - Query admin_users table to get admin_role and permissions
    - Implement @AdminRoles() decorator for role-based access
    - Cache admin permissions in Redis with 5-minute TTL
    - _Requirements: 1.2, 1.3, 1.4, 10.4, 10.5_


- [ ] 3. Backend: Driver management endpoints
  - [ ] 3.1 Implement AdminDriversService
    - Create getAllDrivers() method with status filter and pagination
    - Create getDriverById() method with vehicle and assignment details
    - Create createDriver() method validating telegram_id uniqueness
    - Create updateDriver() method with status change logging
    - Create deactivateDriver() method setting status to OFFLINE
    - Publish driver status changes to Redis channel `driver_status_changed:{driver_id}`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.7_

  - [ ] 3.2 Create AdminDriversController
    - GET /v1/admin/drivers endpoint with query params: status, page, limit
    - GET /v1/admin/drivers/:id endpoint
    - POST /v1/admin/drivers endpoint with CreateDriverDto validation
    - PATCH /v1/admin/drivers/:id endpoint with UpdateDriverDto validation
    - Apply @AdminRoles(FLEET_MANAGER, OPERATIONS_MANAGER, SUPER_ADMIN) guard
    - Create audit log entries for all driver modifications
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 4.1_

  - [ ] 3.3 Create driver DTOs
    - CreateDriverDto: driver_name, driver_id, telegram_id, phone, vehicle_id
    - UpdateDriverDto: partial fields from CreateDriverDto plus status
    - DriverResponseDto: all driver fields plus vehicle details and assignment count
    - Add class-validator decorators for all fields
    - _Requirements: 2.1, 2.2, 2.3_

- [ ] 4. Backend: Vehicle fleet management endpoints
  - [ ] 4.1 Implement AdminVehiclesService
    - Create getAllVehicles() method with category and tier filters
    - Create getVehicleById() method with assigned driver and maintenance history
    - Create createVehicle() method with image upload to Supabase Storage
    - Create updateVehicle() method with price change audit logging
    - Create getVehicleAvailability() method checking driver status and maintenance
    - _Requirements: 3.1, 3.2, 3.3, 3.6, 3.7_

  - [ ] 4.2 Create AdminVehiclesController
    - GET /v1/admin/vehicles endpoint with query params: category, tier, search
    - GET /v1/admin/vehicles/:id endpoint
    - POST /v1/admin/vehicles endpoint with CreateVehicleDto validation
    - PATCH /v1/admin/vehicles/:id endpoint with UpdateVehicleDto validation
    - Apply @AdminRoles(FLEET_MANAGER, OPERATIONS_MANAGER, SUPER_ADMIN) guard
    - _Requirements: 3.1, 3.2, 3.3_

  - [ ] 4.3 Create vehicle DTOs
    - CreateVehicleDto: name, category, capacity, tier, price_per_day, price_per_km, features, images
    - UpdateVehicleDto: partial fields from CreateVehicleDto
    - VehicleResponseDto: all vehicle fields plus assigned_driver and maintenance_status
    - _Requirements: 3.1, 3.2, 3.3_

- [ ] 5. Backend: Vehicle maintenance endpoints
  - [ ] 5.1 Implement AdminMaintenanceService
    - Create getMaintenanceSchedule() method with date range filter
    - Create scheduleMaintenance() method creating VehicleMaintenance record
    - Create updateMaintenanceStatus() method with status transitions
    - Create getMaintenanceHistory() method for specific vehicle
    - Create getUpcomingMaintenance() method for reminders (within 3 days)
    - Prevent vehicle assignment when status is IN_MAINTENANCE
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7_

  - [ ] 5.2 Create AdminMaintenanceController
    - GET /v1/admin/maintenance endpoint with query params: vehicle_id, start_date, end_date
    - POST /v1/admin/maintenance endpoint with ScheduleMaintenanceDto
    - PATCH /v1/admin/maintenance/:id endpoint with UpdateMaintenanceDto
    - GET /v1/admin/maintenance/upcoming endpoint
    - Apply @AdminRoles(FLEET_MANAGER, OPERATIONS_MANAGER, SUPER_ADMIN) guard
    - _Requirements: 14.1, 14.2, 14.4, 14.5_

  - [ ] 5.3 Create maintenance DTOs
    - ScheduleMaintenanceDto: vehicle_id, maintenance_type, scheduled_date, maintenance_notes
    - UpdateMaintenanceDto: status, completion_date, maintenance_cost, maintenance_notes
    - MaintenanceResponseDto: all fields plus vehicle details
    - _Requirements: 14.1, 14.2, 14.5_


- [ ] 6. Backend: Driver assignment endpoints
  - [ ] 6.1 Implement AdminAssignmentsService
    - Create assignDriver() method validating driver status is AVAILABLE
    - Verify vehicle capacity matches booking passenger count
    - Update driver status to BUSY after assignment
    - Create DriverAssignment record with assignment_timestamp
    - Create completeAssignment() method updating driver status to AVAILABLE
    - Publish assignment events to Redis channel `driver_assignments`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [ ] 6.2 Create AdminAssignmentsController
    - POST /v1/admin/assignments endpoint with AssignDriverDto validation
    - PATCH /v1/admin/assignments/:id/complete endpoint
    - GET /v1/admin/assignments endpoint with query params: driver_id, booking_id
    - Apply @AdminRoles(OPERATIONS_MANAGER, FLEET_MANAGER, SUPER_ADMIN) guard
    - Return 409 Conflict if driver is not AVAILABLE
    - _Requirements: 5.1, 5.2, 5.3, 5.7_

  - [ ] 6.3 Create assignment DTOs
    - AssignDriverDto: driver_id, booking_id, vehicle_id
    - AssignmentResponseDto: all fields plus driver, booking, and vehicle details
    - _Requirements: 5.1, 5.5_

- [ ] 7. Backend: Telegram webhook endpoint
  - [ ] 7.1 Create Telegram module
    - Generate telegram module: `nest g module telegram`
    - Create TelegramService with driver status update logic
    - Create TelegramController with webhook endpoint
    - _Requirements: 4.1, 4.2_

  - [ ] 7.2 Implement TelegramService
    - Create handleDriverStatusUpdate() method
    - Parse telegram_id, vehicle_id, driver_name, status from webhook payload
    - Update or create Driver record in database
    - Set last_status_update to current timestamp
    - Publish status change to Redis channel `driver_status_changed:{driver_id}`
    - Create audit log entry for status change
    - _Requirements: 4.1, 4.2, 4.5_

  - [ ] 7.3 Create TelegramController
    - POST /v1/telegram/driver-status endpoint
    - Validate webhook signature (if Telegram bot provides one)
    - Parse payload: telegram_id, vehicle_id, driver_name, status
    - Call TelegramService.handleDriverStatusUpdate()
    - Return 200 OK with confirmation message
    - _Requirements: 4.1, 4.2_

  - [ ] 7.4 Create telegram DTOs
    - DriverStatusWebhookDto: telegram_id, vehicle_id, driver_name, status
    - Add class-validator decorators for required fields
    - Validate status is one of: AVAILABLE, BUSY, OFFLINE
    - _Requirements: 4.1, 4.2_

- [ ] 8. Backend: Booking operations endpoints
  - [ ] 8.1 Implement AdminBookingsService
    - Create getAllBookings() method with filters: booking_type, status, date_range, user_email
    - Create getBookingById() method with full details (trip, hotel, vehicle, guide, payment)
    - Create updateBooking() method for modifications
    - Create cancelBooking() method updating status and processing refund
    - Create getUnassignedBookings() method for pending driver assignments
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [ ] 8.2 Create AdminBookingsController
    - GET /v1/admin/bookings endpoint with query params: booking_type, status, start_date, end_date, search
    - GET /v1/admin/bookings/:id endpoint
    - PATCH /v1/admin/bookings/:id endpoint with UpdateBookingDto
    - POST /v1/bookings/:id/cancel endpoint (reuse existing or create admin version)
    - Apply @AdminRoles(SUPPORT_AGENT, OPERATIONS_MANAGER, SUPER_ADMIN) guard
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [ ] 8.3 Create booking admin DTOs
    - UpdateBookingDto: travel_date, end_date, num_adults, num_children, customizations
    - BookingDetailResponseDto: all booking fields plus related entities
    - _Requirements: 8.3, 8.4_


- [ ] 9. Backend: Hotel inventory management endpoints
  - [ ] 9.1 Implement AdminHotelsService
    - Create getAllHotels() method with pagination
    - Create getHotelById() method with rooms
    - Create createHotel() method with image upload
    - Create updateHotel() method
    - Create getHotelRooms() method
    - Create createRoom() method
    - Create updateRoom() method
    - Create getRoomAvailability() method checking bookings table
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

  - [ ] 9.2 Create AdminHotelsController
    - GET /v1/admin/hotels endpoint
    - GET /v1/admin/hotels/:id endpoint
    - POST /v1/admin/hotels endpoint with CreateHotelDto
    - PATCH /v1/admin/hotels/:id endpoint with UpdateHotelDto
    - GET /v1/admin/hotels/:id/rooms endpoint
    - POST /v1/admin/hotels/:id/rooms endpoint with CreateRoomDto
    - PATCH /v1/admin/hotels/:hotelId/rooms/:roomId endpoint with UpdateRoomDto
    - Apply @AdminRoles(OPERATIONS_MANAGER, SUPER_ADMIN) guard
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ] 9.3 Create hotel admin DTOs
    - CreateHotelDto: name, description, location, images, rating, amenities, check_in_time, check_out_time, cancellation_policy
    - UpdateHotelDto: partial fields from CreateHotelDto
    - CreateRoomDto: name, description, capacity, price_per_night, images, amenities
    - UpdateRoomDto: partial fields from CreateRoomDto
    - _Requirements: 6.3, 6.4, 6.5_

- [ ] 10. Backend: Tour guide management endpoints
  - [ ] 10.1 Implement AdminGuidesService
    - Create getAllGuides() method with language and specialty filters
    - Create getGuideById() method with assignments and performance metrics
    - Create createGuide() method with profile picture upload
    - Create updateGuide() method
    - Create getGuideAssignments() method from bookings table
    - Create getGuideAvailability() method checking overlapping bookings
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [ ] 10.2 Create AdminGuidesController
    - GET /v1/admin/guides endpoint with query params: languages, specialties
    - GET /v1/admin/guides/:id endpoint
    - POST /v1/admin/guides endpoint with CreateGuideDto
    - PATCH /v1/admin/guides/:id endpoint with UpdateGuideDto
    - Apply @AdminRoles(OPERATIONS_MANAGER, SUPER_ADMIN) guard
    - _Requirements: 7.1, 7.2, 7.3_

  - [ ] 10.3 Create guide admin DTOs
    - CreateGuideDto: name, bio, profile_picture, languages, specialties, experience_years, certifications, price_per_hour, price_per_day
    - UpdateGuideDto: partial fields from CreateGuideDto
    - GuideResponseDto: all fields plus assignment count and average rating
    - _Requirements: 7.2, 7.3_

- [ ] 11. Backend: Emergency alert management endpoints
  - [ ] 11.1 Implement AdminEmergencyService
    - Create getAllEmergencyAlerts() method with status and type filters
    - Create getEmergencyAlertById() method with user and booking details
    - Create acknowledgeAlert() method updating status to ACKNOWLEDGED
    - Create resolveAlert() method updating status to RESOLVED with notes
    - Publish emergency events to Redis channel `emergency_alerts`
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7_

  - [ ] 11.2 Create AdminEmergencyController
    - GET /v1/admin/emergency endpoint with query params: status, alert_type
    - GET /v1/admin/emergency/:id endpoint
    - PATCH /v1/admin/emergency/:id endpoint with UpdateEmergencyDto
    - Apply @AdminRoles(OPERATIONS_MANAGER, SUPER_ADMIN) guard
    - _Requirements: 11.1, 11.3, 11.4, 11.5_

  - [ ] 11.3 Create emergency admin DTOs
    - UpdateEmergencyDto: status, acknowledged_at, resolved_at, resolution_notes, responder_admin_user_id
    - EmergencyDetailResponseDto: all fields plus user contact and driver contact
    - _Requirements: 11.4, 11.5_


- [ ] 12. Backend: Customer support endpoints
  - [ ] 12.1 Implement AdminCustomersService
    - Create getAllCustomers() method with search filters (name, email, phone)
    - Create getCustomerById() method with booking history and loyalty transactions
    - Create getCustomerReviews() method from reviews table
    - Create adjustLoyaltyPoints() method updating users.loyalty_points and creating transaction
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7_

  - [ ] 12.2 Create AdminCustomersController
    - GET /v1/admin/customers endpoint with query params: search, page, limit
    - GET /v1/admin/customers/:id endpoint
    - POST /v1/admin/loyalty/adjust endpoint with AdjustLoyaltyDto
    - Apply @AdminRoles(SUPPORT_AGENT, OPERATIONS_MANAGER, SUPER_ADMIN) guard
    - _Requirements: 15.1, 15.2, 15.3, 15.7_

  - [ ] 12.3 Create customer admin DTOs
    - CustomerResponseDto: all user fields plus booking count and loyalty balance
    - AdjustLoyaltyDto: user_id, points (positive or negative), description
    - _Requirements: 15.3, 15.7_

- [ ] 13. Backend: Discount code management endpoints
  - [ ] 13.1 Implement AdminDiscountsService
    - Create getAllDiscountCodes() method
    - Create createDiscountCode() method validating code uniqueness
    - Create updateDiscountCode() method
    - Create deactivateDiscountCode() method setting is_active to false
    - Create getAllStudentVerifications() method with status filter
    - Create reviewStudentVerification() method updating status and users.is_student
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7_

  - [ ] 13.2 Create AdminDiscountsController
    - GET /v1/admin/discounts endpoint
    - POST /v1/admin/discounts endpoint with CreateDiscountCodeDto
    - PATCH /v1/admin/discounts/:id endpoint with UpdateDiscountCodeDto
    - GET /v1/admin/student-verifications endpoint with query param: status
    - PATCH /v1/admin/student-verifications/:id endpoint with ReviewStudentVerificationDto
    - Apply @AdminRoles(OPERATIONS_MANAGER, SUPER_ADMIN) guard
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7_

  - [ ] 13.3 Create discount admin DTOs
    - CreateDiscountCodeDto: code, discount_percentage, valid_from, valid_until, max_usage
    - UpdateDiscountCodeDto: partial fields from CreateDiscountCodeDto plus is_active
    - ReviewStudentVerificationDto: status (APPROVED or REJECTED), reviewed_at
    - _Requirements: 13.2, 13.3, 13.6, 13.7_

- [ ] 14. Backend: Analytics and reporting endpoints
  - [ ] 14.1 Implement AdminAnalyticsService
    - Create getRevenueAnalytics() method aggregating bookings by booking_type
    - Create getBookingStatistics() method with counts by status
    - Create getDriverPerformance() method aggregating assignments and reviews
    - Create getPopularDestinations() method from bookings and trips
    - Create getHotelOccupancy() method calculating occupancy rate
    - Create getGuideUtilization() method calculating utilization percentage
    - Create exportData() method generating CSV/JSON files
    - Create getAIPerformance() method for AI-assisted booking metrics
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 16.5, 16.6, 16.7_

  - [ ] 14.2 Create AdminAnalyticsController
    - GET /v1/admin/analytics/revenue endpoint with query params: start_date, end_date
    - GET /v1/admin/analytics/bookings endpoint with date range
    - GET /v1/admin/analytics/drivers endpoint
    - GET /v1/admin/analytics/ai-bookings endpoint
    - GET /v1/admin/analytics/ai-performance endpoint
    - GET /v1/admin/analytics/export endpoint with format param (CSV or JSON)
    - Apply @AdminRoles(SUPER_ADMIN, OPERATIONS_MANAGER) guard
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 16.5, 16.6, 16.7_

  - [ ] 14.3 Create analytics DTOs
    - RevenueAnalyticsDto: booking_type, total_revenue, booking_count
    - BookingStatisticsDto: total_count, confirmed_count, cancelled_count, cancellation_rate
    - DriverPerformanceDto: driver_id, driver_name, total_trips, average_rating
    - _Requirements: 9.1, 9.2, 9.3_


- [ ] 15. Backend: Admin user management endpoints
  - [ ] 15.1 Implement AdminUsersService
    - Create getAllAdminUsers() method joining users and admin_users tables
    - Create createAdminUser() method creating user with role ADMIN and admin_users record
    - Create updateAdminRole() method updating admin_role and permissions
    - Create deactivateAdminUser() method setting is_active to false and incrementing token_version
    - Cache admin permissions in Redis with 5-minute TTL
    - _Requirements: 10.1, 10.2, 10.3, 10.6_

  - [ ] 15.2 Create AdminUsersController
    - GET /v1/admin/users endpoint
    - POST /v1/admin/users endpoint with CreateAdminUserDto
    - PATCH /v1/admin/users/:id endpoint with UpdateAdminUserDto
    - Apply @AdminRoles(SUPER_ADMIN) guard (only super admins can manage admin users)
    - _Requirements: 10.1, 10.2, 10.3, 10.6_

  - [ ] 15.3 Create admin user DTOs
    - CreateAdminUserDto: email, name, password, admin_role, permissions
    - UpdateAdminUserDto: admin_role, permissions, is_active
    - AdminUserResponseDto: all fields from users and admin_users tables
    - _Requirements: 10.2, 10.3_

- [ ] 16. Backend: Audit logging endpoints
  - [ ] 16.1 Implement AdminAuditService
    - Create getAllAuditLogs() method with filters (date_range, admin_user_id, action_type)
    - Create createAuditLog() method for manual audit entries
    - Create exportAuditLogs() method generating CSV file
    - Implement automatic audit logging in AuditInterceptor for sensitive operations
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 19.7_

  - [ ] 16.2 Create AdminAuditController
    - GET /v1/admin/audit-logs endpoint with query params: start_date, end_date, admin_user_id, action_type
    - GET /v1/admin/audit-logs/export endpoint
    - Apply @AdminRoles(SUPER_ADMIN) guard
    - _Requirements: 19.1, 19.2, 19.7_

  - [ ] 16.3 Create audit DTOs
    - AuditLogResponseDto: all fields plus admin_user name from users table join
    - AuditLogFilterDto: start_date, end_date, admin_user_id, action_type
    - _Requirements: 19.1, 19.2_

- [ ] 17. Backend: Dashboard overview endpoint
  - [ ] 17.1 Implement AdminDashboardService
    - Create getDashboardOverview() method aggregating multiple metrics
    - Calculate total_bookings_today from bookings table
    - Calculate total_revenue_today from bookings table
    - Calculate active_drivers_count from drivers table
    - Get booking_trends for past 30 days
    - Get pending_actions (unassigned bookings, upcoming maintenance)
    - Get recent_emergency_alerts
    - Get driver_availability_summary
    - Get upcoming_bookings for next 24 hours
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 20.6_

  - [ ] 17.2 Create AdminDashboardController
    - GET /v1/admin/dashboard endpoint
    - Apply @AdminRoles(all roles) guard
    - Return different metrics based on admin role
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 20.6_

  - [ ] 17.3 Create dashboard DTOs
    - DashboardOverviewDto: all dashboard metrics
    - BookingTrendDto: date, booking_count
    - PendingActionDto: action_type, count, details
    - _Requirements: 20.1, 20.2, 20.3_

- [ ] 18. Backend: Data export and backup endpoints
  - [ ] 18.1 Implement AdminExportService
    - Create exportBookings() method generating CSV/JSON file
    - Create exportDrivers() method with performance metrics
    - Create exportPayments() method with encryption for sensitive data
    - Create triggerBackup() method creating Supabase database dump
    - Store backup metadata in backups table
    - Implement AES-256 encryption for sensitive exports
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.7_

  - [ ] 18.2 Create AdminExportController
    - GET /v1/admin/export/bookings endpoint with query params: start_date, end_date, format
    - GET /v1/admin/export/drivers endpoint
    - GET /v1/admin/export/payments endpoint
    - POST /v1/admin/backup endpoint
    - GET /v1/admin/backups endpoint
    - Apply @AdminRoles(SUPER_ADMIN) guard
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6_

  - [ ] 18.3 Create export DTOs
    - ExportRequestDto: start_date, end_date, format (CSV or JSON)
    - BackupResponseDto: id, backup_file_url, backup_size_bytes, created_at
    - _Requirements: 18.1, 18.4_


- [ ] 19. Backend: AI agent booking monitoring endpoints
  - [ ] 19.1 Implement AdminAIMonitoringService
    - Create getAIAssistedBookings() method filtering by metadata.ai_assisted
    - Create getAISessionDetails() method retrieving conversation from Redis
    - Create getAIBookingSuccessRate() method calculating success percentage
    - Create getAIPerformanceMetrics() method with average booking time and satisfaction
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7_

  - [ ] 19.2 Create AdminAIMonitoringController
    - GET /v1/admin/ai-sessions/:sessionId endpoint
    - Apply @AdminRoles(OPERATIONS_MANAGER, SUPER_ADMIN) guard
    - Return "Session expired" if Redis TTL expired (7 days)
    - _Requirements: 16.4_

- [ ] 20. Backend: WebSocket gateway for real-time updates
  - [ ] 20.1 Implement AdminGateway
    - Create WebSocket gateway at /v1/admin/ws
    - Implement JWT authentication for WebSocket connections
    - Subscribe to Redis channels: admin_events, driver_status_changed:*, emergency_alerts, driver_assignments
    - Broadcast events to connected admin clients
    - Implement room-based broadcasting by admin role
    - Handle connection/disconnection events
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

  - [ ] 20.2 Implement Redis pub/sub integration
    - Create RedisService with publish() and subscribe() methods
    - Publish driver status changes to driver_status_changed:{driver_id}
    - Publish booking events to admin_events channel
    - Publish emergency alerts to emergency_alerts channel
    - Publish driver assignments to driver_assignments channel
    - _Requirements: 4.5, 12.2, 12.3, 12.4, 12.5_

  - [ ] 20.3 Create WebSocket event DTOs
    - DriverStatusUpdateEvent: driver_id, status, timestamp
    - BookingCreatedEvent: booking_id, booking_ref, booking_type, timestamp
    - EmergencyAlertEvent: alert_id, alert_type, user_id, latitude, longitude, timestamp
    - DriverAssignmentEvent: assignment_id, driver_id, booking_id, timestamp
    - _Requirements: 12.2, 12.3, 12.4, 12.5_

- [ ] 21. Frontend: Admin layout and navigation
  - [ ] 21.1 Create AdminLayout component
    - Implement responsive layout with sidebar and top bar
    - Add sidebar navigation with role-based menu filtering
    - Add top bar with admin user info, language selector, notification bell
    - Add WebSocket connection status indicator
    - Implement collapsible sidebar for mobile
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 12.6, 17.1_

  - [ ] 21.2 Create AdminSidebar component
    - Render navigation menu items based on admin role permissions
    - Highlight active route
    - Add icons from lucide-react
    - Filter menu items: FLEET_MANAGER sees only drivers/vehicles, SUPPORT_AGENT sees only bookings/customers
    - _Requirements: 1.4, 10.4, 10.5_

  - [ ] 21.3 Create NotificationBell component
    - Display badge with unread notification count
    - Implement dropdown with recent notifications
    - Show notification types: new bookings, driver status changes, emergency alerts
    - Mark notifications as read on click
    - Store notifications in Zustand store
    - _Requirements: 12.7_

  - [ ] 21.4 Create admin route group structure
    - Create frontend/app/(admin)/layout.tsx with AdminLayout
    - Create all admin page routes as specified in design document
    - Implement route protection with admin role check
    - Redirect non-admin users to /home
    - _Requirements: 1.1, 1.2, 1.3, 1.4_


- [ ] 22. Frontend: Dashboard page
  - [ ] 22.1 Create DashboardOverview component
    - Fetch dashboard data from GET /v1/admin/dashboard
    - Display metric cards: bookings today, revenue today, active drivers
    - Render booking trend chart for past 30 days using recharts
    - Display pending actions list
    - Display recent emergency alerts
    - Implement auto-refresh every 60 seconds using React Query refetchInterval
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.7_

  - [ ] 22.2 Create MetricCard component
    - Reusable card for displaying single metric
    - Props: title, value, icon, trend (percentage change)
    - Display trend indicator (up/down arrow with color)
    - _Requirements: 20.1_

  - [ ] 22.3 Create BookingTrendChart component
    - Line chart showing daily booking counts
    - Use recharts library (LineChart, Line, XAxis, YAxis, Tooltip)
    - Responsive design
    - _Requirements: 20.2_

  - [ ] 22.4 Create dashboard page
    - Create frontend/app/(admin)/admin/dashboard/page.tsx
    - Render DashboardOverview component
    - Add loading and error states
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 20.6_

- [ ] 23. Frontend: Driver management pages
  - [ ] 23.1 Create DriverList component
    - Fetch drivers from GET /v1/admin/drivers
    - Display data table with columns: name, driver_id, vehicle, status, last_update
    - Implement status filter dropdown (AVAILABLE, BUSY, OFFLINE)
    - Implement search by name or driver_id
    - Subscribe to WebSocket for real-time status updates
    - Add Edit and View Details actions
    - _Requirements: 2.1, 2.5, 2.6_

  - [ ] 23.2 Create DriverStatusBadge component
    - Color-coded badge: green (AVAILABLE), yellow (BUSY), gray (OFFLINE)
    - Add pulsing animation for real-time updates
    - _Requirements: 2.5_

  - [ ] 23.3 Create DriverForm component
    - Form for creating/editing driver profiles
    - Fields: driver_name, driver_id, telegram_id, phone, vehicle_id (dropdown)
    - Use React Hook Form + Zod validation
    - Submit to POST/PATCH /v1/admin/drivers
    - _Requirements: 2.2, 2.3_

  - [ ] 23.4 Create DriverDetailView component
    - Display driver profile information
    - Show assigned vehicle details
    - Display assignment history table
    - Show performance metrics (total trips, average rating)
    - _Requirements: 2.1, 2.7_

  - [ ] 23.5 Create driver pages
    - Create frontend/app/(admin)/admin/drivers/page.tsx with DriverList
    - Create frontend/app/(admin)/admin/drivers/[id]/page.tsx with DriverDetailView
    - Add loading and error states
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [ ] 24. Frontend: Vehicle management pages
  - [ ] 24.1 Create VehicleList component
    - Fetch vehicles from GET /v1/admin/vehicles
    - Display data table with columns: name, category, capacity, tier, price, assigned_driver
    - Implement filters: category (VAN, BUS, TUK_TUK), tier (STANDARD, VIP)
    - Implement search by name
    - Add Edit and Schedule Maintenance actions
    - _Requirements: 3.1, 3.6_

  - [ ] 24.2 Create VehicleForm component
    - Form for creating/editing vehicles
    - Fields: name, category, capacity, tier, price_per_day, price_per_km, features (multi-select), images (upload)
    - Implement image upload to Supabase Storage
    - Use React Hook Form + Zod validation
    - _Requirements: 3.2, 3.3_

  - [ ] 24.3 Create MaintenanceScheduler component
    - Calendar view of scheduled maintenance
    - Form to schedule new maintenance
    - Fields: vehicle_id, maintenance_type, scheduled_date, notes
    - Submit to POST /v1/admin/maintenance
    - Display reminder notifications for upcoming maintenance (within 3 days)
    - _Requirements: 14.1, 14.2, 14.3_

  - [ ] 24.4 Create MaintenanceHistory component
    - Table of past maintenance records
    - Columns: date, type, cost, notes, status
    - Calculate and display total cost
    - _Requirements: 14.6, 14.7_

  - [ ] 24.5 Create vehicle pages
    - Create frontend/app/(admin)/admin/vehicles/page.tsx with VehicleList
    - Create frontend/app/(admin)/admin/vehicles/[id]/page.tsx with vehicle detail and MaintenanceHistory
    - Add loading and error states
    - _Requirements: 3.1, 3.2, 3.3, 14.1, 14.6_


- [ ] 25. Frontend: Booking management pages
  - [ ] 25.1 Create BookingList component
    - Fetch bookings from GET /v1/admin/bookings
    - Display data table with columns: booking_ref, customer, type, status, travel_date, total
    - Implement filters: booking_type, status, date range, AI-assisted flag
    - Implement search by booking_ref or customer email
    - Subscribe to WebSocket for real-time new booking notifications
    - _Requirements: 8.1, 8.2, 12.2_

  - [ ] 25.2 Create BookingDetailView component
    - Fetch booking details from GET /v1/admin/bookings/:id
    - Display complete booking information
    - Show customer details from users table
    - Show trip/hotel/vehicle/guide details
    - Display payment status and history
    - Include DriverAssignmentPanel component
    - Add modification and cancellation actions
    - _Requirements: 8.3, 8.4, 8.5_

  - [ ] 25.3 Create DriverAssignmentPanel component
    - Dropdown to select available driver from GET /v1/admin/drivers?status=AVAILABLE
    - Display vehicle capacity validation
    - Assign button calling POST /v1/admin/assignments
    - Show current assignment if exists
    - Display error if driver not available (409 Conflict)
    - _Requirements: 5.1, 5.2, 5.3, 5.5, 5.6_

  - [ ] 25.4 Create BookingModificationForm component
    - Form to modify booking details
    - Fields: travel_date, end_date, num_adults, num_children, customizations
    - Implement validation and price recalculation
    - Submit to PATCH /v1/admin/bookings/:id
    - _Requirements: 8.4_

  - [ ] 25.5 Create booking pages
    - Create frontend/app/(admin)/admin/bookings/page.tsx with BookingList
    - Create frontend/app/(admin)/admin/bookings/[id]/page.tsx with BookingDetailView
    - Add loading and error states
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 26. Frontend: Hotel management pages
  - [ ] 26.1 Create HotelList component
    - Fetch hotels from GET /v1/admin/hotels
    - Display data table with columns: name, location, rating, room_count
    - Implement search by name or location
    - Add Edit and Manage Rooms actions
    - _Requirements: 6.1_

  - [ ] 26.2 Create HotelForm component
    - Form for creating/editing hotels
    - Fields: name, description, location (JSON with lat/lng), images, rating, amenities, check_in_time, check_out_time, cancellation_policy
    - Implement location picker using Leaflet.js map
    - Implement image upload to Supabase Storage
    - _Requirements: 6.3, 6.5_

  - [ ] 26.3 Create RoomManagement component
    - List of rooms for a hotel from GET /v1/admin/hotels/:id/rooms
    - Add/Edit/Delete room actions
    - Display room availability calendar
    - _Requirements: 6.2, 6.6_

  - [ ] 26.4 Create RoomForm component
    - Form for creating/editing rooms
    - Fields: name, description, capacity, price_per_night, images, amenities
    - Implement image upload to Supabase Storage
    - Submit to POST/PATCH /v1/admin/hotels/:hotelId/rooms/:roomId
    - _Requirements: 6.4, 6.5_

  - [ ] 26.5 Create hotel pages
    - Create frontend/app/(admin)/admin/hotels/page.tsx with HotelList
    - Create frontend/app/(admin)/admin/hotels/[id]/page.tsx with hotel detail
    - Create frontend/app/(admin)/admin/hotels/[id]/rooms/page.tsx with RoomManagement
    - Add loading and error states
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 27. Frontend: Tour guide management pages
  - [ ] 27.1 Create GuideList component
    - Fetch guides from GET /v1/admin/guides
    - Display data table with columns: name, languages, specialties, rating, price
    - Implement filters: languages (multi-select), specialties (multi-select)
    - Add Edit and View Details actions
    - _Requirements: 7.1, 7.6_

  - [ ] 27.2 Create GuideForm component
    - Form for creating/editing guides
    - Fields: name, bio, profile_picture, languages (multi-select), specialties (multi-select), experience_years, certifications, price_per_hour, price_per_day
    - Implement profile picture upload to Supabase Storage
    - _Requirements: 7.2, 7.3_

  - [ ] 27.3 Create GuideDetailView component
    - Display guide profile information
    - Show assignment history from bookings table
    - Display performance metrics (total assignments, average rating)
    - Show availability calendar
    - _Requirements: 7.4, 7.5, 7.7_

  - [ ] 27.4 Create guide pages
    - Create frontend/app/(admin)/admin/guides/page.tsx with GuideList
    - Create frontend/app/(admin)/admin/guides/[id]/page.tsx with GuideDetailView
    - Add loading and error states
    - _Requirements: 7.1, 7.2, 7.3, 7.4_


- [ ] 28. Frontend: Emergency alert management pages
  - [ ] 28.1 Create EmergencyAlertList component
    - Fetch alerts from GET /v1/admin/emergency
    - Display data table with columns: alert_type, customer, location, status, time
    - Implement filters: status (SENT, ACKNOWLEDGED, RESOLVED), alert_type
    - Apply urgent visual styling for SENT alerts
    - Subscribe to WebSocket for new emergency alerts
    - Play sound notification for new alerts using browser Notification API
    - _Requirements: 11.1, 11.2, 12.5_

  - [ ] 28.2 Create EmergencyDetailView component
    - Fetch alert details from GET /v1/admin/emergency/:id
    - Display alert details (type, message, timestamp)
    - Show customer contact information
    - Show assigned driver contact (if applicable)
    - Render EmergencyMap component with location
    - Add Acknowledge and Resolve action buttons
    - Include resolution notes textarea
    - _Requirements: 11.3, 11.4, 11.5, 11.6, 11.7_

  - [ ] 28.3 Create EmergencyMap component
    - Leaflet.js map showing alert location (latitude, longitude)
    - Add marker with alert type icon
    - Display nearby hotels/hospitals/police stations
    - _Requirements: 11.6_

  - [ ] 28.4 Create emergency pages
    - Create frontend/app/(admin)/admin/emergency/page.tsx with EmergencyAlertList
    - Create frontend/app/(admin)/admin/emergency/[id]/page.tsx with EmergencyDetailView
    - Add loading and error states
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [ ] 29. Frontend: Customer support pages
  - [ ] 29.1 Create CustomerList component
    - Fetch customers from GET /v1/admin/customers
    - Display data table with columns: name, email, phone, loyalty_points, is_student
    - Implement search by name, email, or phone
    - Add View Profile action
    - _Requirements: 15.1, 15.2_

  - [ ] 29.2 Create CustomerProfileView component
    - Fetch customer details from GET /v1/admin/customers/:id
    - Display customer information
    - Show booking history table
    - Display loyalty points balance and transaction history
    - Show reviews and feedback
    - Display emergency alerts history
    - Include loyalty points adjustment form
    - _Requirements: 15.3, 15.4, 15.5, 15.6, 15.7_

  - [ ] 29.3 Create customer pages
    - Create frontend/app/(admin)/admin/customers/page.tsx with CustomerList
    - Create frontend/app/(admin)/admin/customers/[id]/page.tsx with CustomerProfileView
    - Add loading and error states
    - _Requirements: 15.1, 15.2, 15.3_

- [ ] 30. Frontend: Discount code management pages
  - [ ] 30.1 Create DiscountCodeList component
    - Fetch discount codes from GET /v1/admin/discounts
    - Display data table with columns: code, discount_percentage, valid_from, valid_until, usage_count, max_usage, is_active
    - Add Edit and Deactivate actions
    - _Requirements: 13.1_

  - [ ] 30.2 Create DiscountCodeForm component
    - Form for creating/editing discount codes
    - Fields: code, discount_percentage, valid_from, valid_until, max_usage
    - Validate code uniqueness and date range validity
    - Submit to POST/PATCH /v1/admin/discounts
    - _Requirements: 13.2, 13.3_

  - [ ] 30.3 Create StudentVerificationQueue component
    - Fetch verifications from GET /v1/admin/student-verifications?status=PENDING
    - Display list with columns: student_name, submitted_at, status
    - Add Review action
    - _Requirements: 13.4_

  - [ ] 30.4 Create StudentVerificationReview component
    - Display uploaded student ID and selfie images from Supabase Storage
    - Side-by-side image comparison
    - Add Approve and Reject buttons with confirmation
    - Include rejection reason textarea
    - Submit to PATCH /v1/admin/student-verifications/:id
    - _Requirements: 13.5, 13.6, 13.7_

  - [ ] 30.5 Create discount pages
    - Create frontend/app/(admin)/admin/discounts/page.tsx with DiscountCodeList
    - Create frontend/app/(admin)/admin/discounts/student-verifications/page.tsx with StudentVerificationQueue
    - Add loading and error states
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_


- [ ] 31. Frontend: Analytics and reporting pages
  - [ ] 31.1 Create AnalyticsDashboard component
    - Fetch analytics data from multiple endpoints
    - Display revenue charts by booking type using RevenueChart component
    - Show booking statistics (total, by status, cancellation rate)
    - Display driver performance metrics using PerformanceMetrics component
    - Show popular destinations chart
    - Display hotel occupancy rate
    - Show guide utilization rate
    - Add date range selector
    - Add export button calling GET /v1/admin/analytics/export
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_

  - [ ] 31.2 Create RevenueChart component
    - Bar chart showing revenue by booking type
    - Use recharts library (BarChart, Bar, XAxis, YAxis, Tooltip, Legend)
    - Responsive design
    - _Requirements: 9.1_

  - [ ] 31.3 Create PerformanceMetrics component
    - Table of driver/guide performance
    - Columns: name, total_trips, average_rating, revenue_generated
    - Sortable columns
    - _Requirements: 9.3_

  - [ ] 31.4 Create analytics page
    - Create frontend/app/(admin)/admin/analytics/page.tsx with AnalyticsDashboard
    - Add loading and error states
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_

- [ ] 32. Frontend: Admin user management pages
  - [ ] 32.1 Create AdminUserList component
    - Fetch admin users from GET /v1/admin/users
    - Display data table with columns: name, email, admin_role, permissions, is_active
    - Add Edit Role and Deactivate actions
    - Only accessible to SUPER_ADMIN role
    - _Requirements: 10.1_

  - [ ] 32.2 Create AdminUserForm component
    - Form for creating/editing admin users
    - Fields: email, name, admin_role (dropdown), permissions (checkboxes)
    - Implement role-based permission presets
    - Submit to POST/PATCH /v1/admin/users
    - _Requirements: 10.2, 10.3_

  - [ ] 32.3 Create admin user page
    - Create frontend/app/(admin)/admin/users/page.tsx with AdminUserList
    - Add loading and error states
    - Restrict access to SUPER_ADMIN only
    - _Requirements: 10.1, 10.2, 10.3_

- [ ] 33. Frontend: Audit log viewer page
  - [ ] 33.1 Create AuditLogViewer component
    - Fetch audit logs from GET /v1/admin/audit-logs
    - Display data table with columns: timestamp, admin_user, action_type, resource_type, affected_resource_id
    - Implement filters: date range, admin_user, action_type
    - Add expandable rows showing changed_fields JSON
    - Add export button calling GET /v1/admin/audit-logs/export
    - _Requirements: 19.1, 19.2, 19.7_

  - [ ] 33.2 Create audit log page
    - Create frontend/app/(admin)/admin/audit-logs/page.tsx with AuditLogViewer
    - Add loading and error states
    - Restrict access to SUPER_ADMIN only
    - _Requirements: 19.1, 19.2_

- [ ] 34. Frontend: WebSocket integration
  - [ ] 34.1 Create useAdminWebSocket custom hook
    - Establish WebSocket connection to wss://api.derlg.com/v1/admin/ws
    - Authenticate using JWT token from auth store
    - Subscribe to event types: DRIVER_STATUS_UPDATE, BOOKING_CREATED, EMERGENCY_ALERT, DRIVER_ASSIGNMENT
    - Handle incoming messages and update Zustand stores
    - Implement reconnection logic with exponential backoff (10s, 20s, 40s)
    - Return connection status (connected, disconnected, reconnecting)
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

  - [ ] 34.2 Create admin notification store
    - Zustand store for managing notifications
    - State: notifications array, unread count
    - Actions: addNotification, markAsRead, clearAll
    - Persist unread count in localStorage
    - _Requirements: 12.7_

  - [ ] 34.3 Integrate WebSocket in AdminLayout
    - Call useAdminWebSocket hook in AdminLayout
    - Display connection status indicator in top bar
    - Show reconnecting message when connection lost
    - _Requirements: 12.6_

  - [ ] 34.4 Implement real-time updates in components
    - Update DriverList when DRIVER_STATUS_UPDATE received
    - Update BookingList when BOOKING_CREATED received
    - Show urgent notification when EMERGENCY_ALERT received
    - Update dashboard metrics when events received
    - Use React Query cache invalidation for data refresh
    - _Requirements: 12.2, 12.3, 12.4, 12.5_


- [ ] 35. Frontend: Multi-language support
  - [ ] 35.1 Create admin translation files
    - Create public/locales/en/admin.json with English translations
    - Create public/locales/zh/admin.json with Chinese translations
    - Create public/locales/km/admin.json with Khmer translations
    - Include translations for all UI labels, buttons, messages, notifications
    - _Requirements: 17.1, 17.2, 17.6_

  - [ ] 35.2 Integrate next-intl in admin pages
    - Use useTranslations hook in all admin components
    - Load translations from admin.json namespace
    - Format dates and times using Intl.DateTimeFormat with selected locale
    - _Requirements: 17.1, 17.2, 17.7_

  - [ ] 35.3 Implement language preference
    - Add language selector to admin top bar
    - Update Zustand language store on selection
    - Save preferred_language to backend via PATCH /v1/users/profile
    - Load preferred language on login from users table
    - _Requirements: 17.2, 17.3, 17.4_

- [ ] 36. Frontend: Authentication and authorization
  - [ ] 36.1 Create admin route protection
    - Implement middleware to check user.role is ADMIN or SUPPORT
    - Redirect non-admin users to /home
    - Fetch admin_role and permissions from backend on login
    - Store admin permissions in Zustand auth store
    - _Requirements: 1.1, 1.2, 1.3_

  - [ ] 36.2 Implement role-based UI rendering
    - Hide/show menu items based on admin_role
    - Disable actions based on permissions
    - Show "Access Denied" message for unauthorized features
    - _Requirements: 1.4, 1.5, 10.4, 10.5_

  - [ ] 36.3 Handle token refresh in admin panel
    - Automatically refresh JWT when access token expires (15 min)
    - Call POST /v1/auth/refresh using refresh token
    - Update tokens in httpOnly cookies
    - Maintain session across page navigation
    - _Requirements: 1.6, 1.7_

- [ ] 37. Frontend: Shared admin components
  - [ ] 37.1 Create DataTable component
    - Reusable table component with sorting, filtering, pagination
    - Props: columns, data, filters, onSort, onFilter, onPageChange
    - Use shadcn/ui Table components
    - Responsive design with horizontal scroll on mobile
    - _Requirements: Multiple requirements across all list views_

  - [ ] 37.2 Create SearchInput component
    - Reusable search input with debounce
    - Props: placeholder, onSearch, debounceMs
    - Clear button
    - _Requirements: Multiple requirements with search functionality_

  - [ ] 37.3 Create FilterDropdown component
    - Reusable dropdown for filtering
    - Props: options, value, onChange, label
    - Multi-select support
    - _Requirements: Multiple requirements with filter functionality_

  - [ ] 37.4 Create ConfirmDialog component
    - Reusable confirmation dialog
    - Props: title, message, onConfirm, onCancel
    - Use shadcn/ui AlertDialog
    - _Requirements: Multiple requirements with delete/deactivate actions_

  - [ ] 37.5 Create ImageUpload component
    - Reusable image upload with preview
    - Props: onUpload, maxSize, accept
    - Upload to Supabase Storage
    - Display upload progress
    - _Requirements: Multiple requirements with image upload_

- [ ] 38. Testing and quality assurance
  - [ ] 38.1 Write unit tests for backend services
    - Test AdminDriversService methods
    - Test AdminVehiclesService methods
    - Test AdminBookingsService methods
    - Test AdminAssignmentsService with driver availability validation
    - Test TelegramService webhook handling
    - Use Jest with mocked Prisma client
    - _Requirements: All backend requirements_

  - [ ] 38.2 Write integration tests for backend endpoints
    - Test admin authentication and authorization
    - Test driver management endpoints
    - Test vehicle and maintenance endpoints
    - Test booking operations endpoints
    - Test WebSocket gateway
    - Use supertest for HTTP requests
    - _Requirements: All backend requirements_

  - [ ] 38.3 Write frontend component tests
    - Test DriverList component with real-time updates
    - Test BookingDetailView with driver assignment
    - Test EmergencyAlertList with notifications
    - Test AdminLayout with role-based navigation
    - Use React Testing Library and Jest
    - _Requirements: All frontend requirements_

  - [ ] 38.4 Write end-to-end tests
    - Test complete driver assignment flow
    - Test emergency alert response flow
    - Test booking modification flow
    - Test student verification approval flow
    - Use Playwright or Cypress
    - _Requirements: Critical user flows_


- [ ] 39. Documentation and deployment
  - [ ] 39.1 Write API documentation
    - Document all /v1/admin/* endpoints with request/response examples
    - Document /v1/telegram/driver-status webhook
    - Document WebSocket events and message formats
    - Include authentication requirements for each endpoint
    - Add to docs/backend/ directory
    - _Requirements: All backend requirements_

  - [ ] 39.2 Write admin panel user guide
    - Create user guide for each admin role
    - Document driver management workflows
    - Document emergency response procedures
    - Document booking modification procedures
    - Include screenshots and step-by-step instructions
    - Add to docs/ directory
    - _Requirements: All frontend requirements_

  - [ ] 39.3 Create database migration scripts
    - Ensure all Prisma migrations are production-ready
    - Create seed script for initial admin users
    - Create seed script for sample drivers and vehicles
    - Document rollback procedures
    - _Requirements: 1.1, 1.2_

  - [ ] 39.4 Configure production environment
    - Set up environment variables for admin module
    - Configure Redis pub/sub channels
    - Set up Telegram Bot webhook URL
    - Configure CORS for admin WebSocket
    - Set up rate limiting for admin endpoints
    - _Requirements: All requirements_

  - [ ] 39.5 Deploy and monitor
    - Deploy backend admin module to production
    - Deploy frontend admin routes to production
    - Set up monitoring for WebSocket connections
    - Set up alerts for emergency notifications
    - Monitor Redis pub/sub performance
    - Set up logging for audit trail
    - _Requirements: All requirements_

## Summary

This implementation plan covers the complete System Admin Panel feature with 39 major tasks and 150+ sub-tasks. The implementation follows a modular approach:

1. **Backend (Tasks 1-20)**: Database schema, NestJS admin module with 13 controllers and services, Telegram webhook, WebSocket gateway, and Redis pub/sub integration
2. **Frontend (Tasks 21-35)**: Next.js admin route group with 40+ components, real-time WebSocket integration, role-based access control, and multi-language support
3. **Testing (Task 38)**: Comprehensive unit, integration, and end-to-end tests
4. **Documentation and Deployment (Task 39)**: API documentation, user guides, and production deployment

The admin panel integrates seamlessly with the existing DerLg platform, sharing the same database, authentication system, and technology stack while providing powerful administrative capabilities for managing all operational aspects of the travel booking platform.
