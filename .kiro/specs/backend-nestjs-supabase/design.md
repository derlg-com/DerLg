# Design Document: DerLg.com Backend (NestJS + Supabase)

## Overview

The DerLg.com backend is a comprehensive NestJS 10 application that serves as the single source of truth for a Cambodia travel booking platform. The system handles authentication, booking management across multiple travel services (trips, hotels, transportation, guides), payment processing via Stripe, emergency services, loyalty programs, and AI agent integration.

### Key Design Principles

1. **Backend-First Architecture**: All business logic resides in the backend to ensure data integrity and security
2. **Type Safety**: Leverage TypeScript and Prisma for end-to-end type safety
3. **Modular Design**: Organize code into feature modules with clear boundaries
4. **API-First**: RESTful APIs for frontend consumption and dedicated tool endpoints for AI agent
5. **Security by Default**: JWT authentication, rate limiting, input validation, and webhook verification
6. **Scalability**: Stateless architecture with Redis for distributed caching and session management
7. **Reliability**: Idempotent operations, transaction management, and comprehensive error handling

### Technology Stack

- **Framework**: NestJS 10 with TypeScript
- **Database**: Supabase PostgreSQL with Prisma ORM
- **Caching**: Upstash Redis for sessions, rate limiting, and caching
- **Payments**: Stripe for card payments and webhooks
- **Authentication**: Supabase Auth + JWT tokens
- **Storage**: Supabase Storage for file uploads
- **Notifications**: Resend (email) + FCM (push notifications)
- **Monitoring**: Winston logging + Sentry error tracking
- **API Documentation**: Swagger/OpenAPI

## Architecture

### High-Level Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        FE[Next.js Frontend]
        AI[Python AI Agent]
    end
    
    subgraph "API Gateway Layer"
        CORS[CORS Middleware]
        AUTH[JWT Auth Guard]
        RATE[Rate Limiter]
        VAL[Validation Pipe]
    end
    
    subgraph "Application Layer"
        API[NestJS REST API]
        TOOLS[AI Tools API]
        WEBHOOK[Stripe Webhooks]
        JOBS[Background Jobs]
    end
    
    subgraph "Service Layer"
        AUTH_SVC[Auth Service]
        BOOKING_SVC[Booking Service]
        PAYMENT_SVC[Payment Service]
        NOTIF_SVC[Notification Service]
        EMERGENCY_SVC[Emergency Service]
        LOYALTY_SVC[Loyalty Service]
    end
    
    subgraph "Data Layer"
        PRISMA[Prisma ORM]
        REDIS[Redis Cache]
        SUPABASE_AUTH[Supabase Auth]
        SUPABASE_STORAGE[Supabase Storage]
    end
    
    subgraph "External Services"
        STRIPE[Stripe API]
        RESEND[Resend Email]
        FCM[Firebase FCM]
        EXCHANGE[ExchangeRate API]
    end
    
    subgraph "Database"
        POSTGRES[(PostgreSQL)]
    end
    
    FE --> CORS
    AI --> TOOLS
    CORS --> AUTH
    AUTH --> RATE
    RATE --> VAL
    VAL --> API
    VAL --> TOOLS
    STRIPE --> WEBHOOK
    
    API --> AUTH_SVC
    API --> BOOKING_SVC
    API --> PAYMENT_SVC
    TOOLS --> BOOKING_SVC
    TOOLS --> PAYMENT_SVC
    WEBHOOK --> PAYMENT_SVC
    JOBS --> BOOKING_SVC
    JOBS --> NOTIF_SVC
    
    AUTH_SVC --> SUPABASE_AUTH
    AUTH_SVC --> REDIS
    BOOKING_SVC --> PRISMA
    BOOKING_SVC --> REDIS
    PAYMENT_SVC --> STRIPE
    PAYMENT_SVC --> PRISMA
    NOTIF_SVC --> RESEND
    NOTIF_SVC --> FCM
    EMERGENCY_SVC --> PRISMA
    LOYALTY_SVC --> PRISMA
    
    PRISMA --> POSTGRES
    SUPABASE_AUTH --> POSTGRES
    SUPABASE_STORAGE --> POSTGRES
```

### Module Structure

The application is organized into feature modules following NestJS best practices:

```
src/
├── main.ts                          # Application entry point
├── app.module.ts                    # Root module
├── config/                          # Configuration module
│   ├── config.module.ts
│   ├── config.service.ts
│   └── env.validation.ts
├── common/                          # Shared utilities
│   ├── decorators/
│   │   ├── current-user.decorator.ts
│   │   ├── roles.decorator.ts
│   │   └── service-key.decorator.ts
│   ├── filters/
│   │   ├── http-exception.filter.ts
│   │   └── prisma-exception.filter.ts
│   ├── guards/
│   │   ├── jwt-auth.guard.ts
│   │   ├── roles.guard.ts
│   │   └── service-key.guard.ts
│   ├── interceptors/
│   │   ├── response-transform.interceptor.ts
│   │   ├── logging.interceptor.ts
│   │   └── audit.interceptor.ts
│   ├── pipes/
│   │   └── validation.pipe.ts
│   └── types/
│       ├── response.interface.ts
│       └── pagination.interface.ts
├── auth/                            # Authentication module
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── strategies/
│   │   ├── jwt.strategy.ts
│   │   └── google.strategy.ts
│   └── dto/
│       ├── register.dto.ts
│       ├── login.dto.ts
│       └── refresh-token.dto.ts
├── users/                           # User management module
│   ├── users.module.ts
│   ├── users.controller.ts
│   ├── users.service.ts
│   └── dto/
│       └── update-profile.dto.ts
├── trips/                           # Trip catalog module
│   ├── trips.module.ts
│   ├── trips.controller.ts
│   ├── trips.service.ts
│   └── dto/
│       └── trip-filter.dto.ts
├── bookings/                        # Booking management module
│   ├── bookings.module.ts
│   ├── bookings.controller.ts
│   ├── bookings.service.ts
│   └── dto/
│       ├── create-booking.dto.ts
│       └── cancel-booking.dto.ts
├── payments/                        # Payment processing module
│   ├── payments.module.ts
│   ├── payments.controller.ts
│   ├── payments.service.ts
│   ├── webhooks.controller.ts
│   └── dto/
│       ├── create-payment-intent.dto.ts
│       └── process-refund.dto.ts
├── transportation/                  # Vehicle booking module
│   ├── transportation.module.ts
│   ├── transportation.controller.ts
│   └── transportation.service.ts
├── hotels/                          # Hotel booking module
│   ├── hotels.module.ts
│   ├── hotels.controller.ts
│   └── hotels.service.ts
├── guides/                          # Tour guide booking module
│   ├── guides.module.ts
│   ├── guides.controller.ts
│   └── guides.service.ts
├── emergency/                       # Emergency alert module
│   ├── emergency.module.ts
│   ├── emergency.controller.ts
│   ├── emergency.service.ts
│   └── dto/
│       └── create-alert.dto.ts
├── student-discount/                # Student verification module
│   ├── student-discount.module.ts
│   ├── student-discount.controller.ts
│   └── student-discount.service.ts
├── loyalty/                         # Loyalty points module
│   ├── loyalty.module.ts
│   ├── loyalty.controller.ts
│   └── loyalty.service.ts
├── notifications/                   # Notification module
│   ├── notifications.module.ts
│   ├── notifications.service.ts
│   └── templates/
│       ├── booking-confirmation.template.ts
│       └── payment-failed.template.ts
├── explore/                         # Places exploration module
│   ├── explore.module.ts
│   ├── explore.controller.ts
│   └── explore.service.ts
├── festivals/                       # Festival calendar module
│   ├── festivals.module.ts
│   ├── festivals.controller.ts
│   └── festivals.service.ts
├── currency/                        # Currency exchange module
│   ├── currency.module.ts
│   ├── currency.controller.ts
│   └── currency.service.ts
├── ai-tools/                        # AI agent tools module
│   ├── ai-tools.module.ts
│   ├── ai-tools.controller.ts
│   └── ai-tools.service.ts
├── redis/                           # Redis integration module
│   ├── redis.module.ts
│   └── redis.service.ts
├── prisma/                          # Prisma ORM module
│   ├── prisma.module.ts
│   └── prisma.service.ts
└── jobs/                            # Background jobs module
    ├── jobs.module.ts
    └── jobs.service.ts
