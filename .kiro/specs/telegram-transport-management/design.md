# Telegram Transportation Management System - Design Document

## Overview

The Telegram Transportation Management System is a Telegram Bot interface that integrates with the DerLg System Admin Panel to enable transportation drivers to manage their availability and trip assignments via mobile phones. This system bridges the gap between the admin panel's fleet management interface and drivers in the field, providing real-time status synchronization through Redis pub/sub and WebSocket connections.

### Key Design Principles

1. **Seamless Admin Integration**: Fully integrated with the System Admin Panel's driver management module at `/admin/drivers`
2. **Real-Time Synchronization**: Driver status updates via Telegram instantly reflect in the admin dashboard through Redis pub/sub
3. **Lightweight Driver Interface**: No app installation required; drivers use familiar Telegram messaging
4. **Webhook-Driven Architecture**: Telegram servers push updates to backend via HTTPS webhooks
5. **Async Processing**: Bull queue handles broadcast messages and time-sensitive operations
6. **Multi-Language Support**: Supports Khmer, English, and Chinese matching the main platform

### Technology Stack

- **Bot Framework**: node-telegram-bot-api (Node.js)
- **Backend Integration**: NestJS telegram module at `backend/src/telegram/`
- **Queue System**: Bull (Redis-based) for async job processing
- **Real-Time**: Redis pub/sub + WebSocket to Admin Panel
- **Database**: Supabase PostgreSQL (shared with admin panel)
- **i18n**: i18next with JSON translation files
- **Security**: Telegram webhook secret token validation

## Architecture

### High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Telegram Platform                            │
│  ┌──────────────┐         ┌──────────────┐                     │
│  │ Driver Phone │         │ Driver Phone │                     │
│  │  (Telegram)  │   ...   │  (Telegram)  │                     │
│  └──────┬───────┘         └──────┬───────┘                     │
└─────────┼────────────────────────┼─────────────────────────────┘
          │                        │
          └────────┬───────────────┘
                   │ HTTPS Webhook
                   ▼
┌──────────────────────────────────────────────────────────────────┐
│                    NestJS Backend API                             │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              Telegram Module                                │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │ │
│  │  │   Webhook    │  │   Command    │  │   Message    │    │ │
│  │  │  Controller  │  │   Handlers   │  │   Sender     │    │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘    │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              Admin Module (Existing)                        │ │
│  │  /v1/admin/drivers, /v1/admin/assignments                  │ │
│  └────────────────────────────────────────────────────────────┘ │
└────┬──────────────┬──────────────┬──────────────┬──────────────┘
     │              │              │              │
     ▼              ▼              ▼              ▼
┌─────────┐   ┌─────────┐   ┌──────────┐   ┌──────────┐
│Supabase │   │  Redis  │   │   Bull   │   │WebSocket │
│   DB    │   │ Pub/Sub │   │  Queue   │   │ Gateway  │
└─────────┘   └─────────┘   └──────────┘   └────┬─────┘
                                                  │
                                                  ▼
                                          ┌──────────────┐
                                          │ Admin Panel  │
                                          │  (Next.js)   │
                                          │ /admin/drivers│
                                          └──────────────┘
```

### Integration with Admin Panel

```
Admin Panel Flow:
1. Fleet Manager creates driver profile in /admin/drivers
2. System generates driver_id and auth_pin (4-digit)
3. Fleet Manager shares credentials with driver via SMS/WhatsApp
4. Driver registers Telegram account using /start command
5. Driver updates status via Telegram (/online, /offline)
6. Status change triggers Redis pub/sub event
7. Admin Panel receives WebSocket notification
8. Driver status updates in real-time on dashboard

Assignment Flow:
1. Operations Manager assigns driver to booking in /admin/bookings
2. Backend creates driver_assignment record
3. Backend sends Telegram notification to driver
4. Driver receives message with [Accept] [Reject] buttons
5. Driver taps button → callback query to webhook
6. Backend updates assignment status
7. Admin Panel receives WebSocket notification
8. Assignment status updates in real-time
```

### Data Flow Diagram

```
┌─────────────┐
│   Driver    │
│  (Telegram) │
└──────┬──────┘
       │ /online
       ▼
┌──────────────────────────────────────┐
│  POST /v1/telegram/webhook           │
│  {                                   │
│    message: { text: "/online" },    │
│    from: { id: 123456789 }          │
│  }                                   │
└──────┬───────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│  telegram.service.ts                 │
│  - Parse command                     │
│  - Validate telegram_id              │
│  - Call driver-status.service        │
└──────┬───────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│  driver-status.service.ts            │
│  - Update drivers.status = AVAILABLE│
│  - Update last_status_update         │
│  - Create audit_log                  │
└──────┬───────────────────────────────┘
       │
       ├──────────────┬─────────────────┐
       ▼              ▼                 ▼
┌──────────┐   ┌──────────┐   ┌────────────────┐
│ Database │   │  Redis   │   │   Telegram     │
│  UPDATE  │   │ PUBLISH  │   │  sendMessage   │
│ drivers  │   │ channel  │   │  "✅ Online"   │
└──────────┘   └────┬─────┘   └────────────────┘
                    │
                    ▼
            ┌───────────────┐
            │   WebSocket   │
            │   to Admin    │
            │    Panel      │
            └───────────────┘
