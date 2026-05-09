# System Admin Panel - Design Document

## Overview

The System Admin Panel is a comprehensive administrative interface built as a new route group within the existing Next.js 14 frontend application. It provides role-based access for administrators to manage all operational aspects of the DerLg Cambodia travel booking platform, including transportation fleet, hotel inventory, tour guides, bookings, emergency alerts, and real-time driver operations.

### Key Design Principles

1. **Integrated Architecture**: Built as `frontend/app/(admin)/*` route group, sharing the same codebase and authentication system as the main application
2. **Real-Time Operations**: WebSocket connections for live driver status updates, emergency alerts, and booking notifications
3. **Role-Based Access Control**: Four admin roles (SUPER_ADMIN, OPERATIONS_MANAGER, FLEET_MANAGER, SUPPORT_AGENT) with granular permissions
4. **Telegram Bot Integration**: Drivers update availability via Telegram bot, which triggers webhooks to the backend API
5. **Unified Database**: All admin operations use the existing Supabase PostgreSQL database with new tables for admin-specific data
6. **API-First Communication**: All data operations go through NestJS backend at `/v1/admin/*` endpoints

### Technology Stack

- **Frontend**: Next.js 14 App Router, TypeScript, Tailwind CSS, shadcn/ui
- **State Management**: Zustand (client state), React Query (server state)
- **Real-Time**: WebSocket + Redis pub/sub
- **Backend**: NestJS with new admin module
- **Database**: Supabase PostgreSQL (shared with main app)
- **Maps**: Leaflet.js for emergency location tracking
- **i18n**: next-intl (EN/ZH/KM)

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js Frontend                          │
│  ┌──────────────────┐         ┌──────────────────┐         │
│  │  (app) Routes    │         │  (admin) Routes  │         │
│  │  /home, /chat    │         │  /admin/*        │         │
│  └──────────────────┘         └──────────────────┘         │
│           │                            │                     │
│           └────────────┬───────────────┘                     │
│                        │                                     │
└────────────────────────┼─────────────────────────────────────┘
                         │
                         │ HTTP/WebSocket
                         │
┌────────────────────────▼─────────────────────────────────────┐
│                   NestJS Backend API                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ /v1/bookings │  │ /v1/admin/*  │  │ /v1/telegram │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                            │                  ▲               │
└────────────────────────────┼──────────────────┼───────────────┘
                             │                  │
                    ┌────────▼────────┐  ┌──────┴──────┐
                    │   Supabase      │  │  Telegram   │
                    │   PostgreSQL    │  │    Bot      │
                    └─────────────────┘  └─────────────┘
                             │
                    ┌────────▼────────┐
                    │  Redis (Upstash)│
                    │  Pub/Sub + Cache│
                    └─────────────────┘
```


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


## Components and Interfaces

### Frontend Components

#### Layout Components

**AdminLayout** (`frontend/components/layout/AdminLayout.tsx`)
- Sidebar navigation with role-based menu items
- Top bar with admin user info, language selector, notification bell
- Connection status indicator for WebSocket
- Responsive design (collapsible sidebar on mobile)

**AdminSidebar** (`frontend/components/admin/AdminSidebar.tsx`)
- Navigation menu filtered by admin role permissions
- Active route highlighting
- Icons from lucide-react

**NotificationBell** (`frontend/components/admin/NotificationBell.tsx`)
- Badge showing unread notification count
- Dropdown with recent notifications (bookings, driver status, emergencies)
- Click to mark as read

#### Dashboard Components

**DashboardOverview** (`frontend/components/admin/dashboard/DashboardOverview.tsx`)
- Key metrics cards (bookings today, revenue today, active drivers)
- Booking trend chart (30-day line chart using recharts)
- Pending actions list
- Recent emergency alerts

**MetricCard** (`frontend/components/admin/dashboard/MetricCard.tsx`)
- Reusable card for displaying single metric
- Props: title, value, icon, trend (up/down percentage)

**BookingTrendChart** (`frontend/components/admin/dashboard/BookingTrendChart.tsx`)
- Line chart showing daily booking counts
- Uses recharts library
- Responsive design

#### Driver Management Components

**DriverList** (`frontend/components/admin/drivers/DriverList.tsx`)
- Data table with columns: name, driver_id, vehicle, status, last_update
- Status filter dropdown (AVAILABLE, BUSY, OFFLINE)
- Search by name or driver_id
- Real-time status updates via WebSocket
- Actions: Edit, View Details

**DriverForm** (`frontend/components/admin/drivers/DriverForm.tsx`)
- Form for creating/editing driver profiles
- Fields: driver_name, driver_id, telegram_id, phone, vehicle_id (dropdown)
- Validation using React Hook Form + Zod
- Submit calls POST/PATCH /v1/admin/drivers

**DriverStatusBadge** (`frontend/components/admin/drivers/DriverStatusBadge.tsx`)
- Color-coded badge: green (AVAILABLE), yellow (BUSY), gray (OFFLINE)
- Pulsing animation for real-time updates

**DriverDetailView** (`frontend/components/admin/drivers/DriverDetailView.tsx`)
- Driver profile information
- Assigned vehicle details
- Assignment history table
- Performance metrics (total trips, average rating)

#### Vehicle Management Components

**VehicleList** (`frontend/components/admin/vehicles/VehicleList.tsx`)
- Data table with columns: name, category, capacity, tier, price, assigned_driver
- Filter by category (VAN, BUS, TUK_TUK) and tier (STANDARD, VIP)
- Search by name
- Actions: Edit, Schedule Maintenance

**VehicleForm** (`frontend/components/admin/vehicles/VehicleForm.tsx`)
- Form for creating/editing vehicles
- Fields: name, category, capacity, tier, price_per_day, price_per_km, features (multi-select), images (upload)
- Image upload to Supabase Storage

**MaintenanceScheduler** (`frontend/components/admin/vehicles/MaintenanceScheduler.tsx`)
- Calendar view of scheduled maintenance
- Form to schedule new maintenance
- Fields: vehicle_id, maintenance_type, scheduled_date, notes
- Reminder notifications for upcoming maintenance

**MaintenanceHistory** (`frontend/components/admin/vehicles/MaintenanceHistory.tsx`)
- Table of past maintenance records
- Columns: date, type, cost, notes, status
- Total cost calculation

#### Booking Management Components

**BookingList** (`frontend/components/admin/bookings/BookingList.tsx`)
- Data table with columns: booking_ref, customer, type, status, travel_date, total
- Filters: booking_type, status, date range, AI-assisted flag
- Search by booking_ref or customer email
- Real-time updates for new bookings

**BookingDetailView** (`frontend/components/admin/bookings/BookingDetailView.tsx`)
- Complete booking information
- Customer details (from users table)
- Trip/hotel/vehicle/guide details (via foreign keys)
- Payment status and history
- Driver assignment section
- Modification and cancellation actions

**DriverAssignmentPanel** (`frontend/components/admin/bookings/DriverAssignmentPanel.tsx`)
- Dropdown to select available driver
- Vehicle capacity validation
- Assign button calls POST /v1/admin/assignments
- Shows current assignment if exists

**BookingModificationForm** (`frontend/components/admin/bookings/BookingModificationForm.tsx`)
- Form to modify booking details
- Fields: travel_date, end_date, num_adults, num_children, customizations
- Validation and price recalculation


#### Hotel Management Components

**HotelList** (`frontend/components/admin/hotels/HotelList.tsx`)
- Data table with columns: name, location, rating, room_count
- Search by name or location
- Actions: Edit, Manage Rooms

**HotelForm** (`frontend/components/admin/hotels/HotelForm.tsx`)
- Form for creating/editing hotels
- Fields: name, description, location (JSON with lat/lng), images, rating, amenities, check_in_time, check_out_time, cancellation_policy
- Location picker using Leaflet.js map

**RoomManagement** (`frontend/components/admin/hotels/RoomManagement.tsx`)
- List of rooms for a hotel
- Add/Edit/Delete room actions
- Room availability calendar

**RoomForm** (`frontend/components/admin/hotels/RoomForm.tsx`)
- Form for creating/editing rooms
- Fields: name, description, capacity, price_per_night, images, amenities
- Image upload to Supabase Storage

#### Emergency Management Components

**EmergencyAlertList** (`frontend/components/admin/emergency/EmergencyAlertList.tsx`)
- Data table with columns: alert_type, customer, location, status, time
- Filter by status (SENT, ACKNOWLEDGED, RESOLVED) and alert_type
- Urgent visual styling for SENT alerts
- Sound notification for new alerts

**EmergencyDetailView** (`frontend/components/admin/emergency/EmergencyDetailView.tsx`)
- Alert details (type, message, timestamp)
- Customer contact information
- Assigned driver contact (if applicable)
- Location map using Leaflet.js
- Action buttons: Acknowledge, Resolve
- Resolution notes textarea

**EmergencyMap** (`frontend/components/admin/emergency/EmergencyMap.tsx`)
- Leaflet.js map showing alert location
- Marker with alert type icon
- Nearby hotels/hospitals/police stations

#### Customer Support Components

**CustomerList** (`frontend/components/admin/customers/CustomerList.tsx`)
- Data table with columns: name, email, phone, loyalty_points, is_student
- Search by name, email, or phone
- Actions: View Profile

**CustomerProfileView** (`frontend/components/admin/customers/CustomerProfileView.tsx`)
- Customer information
- Booking history table
- Loyalty points balance and transaction history
- Reviews and feedback
- Emergency alerts history
- Loyalty points adjustment form

#### Analytics Components

**AnalyticsDashboard** (`frontend/components/admin/analytics/AnalyticsDashboard.tsx`)
- Revenue charts by booking type
- Booking statistics (total, by status, cancellation rate)
- Driver performance metrics
- Popular destinations chart
- Hotel occupancy rate
- Guide utilization rate
- Date range selector
- Export button

**RevenueChart** (`frontend/components/admin/analytics/RevenueChart.tsx`)
- Bar chart showing revenue by booking type
- Uses recharts library

**PerformanceMetrics** (`frontend/components/admin/analytics/PerformanceMetrics.tsx`)
- Table of driver/guide performance
- Columns: name, total_trips, average_rating, revenue_generated

#### Discount Management Components

**DiscountCodeList** (`frontend/components/admin/discounts/DiscountCodeList.tsx`)
- Data table with columns: code, discount_percentage, valid_from, valid_until, usage_count, max_usage, is_active
- Actions: Edit, Deactivate

**DiscountCodeForm** (`frontend/components/admin/discounts/DiscountCodeForm.tsx`)
- Form for creating/editing discount codes
- Fields: code, discount_percentage, valid_from, valid_until, max_usage
- Validation: code uniqueness, date range validity

**StudentVerificationQueue** (`frontend/components/admin/discounts/StudentVerificationQueue.tsx`)
- List of pending student verifications
- Columns: student_name, submitted_at, status
- Actions: Review

**StudentVerificationReview** (`frontend/components/admin/discounts/StudentVerificationReview.tsx`)
- Display uploaded student ID and selfie images
- Side-by-side comparison
- Approve/Reject buttons with confirmation
- Rejection reason textarea

#### Admin User Management Components

**AdminUserList** (`frontend/components/admin/users/AdminUserList.tsx`)
- Data table with columns: name, email, admin_role, permissions, is_active
- Actions: Edit Role, Deactivate

**AdminUserForm** (`frontend/components/admin/users/AdminUserForm.tsx`)
- Form for creating/editing admin users
- Fields: email, name, admin_role (dropdown), permissions (checkboxes)
- Role-based permission presets

#### Audit Log Components

**AuditLogViewer** (`frontend/components/admin/audit/AuditLogViewer.tsx`)
- Data table with columns: timestamp, admin_user, action_type, resource_type, affected_resource_id
- Filters: date range, admin_user, action_type
- Expandable rows showing changed_fields JSON
- Export button