```

### Request Flow

#### Standard API Request Flow

1. **Request arrives** at NestJS application
2. **CORS middleware** validates origin against whitelist
3. **JWT Auth Guard** validates access token and extracts user claims
4. **Rate Limiter** checks Redis for request count and enforces limits
5. **Validation Pipe** validates request DTO using class-validator
6. **Controller** receives validated request and calls service
7. **Service** executes business logic and database operations
8. **Response Transform Interceptor** wraps response in standard envelope
9. **Response** sent to client

#### Stripe Webhook Flow

1. **Webhook request** arrives at `/v1/payments/webhook` (no JWT auth)
2. **Webhook signature verification** using Stripe library
3. **Idempotency check** queries database for `stripe_event_id`
4. **Event processing** based on event type (payment_intent.succeeded, etc.)
5. **Database updates** in transaction (booking, payment, loyalty)
6. **Side effects** (notifications, Redis pub/sub)
7. **200 OK response** to Stripe within 5 seconds

#### AI Tools Request Flow

1. **Request arrives** at `/v1/ai-tools/*` endpoint
2. **Service Key Guard** validates `X-Service-Key` header
3. **Validation Pipe** validates tool-specific DTO
4. **AI Tools Service** executes tool logic
5. **Standardized response** with error codes for AI parsing
6. **Response** sent to AI agent

## Components and Interfaces

### Core Services

#### AuthService

Handles user authentication, token management, and session control.

```typescript
interface AuthService {
  // Registration and login
  register(dto: RegisterDto): Promise<AuthResponse>;
  login(dto: LoginDto): Promise<AuthResponse>;
  loginWithGoogle(token: string): Promise<AuthResponse>;
  
  // Token management
  refreshAccessToken(refreshToken: string): Promise<AuthResponse>;
  logout(userId: string): Promise<void>;
  
  // Password management
  requestPasswordReset(email: string): Promise<void>;
  resetPassword(token: string, newPassword: string): Promise<void>;
  
  // Token utilities
  generateAccessToken(user: User): string;
  generateRefreshToken(user: User): string;
  validateRefreshToken(token: string): Promise<TokenPayload>;
  incrementTokenVersion(userId: string): Promise<void>;
}

interface AuthResponse {
  success: boolean;
  data: {
    user: UserDto;
    accessToken: string;
    refreshToken: string;
  };
  message: string;
}
```

#### BookingService

Manages booking lifecycle including creation, holds, confirmation, and cancellation.

```typescript
interface BookingService {
  // Booking creation
  createBooking(userId: string, dto: CreateBookingDto): Promise<Booking>;
  
  // Booking retrieval
  getUserBookings(userId: string, filters: BookingFilterDto): Promise<PaginatedResponse<Booking>>;
  getBookingByRef(bookingRef: string, userId: string): Promise<Booking>;
  
  // Booking management
  confirmBooking(bookingId: string): Promise<Booking>;
  cancelBooking(bookingId: string, userId: string): Promise<Booking>;
  
  // Availability checking
  checkAvailability(dto: AvailabilityCheckDto): Promise<AvailabilityResponse>;
  
  // Booking holds
  createBookingHold(bookingId: string): Promise<void>;
  releaseBookingHold(bookingId: string): Promise<void>;
  
  // Pricing calculations
  calculateBookingPrice(dto: CreateBookingDto): Promise<PriceBreakdown>;
  applyDiscounts(subtotal: number, discounts: DiscountDto[]): Promise<number>;
  
  // Reference generation
  generateBookingRef(): string;
}

interface CreateBookingDto {
  bookingType: BookingType;
  tripId?: string;
  hotelRoomId?: string;
  transportVehicleId?: string;
  guideId?: string;
  travelDate: Date;
  endDate?: Date;
  numAdults: number;
  numChildren: number;
  customizations?: Record<string, any>;
  discountCode?: string;
  loyaltyPointsToRedeem?: number;
}

interface PriceBreakdown {
  subtotal: number;
  discounts: {
    type: string;
    amount: number;
  }[];
  total: number;
}
```

#### PaymentService

Handles Stripe payment intents, webhooks, and refund processing.

```typescript
interface PaymentService {
  // Payment intent creation
  createPaymentIntent(bookingId: string, userId: string): Promise<PaymentIntentResponse>;
  generateQRPayment(bookingId: string, userId: string): Promise<QRPaymentResponse>;
  
  // Webhook processing
  processWebhook(signature: string, payload: Buffer): Promise<void>;
  handlePaymentSucceeded(event: Stripe.Event): Promise<void>;
  handlePaymentFailed(event: Stripe.Event): Promise<void>;
  handleChargeRefunded(event: Stripe.Event): Promise<void>;
  
  // Refund processing
  processRefund(bookingId: string, userId: string): Promise<RefundResponse>;
  calculateRefundAmount(booking: Booking): Promise<number>;
  
  // Idempotency
  checkEventProcessed(eventId: string): Promise<boolean>;
  markEventProcessed(eventId: string): Promise<void>;
}

interface PaymentIntentResponse {
  clientSecret: string;
  amount: number;
  currency: string;
  expiresAt: Date;
}

interface QRPaymentResponse {
  qrCodeUrl: string;
  paymentIntentId: string;
  amount: number;
  expiresAt: Date;
}
```

#### EmergencyService

Manages emergency alerts with GPS tracking and support coordination.

```typescript
interface EmergencyService {
  // Alert creation
  createAlert(userId: string, dto: CreateAlertDto): Promise<EmergencyAlertResponse>;
  
  // Alert management
  updateAlertStatus(alertId: string, status: AlertStatus): Promise<EmergencyAlert>;
  getAlertById(alertId: string): Promise<EmergencyAlert>;
  
  // Support coordination
  notifySupportTeam(alert: EmergencyAlert): Promise<void>;
  sendSMSToSupport(alert: EmergencyAlert): Promise<void>;
  
  // Location services
  getEmergencyContacts(latitude: number, longitude: number): Promise<EmergencyContacts>;
  getNearestHospital(latitude: number, longitude: number): Promise<Hospital>;
  getProvinceFromCoordinates(latitude: number, longitude: number): Promise<string>;
}

interface CreateAlertDto {
  alertType: AlertType;
  latitude: number;
  longitude: number;
  accuracy: number;
  message?: string;
}

interface EmergencyAlertResponse {
  alert: EmergencyAlert;
  supportContacts: {
    supportPhone: string;
    policeNumber: string;
    ambulanceNumber: string;
  };
  nearestHospital: Hospital;
}
```

#### LoyaltyService

Manages loyalty points earning, redemption, and transaction history.

```typescript
interface LoyaltyService {
  // Points management
  awardPoints(userId: string, amount: number, bookingId: string): Promise<void>;
  redeemPoints(userId: string, amount: number, bookingId: string): Promise<void>;
  reversePoints(userId: string, bookingId: string): Promise<void>;
  
  // Balance and history
  getBalance(userId: string): Promise<number>;
  getTransactionHistory(userId: string, pagination: PaginationDto): Promise<PaginatedResponse<LoyaltyTransaction>>;
  
  // Calculations
  calculateEarnedPoints(amountUsd: number): number;
  calculateRedemptionValue(points: number): number;
}
```

#### NotificationService

Handles multi-channel notifications with templating and retry logic.

```typescript
interface NotificationService {
  // Notification sending
  sendBookingConfirmation(booking: Booking): Promise<void>;
  sendPaymentFailed(booking: Booking): Promise<void>;
  sendTravelReminder(booking: Booking): Promise<void>;
  sendRefundConfirmation(booking: Booking, refundAmount: number): Promise<void>;
  sendEmergencyAcknowledgment(alert: EmergencyAlert): Promise<void>;
  
  // Multi-channel delivery
  sendEmail(to: string, template: string, data: any, language: Language): Promise<void>;
  sendPushNotification(userId: string, title: string, body: string): Promise<void>;
  sendSMS(phoneNumber: string, message: string): Promise<void>;
  
  // Template management
  renderTemplate(templateName: string, data: any, language: Language): string;
  
  // Retry logic
  retryFailedNotification(notificationId: string): Promise<void>;
}
```

### Data Transfer Objects (DTOs)

DTOs use class-validator decorators for automatic validation:

```typescript
// Example: CreateBookingDto
export class CreateBookingDto {
  @IsEnum(BookingType)
  bookingType: BookingType;

  @IsUUID()
  @IsOptional()
  tripId?: string;

  @IsUUID()
  @IsOptional()
  hotelRoomId?: string;

  @IsUUID()
  @IsOptional()
  transportVehicleId?: string;

  @IsUUID()
  @IsOptional()
  guideId?: string;

  @IsDateString()
  travelDate: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsInt()
  @Min(1)
  @Max(20)
  numAdults: number;

  @IsInt()
  @Min(0)
  @Max(10)
  numChildren: number;

  @IsObject()
  @IsOptional()
  customizations?: Record<string, any>;

  @IsString()
  @IsOptional()
  discountCode?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  loyaltyPointsToRedeem?: number;
}
```

### Guards and Decorators

#### JWT Auth Guard

```typescript
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest(err, user, info) {
    if (err || !user) {
      throw new UnauthorizedException('Invalid or expired token');
    }
    return user;
  }
}
```

#### Service Key Guard

```typescript
@Injectable()
export class ServiceKeyGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const serviceKey = request.headers['x-service-key'];
    
    if (!serviceKey) {
      throw new UnauthorizedException('Service key required');
    }
    
    const validKey = this.configService.get('AI_SERVICE_KEY');
    if (serviceKey !== validKey) {
      throw new UnauthorizedException('Invalid service key');
    }
    
    return true;
  }
}
```

#### Current User Decorator

```typescript
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);

// Usage in controller:
@Get('profile')
@UseGuards(JwtAuthGuard)
async getProfile(@CurrentUser() user: JwtPayload) {
  return this.usersService.getProfile(user.sub);
}
```

## Data Models

### Prisma Schema Overview

The database schema consists of 18 models with the following relationships:

```prisma
// Core user model
model User {
  id                      String   @id @default(uuid())
  supabaseUid             String   @unique @map("supabase_uid")
  email                   String   @unique
  name                    String
  phone                   String?
  avatarUrl               String?  @map("avatar_url")
  role                    UserRole @default(USER)
  preferredLanguage       Language @default(EN) @map("preferred_language")
  loyaltyPoints           Int      @default(0) @map("loyalty_points")
  isStudent               Boolean  @default(false) @map("is_student")
  studentVerifiedAt       DateTime? @map("student_verified_at")
  emergencyContactName    String?  @map("emergency_contact_name")
  emergencyContactPhone   String?  @map("emergency_contact_phone")
  tokenVersion            Int      @default(0) @map("token_version")
  createdAt               DateTime @default(now()) @map("created_at")
  updatedAt               DateTime @updatedAt @map("updated_at")

  bookings                Booking[]
  payments                Payment[]
  reviews                 Review[]
  loyaltyTransactions     LoyaltyTransaction[]
  emergencyAlerts         EmergencyAlert[]
  studentVerifications    StudentVerification[]
  notifications           Notification[]

  @@index([email])
  @@index([supabaseUid])
  @@map("users")
}

// Booking model - central to the system
model Booking {
  id                String        @id @default(uuid())
  bookingRef        String        @unique @map("booking_ref")
  userId            String        @map("user_id")
  bookingType       BookingType   @map("booking_type")
  status            BookingStatus @default(RESERVED)
  
  // Related entities
  tripId            String?       @map("trip_id")
  hotelRoomId       String?       @map("hotel_room_id")
  transportVehicleId String?      @map("transport_vehicle_id")
  guideId           String?       @map("guide_id")
  
  // Dates and participants
  travelDate        DateTime      @map("travel_date")
  endDate           DateTime?     @map("end_date")
  numAdults         Int           @map("num_adults")
  numChildren       Int           @map("num_children")
  
  // Pricing
  subtotalUsd       Decimal       @map("subtotal_usd") @db.Decimal(10, 2)
  discountUsd       Decimal       @default(0) @map("discount_usd") @db.Decimal(10, 2)
  totalUsd          Decimal       @map("total_usd") @db.Decimal(10, 2)
  
  // Additional data
  customizations    Json?
  discountCodeId    String?       @map("discount_code_id")
  loyaltyPointsUsed Int           @default(0) @map("loyalty_points_used")
  reservedUntil     DateTime?     @map("reserved_until")
  
  createdAt         DateTime      @default(now()) @map("created_at")
  updatedAt         DateTime      @updatedAt @map("updated_at")

  user              User          @relation(fields: [userId], references: [id])
  trip              Trip?         @relation(fields: [tripId], references: [id])
  hotelRoom         HotelRoom?    @relation(fields: [hotelRoomId], references: [id])
  transportVehicle  TransportationVehicle? @relation(fields: [transportVehicleId], references: [id])
  guide             Guide?        @relation(fields: [guideId], references: [id])
  discountCode      DiscountCode? @relation(fields: [discountCodeId], references: [id])
  payments          Payment[]
  reviews           Review[]

  @@index([userId])
  @@index([bookingRef])
  @@index([status])
  @@index([travelDate])
  @@map("bookings")
}

// Payment model
model Payment {
  id                  String        @id @default(uuid())
  bookingId           String        @map("booking_id")
  userId              String        @map("user_id")
  stripePaymentIntentId String      @unique @map("stripe_payment_intent_id")
  stripeEventId       String?       @unique @map("stripe_event_id")
  amountUsd           Decimal       @map("amount_usd") @db.Decimal(10, 2)
  currency            String        @default("usd")
  status              PaymentStatus @default(PENDING)
  paymentMethod       PaymentMethod @map("payment_method")
  refundedAmountUsd   Decimal       @default(0) @map("refunded_amount_usd") @db.Decimal(10, 2)
  metadata            Json?
  createdAt           DateTime      @default(now()) @map("created_at")
  updatedAt           DateTime      @updatedAt @map("updated_at")

  booking             Booking       @relation(fields: [bookingId], references: [id])
  user                User          @relation(fields: [userId], references: [id])

  @@index([userId])
  @@index([bookingId])
  @@index([status])
  @@map("payments")
}
```

### Key Enums

```prisma
enum UserRole {
  USER
  ADMIN
  SUPPORT
}

enum Language {
  EN
  KH
  ZH
}

enum BookingType {
  PACKAGE
  HOTEL_ONLY
  TRANSPORT_ONLY
  GUIDE_ONLY
}

enum BookingStatus {
  RESERVED
  CONFIRMED
  CANCELLED
  COMPLETED
  REFUNDED
}

enum PaymentStatus {
  PENDING
  SUCCEEDED
  FAILED
  REFUNDED
  PARTIALLY_REFUNDED
}

enum PaymentMethod {
  CARD
  QR_CODE
}

enum AlertType {
  SOS
  MEDICAL
  THEFT
  LOST
}

enum AlertStatus {
  SENT
  ACKNOWLEDGED
  RESOLVED
}
```

### Database Indexes

Critical indexes for performance:

- `users.email` - Login queries
- `users.supabase_uid` - Auth integration
- `bookings.booking_ref` - Booking lookups
- `bookings.user_id` - User booking lists
- `bookings.status` - Status filtering
- `bookings.travel_date` - Date range queries
- `payments.stripe_payment_intent_id` - Webhook processing
- `payments.stripe_event_id` - Idempotency checks



## API Design

### API Versioning and Structure

All API endpoints are versioned with `/v1` prefix:

- **Public APIs**: `/v1/{resource}` - Require JWT authentication
- **AI Tools**: `/v1/ai-tools/{tool}` - Require service key authentication
- **Webhooks**: `/v1/payments/webhook` - No authentication (signature verified)

### Standard Response Format

All responses follow a consistent envelope structure:

**Success Response:**
```json
{
  "success": true,
  "data": { /* response data */ },
  "message": "Operation completed successfully"
}
```

**Error Response:**
```json
{
  "success": false,
  "data": null,
  "message": "Human-readable error message",
  "error": {
    "code": "BOOKING_EXPIRED",
    "details": { /* additional context */ }
  }
}
```

**Paginated Response:**
```json
{
  "success": true,
  "data": {
    "items": [ /* array of items */ ],
    "pagination": {
      "page": 1,
      "perPage": 20,
      "total": 150,
      "totalPages": 8
    }
  },
  "message": "Items retrieved successfully"
}
```

### Authentication Endpoints

#### POST /v1/auth/register
Register a new user account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "John Doe",
  "phone": "+855123456789",
  "preferredLanguage": "EN"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "USER",
      "loyaltyPoints": 0
    },
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc..."
  },
  "message": "Registration successful. Please verify your email."
}
```