```


## Backend Module Structure

### Telegram Module Organization

```
backend/src/telegram/
├── telegram.module.ts              # Module definition with imports
├── telegram.controller.ts          # Webhook endpoint controller
├── telegram.service.ts             # Core bot orchestration
│
├── handlers/
│   ├── command.handler.ts          # Command routing (/start, /online, etc.)
│   ├── callback.handler.ts         # Inline button callbacks
│   ├── location.handler.ts         # Location update processing
│   └── message.handler.ts          # Text message processing
│
├── services/
│   ├── bot-sender.service.ts       # Telegram API message sender
│   ├── driver-status.service.ts    # Status management logic
│   ├── assignment.service.ts       # Trip assignment operations
│   ├── broadcast.service.ts        # Broadcast message handling
│   ├── registration.service.ts     # Driver registration flow
│   └── i18n.service.ts             # Translation management
│
├── dto/
│   ├── webhook-update.dto.ts       # Telegram Update object
│   ├── register-driver.dto.ts      # Registration payload
│   ├── status-update.dto.ts        # Status change payload
│   ├── assignment-action.dto.ts    # Accept/reject payload
│   ├── location-update.dto.ts      # Location coordinates
│   └── broadcast-message.dto.ts    # Broadcast payload
│
├── guards/
│   ├── telegram-auth.guard.ts      # Validate telegram_id exists
│   └── webhook-secret.guard.ts     # Validate Telegram secret token
│
├── jobs/
│   ├── broadcast.processor.ts      # Process broadcast queue
│   ├── assignment-timeout.processor.ts  # Auto-reject after 5 min
│   └── location-cleanup.processor.ts    # Clean old location data
│
├── locales/
│   ├── en.json                     # English translations
│   ├── km.json                     # Khmer translations
│   └── zh.json                     # Chinese translations
│
└── interfaces/
    ├── telegram-context.interface.ts
    ├── driver-session.interface.ts
    └── bot-message.interface.ts
```

### Integration with Admin Module

The telegram module integrates with the existing admin module through shared services:

```
backend/src/admin/
├── services/
│   ├── admin-drivers.service.ts    # Used by telegram for driver CRUD
│   └── admin-assignments.service.ts # Used by telegram for assignments
│
└── websocket/
    └── admin-gateway.ts            # Receives events from telegram module
```

**Shared Service Usage:**
- `telegram.service.ts` imports `AdminDriversService` for driver operations
- `assignment.service.ts` imports `AdminAssignmentsService` for trip assignments
- Both modules publish to same Redis channels for WebSocket sync


## Admin Panel Integration

### Enhanced Driver Management Components

The existing admin panel driver management components are enhanced to support Telegram integration:

#### DriverList Component Updates

**Location:** `frontend/components/admin/drivers/DriverList.tsx`

**New Features:**
- Telegram status indicator column (✅ Registered / ❌ Not Registered)
- Last seen timestamp from Telegram activity
- Real-time status updates via WebSocket subscription
- Filter by Telegram registration status

**WebSocket Integration:**
```typescript
// Subscribe to driver status changes
useEffect(() => {
  const socket = io(process.env.NEXT_PUBLIC_WS_URL);
  
  socket.on('driver:status:changed', (data: DriverStatusUpdate) => {
    // Update driver status in real-time
    queryClient.setQueryData(['drivers'], (old) => 
      updateDriverStatus(old, data.driver_id, data.status)
    );
  });
  
  return () => socket.disconnect();
}, []);
```

#### DriverForm Component Updates

**Location:** `frontend/components/admin/drivers/DriverForm.tsx`

**New Fields:**
- `auth_pin` (4-digit PIN, auto-generated or manual)
- `telegram_id` (read-only, populated after driver registers)
- `preferred_language` (dropdown: EN/KH/ZH)

**PIN Generation:**
```typescript
const generatePIN = () => {
  const pin = Math.floor(1000 + Math.random() * 9000).toString();
  setValue('auth_pin', pin);
};
```

**Credential Sharing:**
- "Copy Credentials" button to copy driver_id and PIN
- "Send via SMS" button (future enhancement)

#### New Component: TelegramStatusCard

**Location:** `frontend/components/admin/drivers/TelegramStatusCard.tsx`

**Purpose:** Display Telegram registration and activity status

**Features:**
- Registration status badge
- Last activity timestamp
- "Send Test Message" button (for testing)
- "Resend Credentials" button

**Props:**
```typescript
interface TelegramStatusCardProps {
  driver: Driver;
  onSendTestMessage: () => void;
  onResendCredentials: () => void;
}
```

#### New Component: DriverAssignmentNotification

**Location:** `frontend/components/admin/bookings/DriverAssignmentNotification.tsx`

**Purpose:** Show real-time driver response to assignment

**Features:**
- Pending state with countdown timer (5 minutes)
- Accepted state with green checkmark
- Rejected state with reason display
- Auto-refresh on WebSocket event

**WebSocket Integration:**
```typescript
socket.on('assignment:response', (data: AssignmentResponse) => {
  if (data.assignment_id === assignmentId) {
    setStatus(data.status);
    setReason(data.rejection_reason);
  }
});
```

### New Admin Panel Pages

#### Telegram Broadcast Page

**Location:** `frontend/app/(admin)/admin/telegram/broadcast/page.tsx`

**Purpose:** Send broadcast messages to drivers

**Features:**
- Message composer with rich text editor
- Image upload for broadcast
- Target audience selector:
  - All Drivers
  - Online Drivers Only
  - Offline Drivers
  - By Vehicle Type (VAN/BUS/TUK_TUK)
- Preview before send
- Broadcast history table
- Delivery status tracking

**Component Structure:**
```typescript
<BroadcastComposer>
  <MessageEditor />
  <ImageUploader />
  <AudienceSelector />
  <PreviewPanel />
  <SendButton />
