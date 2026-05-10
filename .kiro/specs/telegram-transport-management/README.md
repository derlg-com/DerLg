# Telegram Transportation Management System

## Specification Overview

This specification defines a Telegram Bot system that integrates with the DerLg System Admin Panel to enable transportation drivers to manage their availability and trip assignments via mobile phones without requiring a dedicated app.

## Documents

### 📋 [requirements.md](./requirements.md)
**1,352 lines** - Complete functional and non-functional requirements

**Contents:**
- 18 detailed requirements with acceptance criteria
- 10 core driver features (registration, status, trips, history, emergency, support, location, language, security, broadcast)
- 8 admin panel integration requirements
- Non-functional requirements (performance, reliability, security, scalability)
- Database schema with 4 new tables
- 16 Telegram API endpoints + 6 Admin endpoints
- Technical architecture and dependencies
- Implementation phases (7 weeks)
- Testing strategy with unit/integration/manual tests
- Deployment checklist
- Success metrics

### 🎨 [design.md](./design.md)
**1,239 lines** - Technical design and implementation details

**Contents:**
- System architecture diagrams
- Backend module structure (telegram + admin integration)
- Admin panel component enhancements
- Bot interface design (commands, messages, keyboards)
- Conversation state machine
- Database schema integration
- API endpoint specifications
- Implementation code examples
- Real-time synchronization (Redis pub/sub + WebSocket)
- Security considerations
- Performance optimization
- Monitoring and observability
- Deployment checklist

### 🔗 [INTEGRATION.md](./INTEGRATION.md)
**327 lines** - Integration summary between Telegram Bot and Admin Panel

**Contents:**
- System architecture alignment
- Shared database tables mapping
- 4 integration flow diagrams (registration, status, assignment, broadcast)
- Admin panel component enhancements list
- API endpoint mapping
- WebSocket event catalog
- Role-based access control matrix
- Implementation priority phases
- Success metrics

## Key Features

### For Drivers (via Telegram Bot)
- ✅ PIN-based registration (no app installation)
- ✅ Status management (`/online`, `/offline`, `/status`)
- ✅ Trip notifications with accept/reject buttons
- ✅ Active trip management (start, complete)
- ✅ Trip history and earnings summary
- ✅ Emergency alerts
- ✅ Support ticket creation
- ✅ Live location sharing
- ✅ Multi-language (EN/KH/ZH)

### For Admin (via Admin Panel)
- ✅ Driver profile creation with PIN generation
- ✅ Real-time driver status dashboard
- ✅ Trip assignment with instant Telegram notifications
- ✅ Broadcast messaging to driver groups
- ✅ Live driver location tracking on map
- ✅ Support ticket management
- ✅ Emergency alert monitoring
- ✅ Telegram analytics dashboard

## Technology Stack

- **Bot Framework:** node-telegram-bot-api
- **Backend:** NestJS (new telegram module)
- **Frontend:** Next.js 14 (enhanced admin panel)
- **Database:** Supabase PostgreSQL (shared)
- **Real-Time:** Redis pub/sub + WebSocket
- **Queue:** Bull (Redis-based)
- **i18n:** i18next (EN/KH/ZH)

## Architecture Highlights

### Real-Time Synchronization
```
Driver (Telegram) → Backend API → Redis Pub/Sub → WebSocket → Admin Panel
```

### Shared Services
- Admin module and Telegram module share driver/assignment services
- Single source of truth in Supabase PostgreSQL
- Redis for caching and pub/sub
- WebSocket for real-time updates

### Security
- Webhook secret token validation
- PIN-based driver authentication (bcrypt)
- Rate limiting (30 req/min per driver)
- HTTPS required for webhooks
- Role-based access control for admin

## Implementation Timeline

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| **Phase 1** | Week 1-2 | Core bot setup, registration, status management |
| **Phase 2** | Week 3-4 | Trip assignment, notifications, location tracking |
| **Phase 3** | Week 5-6 | Support tickets, emergency alerts, broadcast |
| **Phase 4** | Week 7 | Multi-language, analytics, testing, docs |

## Database Schema

### New Tables
- `drivers` (shared with admin panel)
- `driver_assignments` (shared with admin panel)
- `support_tickets` (Telegram-specific)
- `broadcast_messages` (Telegram-specific)

### Modified Tables
- `emergency_alerts` (add driver_id column)

## API Endpoints

### Telegram Bot
- `POST /v1/telegram/webhook` - Receive Telegram updates
- `POST /v1/telegram/register` - Driver registration
- `POST /v1/telegram/status` - Update driver status
- `GET /v1/telegram/driver-info` - Get driver profile
- `POST /v1/telegram/assignments/:id/accept` - Accept trip
- `POST /v1/telegram/assignments/:id/reject` - Reject trip
- `POST /v1/telegram/location` - Update location
- `POST /v1/telegram/emergency` - Create emergency alert
- `POST /v1/telegram/support` - Create support ticket

### Admin Panel
- `POST /v1/admin/telegram/broadcast` - Send broadcast
- `GET /v1/admin/telegram/analytics` - View analytics
- `GET /v1/admin/drivers?telegram_registered=true` - Filter drivers

## WebSocket Events

### Backend → Admin Panel
- `driver:status:changed` - Status update
- `driver:registered` - New registration
- `assignment:response` - Trip accepted/rejected
- `driver:location:updated` - Location update
- `driver:emergency` - Emergency alert
- `driver:support:ticket` - New support ticket
- `broadcast:status` - Broadcast delivery progress

## Success Metrics

### Technical
- WebSocket uptime: > 99%
- Status update latency: < 5 seconds
- Notification delivery: > 99%
- Broadcast delivery: > 95%

### Business
- Driver registration: > 80% within 2 weeks
- Daily active drivers: > 60%
- Assignment acceptance: > 85%
- Response time: < 2 minutes

## Getting Started

1. Review [requirements.md](./requirements.md) for complete functional requirements
2. Review [design.md](./design.md) for technical implementation details
3. Review [INTEGRATION.md](./INTEGRATION.md) for admin panel integration
4. Follow implementation phases in requirements.md
5. Use deployment checklist before going live

## Related Specifications

- [System Admin Panel](../system-admin-panel/) - Admin interface that this integrates with
- [Backend NestJS](../backend-nestjs-supabase/) - Backend API architecture
- [Frontend Next.js](../frontend-nextjs-implementation/) - Frontend architecture