#### POST /v1/auth/login
Authenticate user and receive tokens.

#### POST /v1/auth/refresh
Refresh access token using refresh token.

#### POST /v1/auth/logout
Invalidate all user tokens.

#### POST /v1/auth/google
Authenticate using Google OAuth.

### Booking Endpoints

#### POST /v1/bookings
Create a new booking with 15-minute hold.

**Request:**
```json
{
  "bookingType": "PACKAGE",
  "tripId": "uuid",
  "travelDate": "2024-06-15T00:00:00Z",
  "numAdults": 2,
  "numChildren": 1,
  "customizations": {
    "dietaryRestrictions": ["vegetarian"],
    "specialRequests": "Window seat preferred"
  },
  "discountCode": "SUMMER2024",
  "loyaltyPointsToRedeem": 500
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "booking": {
      "id": "uuid",
      "bookingRef": "DLG-2024-0001",
      "status": "RESERVED",
      "subtotalUsd": 450.00,
      "discountUsd": 50.00,
      "totalUsd": 400.00,
      "reservedUntil": "2024-06-01T10:15:00Z",
      "travelDate": "2024-06-15T00:00:00Z"
    },
    "priceBreakdown": {
      "subtotal": 450.00,
      "discounts": [
        { "type": "DISCOUNT_CODE", "amount": 25.00 },
        { "type": "LOYALTY_POINTS", "amount": 5.00 },
        { "type": "STUDENT_DISCOUNT", "amount": 20.00 }
      ],
      "total": 400.00
    }
  },
  "message": "Booking created. Complete payment within 15 minutes."
}
```

#### GET /v1/bookings
List user's bookings with filters.

**Query Parameters:**
- `status` - Filter by booking status
- `bookingType` - Filter by booking type
- `page` - Page number (default: 1)
- `perPage` - Items per page (default: 20)

#### GET /v1/bookings/:bookingRef
Get booking details by reference.

#### POST /v1/bookings/:id/cancel
Cancel a booking and process refund.

#### GET /v1/bookings/:id/availability
Check availability for booking modification.

### Payment Endpoints

#### POST /v1/payments/create-intent
Create Stripe payment intent for booking.

**Request:**
```json
{
  "bookingId": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "clientSecret": "pi_xxx_secret_xxx",
    "amount": 40000,
    "currency": "usd",
    "expiresAt": "2024-06-01T10:15:00Z"
  },
  "message": "Payment intent created"
}
```

#### POST /v1/payments/qr-payment
Generate QR code for Bakong/ABA Pay.

**Response:**
```json
{
  "success": true,
  "data": {
    "qrCodeUrl": "https://storage.supabase.co/qr/xxx.png",
    "paymentIntentId": "pi_xxx",
    "amount": 40000,
    "expiresAt": "2024-06-01T10:15:00Z"
  },
  "message": "QR payment generated"
}
```

#### POST /v1/payments/webhook
Stripe webhook endpoint (no authentication).

**Headers:**
- `stripe-signature` - Webhook signature for verification

#### POST /v1/payments/:bookingId/refund
Process refund for cancelled booking.

### Trip Endpoints

#### GET /v1/trips
List available trips with filters.

**Query Parameters:**
- `environment` - Filter by environment type (MOUNTAIN, BEACH, etc.)
- `minDays` / `maxDays` - Duration range
- `minPrice` / `maxPrice` - Price range in USD
- `province` - Filter by province
- `sortBy` - Sort by price, rating, or duration
- `language` - Preferred language for content (EN, KH, ZH)

#### GET /v1/trips/:id
Get detailed trip information.

### Transportation Endpoints

#### GET /v1/transportation/vehicles
List available vehicles with filters.

**Query Parameters:**
- `category` - VAN, BUS, TUK_TUK
- `minCapacity` - Minimum passenger capacity
- `tier` - STANDARD, VIP

#### POST /v1/transportation/check-availability
Check vehicle availability for dates.

### Hotel Endpoints

#### GET /v1/hotels
List hotels by province.

#### GET /v1/hotels/:id/rooms
List rooms for a hotel.

#### POST /v1/hotels/check-availability
Check room availability for dates.

### Guide Endpoints

#### GET /v1/guides
List tour guides with filters.

**Query Parameters:**
- `languages` - Filter by spoken languages
- `specialties` - Filter by specialties
- `province` - Filter by availability

#### POST /v1/guides/check-availability
Check guide availability for dates.

### Emergency Endpoints

#### POST /v1/emergency/alerts
Create emergency alert with GPS location.

**Request:**
```json
{
  "alertType": "SOS",
  "latitude": 13.3622,
  "longitude": 103.8597,
  "accuracy": 10.5,
  "message": "Need immediate assistance"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "alert": {
      "id": "uuid",
      "status": "SENT",
      "createdAt": "2024-06-01T10:00:00Z"
    },
    "supportContacts": {
      "supportPhone": "+855123456789",
      "policeNumber": "117",
      "ambulanceNumber": "119"
    },
    "nearestHospital": {
      "name": "Siem Reap Provincial Hospital",
      "distance": 2.5,
      "phone": "+855123456789"
    }
  },
  "message": "Emergency alert sent. Help is on the way."
}
```

#### PATCH /v1/emergency/alerts/:id
Update alert status (admin only).