</BroadcastComposer>

<BroadcastHistory>
  <BroadcastTable 
    columns={['timestamp', 'message', 'target', 'sent', 'failed']}
  />
</BroadcastHistory>
```

#### Telegram Analytics Page

**Location:** `frontend/app/(admin)/admin/telegram/analytics/page.tsx`

**Purpose:** Monitor Telegram bot usage and driver engagement

**Metrics:**
- Total registered drivers
- Active drivers (used bot in last 24h)
- Average response time to assignments
- Command usage frequency
- Language distribution
- Peak usage hours

**Charts:**
- Daily active drivers (line chart)
- Command usage breakdown (pie chart)
- Assignment acceptance rate (bar chart)

### WebSocket Event Handlers

**Location:** `frontend/lib/websocket.ts`

**Events from Backend:**

```typescript
// Driver status changed
socket.on('driver:status:changed', (data: {
  driver_id: string;
  status: 'AVAILABLE' | 'UNAVAILABLE' | 'BUSY';
  timestamp: string;
}) => void);

// Assignment response received
socket.on('assignment:response', (data: {
  assignment_id: string;
  driver_id: string;
  status: 'ACCEPTED' | 'REJECTED';
  rejection_reason?: string;
  timestamp: string;
}) => void);

// Driver location updated
socket.on('driver:location:updated', (data: {
  driver_id: string;
  latitude: number;
  longitude: number;
  timestamp: string;
}) => void);

// Emergency alert from driver
socket.on('driver:emergency', (data: {
  driver_id: string;
  alert_id: string;
  location?: { lat: number; lng: number };
  timestamp: string;
}) => void);

// Support ticket created
socket.on('driver:support:ticket', (data: {
  ticket_id: string;
  driver_id: string;
  message: string;
  timestamp: string;
}) => void);

// Broadcast delivery status
socket.on('broadcast:status', (data: {
  message_id: string;
  sent_count: number;
  failed_count: number;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
}) => void);
```


## Bot Interface Design

### Command Structure

#### Primary Commands

**`/start`** - Registration and Dashboard
- **First-time user:** Registration flow
- **Registered user:** Status dashboard

**`/online`** - Go online (AVAILABLE status)
- Updates status to AVAILABLE
- Notifies admin panel in real-time

**`/offline`** - Go offline (UNAVAILABLE status)
- Validates no active trips
- Updates status to UNAVAILABLE

**`/status`** - View current status
- Shows current status, vehicle, last update
- Inline buttons: [Go Online] [Go Offline] [View Trips]

**`/mytrip`** - View active trip
- Shows current trip details
- Buttons: [Start Trip] [Complete Trip] [Contact Support]

**`/history`** - View trip history
- Last 10 completed trips
- Buttons: [Today's Summary] [This Week] [This Month]

**`/emergency`** - Send emergency alert
- Creates emergency alert
- Notifies admin immediately
- Shows emergency contact numbers

**`/support`** - Create support ticket
- Prompts for issue description
- Creates ticket in admin panel

**`/language`** - Change language
- Buttons: [🇰🇭 ខ្មែរ] [🇬🇧 English] [🇨🇳 中文]

**`/help`** - Show command list
- Lists all available commands with descriptions

### Message Templates

#### Registration Flow

**Step 1: Welcome Message**
```
🚗 Welcome to DerLg Driver Bot!

To get started, please provide your credentials:

Format:
driver_id: YOUR_ID
pin: YOUR_PIN

Example:
driver_id: DRV001
pin: 1234

Your Fleet Manager will provide these credentials.
```

**Step 2: Success Message**
```
✅ Registration Successful!

👤 Name: {driver_name}
🚐 Vehicle: {vehicle_name}
📊 Status: {status}

You can now use the following commands:
/online - Go online
/status - Check your status
/help - View all commands
```

#### Status Update Messages

**Online Confirmation**
```
✅ You are now ONLINE

You are available for trip assignments.
We'll notify you when a trip is assigned.

[Go Offline] [View Status]
```

**Offline Confirmation**
```
✅ You are now OFFLINE

You won't receive trip assignments.
Tap below when ready to work:

[Go Online]
```

**Offline Error (Active Trip)**
```
❌ Cannot go offline

You have an active trip in progress.
Please complete the trip first.

[View Trip Details]
```

#### Trip Assignment Notification

```
🚗 New Trip Assignment!

📍 Pickup: {pickup_location}
📍 Destination: {destination}
🕐 Pickup Time: {pickup_time}

👤 Customer: {customer_name}
👥 Passengers: {num_adults} adults, {num_children} children
📝 Booking Ref: {booking_ref}

⏰ Please respond within 5 minutes

[Accept Trip] [Reject Trip]
```

#### Trip Accepted

```
✅ Trip Accepted

Customer has been notified.

📍 Pickup: {pickup_location}
🕐 Time: {pickup_time}
📞 Customer: {customer_phone}

[Start Trip] [View Details] [Contact Support]
```

#### Trip Started

```
🚗 Trip Started

Drive safely!

📍 Destination: {destination}
⏱ Estimated Duration: {duration}

📍 Share your live location?
[Share Location] [Skip]

[Complete Trip] [Emergency]
```

#### Trip Completed

```
✅ Trip Completed!

⏱ Duration: {duration}
📏 Distance: {distance} km

You are now available for new assignments.

[View History] [Go Offline]
```

#### Emergency Alert Sent

```
🚨 Emergency Alert Sent

Dispatch has been notified and will contact you immediately.

📞 Emergency Contacts:
Police: 117
Ambulance: 119
Tourist Police: 012 942 484

Stay safe! Help is on the way.
```

### Inline Keyboard Layouts

#### Status Dashboard Keyboard

```typescript
const statusKeyboard = {
  inline_keyboard: [
    [
      { text: '🟢 Go Online', callback_data: 'status:online' },
      { text: '🔴 Go Offline', callback_data: 'status:offline' }
    ],
    [
      { text: '📊 View Status', callback_data: 'status:view' },
      { text: '🚗 My Trip', callback_data: 'trip:view' }
    ],
    [
      { text: '📜 History', callback_data: 'history:view' },
      { text: '❓ Help', callback_data: 'help' }
    ]
  ]
};
```

#### Trip Assignment Keyboard

```typescript
const assignmentKeyboard = {
  inline_keyboard: [
    [
      { text: '✅ Accept Trip', callback_data: `assignment:accept:${assignment_id}` },
      { text: '❌ Reject Trip', callback_data: `assignment:reject:${assignment_id}` }
    ]
  ]
};
```

#### Active Trip Keyboard

```typescript
const activeTripKeyboard = {
  inline_keyboard: [
    [
      { text: '🚀 Start Trip', callback_data: `trip:start:${assignment_id}` }
    ],
    [
      { text: '✅ Complete Trip', callback_data: `trip:complete:${assignment_id}` }
    ],
    [
      { text: '📞 Contact Support', callback_data: 'support:contact' },
      { text: '🚨 Emergency', callback_data: 'emergency:alert' }
    ]
  ]
};
```

#### Language Selection Keyboard

```typescript
const languageKeyboard = {
  inline_keyboard: [
    [
      { text: '🇰🇭 ខ្មែរ (Khmer)', callback_data: 'lang:km' }
    ],
    [
      { text: '🇬🇧 English', callback_data: 'lang:en' }
    ],
    [
      { text: '🇨🇳 中文 (Chinese)', callback_data: 'lang:zh' }
    ]
  ]
};
```

### Conversation State Machine

```
┌─────────────┐
│   /start    │
└──────┬──────┘
       │
       ▼
┌─────────────────┐      ┌──────────────┐
│ Not Registered? │─Yes─→│ Registration │
└─────────┬───────┘      │    Flow      │
          │              └──────┬───────┘
          No                    │
          │                     │
          └──────────┬──────────┘
                     ▼
            ┌────────────────┐
            │   Dashboard    │
            │   (Idle State) │
            └────────┬───────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
        ▼            ▼            ▼
┌──────────┐  ┌──────────┐  ┌──────────┐
│  Online  │  │ Offline  │  │ On Trip  │
└──────────┘  └──────────┘  └────┬─────┘
                                  │
                    ┌─────────────┼─────────────┐
                    ▼             ▼             ▼
              ┌──────────┐  ┌──────────┐  ┌──────────┐
              │ Pending  │  │ Started  │  │Completed │
              │Assignment│  │   Trip   │  │   Trip   │
              └──────────┘  └──────────┘  └──────────┘
```

### Session State Management

**Redis Session Structure:**

```typescript
interface DriverSession {
  telegram_id: number;
  driver_id: string;
  state: 'idle' | 'registration' | 'support_request' | 'trip_active';
  language: 'en' | 'km' | 'zh';
  last_command: string;
  last_activity: string;
  context?: {
    pending_assignment_id?: string;
    active_trip_id?: string;
    support_message?: string;
  };
}
```

**Redis Key:** `telegram_session:{telegram_id}`
**TTL:** 1 hour (refreshed on each interaction)


## Database Schema Integration

### Alignment with Admin Panel Schema

The Telegram system uses the same database tables as the Admin Panel with these key tables:

#### drivers Table (Shared with Admin Panel)

```sql
CREATE TABLE drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id VARCHAR(50) UNIQUE NOT NULL,
  driver_name VARCHAR(255) NOT NULL,
  telegram_id BIGINT UNIQUE,              -- Links to Telegram account
  phone VARCHAR(20) NOT NULL,
  auth_pin VARCHAR(255) NOT NULL,         -- bcrypt hashed PIN
  vehicle_id UUID REFERENCES transportation_vehicles(id),
  status VARCHAR(20) DEFAULT 'UNAVAILABLE' CHECK (status IN ('AVAILABLE', 'UNAVAILABLE', 'BUSY')),
  preferred_language VARCHAR(5) DEFAULT 'en' CHECK (preferred_language IN ('en', 'km', 'zh')),
  last_status_update TIMESTAMP WITH TIME ZONE,
  last_telegram_activity TIMESTAMP WITH TIME ZONE,  -- New field for bot activity
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Admin Panel Usage:**
- Created via `/admin/drivers` form
- Displayed in `DriverList` component
- Real-time status updates via WebSocket

**Telegram Bot Usage:**
- `telegram_id` populated during `/start` registration
- `status` updated via `/online`, `/offline` commands
- `last_telegram_activity` updated on every bot interaction

#### driver_assignments Table (Shared with Admin Panel)

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
  telegram_notification_sent BOOLEAN DEFAULT FALSE,  -- New field
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Admin Panel Usage:**
- Created via `DriverAssignmentPanel` component
- Displayed in booking detail view
- Real-time status updates via WebSocket

**Telegram Bot Usage:**
- Triggers notification to driver when created
- `status` updated when driver accepts/rejects
- `response_timestamp` set on driver action

#### support_tickets Table (New, Telegram-specific)

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
```

**Admin Panel Usage:**
- Displayed in new support tickets dashboard
- Assigned to support agents
- Status updated by admin

**Telegram Bot Usage:**
- Created via `/support` command
- Driver receives ticket_id confirmation

#### broadcast_messages Table (New, Telegram-specific)

```sql
CREATE TABLE broadcast_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id VARCHAR(50) UNIQUE NOT NULL,
  content TEXT NOT NULL,
  image_url VARCHAR(500),
  target_filter JSONB NOT NULL,
  sent_by UUID NOT NULL REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED')),
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Admin Panel Usage:**
- Created via `/admin/telegram/broadcast` page
- Delivery status tracked in real-time

**Telegram Bot Usage:**
- Messages sent to drivers based on target_filter
- Delivery status updated by Bull queue processor

### Redis Data Structures

#### Driver Session State

```
Key: telegram_session:{telegram_id}
Type: Hash
TTL: 1 hour
Fields: {
  driver_id: UUID,
  state: string,
  language: string,
  last_command: string,
  context: JSON
}
```

#### Driver Location (Live Tracking)

```
Key: driver_location:{driver_id}
Type: Hash
TTL: 5 minutes
Fields: {
  latitude: float,
  longitude: float,
  timestamp: ISO string,
  accuracy: float
}
```

#### Rate Limiting

```
Key: telegram_rate:{telegram_id}
Type: String (counter)
TTL: 1 minute
Value: request count
```

#### Driver-Telegram Mapping

```
Key: telegram_driver:{telegram_id}
Type: String
TTL: 30 days
Value: driver_id (UUID)
```

#### Pub/Sub Channels

```
driver_status_changed:{driver_id}
Payload: { driver_id, status, timestamp }

assignment_created:{driver_id}
Payload: { assignment_id, booking_id, details }

assignment_response:{assignment_id}
Payload: { assignment_id, status, rejection_reason }

driver_location_updated:{driver_id}
Payload: { driver_id, latitude, longitude, timestamp }

driver_emergency:{driver_id}
Payload: { driver_id, alert_id, location, timestamp }
```

## API Endpoints

### Telegram Webhook Endpoints

All endpoints are under `/v1/telegram/*` and protected by webhook secret validation.

#### POST /v1/telegram/webhook
**Purpose:** Receive updates from Telegram servers
**Auth:** X-Telegram-Bot-Api-Secret-Token header
**Request:** Telegram Update object
**Response:** 200 OK (immediate)
**Processing:** Async via Bull queue

#### POST /v1/telegram/register
**Purpose:** Register driver's Telegram account
**Auth:** None (public)
**Request:**
```json
{
  "telegram_id": 123456789,
  "driver_id": "DRV001",
  "pin": "1234"
}
```
**Response:**
```json
{
  "success": true,
  "driver": {
    "id": "uuid",
    "name": "John Doe",
    "vehicle": "Toyota Camry",
    "status": "UNAVAILABLE"
  }
}
```

#### POST /v1/telegram/status
**Purpose:** Update driver status
**Auth:** Telegram ID validation
**Request:**
```json
{
  "telegram_id": 123456789,
  "status": "AVAILABLE"
}
```
**Response:**
```json
{
  "success": true,
  "status": "AVAILABLE",
  "timestamp": "2026-05-09T10:00:00Z"
}
```
**Side Effects:**
- Updates `drivers.status`
- Publishes to Redis channel `driver_status_changed:{driver_id}`
- Creates audit log