### Student Discount Endpoints

#### POST /v1/student-discount/verify
Submit student verification documents.

**Request (multipart/form-data):**
- `studentIdImage` - File upload
- `faceSelfie` - File upload

#### GET /v1/student-discount/status
Check verification status.

### Loyalty Endpoints

#### GET /v1/loyalty/balance
Get current loyalty points balance.

#### GET /v1/loyalty/transactions
Get loyalty transaction history.

### Explore Endpoints

#### GET /v1/explore/places
List places with filters.

**Query Parameters:**
- `province` - Filter by province
- `category` - TEMPLE, MUSEUM, NATURE, etc.
- `search` - Text search
- `language` - Preferred language

#### GET /v1/explore/places/:id
Get place details.

### Festival Endpoints

#### GET /v1/festivals
List festivals with date filters.

#### GET /v1/festivals/upcoming
Get upcoming festivals.

### Currency Endpoints

#### GET /v1/currency/rates
Get current exchange rates.

**Response:**
```json
{
  "success": true,
  "data": {
    "rates": {
      "USD": 1.0,
      "KHR": 4100.0,
      "CNY": 7.25
    },
    "lastUpdated": "2024-06-01T10:00:00Z"
  },
  "message": "Exchange rates retrieved"
}
```

### AI Tools Endpoints

All AI tools endpoints require `X-Service-Key` header.

#### POST /v1/ai-tools/suggest-trips
Get trip suggestions based on preferences.

**Request:**
```json
{
  "preferences": {
    "environment": ["BEACH", "TEMPLE"],
    "duration": 5,
    "budget": 500,
    "interests": ["culture", "history"]
  },
  "language": "EN"
}
```

#### POST /v1/ai-tools/create-booking
Create booking via AI agent.

#### POST /v1/ai-tools/cancel-booking
Cancel booking via AI agent.

#### POST /v1/ai-tools/generate-qr-payment
Generate QR payment for booking.

#### GET /v1/ai-tools/booking-status/:bookingRef
Check booking status.

#### POST /v1/ai-tools/search-places
Search places for recommendations.

### Error Codes

Standardized error codes for client handling:

- `TOKEN_EXPIRED` - JWT token has expired
- `TOKEN_INVALID` - JWT token is malformed or invalid
- `BOOKING_EXPIRED` - Booking hold time has expired
- `BOOKING_NOT_FOUND` - Booking reference not found
- `INSUFFICIENT_POINTS` - Not enough loyalty points
- `INVALID_DISCOUNT_CODE` - Discount code invalid or expired
- `RESOURCE_UNAVAILABLE` - Resource already booked for dates
- `PAYMENT_FAILED` - Payment processing failed
- `TRIP_ALREADY_STARTED` - Cannot cancel after travel date
- `INVALID_IMAGE_FORMAT` - Uploaded image is corrupted
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `SERVICE_UNAVAILABLE` - External service unavailable

## Payment Processing Flow

### Payment Intent Creation Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant Redis
    participant Stripe
    participant Database

    User->>Frontend: Click "Pay Now"
    Frontend->>Backend: POST /v1/payments/create-intent
    Backend->>Database: Fetch booking by ID
    Backend->>Database: Verify status = RESERVED
    Backend->>Database: Check reserved_until not expired
    Backend->>Backend: Calculate amount independently
    Backend->>Stripe: Create Payment Intent
    Stripe-->>Backend: Return client_secret
    Backend->>Database: Create payment record (PENDING)
    Backend->>Redis: Extend booking hold TTL
    Backend-->>Frontend: Return client_secret
    Frontend->>Stripe: Confirm payment with card
    Stripe-->>Frontend: Payment result
```

### Webhook Processing Flow

```mermaid
sequenceDiagram
    participant Stripe
    participant Backend
    participant Database
    participant Redis
    participant NotificationService

    Stripe->>Backend: POST /webhook (payment_intent.succeeded)
    Backend->>Backend: Verify webhook signature
    Backend->>Database: Check stripe_event_id exists
    alt Event already processed
        Backend-->>Stripe: 200 OK (idempotent)
    else New event
        Backend->>Database: BEGIN TRANSACTION
        Backend->>Database: Update booking status = CONFIRMED
        Backend->>Database: Update payment status = SUCCEEDED
        Backend->>Database: Award loyalty points
        Backend->>Database: Store stripe_event_id
        Backend->>Database: COMMIT TRANSACTION
        Backend->>Redis: Delete booking hold
        Backend->>Redis: Publish payment success event
        Backend->>NotificationService: Send confirmation email
        Backend->>NotificationService: Send push notification
        Backend-->>Stripe: 200 OK
    end
```

### Refund Processing Flow

```mermaid
sequenceDiagram
    participant User
    participant Backend
    participant Database
    participant Stripe
    participant NotificationService

    User->>Backend: POST /v1/bookings/:id/cancel
    Backend->>Database: Fetch booking
    Backend->>Backend: Calculate days until travel_date
    Backend->>Backend: Apply cancellation policy
    alt 7+ days before
        Backend->>Backend: refundAmount = 100%
    else 1-7 days before
        Backend->>Backend: refundAmount = 50%
    else < 24 hours
        Backend->>Backend: refundAmount = 0%
    end
    Backend->>Stripe: Create refund
    Stripe-->>Backend: Refund created
    Backend->>Database: BEGIN TRANSACTION
    Backend->>Database: Update payment status
    Backend->>Database: Update booking status = CANCELLED
    Backend->>Database: Deduct loyalty points
    Backend->>Database: COMMIT TRANSACTION
    Backend->>NotificationService: Send refund confirmation
    Backend-->>User: Return refund details
```

## Booking Lifecycle Management

### Booking State Machine

```mermaid
stateDiagram-v2
    [*] --> RESERVED: Create booking
    RESERVED --> CONFIRMED: Payment succeeded
    RESERVED --> CANCELLED: Hold expired (15 min)
    RESERVED --> CANCELLED: User cancels
    CONFIRMED --> COMPLETED: Travel date passed
    CONFIRMED --> CANCELLED: User cancels
    CONFIRMED --> REFUNDED: Refund processed
    CANCELLED --> [*]
    COMPLETED --> [*]
    REFUNDED --> [*]
```

### Booking Hold Mechanism

When a booking is created:

1. **Database record** created with `status = RESERVED`
2. **reserved_until** set to `now() + 15 minutes`
3. **Redis key** created: `booking_hold:{booking_id}` with 15-minute TTL
4. **Background job** runs every 5 minutes to clean up expired holds

Redis key structure:
```typescript
{
  key: `booking_hold:${bookingId}`,
  value: JSON.stringify({
    bookingId,
    userId,
    resourceType,
    resourceId,
    expiresAt
  }),
  ttl: 900 // 15 minutes in seconds
}
```

### Availability Checking

Availability checks must consider:

1. **Confirmed bookings** - `status = CONFIRMED`
2. **Reserved bookings** - `status = RESERVED` AND `reserved_until > now()`
3. **Date range overlaps** - Check for any date intersection

```typescript
async checkAvailability(
  resourceType: string,
  resourceId: string,
  startDate: Date,
  endDate: Date
): Promise<boolean> {
  const conflictingBookings = await this.prisma.booking.findMany({
    where: {
      [resourceType]: resourceId,
      OR: [
        { status: 'CONFIRMED' },
        {
          status: 'RESERVED',
          reservedUntil: { gt: new Date() }
        }
      ],
      AND: [
        { travelDate: { lte: endDate } },
        { endDate: { gte: startDate } }
      ]
    }
  });

  return conflictingBookings.length === 0;
}
```

### Pessimistic Locking for Booking Creation

To prevent race conditions when multiple users book the same resource:

```typescript
async createBooking(dto: CreateBookingDto): Promise<Booking> {
  return await this.prisma.$transaction(async (tx) => {
    // Lock the resource row
    const resource = await tx.trip.findUnique({
      where: { id: dto.tripId },
      // Prisma doesn't support SELECT FOR UPDATE directly,
      // but transaction isolation handles this
    });

    // Check availability within transaction
    const isAvailable = await this.checkAvailability(
      'tripId',
      dto.tripId,
      dto.travelDate,
      dto.endDate
    );

    if (!isAvailable) {
      throw new ConflictException('Resource not available');
    }

    // Create booking
    const booking = await tx.booking.create({
      data: {
        ...bookingData,
        status: 'RESERVED',
        reservedUntil: new Date(Date.now() + 15 * 60 * 1000)
      }
    });

    return booking;
  }, {
    isolationLevel: 'Serializable'
  });
}
```

## Background Jobs

### Job Scheduling

Using `@nestjs/schedule` for cron jobs:

```typescript
@Injectable()
export class JobsService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
    private redis: RedisService
  ) {}

  // Run every 5 minutes
  @Cron('*/5 * * * *')
  async cleanupExpiredBookings() {
    const expiredBookings = await this.prisma.booking.findMany({
      where: {
        status: 'RESERVED',
        reservedUntil: { lt: new Date() }
      }
    });

    for (const booking of expiredBookings) {
      await this.prisma.booking.update({
        where: { id: booking.id },
        data: { status: 'CANCELLED' }
      });

      await this.redis.del(`booking_hold:${booking.id}`);
    }

    console.log(`Cleaned up ${expiredBookings.length} expired bookings`);
  }

  // Run daily at 9am Cambodia time (UTC+7)
  @Cron('0 9 * * *', { timeZone: 'Asia/Phnom_Penh' })
  async sendTravelReminders() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const tomorrowEnd = new Date(tomorrow);
    tomorrowEnd.setHours(23, 59, 59, 999);

    const upcomingBookings = await this.prisma.booking.findMany({
      where: {
        status: 'CONFIRMED',
        travelDate: {
          gte: tomorrow,
          lte: tomorrowEnd
        }
      },
      include: { user: true }
    });

    for (const booking of upcomingBookings) {
      await this.notificationService.sendTravelReminder(booking);
    }

    console.log(`Sent ${upcomingBookings.length} travel reminders`);
  }

  // Run daily at 8am Cambodia time
  @Cron('0 8 * * *', { timeZone: 'Asia/Phnom_Penh' })
  async sendFestivalAlerts() {
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    const upcomingFestivals = await this.prisma.festival.findMany({
      where: {
        isActive: true,
        startDate: {
          gte: new Date(),
          lte: threeDaysFromNow
        }
      }
    });

    // Send to all users who have visited related provinces
    for (const festival of upcomingFestivals) {
      // Implementation details...
    }
  }
}
```

## Redis Integration

### Redis Key Patterns

```typescript
// Booking holds
booking_hold:{bookingId} = { bookingId, userId, expiresAt }
TTL: 900 seconds (15 minutes)