#### GET /v1/telegram/driver-info
**Purpose:** Get driver profile and status
**Auth:** Telegram ID validation
**Query:** `telegram_id=123456789`
**Response:**
```json
{
  "driver_id": "DRV001",
  "name": "John Doe",
  "vehicle": {
    "id": "uuid",
    "name": "Toyota Camry",
    "category": "VAN"
  },
  "status": "AVAILABLE",
  "last_update": "2026-05-09T10:00:00Z",
  "active_trip": null
}
```

#### POST /v1/telegram/assignments/:id/accept
**Purpose:** Accept trip assignment
**Auth:** Telegram ID validation
**Response:**
```json
{
  "success": true,
  "trip_details": {
    "booking_ref": "BK123456",
    "pickup": "Phnom Penh Airport",
    "destination": "Siem Reap",
    "pickup_time": "2026-05-10T08:00:00Z",
    "customer": {
      "name": "Jane Smith",
      "phone": "+855123456789"
    }
  }
}
```
**Side Effects:**
- Updates `driver_assignments.status` to ACCEPTED
- Updates `drivers.status` to BUSY
- Publishes to Redis channel `assignment_response:{assignment_id}`
- Notifies customer via email/SMS

#### POST /v1/telegram/assignments/:id/reject
**Purpose:** Reject trip assignment
**Auth:** Telegram ID validation
**Request:**
```json
{
  "reason": "Vehicle maintenance scheduled"
}
```
**Response:**
```json
{
  "success": true
}
```
**Side Effects:**
- Updates `driver_assignments.status` to REJECTED
- Updates `drivers.status` to AVAILABLE
- Publishes to Redis channel `assignment_response:{assignment_id}`
- Notifies admin via WebSocket

### Admin Panel Endpoints (Enhanced)

#### POST /v1/admin/telegram/broadcast
**Purpose:** Send broadcast message to drivers
**Auth:** JWT (OPERATIONS_MANAGER or SUPER_ADMIN)
**Request:**
```json
{
  "message": "System maintenance tonight 10 PM - 12 AM",
  "image_url": "https://...",
  "target_filter": {
    "type": "online"
  }
}
```
**Response:**
```json
{
  "success": true,
  "message_id": "BM123456",
  "queued_count": 45
}
```

#### GET /v1/admin/drivers?telegram_registered=true
**Purpose:** Filter drivers by Telegram registration status
**Auth:** JWT (FLEET_MANAGER or higher)
**Query:** `telegram_registered=true|false`
**Response:** Array of drivers


## Implementation Details

### Webhook Setup and Configuration

#### Telegram Bot Creation

1. Create bot via BotFather on Telegram
2. Obtain bot token: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`
3. Set webhook URL with secret token:

```bash
curl -X POST "https://api.telegram.org/bot{TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://api.derlg.com/v1/telegram/webhook",
    "secret_token": "your-32-char-secret",
    "max_connections": 40,
    "allowed_updates": ["message", "callback_query", "edited_message"]
  }'
```

#### Backend Webhook Handler

**Location:** `backend/src/telegram/telegram.controller.ts`

```typescript
@Controller('v1/telegram')
export class TelegramController {
  constructor(private readonly telegramService: TelegramService) {}

  @Post('webhook')
  @UseGuards(WebhookSecretGuard)
  async handleWebhook(@Body() update: TelegramUpdate): Promise<void> {
    // Acknowledge immediately
    // Process async via Bull queue
    await this.telegramService.queueUpdate(update);
    return; // 200 OK
  }
}
```

### Command Handler Implementation

**Location:** `backend/src/telegram/handlers/command.handler.ts`

```typescript
@Injectable()
export class CommandHandler {
  constructor(
    private readonly botSender: BotSenderService,
    private readonly driverStatus: DriverStatusService,
    private readonly i18n: I18nService,
  ) {}

  async handleCommand(
    telegramId: number,
    command: string,
    language: string,
  ): Promise<void> {
    switch (command) {
      case '/start':
        await this.handleStart(telegramId, language);
        break;
      case '/online':
        await this.handleOnline(telegramId, language);
        break;
      case '/offline':
        await this.handleOffline(telegramId, language);
        break;
      case '/status':
        await this.handleStatus(telegramId, language);
        break;
      // ... other commands
    }
  }