// Refresh token versions
refresh_token_version:{userId} = number
TTL: none (permanent)

// AI session state
session:{sessionId} = { userId, conversationHistory, context }
TTL: 604800 seconds (7 days)

// Currency exchange rates
currency:rates = { USD: 1.0, KHR: 4100.0, CNY: 7.25 }
TTL: 3600 seconds (1 hour)

// Weather data
weather:{city} = { temp, conditions, forecast }
TTL: 3600 seconds (1 hour)

// Rate limiting
rate_limit:{endpoint}:{userId}:{window} = count
TTL: window duration

// Payment events pub/sub
Channel: payment_events:{userId}
Message: { event: 'payment_succeeded', bookingId, amount }
```

### Redis Service Implementation

```typescript
@Injectable()
export class RedisService {
  private client: Redis;

  constructor(private configService: ConfigService) {
    this.client = new Redis(this.configService.get('REDIS_URL'));
  }

  async get(key: string): Promise<string | null> {
    return await this.client.get(key);
  }

  async set(key: string, value: string): Promise<void> {
    await this.client.set(key, value);
  }

  async setex(key: string, seconds: number, value: string): Promise<void> {
    await this.client.setex(key, seconds, value);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async incr(key: string): Promise<number> {
    return await this.client.incr(key);
  }

  async expire(key: string, seconds: number): Promise<void> {
    await this.client.expire(key, seconds);
  }

  async publish(channel: string, message: string): Promise<void> {
    await this.client.publish(channel, message);
  }

  async subscribe(channel: string, callback: (message: string) => void): Promise<void> {
    const subscriber = this.client.duplicate();
    await subscriber.subscribe(channel);
    subscriber.on('message', (ch, msg) => {
      if (ch === channel) callback(msg);
    });
  }
}
```

### Rate Limiting with Redis

```typescript
@Injectable()
export class RedisRateLimiter {
  constructor(private redis: RedisService) {}

  async checkRateLimit(
    key: string,
    limit: number,
    windowSeconds: number
  ): Promise<boolean> {
    const current = await this.redis.incr(key);
    
    if (current === 1) {
      await this.redis.expire(key, windowSeconds);
    }
    
    return current <= limit;
  }
}

// Usage in guard
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(private rateLimiter: RedisRateLimiter) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.sub || request.ip;
    const endpoint = request.route.path;
    
    const key = `rate_limit:${endpoint}:${userId}:${Math.floor(Date.now() / 60000)}`;
    const allowed = await this.rateLimiter.checkRateLimit(key, 60, 60);
    
    if (!allowed) {
      throw new HttpException('Rate limit exceeded', 429);
    }
    
    return true;
  }
}
```

## Security Implementation

### Input Validation

All DTOs use class-validator decorators:

```typescript
export class CreateBookingDto {
  @IsEnum(BookingType)
  bookingType: BookingType;

  @IsUUID()
  @ValidateIf(o => o.bookingType === 'PACKAGE')
  tripId?: string;

  @IsDateString()
  @IsNotEmpty()
  travelDate: string;

  @IsInt()
  @Min(1)
  @Max(20)
  numAdults: number;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  @Matches(/^[A-Z0-9]+$/)
  discountCode?: string;
}
```

### SQL Injection Prevention

Prisma uses parameterized queries automatically:

```typescript
// Safe - Prisma handles parameterization
const user = await this.prisma.user.findUnique({
  where: { email: userInput }
});