  private async handleOnline(
    telegramId: number,
    language: string,
  ): Promise<void> {
    const driver = await this.getDriverByTelegramId(telegramId);
    
    if (!driver) {
      await this.botSender.sendMessage(
        telegramId,
        this.i18n.t('errors.not_registered', { lng: language }),
      );
      return;
    }

    await this.driverStatus.updateStatus(driver.id, 'AVAILABLE');
    
    await this.botSender.sendMessage(
      telegramId,
      this.i18n.t('status.online_success', { lng: language }),
      {
        reply_markup: {
          inline_keyboard: [
            [
              { 
                text: this.i18n.t('buttons.go_offline', { lng: language }), 
                callback_data: 'status:offline' 
              },
            ],
          ],
        },
      },
    );
  }
}
```

### Real-Time Synchronization

#### Redis Pub/Sub Publisher

**Location:** `backend/src/telegram/services/driver-status.service.ts`

```typescript
@Injectable()
export class DriverStatusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async updateStatus(
    driverId: string,
    status: DriverStatus,
  ): Promise<void> {
    // Update database
    await this.prisma.driver.update({
      where: { id: driverId },
      data: {
        status,
        last_status_update: new Date(),
        last_telegram_activity: new Date(),
      },
    });

    // Publish to Redis
    await this.redis.publish(
      `driver_status_changed:${driverId}`,
      JSON.stringify({
        driver_id: driverId,
        status,
        timestamp: new Date().toISOString(),
      }),
    );

    // Create audit log
    await this.prisma.auditLog.create({
      data: {
        action_type: 'DRIVER_STATUS_CHANGE',
        affected_resource_id: driverId,
        changed_fields: { status },
      },
    });
  }
}
```

#### WebSocket Gateway Subscriber

**Location:** `backend/src/admin/websocket/admin-gateway.ts`

```typescript
@WebSocketGateway({ namespace: '/admin' })
export class AdminGateway implements OnGatewayInit {
  @WebSocketServer()
  server: Server;

  constructor(private readonly redis: RedisService) {}

  afterInit() {
    // Subscribe to all driver status changes
    this.redis.subscribe('driver_status_changed:*', (message, channel) => {
      const data = JSON.parse(message);
      
      // Broadcast to all connected admin clients
      this.server.emit('driver:status:changed', data);
    });

    // Subscribe to assignment responses
    this.redis.subscribe('assignment_response:*', (message, channel) => {
      const data = JSON.parse(message);
      this.server.emit('assignment:response', data);
    });
  }
}
```

#### Frontend WebSocket Consumer

**Location:** `frontend/components/admin/drivers/DriverList.tsx`

```typescript
export function DriverList() {
  const { data: drivers, refetch } = useQuery(['drivers'], fetchDrivers);
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = io(`${process.env.NEXT_PUBLIC_WS_URL}/admin`);

    socket.on('driver:status:changed', (data: DriverStatusUpdate) => {
      // Optimistic update
      queryClient.setQueryData<Driver[]>(['drivers'], (old) => {
        if (!old) return old;
        return old.map((driver) =>
          driver.id === data.driver_id
            ? { ...driver, status: data.status, last_status_update: data.timestamp }
            : driver
        );
      });

      // Show toast notification
      toast.success(`Driver status updated: ${data.status}`);
    });

    return () => socket.disconnect();
  }, [queryClient]);

  return (
    <DataTable
      data={drivers}
      columns={driverColumns}
      // ... other props
    />
  );
}
```

### Broadcast Message Processing

#### Bull Queue Processor

**Location:** `backend/src/telegram/jobs/broadcast.processor.ts`

```typescript
@Processor('telegram-broadcast')
export class BroadcastProcessor {
  constructor(
    private readonly botSender: BotSenderService,
    private readonly prisma: PrismaService,
  ) {}