// Safe - Prisma escapes all inputs
const bookings = await this.prisma.booking.findMany({
  where: {
    userId: userId,
    status: { in: statusArray }
  }
});
```

### Webhook Signature Verification

```typescript
@Post('webhook')
async handleWebhook(
  @Headers('stripe-signature') signature: string,
  @Req() request: RawBodyRequest<Request>
) {
  const webhookSecret = this.configService.get('STRIPE_WEBHOOK_SECRET');
  
  let event: Stripe.Event;
  
  try {
    event = this.stripe.webhooks.constructEvent(
      request.rawBody,
      signature,
      webhookSecret
    );
  } catch (err) {
    throw new BadRequestException('Invalid signature');
  }
  
  // Check idempotency
  const processed = await this.checkEventProcessed(event.id);
  if (processed) {
    return { received: true };
  }
  
  await this.processWebhook(event);
  
  return { received: true };
}
```

### Sensitive Data Masking

```typescript
export class AuditInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    
    // Mask sensitive fields in logs
    const sanitizedBody = this.maskSensitiveData(request.body);
    
    console.log({
      method: request.method,
      url: request.url,
      userId: request.user?.sub,
      body: sanitizedBody,
      ip: request.ip,
      timestamp: new Date().toISOString()
    });
    
    return next.handle();
  }
  
  private maskSensitiveData(data: any): any {
    const sensitive = ['password', 'cardNumber', 'cvv', 'ssn'];
    const masked = { ...data };
    
    for (const key of sensitive) {
      if (masked[key]) {
        masked[key] = '***MASKED***';
      }
    }
    
    return masked;
  }
}
```

### CORS Configuration

```typescript
// main.ts
app.enableCors({
  origin: [
    'https://derlg.com',
    'https://www.derlg.com',
    ...(process.env.NODE_ENV === 'development' ? ['http://localhost:3000'] : [])
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Service-Key']
});
```



## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

Before defining properties, I analyzed all acceptance criteria for redundancy:

**Redundancies Identified:**
- Properties 3.1 and 3.2 (registration creates both Supabase account and user record) can be combined into one comprehensive registration property
- Properties 3.4 and 3.5 (access and refresh token generation) can be combined into one login token property
- Properties 10.13, 10.14, 10.15, 10.16, 10.17 (all actions on payment success) can be combined into one comprehensive webhook processing property
- Properties 11.3, 11.4, 11.5 (refund percentages at different times) can be combined into one refund calculation property
- Properties 26.6 and 26.7 (round-trip for bookings and payments) are both serialization round-trips and can be generalized
- Properties 40.1, 40.2, 40.3, 40.4 (discount code validation checks) can be combined into one validation property

**Properties Retained:**
Each remaining property provides unique validation value and tests distinct system behaviors.

### Authentication Properties

### Property 1: Registration creates complete user account

*For any* valid registration request with email and password, the system should create both a Supabase Auth account and a corresponding user record in the users table with the supabase_uid correctly linked.

**Validates: Requirements 3.1, 3.2**

### Property 2: Login generates valid token pair

*For any* valid login with correct credentials, the system should generate both an access token with 15-minute expiry and a refresh token with 7-day expiry, stored in httpOnly Secure SameSite=Strict cookies.

**Validates: Requirements 3.4, 3.5, 3.6**

### Property 3: Access tokens contain required claims

*For any* generated access token, decoding the JWT should reveal user claims including sub (user_id), role, email, and preferred_language.

**Validates: Requirements 3.7**

### Property 4: Token refresh round-trip

*For any* valid refresh token, presenting it to the refresh endpoint should return a new valid access token that can be used to access protected resources.

**Validates: Requirements 3.8**

### Property 5: Logout invalidates all tokens

*For any* user logout operation, incrementing the token version should cause all previously issued tokens for that user to be rejected on subsequent requests.

**Validates: Requirements 3.9**

### Property 6: Protected routes require authentication

*For any* protected API endpoint, requests without a valid JWT access token should be rejected with 401 Unauthorized status.

**Validates: Requirements 3.12**

### Property 7: Admin routes enforce role authorization

*For any* admin-only endpoint, requests from users with role other than ADMIN should be rejected with 403 Forbidden status.

**Validates: Requirements 3.13**

### Property 8: Authentication rate limiting

*For any* IP address, making more than 5 authentication requests within a 5-minute window should result in the 6th request being rejected with 429 Too Many Requests.

**Validates: Requirements 3.14**

### User Management Properties

### Property 9: Profile updates persist correctly

*For any* authenticated user submitting valid profile updates, the changes should be saved to the database and reflected in subsequent profile retrieval requests.

**Validates: Requirements 4.2**

### Property 10: Protected fields are immutable

*For any* user profile update attempt that includes protected fields (loyalty_points, is_student, student_verified_at, role), those fields should remain unchanged after the update operation.

**Validates: Requirements 4.4**

### Property 11: Profile responses include loyalty and student data

*For any* user profile retrieval, the response should include both the current loyalty_points balance and student verification status (is_student, student_verified_at).

**Validates: Requirements 4.5, 4.6**

### Property 12: Avatar upload round-trip

*For any* valid avatar image upload, the system should store the image in Supabase Storage, save the URL to the user record, and return the same URL in subsequent profile requests.

**Validates: Requirements 4.7**

### Trip Catalog Properties

### Property 13: Trip pagination consistency

*For any* trip list request with pagination parameters, the total number of items across all pages should equal the total count returned in the pagination metadata.

**Validates: Requirements 5.1**

### Property 14: Environment filter accuracy

*For any* trip list request filtered by environment type, all returned trips should have an environment field matching the requested type.

**Validates: Requirements 5.2**

### Property 15: Duration filter boundaries

*For any* trip list request with min_days and max_days filters, all returned trips should have duration values within the inclusive range [min_days, max_days].

**Validates: Requirements 5.3**

### Property 16: Price filter boundaries

*For any* trip list request with min_price and max_price filters, all returned trips should have price values within the inclusive range [min_price, max_price].

**Validates: Requirements 5.4**

### Property 17: Province filter accuracy

*For any* trip list request filtered by province, all returned trips should have a province field matching the requested province.

**Validates: Requirements 5.5**

### Property 18: Sort order correctness

*For any* trip list request with a sortBy parameter (price, rating, or duration), the returned trips should be ordered according to that field in ascending or descending order as specified.

**Validates: Requirements 5.6**

### Property 19: Language-specific content

*For any* trip request with a language header (EN, KH, ZH), the response should include the trip title in the requested language field (title_en, title_kh, or title_zh).

**Validates: Requirements 5.7**

### Property 20: Active trips only

*For any* trip list request, all returned trips should have is_active set to true, and no inactive trips should appear in the results.

**Validates: Requirements 5.10**

### Property 21: Trip response completeness

*For any* individual trip retrieval, the response should include hotel details, transport details, and itinerary information.

**Validates: Requirements 5.9**

### Booking Properties

### Property 22: Booking reference format

*For any* newly created booking, the booking_ref should match the format DLG-YYYY-NNNN where YYYY is the current year and NNNN is a sequential number.

**Validates: Requirements 6.1**

### Property 23: New bookings are reserved

*For any* newly created booking, the initial status should be RESERVED and the reserved_until timestamp should be exactly 15 minutes after the creation time.

**Validates: Requirements 6.2, 6.3**

### Property 24: Booking price calculation accuracy

*For any* booking creation request, the calculated subtotal should equal the sum of base prices for all selected resources (trip, hotel, transport, guide).

**Validates: Requirements 6.4**

### Property 25: Discount application correctness

*For any* booking with valid discount code, loyalty points redemption, and/or student discount, the total_usd should equal subtotal_usd minus the sum of all applicable discounts.

**Validates: Requirements 6.5, 6.6, 6.7, 6.8**

### Property 26: Booking hold in Redis

*For any* newly created booking, a Redis key with pattern booking_hold:{booking_id} should exist with a TTL of approximately 900 seconds (15 minutes).

**Validates: Requirements 6.9**

### Property 27: Payment confirmation updates booking

*For any* booking with status RESERVED, when a successful payment webhook is processed, the booking status should transition to CONFIRMED.

**Validates: Requirements 6.10**

### Property 28: Expired holds are cancelled

*For any* booking with status RESERVED where reserved_until is in the past, the background cleanup job should update the status to CANCELLED.

**Validates: Requirements 6.11**

### Property 29: Booking isolation per user

*For any* user requesting their booking list, the response should only include bookings where the user_id matches the authenticated user's ID.

**Validates: Requirements 6.12**

### Property 30: Availability prevents double booking

*For any* booking creation attempt on a resource (trip, hotel room, vehicle, guide) that already has a CONFIRMED or unexpired RESERVED booking for overlapping dates, the creation should fail with a resource unavailable error.

**Validates: Requirements 6.15**

### Payment Properties

### Property 31: Payment intent requires valid booking

*For any* payment intent creation request, if the booking does not exist, is not in RESERVED status, or has an expired reserved_until timestamp, the request should be rejected with an appropriate error.

**Validates: Requirements 10.1, 10.2**

### Property 32: Payment amount independence

*For any* payment intent creation, the amount sent to Stripe should be calculated independently by the backend from the booking's stored data, not from any client-provided amount.

**Validates: Requirements 10.3**

### Property 33: Payment intent creates payment record

*For any* successful payment intent creation, a payment record should be created in the database with status PENDING and linked to the booking.

**Validates: Requirements 10.5**

### Property 34: Payment intent returns client secret

*For any* successful payment intent creation, the response should include a client_secret string that can be used by the frontend to confirm the payment with Stripe.

**Validates: Requirements 10.6**

### Property 35: Webhook signature verification

*For any* webhook request to /v1/payments/webhook, if the stripe-signature header does not match the expected signature computed using the webhook secret, the request should be rejected with 400 Bad Request.

**Validates: Requirements 10.11**

### Property 36: Webhook idempotency

*For any* Stripe webhook event, if the stripe_event_id has already been processed (exists in the database), the webhook handler should return 200 OK without reprocessing the event.

**Validates: Requirements 10.12**

### Property 37: Payment success triggers complete workflow

*For any* payment_intent.succeeded webhook event, the system should atomically: update booking status to CONFIRMED, update payment status to SUCCEEDED, award loyalty points (2 points per USD), send booking confirmation notification, and publish payment success event to Redis.

**Validates: Requirements 10.13, 10.14, 10.15, 10.16, 10.17**

### Property 38: Payment failure updates status

*For any* payment_intent.payment_failed webhook event, the payment record status should be updated to FAILED.

**Validates: Requirements 10.18**

### Property 39: Refund event updates statuses

*For any* charge.refunded webhook event, both the payment status and booking status should be updated to REFUNDED.

**Validates: Requirements 10.19**

### Property 40: Payment rate limiting

*For any* user, making more than 3 payment intent creation requests within a 1-minute window should result in the 4th request being rejected with 429 Too Many Requests.

**Validates: Requirements 10.20**

### Refund Properties

### Property 41: Cancellation policy refund calculation

*For any* booking cancellation, the refund amount should be: 100% of total if cancelled 7+ days before travel_date, 50% if cancelled 1-7 days before, and 0% if cancelled less than 24 hours before.

**Validates: Requirements 11.3, 11.4, 11.5**

### Property 42: Refund creates Stripe refund

*For any* approved refund with amount > 0, a Stripe refund should be created with the calculated refund amount.

**Validates: Requirements 11.6**

### Property 43: Refund updates payment status

*For any* processed refund, the payment status should be updated to REFUNDED if the full amount is refunded, or PARTIALLY_REFUNDED if only a portion is refunded.

**Validates: Requirements 11.7**

### Property 44: Refund cancels booking

*For any* processed refund, the booking status should be updated to CANCELLED.

**Validates: Requirements 11.8**

### Property 45: Refund reverses loyalty points

*For any* processed refund for a booking that awarded loyalty points, the user's loyalty_points balance should be decreased by the amount that was originally awarded, and a loyalty_transaction record with type ADJUSTED should be created.

**Validates: Requirements 11.9**

### Property 46: Refund sends notification

*For any* processed refund, a refund confirmation notification should be sent to the user via email and push notification.

**Validates: Requirements 11.10**

### Emergency Alert Properties

### Property 47: Emergency alert captures GPS data

*For any* emergency alert creation request, the stored alert record should include the provided latitude, longitude, and accuracy values.

**Validates: Requirements 12.1, 12.2**

### Property 48: New alerts have SENT status

*For any* newly created emergency alert, the initial status should be SENT.

**Validates: Requirements 12.3**

### Property 49: Emergency alert notifies support

*For any* emergency alert creation, both a push notification to the support team and an SMS to the support emergency line should be sent.

**Validates: Requirements 12.4, 12.5**

### Property 50: Emergency alert response completeness

*For any* emergency alert creation response, the data should include support contact numbers, local police number based on GPS location, and nearest hospital information.

**Validates: Requirements 12.6, 12.7, 12.8**

### Property 51: Emergency alerts are permanent

*For any* emergency alert, the record should never be deleted from the database, only status updates should be allowed.

**Validates: Requirements 12.10**

### Property 52: Province-specific emergency contacts

*For any* GPS coordinates within Cambodia, the system should return emergency contact information specific to one of the 25 provinces.

**Validates: Requirements 12.11**

### Property 53: Location sharing expiry

*For any* location sharing session with a specified TTL, the session should automatically expire and location data should be deleted after the TTL period.

**Validates: Requirements 12.12**

### Serialization Properties

### Property 54: JSON validation on parse

*For any* booking customizations, trip itinerary, or cancellation policy JSON input, the system should validate the structure against the expected schema and reject invalid JSON with a descriptive error including field location.

**Validates: Requirements 26.1, 26.2, 26.3, 26.8**

### Property 55: Booking serialization round-trip

*For any* valid booking object, serializing it to JSON for an API response, then parsing that JSON back into an object, should produce an equivalent booking object with all fields preserved.

**Validates: Requirements 26.6**

### Property 56: Payment serialization round-trip

*For any* valid payment object, serializing it to JSON for an API response, then parsing that JSON back into an object, should produce an equivalent payment object with all fields preserved.

**Validates: Requirements 26.7**

### Concurrency and Error Handling Properties

### Property 57: Concurrent booking prevention

*For any* two simultaneous booking creation requests for the same resource and overlapping dates, exactly one should succeed with status RESERVED, and the other should fail with a resource unavailable error.

**Validates: Requirements 34.4**

### Property 58: Loyalty points redemption validation

*For any* booking creation attempt that requests to redeem more loyalty points than the user's current balance, the request should be rejected with an error that includes the user's current loyalty points balance.

**Validates: Requirements 34.6**

### Property 59: Rate limit response format

*For any* request that exceeds the rate limit for an endpoint, the response should have status 429 Too Many Requests and include a retry-after header indicating when the client can retry.

**Validates: Requirements 34.9**

### Property 60: Expired token error code

*For any* request to a protected endpoint with an expired JWT token, the response should have status 401 Unauthorized and include error code TOKEN_EXPIRED.

**Validates: Requirements 34.10**

### Property 61: Token version mismatch rejection

*For any* refresh token request where the token's version does not match the user's current token_version in the database, the request should be rejected and require the user to re-login.

**Validates: Requirements 34.11**

### Property 62: Post-travel cancellation rejection

*For any* booking cancellation attempt where the travel_date is in the past, the request should be rejected with error code TRIP_ALREADY_STARTED.

**Validates: Requirements 34.12**

### Property 63: Invalid discount code error details

*For any* booking creation with an expired or invalid discount code, the error response should include the specific reason (expired, invalid, usage limit exceeded) and the code's expiry date if applicable.

**Validates: Requirements 34.14**

### Property 64: Availability conflict details

*For any* availability check that fails due to date conflicts, the response should include the dates of the conflicting booking(s).

**Validates: Requirements 34.15**

### Availability and Date Validation Properties

### Property 65: Date overlap detection

*For any* availability check on a resource, if there exists a CONFIRMED or unexpired RESERVED booking with date range that overlaps the requested date range, the availability status should be false.

**Validates: Requirements 38.3**

### Property 66: Future date validation

*For any* booking creation request, if the travel_date is in the past, the request should be rejected with a validation error.

**Validates: Requirements 38.7**

### Property 67: Date range validation

*For any* booking creation request with both check-in and check-out dates, if the check-out date is not after the check-in date, the request should be rejected with a validation error.

**Validates: Requirements 38.8**

### Property 68: Maximum advance booking

*For any* booking creation request, if the travel_date is more than 2 years in the future, the request should be rejected with a validation error.

**Validates: Requirements 38.9**

### Property 69: Alternative dates suggestion

*For any* availability check that returns unavailable status, the response should include a list of alternative available dates near the requested dates.

**Validates: Requirements 38.10**

### Discount Code Properties

### Property 70: Discount code validation

*For any* discount code application, the code should be validated to: exist in the database, have is_active = true, have current date within valid_from and valid_until range, not exceed usage_limit, and apply to the booking_type.

**Validates: Requirements 40.1, 40.2, 40.3, 40.4**

### Property 71: Single discount code per booking

*For any* booking creation attempt that includes multiple discount codes, the request should be rejected with an error indicating that only one discount code can be applied per booking.

**Validates: Requirements 40.5**

### Property 72: Discount stacking with loyalty points

*For any* booking creation with both a valid discount code and loyalty points redemption, both discounts should be applied to calculate the final total.

**Validates: Requirements 40.6**

### Property 73: Discount stacking with student discount

*For any* booking creation by a verified student with a valid discount code, both the discount code and student discount should be applied to calculate the final total.

**Validates: Requirements 40.7**

### Property 74: Discount code error specificity

*For any* invalid discount code application, the error response should include the specific reason for invalidity (expired, inactive, usage limit exceeded, wrong booking type, minimum amount not met).

**Validates: Requirements 40.8**

### Property 75: Discount code usage tracking

*For any* successful booking creation with a discount code, the usage count for that code should be incremented by 1.

**Validates: Requirements 40.9**

### Property 76: Discount calculation accuracy

*For any* discount code with type PERCENTAGE, the discount amount should equal (subtotal * percentage / 100), and for type FIXED_AMOUNT, the discount should equal the fixed amount value.

**Validates: Requirements 40.10**

### Property 77: Minimum booking amount enforcement

*For any* discount code with a minimum_booking_amount, if the booking subtotal is less than this amount, the code should be rejected with an error.

**Validates: Requirements 40.11**

### Property 78: Discount code uniqueness per booking

*For any* booking, the same discount code should not be applicable more than once to that booking.

**Validates: Requirements 40.13**

### Property 79: Discount amount in booking summary

*For any* booking creation response that applied a discount code, the response should include the discount_usd amount showing how much was discounted.

**Validates: Requirements 40.14**

### Property 80: Discount code storage in booking

*For any* booking created with a discount code, the booking record should store the discount_code_id linking to the applied discount code.

**Validates: Requirements 40.15**

### CORS Property

### Property 81: CORS origin whitelist enforcement

*For any* API request with an Origin header, if the origin is not in the whitelist (https://derlg.com, https://www.derlg.com), the request should be rejected or the CORS headers should not be included in the response.

**Validates: Requirements 1.10**



## Error Handling

### Error Response Structure

All errors follow a consistent format:

```typescript
interface ErrorResponse {
  success: false;
  data: null;
  message: string;
  error: {
    code: string;
    details?: Record<string, any>;
  };
}
```

### HTTP Exception Filter

Global exception filter handles all HTTP exceptions:

```typescript
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    const errorResponse: ErrorResponse = {
      success: false,
      data: null,
      message: typeof exceptionResponse === 'string' 
        ? exceptionResponse 
        : (exceptionResponse as any).message,
      error: {
        code: this.getErrorCode(exception),
        details: typeof exceptionResponse === 'object' 
          ? exceptionResponse 
          : undefined
      }
    };

    response.status(status).json(errorResponse);
  }

  private getErrorCode(exception: HttpException): string {
    const response = exception.getResponse();
    if (typeof response === 'object' && 'code' in response) {
      return response.code as string;
    }
    return exception.constructor.name.replace('Exception', '').toUpperCase();
  }
}
```

### Prisma Exception Filter

Handles database-specific errors:

```typescript
@Catch(PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    let status = 500;
    let message = 'Database error occurred';
    let code = 'DATABASE_ERROR';

    switch (exception.code) {
      case 'P2002':
        status = 409;
        message = 'A record with this value already exists';
        code = 'DUPLICATE_RECORD';
        break;
      case 'P2025':
        status = 404;
        message = 'Record not found';
        code = 'NOT_FOUND';
        break;
      case 'P2003':
        status = 400;
        message = 'Foreign key constraint failed';
        code = 'INVALID_REFERENCE';
        break;
    }

    const errorResponse: ErrorResponse = {
      success: false,
      data: null,
      message,
      error: {
        code,
        details: {
          target: exception.meta?.target
        }
      }
    };

    response.status(status).json(errorResponse);
  }
}
```

### Validation Error Handling

Class-validator errors are automatically formatted:

```typescript
// In main.ts
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) => {
      const messages = errors.map(error => ({
        field: error.property,
        constraints: error.constraints
      }));
      
      return new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: messages
      });
    }
  })
);
```

### Error Codes Reference

| Code | HTTP Status | Description |
|------|-------------|-------------|
| TOKEN_EXPIRED | 401 | JWT access token has expired |
| TOKEN_INVALID | 401 | JWT token is malformed or invalid |
| BOOKING_EXPIRED | 400 | Booking hold time has expired |
| BOOKING_NOT_FOUND | 404 | Booking reference not found |
| INSUFFICIENT_POINTS | 400 | Not enough loyalty points for redemption |
| INVALID_DISCOUNT_CODE | 400 | Discount code invalid, expired, or usage limit exceeded |
| RESOURCE_UNAVAILABLE | 409 | Resource already booked for requested dates |
| PAYMENT_FAILED | 400 | Payment processing failed |
| TRIP_ALREADY_STARTED | 400 | Cannot cancel booking after travel date |
| INVALID_IMAGE_FORMAT | 400 | Uploaded image is corrupted or wrong format |
| RATE_LIMIT_EXCEEDED | 429 | Too many requests from this client |
| SERVICE_UNAVAILABLE | 503 | External service (Stripe, etc.) unavailable |
| DUPLICATE_RECORD | 409 | Record with unique constraint already exists |
| VALIDATION_ERROR | 400 | Request data failed validation |
| UNAUTHORIZED | 401 | Authentication required |
| FORBIDDEN | 403 | Insufficient permissions |

### Retry Logic

For external service failures:

```typescript
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  backoffMs: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      if (attempt < maxRetries - 1) {
        const delay = backoffMs * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

// Usage
const exchangeRates = await withRetry(
  () => this.fetchExchangeRates(),
  3,
  1000
);
```

### Circuit Breaker Pattern

For protecting against cascading failures:

```typescript
@Injectable()
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime: number = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  
  constructor(
    private threshold: number = 5,
    private timeout: number = 60000
  ) {}
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new ServiceUnavailableException('Circuit breaker is OPEN');
      }
    }
    
    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
  }
  
  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
    }
  }
}
```

### Graceful Degradation

When external services fail, provide fallback behavior:

```typescript
async getCurrencyRates(): Promise<ExchangeRates> {
  try {
    // Try to get from cache first
    const cached = await this.redis.get('currency:rates');
    if (cached) {
      return JSON.parse(cached);
    }
    
    // Fetch from external API
    const rates = await this.fetchExchangeRates();
    await this.redis.setex('currency:rates', 3600, JSON.stringify(rates));
    return rates;
  } catch (error) {
    // Fallback to default rates if external API fails
    this.logger.error('Failed to fetch exchange rates, using defaults', error);
    return {
      USD: 1.0,
      KHR: 4100.0,
      CNY: 7.25,
      lastUpdated: new Date()
    };
  }
}
```

## Testing Strategy

### Testing Approach

The backend uses a dual testing approach combining unit tests and property-based tests:

- **Unit Tests**: Verify specific examples, edge cases, and integration points
- **Property-Based Tests**: Verify universal properties across randomized inputs

This combination ensures both concrete bug detection and general correctness validation.

### Property-Based Testing

#### Library Selection

Use **fast-check** for TypeScript property-based testing:

```bash
npm install --save-dev fast-check @types/fast-check
```

#### Configuration

Each property test should run a minimum of 100 iterations:

```typescript
import * as fc from 'fast-check';