  @Process('send-broadcast')
  async handleBroadcast(job: Job<BroadcastJob>): Promise<void> {
    const { message_id, content, image_url, telegram_ids } = job.data;

    let sent_count = 0;
    let failed_count = 0;

    // Update status to IN_PROGRESS
    await this.prisma.broadcastMessage.update({
      where: { message_id },
      data: { status: 'IN_PROGRESS' },
    });

    // Send to each driver with rate limiting (30/sec)
    for (const telegram_id of telegram_ids) {
      try {
        if (image_url) {
          await this.botSender.sendPhoto(telegram_id, image_url, content);
        } else {
          await this.botSender.sendMessage(telegram_id, `📢 ${content}`);
        }
        sent_count++;
      } catch (error) {
        failed_count++;
        console.error(`Failed to send to ${telegram_id}:`, error);
      }

      // Rate limit: 30 messages per second
      await new Promise((resolve) => setTimeout(resolve, 34));

      // Update progress every 10 messages
      if ((sent_count + failed_count) % 10 === 0) {
        await this.prisma.broadcastMessage.update({
          where: { message_id },
          data: { sent_count, failed_count },
        });
      }
    }

    // Final update
    await this.prisma.broadcastMessage.update({
      where: { message_id },
      data: {
        status: 'COMPLETED',
        sent_count,
        failed_count,
        completed_at: new Date(),
      },
    });
  }
}
```

## Security Considerations

### Webhook Security

1. **Secret Token Validation**
   - Telegram sends `X-Telegram-Bot-Api-Secret-Token` header
   - Backend validates against stored secret
   - Reject requests without valid token (403 Forbidden)

2. **HTTPS Requirement**
   - Telegram only sends webhooks to HTTPS endpoints
   - Valid SSL certificate required (Let's Encrypt, Railway, Vercel)

3. **Request Validation**
   - Validate webhook payload structure
   - Reject malformed requests (400 Bad Request)

### Authentication and Authorization

1. **Driver Authentication**
   - PIN-based registration (bcrypt hashed)
   - Telegram ID linked to driver profile
   - Session state stored in Redis with TTL

2. **Rate Limiting**
   - 30 requests per minute per telegram_id
   - Prevents abuse and spam
   - Returns 429 Too Many Requests when exceeded

3. **Admin Authorization**
   - Broadcast endpoints require OPERATIONS_MANAGER or SUPER_ADMIN role
   - JWT token validation on all admin endpoints
   - Role-based access control enforced

### Data Privacy

1. **Location Data**
   - Stored in Redis with 5-minute TTL
   - Not persisted to database beyond trip completion
   - Only accessible to assigned admin and customer

2. **Personal Information**
   - Driver phone numbers encrypted at rest
   - PINs hashed with bcrypt (salt rounds: 10)
   - Audit logs track all data access

3. **Message Content**
   - Support ticket messages sanitized for XSS
   - Broadcast messages validated before sending
   - No sensitive data in bot messages

### Error Handling

1. **Graceful Degradation**
   - If Telegram API is down, queue messages for retry
   - If Redis is down, fall back to database polling
   - If WebSocket disconnects, auto-reconnect with exponential backoff

2. **Error Logging**
   - All errors logged to Sentry
   - Webhook failures logged with telegram_id and error details
   - Admin notified of critical failures

3. **User-Friendly Messages**
   - Technical errors translated to user-friendly messages
   - Provide actionable guidance (e.g., "Try again in a moment")
   - Include support contact for persistent issues

## Performance Optimization

### Caching Strategy

1. **Driver Session Cache**
   - Store in Redis for 1 hour
   - Reduces database queries on every command
   - Invalidate on status change

2. **Translation Cache**
   - Load translation files into memory on startup
   - No disk I/O on every message
   - Reload on deployment

3. **Driver-Telegram Mapping Cache**
   - Store in Redis for 30 days
   - Avoid database lookup on every webhook
   - Update on registration

### Database Optimization

1. **Indexes**
   - `drivers.telegram_id` (unique index)
   - `drivers.status` (for filtering available drivers)
   - `driver_assignments.driver_id` (for history queries)
   - `driver_assignments.status` (for active trip queries)

2. **Query Optimization**
   - Use `SELECT` with specific columns (avoid `SELECT *`)
   - Paginate history queries (limit 10 per page)
   - Use database connection pooling

### Webhook Processing

1. **Async Processing**
   - Acknowledge webhook immediately (200 OK)
   - Process in background via Bull queue
   - Prevents Telegram timeout (10 seconds)

2. **Idempotency**
   - Check `update_id` in Redis before processing
   - Prevent duplicate processing of same update
   - TTL: 24 hours

3. **Batch Operations**
   - Batch audit log inserts (every 10 operations)
   - Batch broadcast status updates (every 10 messages)
   - Reduces database write load

## Monitoring and Observability

### Metrics to Track

1. **Bot Performance**
   - Webhook response time (target: < 1 second)
   - Command processing time (target: < 2 seconds)
   - Message delivery success rate (target: > 99%)

2. **Driver Engagement**
   - Daily active drivers
   - Average response time to assignments
   - Command usage frequency

3. **System Health**
   - Redis connection status
   - Bull queue length
   - WebSocket connection count
   - Database query performance

### Alerting

1. **Critical Alerts**
   - Webhook endpoint down (> 5 minutes)
   - Redis connection lost
   - Broadcast delivery failure rate > 10%
   - Emergency alert not delivered

2. **Warning Alerts**
   - Webhook response time > 2 seconds
   - Bull queue length > 100
   - Driver assignment timeout rate > 20%

### Logging

1. **Structured Logging**
   - Use Winston with JSON format
   - Include telegram_id, driver_id, command in every log
   - Log levels: error, warn, info, debug

2. **Log Aggregation**
   - Send logs to Sentry for error tracking
   - Use Railway/Vercel logs for debugging
   - Retain logs for 30 days

## Deployment Checklist

### Pre-Deployment

- [ ] Create Telegram bot with BotFather
- [ ] Set environment variables (TELEGRAM_BOT_TOKEN, TELEGRAM_SECRET_TOKEN)
- [ ] Run database migrations (drivers, driver_assignments, support_tickets, broadcast_messages)
- [ ] Configure Redis connection
- [ ] Set up Bull queue
- [ ] Upload translation files (en.json, km.json, zh.json)
- [ ] Configure webhook URL with HTTPS
- [ ] Test webhook connectivity

### Deployment

- [ ] Deploy backend with telegram module
- [ ] Set Telegram webhook URL
- [ ] Verify webhook is active (getWebhookInfo)
- [ ] Deploy admin panel updates
- [ ] Test bot with test driver account
- [ ] Monitor logs for errors

### Post-Deployment

- [ ] Create initial driver profiles in admin panel
- [ ] Share credentials with drivers
- [ ] Monitor driver registration rate
- [ ] Monitor webhook success rate
- [ ] Collect driver feedback
- [ ] Train operations team on new features