describe('Booking Service Properties', () => {
  it('Property 22: Booking reference format', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.uuid(),
          tripId: fc.uuid(),
          travelDate: fc.date({ min: new Date() }),
          numAdults: fc.integer({ min: 1, max: 20 }),
          numChildren: fc.integer({ min: 0, max: 10 })
        }),
        async (bookingData) => {
          const booking = await bookingService.createBooking(bookingData);
          const refPattern = /^DLG-\d{4}-\d{4}$/;
          expect(booking.bookingRef).toMatch(refPattern);
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

#### Property Test Tags

Each property test must include a comment tag referencing the design document:

```typescript
/**
 * Feature: backend-nestjs-supabase, Property 25: Discount application correctness
 * 
 * For any booking with valid discount code, loyalty points redemption, and/or 
 * student discount, the total_usd should equal subtotal_usd minus the sum of 
 * all applicable discounts.
 */
it('Property 25: Discount application correctness', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.record({
        subtotal: fc.float({ min: 100, max: 1000 }),
        discountCode: fc.option(fc.record({
          type: fc.constantFrom('PERCENTAGE', 'FIXED_AMOUNT'),
          value: fc.float({ min: 5, max: 50 })
        })),
        loyaltyPoints: fc.integer({ min: 0, max: 1000 }),
        isStudent: fc.boolean()
      }),
      async (data) => {
        const booking = await createBookingWithDiscounts(data);
        const expectedTotal = calculateExpectedTotal(data);
        expect(booking.totalUsd).toBeCloseTo(expectedTotal, 2);
      }
    ),
    { numRuns: 100 }
  );
});
```

#### Custom Arbitraries

Define custom generators for domain objects:

```typescript
// Arbitrary for valid booking dates
const futureDate = fc.date({ min: new Date(), max: new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000) });

// Arbitrary for valid email addresses
const email = fc.emailAddress();

// Arbitrary for GPS coordinates in Cambodia
const cambodiaCoordinates = fc.record({
  latitude: fc.float({ min: 10.0, max: 14.7 }),
  longitude: fc.float({ min: 102.3, max: 107.7 })
});

// Arbitrary for booking status
const bookingStatus = fc.constantFrom('RESERVED', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'REFUNDED');

// Arbitrary for valid discount code
const discountCode = fc.record({
  code: fc.stringOf(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('')), { minLength: 6, maxLength: 12 }),
  type: fc.constantFrom('PERCENTAGE', 'FIXED_AMOUNT'),
  value: fc.float({ min: 5, max: 100 }),
  isActive: fc.constant(true),
  validFrom: fc.date({ max: new Date() }),
  validUntil: fc.date({ min: new Date() }),
  usageLimit: fc.integer({ min: 10, max: 1000 }),
  usageCount: fc.integer({ min: 0, max: 9 })
});
```

### Unit Testing

#### Test Structure

Unit tests focus on specific scenarios and edge cases:

```typescript
describe('BookingService', () => {
  let service: BookingService;
  let prisma: PrismaService;
  let redis: RedisService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        BookingService,
        {
          provide: PrismaService,
          useValue: mockPrismaService
        },
        {
          provide: RedisService,
          useValue: mockRedisService
        }
      ]
    }).compile();

    service = module.get<BookingService>(BookingService);
    prisma = module.get<PrismaService>(PrismaService);
    redis = module.get<RedisService>(RedisService);
  });

  describe('createBooking', () => {
    it('should create a booking with RESERVED status', async () => {
      const dto = {
        bookingType: 'PACKAGE',
        tripId: 'trip-uuid',
        travelDate: new Date('2024-12-01'),
        numAdults: 2,
        numChildren: 1
      };

      const result = await service.createBooking('user-uuid', dto);

      expect(result.status).toBe('RESERVED');
      expect(result.bookingRef).toMatch(/^DLG-\d{4}-\d{4}$/);
    });

    it('should reject booking for past dates', async () => {
      const dto = {
        bookingType: 'PACKAGE',
        tripId: 'trip-uuid',
        travelDate: new Date('2020-01-01'),
        numAdults: 2,
        numChildren: 0
      };

      await expect(
        service.createBooking('user-uuid', dto)
      ).rejects.toThrow('Travel date must be in the future');
    });

    it('should reject booking when resource is unavailable', async () => {
      prisma.booking.findMany.mockResolvedValue([
        { status: 'CONFIRMED', travelDate: new Date('2024-12-01') }
      ]);

      const dto = {
        bookingType: 'PACKAGE',
        tripId: 'trip-uuid',
        travelDate: new Date('2024-12-01'),
        numAdults: 2,
        numChildren: 0
      };

      await expect(
        service.createBooking('user-uuid', dto)
      ).rejects.toThrow('Resource not available');
    });
  });

  describe('cancelBooking', () => {
    it('should refund 100% when cancelled 7+ days before travel', async () => {
      const booking = {
        id: 'booking-uuid',
        totalUsd: 500,
        travelDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        status: 'CONFIRMED'
      };

      const result = await service.cancelBooking(booking.id, 'user-uuid');

      expect(result.refundAmount).toBe(500);
    });

    it('should refund 50% when cancelled 1-7 days before travel', async () => {
      const booking = {
        id: 'booking-uuid',
        totalUsd: 500,
        travelDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        status: 'CONFIRMED'
      };

      const result = await service.cancelBooking(booking.id, 'user-uuid');

      expect(result.refundAmount).toBe(250);
    });

    it('should refund 0% when cancelled < 24 hours before travel', async () => {
      const booking = {
        id: 'booking-uuid',
        totalUsd: 500,
        travelDate: new Date(Date.now() + 12 * 60 * 60 * 1000),
        status: 'CONFIRMED'
      };

      const result = await service.cancelBooking(booking.id, 'user-uuid');

      expect(result.refundAmount).toBe(0);
    });
  });
});
```

#### Integration Tests

Test critical flows end-to-end:

```typescript
describe('Booking and Payment Flow (E2E)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should complete full booking and payment flow', async () => {
    // 1. Register user
    const registerResponse = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        email: 'test@example.com',
        password: 'SecurePass123!',
        name: 'Test User'
      })
      .expect(201);

    const { accessToken } = registerResponse.body.data;

    // 2. Create booking
    const bookingResponse = await request(app.getHttpServer())
      .post('/v1/bookings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        bookingType: 'PACKAGE',
        tripId: 'test-trip-uuid',
        travelDate: '2024-12-01',
        numAdults: 2,
        numChildren: 0
      })
      .expect(201);

    const { booking } = bookingResponse.body.data;
    expect(booking.status).toBe('RESERVED');

    // 3. Create payment intent
    const paymentResponse = await request(app.getHttpServer())
      .post('/v1/payments/create-intent')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        bookingId: booking.id
      })
      .expect(201);

    expect(paymentResponse.body.data.clientSecret).toBeDefined();

    // 4. Simulate webhook (payment succeeded)
    const webhookPayload = {
      id: 'evt_test_123',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: paymentResponse.body.data.paymentIntentId,
          metadata: {
            bookingId: booking.id
          }
        }
      }
    };

    await request(app.getHttpServer())
      .post('/v1/payments/webhook')
      .set('stripe-signature', 'test-signature')
      .send(webhookPayload)
      .expect(200);

    // 5. Verify booking is confirmed
    const updatedBookingResponse = await request(app.getHttpServer())
      .get(`/v1/bookings/${booking.bookingRef}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(updatedBookingResponse.body.data.booking.status).toBe('CONFIRMED');
  });
});
```

### Test Coverage Goals

- **Unit Test Coverage**: Minimum 80% code coverage
- **Property Test Coverage**: All 81 correctness properties implemented
- **Integration Test Coverage**: All critical user flows (auth, booking, payment, refund, emergency)
- **Edge Case Coverage**: File size limits, rate limits, date boundaries, GPS boundaries

### Testing Tools

- **Jest**: Test runner and assertion library
- **fast-check**: Property-based testing
- **Supertest**: HTTP integration testing
- **@nestjs/testing**: NestJS testing utilities
- **Prisma Client Mock**: Database mocking

### Continuous Integration

Tests run on every commit:

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run Prisma migrations
        run: npx prisma migrate deploy
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
      
      - name: Run unit tests
        run: npm run test:cov
      
      - name: Run property tests
        run: npm run test:property
      
      - name: Run integration tests
        run: npm run test:e2e
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

## Deployment Considerations

### Environment Variables

Required environment variables for production:

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/db?pgbouncer=true
DIRECT_URL=postgresql://user:pass@host:5432/db

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx

# JWT
JWT_ACCESS_SECRET=xxx
JWT_REFRESH_SECRET=xxx

# Stripe
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# AI Service
AI_SERVICE_KEY=xxx

# Redis
REDIS_URL=redis://default:xxx@xxx.upstash.io:6379

# Email
RESEND_API_KEY=re_xxx

# Monitoring
SENTRY_DSN=https://xxx@sentry.io/xxx

# Application
NODE_ENV=production
PORT=3001
CORS_ORIGINS=https://derlg.com,https://www.derlg.com
```

### Health Check Endpoint

```typescript
@Controller('health')
export class HealthController {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService
  ) {}

  @Get()
  async check(): Promise<HealthCheckResponse> {
    const checks = await Promise.allSettled([
      this.checkDatabase(),
      this.checkRedis()
    ]);

    const [dbCheck, redisCheck] = checks;

    return {
      status: checks.every(c => c.status === 'fulfilled') ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        database: dbCheck.status === 'fulfilled' ? 'up' : 'down',
        redis: redisCheck.status === 'fulfilled' ? 'up' : 'down'
      }
    };
  }

  private async checkDatabase(): Promise<void> {
    await this.prisma.$queryRaw`SELECT 1`;
  }

  private async checkRedis(): Promise<void> {
    await this.redis.set('health_check', 'ok');
    await this.redis.del('health_check');
  }
}
```

### Graceful Shutdown

```typescript
// main.ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Enable graceful shutdown
  app.enableShutdownHooks();
  
  // Handle SIGTERM
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully');
    await app.close();
    process.exit(0);
  });
  
  await app.listen(3001);
}
```

### Performance Optimization

1. **Connection Pooling**: Configure Prisma connection pool
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
     connection_limit = 100
   }
   ```

2. **Query Optimization**: Use Prisma select and include strategically
   ```typescript
   const booking = await prisma.booking.findUnique({
     where: { id },
     select: {
       id: true,
       bookingRef: true,
       status: true,
       // Only select needed fields
     }
   });
   ```

3. **Redis Caching**: Cache frequently accessed data
   ```typescript
   async getTrip(id: string): Promise<Trip> {
     const cached = await this.redis.get(`trip:${id}`);
     if (cached) return JSON.parse(cached);
     
     const trip = await this.prisma.trip.findUnique({ where: { id } });
     await this.redis.setex(`trip:${id}`, 3600, JSON.stringify(trip));
     return trip;
   }
   ```

4. **Response Compression**: Enable gzip compression
   ```typescript
   import compression from 'compression';
   app.use(compression());
   ```

### Monitoring and Logging

```typescript
// Winston logger configuration
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Sentry integration
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1
});
```

## Summary

This design document provides a comprehensive blueprint for implementing the DerLg.com backend using NestJS and Supabase. The architecture emphasizes:

- **Type safety** through TypeScript and Prisma
- **Modularity** with clear separation of concerns
- **Security** with JWT authentication, rate limiting, and input validation
- **Reliability** through idempotent operations and transaction management
- **Testability** with 81 correctness properties and comprehensive unit tests
- **Scalability** via stateless design and Redis caching

The implementation should follow the module structure, API contracts, and testing strategy outlined in this document to ensure a robust, maintainable, and correct system.

