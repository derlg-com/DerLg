# DerLg Database Schema Specification

> Complete Prisma schema. This is the source of truth for all database operations. Any change here requires a migration.

---

## Schema Conventions

| Convention | Rule |
|------------|------|
| Table names | `snake_case`, plural — `hotel_rooms` |
| Model names | `PascalCase`, singular — `HotelRoom` |
| Field names | `camelCase` in Prisma, `@map("snake_case")` in DB |
| Primary keys | `id String @id @default(uuid())` |
| Money | `Decimal @db.Decimal(10, 2)` |
| Timestamps | `DateTime @db.Timestamptz(6) @default(now())` |
| Soft delete | `deletedAt DateTime?` on every table |
| JSONB | `Json? @db.JsonB` for flexible structures |
| Enums | Defined in Prisma, mapped to DB enums |
| Indexes | Explicit `@index` for all foreign keys and query patterns |

---

## Complete Schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

// ─────────────────────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────────────────────

enum UserRole {
  USER
  STUDENT
  GUIDE
  ADMIN
}

enum UserStatus {
  ACTIVE
  INACTIVE
  SUSPENDED
}

enum BookingStatus {
  HOLD
  PENDING_PAYMENT
  CONFIRMED
  CANCELLED
  EXPIRED
}

enum PaymentStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
  REFUNDED
}

enum PaymentMethod {
  CARD
  QR
  BANK_TRANSFER
}

enum GuideStatus {
  ACTIVE
  INACTIVE
  SUSPENDED
}

enum HotelStarRating {
  ONE
  TWO
  THREE
  FOUR
  FIVE
}

enum PlaceCategory {
  TEMPLE
  MUSEUM
  NATURE
  MARKET
  BEACH
  MOUNTAIN
  OTHER
}

enum TransportationType {
  CAR
  VAN
  BUS
  TUK_TUK
  BIKE
  BOAT
}

enum NotificationChannel {
  EMAIL
  PUSH
  IN_APP
}

enum NotificationStatus {
  PENDING
  SENT
  DELIVERED
  FAILED
}

enum StudentVerificationStatus {
  PENDING
  APPROVED
  REJECTED
}

enum EmergencyAlertStatus {
  ACTIVE
  ACKNOWLEDGED
  RESOLVED
}

enum AuditAction {
  CREATE
  UPDATE
  DELETE
  LOGIN
  LOGOUT
  EXPORT
}

enum TripCategory {
  TEMPLES
  NATURE
  CULTURE
  ADVENTURE
  FOOD
}

enum TripStatus {
  ACTIVE
  INACTIVE
  DRAFT
}

enum LoyaltyAction {
  EARNED
  REDEEMED
  EXPIRED
}

enum Gender {
  MALE
  FEMALE
  OTHER
  PREFER_NOT_TO_SAY
}

enum Language {
  EN
  ZH
  KM
}

// ─────────────────────────────────────────────────────────────
// Core: Users & Auth
// ─────────────────────────────────────────────────────────────

model User {
  id            String     @id @default(uuid())
  email         String     @unique
  passwordHash  String     @map("password_hash")
  name          String?
  phone         String?
  avatarUrl     String?    @map("avatar_url")
  role          UserRole   @default(USER)
  status        UserStatus @default(ACTIVE)
  gender        Gender?
  dateOfBirth   DateTime?  @map("date_of_birth")
  nationality   String?
  isVerified    Boolean    @default(false) @map("is_verified")
  
  // Student discount
  studentVerification StudentVerification?
  
  // Loyalty
  loyaltyPoints   Int      @default(0) @map("loyalty_points")
  loyaltyTransactions LoyaltyTransaction[]
  
  // Auth
  refreshTokens   RefreshToken[]
  
  // Relations
  bookings        Booking[]
  reviews         Review[]
  favorites       Favorite[]
  notifications   Notification[]
  emergencyAlerts EmergencyAlert[]
  locationShares  LocationShare[]
  aiSessions      AiSession[]
  
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")
  deletedAt       DateTime? @map("deleted_at")
  
  @@index([email])
  @@index([role])
  @@index([deletedAt])
  @@map("users")
}

model RefreshToken {
  id        String   @id @default(uuid())
  token     String   @unique
  userId    String   @map("user_id")
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime @map("expires_at")
  createdAt DateTime @default(now()) @map("created_at")
  
  @@index([userId])
  @@index([token])
  @@map("refresh_tokens")
}

// ─────────────────────────────────────────────────────────────
// Core: Trips
// ─────────────────────────────────────────────────────────────

model Trip {
  id              String      @id @default(uuid())
  slug            String      @unique
  name            String
  description     String?
  coverImageUrl   String?     @map("cover_image_url")
  durationDays    Int         @map("duration_days")
  priceUsd        Decimal     @map("price_usd") @db.Decimal(10, 2)
  priceFromUsd    Decimal?    @map("price_from_usd") @db.Decimal(10, 2)
  category        TripCategory
  location        String
  maxGuests       Int?        @map("max_guests")
  isFeatured      Boolean     @default(false) @map("is_featured")
  status          TripStatus  @default(DRAFT)
  ratingAverage   Decimal?    @map("rating_average") @db.Decimal(2, 1)
  ratingCount     Int         @default(0) @map("rating_count")
  
  // Rich content
  galleryImageUrls String[]   @map("gallery_image_urls")
  itineraryDays    Json?      @map("itinerary_days") // [{ dayNumber, title, description, durationHours }]
  includedItems    String[]   @map("included_items")
  excludedItems    String[]   @map("excluded_items")
  meetingPoint     Json?      @map("meeting_point") // { description, latitude, longitude }
  cancellationPolicy String?  @map("cancellation_policy")
  
  // Relations
  reviews         Review[]
  favorites       Favorite[]
  bookings        Booking[]
  
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")
  deletedAt       DateTime? @map("deleted_at")
  
  @@index([slug])
  @@index([category])
  @@index([location])
  @@index([isFeatured])
  @@index([status])
  @@index([deletedAt])
  @@map("trips")
}

// ─────────────────────────────────────────────────────────────
// Core: Places
// ─────────────────────────────────────────────────────────────

model Place {
  id              String       @id @default(uuid())
  slug            String       @unique
  name            String
  description     String?
  coverImageUrl   String?      @map("cover_image_url")
  category        PlaceCategory
  province        String
  latitude        Decimal      @db.Decimal(10, 8)
  longitude       Decimal      @db.Decimal(11, 8)
  ratingAverage   Decimal?     @map("rating_average") @db.Decimal(2, 1)
  ratingCount     Int          @default(0) @map("rating_count")
  entryFeeUsd     Decimal?     @map("entry_fee_usd") @db.Decimal(10, 2)
  
  // Rich content
  visitorTips     String?      @map("visitor_tips")
  dressCode       String?      @map("dress_code")
  galleryImageUrls String[]    @map("gallery_image_urls")
  openingHours    Json?        @map("opening_hours") // { monday, tuesday, ... }
  status          TripStatus   @default(ACTIVE)
  
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")
  deletedAt       DateTime? @map("deleted_at")
  
  @@index([slug])
  @@index([category])
  @@index([province])
  @@index([status])
  @@index([deletedAt])
  @@map("places")
}

// ─────────────────────────────────────────────────────────────
// Core: Hotels
// ─────────────────────────────────────────────────────────────

model Hotel {
  id                String   @id @default(uuid())
  slug              String   @unique
  name              String
  description       String?
  coverImageUrl     String?  @map("cover_image_url")
  location          String
  address           String?
  latitude          Decimal? @db.Decimal(10, 8)
  longitude         Decimal? @db.Decimal(11, 8)
  starRating        Int?     @map("star_rating")
  pricePerNightFrom Decimal? @map("price_per_night_from") @db.Decimal(10, 2)
  amenities         String[]
  ratingAverage     Decimal? @map("rating_average") @db.Decimal(2, 1)
  ratingCount       Int      @default(0) @map("rating_count")
  checkInTime       String?  @map("check_in_time")
  checkOutTime      String?  @map("check_out_time")
  cancellationPolicy String? @map("cancellation_policy")
  galleryImageUrls  String[] @map("gallery_image_urls")
  status            TripStatus @default(ACTIVE)
  
  // Relations
  rooms             HotelRoom[]
  bookings          Booking[]
  
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")
  deletedAt         DateTime? @map("deleted_at")
  
  @@index([slug])
  @@index([location])
  @@index([status])
  @@index([deletedAt])
  @@map("hotels")
}

model HotelRoom {
  id              String   @id @default(uuid())
  hotelId         String   @map("hotel_id")
  hotel           Hotel    @relation(fields: [hotelId], references: [id], onDelete: Cascade)
  name            String
  description     String?
  bedConfiguration String? @map("bed_configuration")
  maxOccupancy    Int      @map("max_occupancy")
  sizeSqm         Int?     @map("size_sqm")
  amenities       String[]
  imageUrls       String[] @map("image_urls")
  pricePerNightUsd Decimal @map("price_per_night_usd") @db.Decimal(10, 2)
  totalRooms      Int      @map("total_rooms")
  
  // Relations
  bookings        Booking[]
  
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")
  deletedAt       DateTime? @map("deleted_at")
  
  @@index([hotelId])
  @@index([deletedAt])
  @@map("hotel_rooms")
}

// ─────────────────────────────────────────────────────────────
// Core: Guides
// ─────────────────────────────────────────────────────────────

model Guide {
  id              String     @id @default(uuid())
  userId          String?    @map("user_id") // Link to User if guide has login
  name            String
  profilePicture  String?    @map("profile_picture")
  bio             String?
  experienceYears Int?       @map("experience_years")
  languages       Language[]
  specialties     String[]
  location        String
  gender          Gender?
  pricePerDayUsd  Decimal?   @map("price_per_day_usd") @db.Decimal(10, 2)
  pricePerHourUsd Decimal?   @map("price_per_hour_usd") @db.Decimal(10, 2)
  isVerified      Boolean    @default(false) @map("is_verified")
  certifications  String[]
  galleryImageUrls String[]  @map("gallery_image_urls")
  status          GuideStatus @default(ACTIVE)
  ratingAverage   Decimal?   @map("rating_average") @db.Decimal(2, 1)
  ratingCount     Int        @default(0) @map("rating_count")
  
  // Relations
  bookings        Booking[]
  
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")
  deletedAt       DateTime? @map("deleted_at")
  
  @@index([location])
  @@index([status])
  @@index([isVerified])
  @@index([deletedAt])
  @@map("guides")
}

// ─────────────────────────────────────────────────────────────
// Core: Transportation
// ─────────────────────────────────────────────────────────────

model TransportationVehicle {
  id              String            @id @default(uuid())
  type            TransportationType
  name            String
  description     String?
  capacity        Int
  pricePerDayUsd  Decimal           @map("price_per_day_usd") @db.Decimal(10, 2)
  imageUrls       String[]          @map("image_urls")
  amenities       String[]
  isAvailable     Boolean           @default(true) @map("is_available")
  ratingAverage   Decimal?          @map("rating_average") @db.Decimal(2, 1)
  ratingCount     Int               @default(0) @map("rating_count")
  
  // Relations
  bookings        Booking[]
  
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")
  deletedAt       DateTime? @map("deleted_at")
  
  @@index([type])
  @@index([isAvailable])
  @@index([deletedAt])
  @@map("transportation_vehicles")
}

// ─────────────────────────────────────────────────────────────
// Core: Bookings
// ─────────────────────────────────────────────────────────────

model Booking {
  id                  String        @id @default(uuid())
  reference           String        @unique // e.g., "GDE-ABC123"
  userId              String        @map("user_id")
  user                User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  // Polymorphic booking (one of these is set)
  tripId              String?       @map("trip_id")
  trip                Trip?         @relation(fields: [tripId], references: [id])
  guideId             String?       @map("guide_id")
  guide               Guide?        @relation(fields: [guideId], references: [id])
  hotelId             String?       @map("hotel_id")
  hotel               Hotel?        @relation(fields: [hotelId], references: [id])
  hotelRoomId         String?       @map("hotel_room_id")
  hotelRoom           HotelRoom?    @relation(fields: [hotelRoomId], references: [id])
  vehicleId           String?       @map("vehicle_id")
  vehicle             TransportationVehicle? @relation(fields: [vehicleId], references: [id])
  
  // Dates
  startDate           DateTime      @map("start_date")
  endDate             DateTime      @map("end_date")
  days                Int?
  nights              Int?
  
  // Guests
  guestsAdults        Int           @map("guests_adults")
  guestsChildren      Int           @default(0) @map("guests_children")
  
  // Status & Pricing
  status              BookingStatus @default(HOLD)
  totalPriceUsd       Decimal       @map("total_price_usd") @db.Decimal(10, 2)
  specialRequests     String?       @map("special_requests")
  
  // Hold
  holdExpiresAt       DateTime?     @map("hold_expires_at")
  
  // Relations
  payments            Payment[]
  
  createdAt           DateTime @default(now()) @map("created_at")
  updatedAt           DateTime @updatedAt @map("updated_at")
  deletedAt           DateTime? @map("deleted_at")
  
  @@index([userId])
  @@index([status])
  @@index([startDate, endDate])
  @@index([reference])
  @@index([deletedAt])
  @@map("bookings")
}

// ─────────────────────────────────────────────────────────────
// Core: Payments
// ─────────────────────────────────────────────────────────────

model Payment {
  id              String        @id @default(uuid())
  bookingId       String        @map("booking_id")
  booking         Booking       @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  amountUsd       Decimal       @map("amount_usd") @db.Decimal(10, 2)
  status          PaymentStatus @default(PENDING)
  method          PaymentMethod
  stripePaymentIntentId String? @map("stripe_payment_intent_id")
  stripeEventId   String?       @map("stripe_event_id")
  
  // Relations
  refunds         Refund[]
  
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")
  deletedAt       DateTime? @map("deleted_at")
  
  @@index([bookingId])
  @@index([status])
  @@index([stripePaymentIntentId])
  @@index([stripeEventId])
  @@index([deletedAt])
  @@map("payments")
}

model Refund {
  id              String   @id @default(uuid())
  paymentId       String   @map("payment_id")
  payment         Payment  @relation(fields: [paymentId], references: [id], onDelete: Cascade)
  amountUsd       Decimal  @map("amount_usd") @db.Decimal(10, 2)
  percentage      Int
  reason          String?
  stripeRefundId  String?  @map("stripe_refund_id")
  
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")
  deletedAt       DateTime? @map("deleted_at")
  
  @@index([paymentId])
  @@index([deletedAt])
  @@map("refunds")
}

// ─────────────────────────────────────────────────────────────
// Core: Reviews
// ─────────────────────────────────────────────────────────────

model Review {
  id          String   @id @default(uuid())
  userId      String   @map("user_id")
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  tripId      String?  @map("trip_id")
  trip        Trip?    @relation(fields: [tripId], references: [id])
  rating      Int
  text        String?
  photoUrls   String[] @map("photo_urls")
  isVerified  Boolean  @default(false) @map("is_verified")
  
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")
  deletedAt   DateTime? @map("deleted_at")
  
  @@index([userId])
  @@index([tripId])
  @@index([rating])
  @@index([deletedAt])
  @@map("reviews")
}

// ─────────────────────────────────────────────────────────────
// Core: Favorites
// ─────────────────────────────────────────────────────────────

model Favorite {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  tripId    String   @map("trip_id")
  trip      Trip     @relation(fields: [tripId], references: [id], onDelete: Cascade)
  
  createdAt DateTime @default(now()) @map("created_at")
  
  @@unique([userId, tripId])
  @@index([userId])
  @@index([tripId])
  @@map("favorites")
}

// ─────────────────────────────────────────────────────────────
// Core: Discount Codes
// ─────────────────────────────────────────────────────────────

model DiscountCode {
  id              String    @id @default(uuid())
  code            String    @unique
  description     String?
  discountPercent Int       @map("discount_percent")
  maxUses         Int?      @map("max_uses")
  usedCount       Int       @default(0) @map("used_count")
  validFrom       DateTime  @map("valid_from")
  validUntil      DateTime? @map("valid_until")
  minBookingValue Decimal?  @map("min_booking_value") @db.Decimal(10, 2)
  isActive        Boolean   @default(true) @map("is_active")
  
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")
  deletedAt       DateTime? @map("deleted_at")
  
  @@index([code])
  @@index([isActive])
  @@index([deletedAt])
  @@map("discount_codes")
}

// ─────────────────────────────────────────────────────────────
// Core: Loyalty
// ─────────────────────────────────────────────────────────────

model LoyaltyTransaction {
  id          String        @id @default(uuid())
  userId      String        @map("user_id")
  user        User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  action      LoyaltyAction
  points      Int
  description String?
  bookingId   String?       @map("booking_id")
  
  createdAt   DateTime @default(now()) @map("created_at")
  deletedAt   DateTime? @map("deleted_at")
  
  @@index([userId])
  @@index([action])
  @@index([deletedAt])
  @@map("loyalty_transactions")
}

// ─────────────────────────────────────────────────────────────
// Core: Student Verification
// ─────────────────────────────────────────────────────────────

model StudentVerification {
  id              String                   @id @default(uuid())
  userId          String                   @unique @map("user_id")
  user            User                     @relation(fields: [userId], references: [id], onDelete: Cascade)
  status          StudentVerificationStatus @default(PENDING)
  institution     String?
  studentIdNumber String?                  @map("student_id_number")
  documentUrl     String?                  @map("document_url")
  verifiedBy      String?                  @map("verified_by")
  verifiedAt      DateTime?                @map("verified_at")
  rejectionReason String?                  @map("rejection_reason")
  
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")
  deletedAt       DateTime? @map("deleted_at")
  
  @@index([status])
  @@index([deletedAt])
  @@map("student_verifications")
}

// ─────────────────────────────────────────────────────────────
// Core: Emergency
// ─────────────────────────────────────────────────────────────

model EmergencyAlert {
  id          String               @id @default(uuid())
  userId      String               @map("user_id")
  user        User                 @relation(fields: [userId], references: [id], onDelete: Cascade)
  type        String
  description String?
  latitude    Decimal?             @db.Decimal(10, 8)
  longitude   Decimal?             @db.Decimal(11, 8)
  status      EmergencyAlertStatus @default(ACTIVE)
  resolvedAt  DateTime?            @map("resolved_at")
  
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")
  deletedAt   DateTime? @map("deleted_at")
  
  @@index([userId])
  @@index([status])
  @@index([deletedAt])
  @@map("emergency_alerts")
}

model LocationShare {
  id        String   @id @default(uuid())
  token     String   @unique
  userId    String   @map("user_id")
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  latitude  Decimal  @db.Decimal(10, 8)
  longitude Decimal  @db.Decimal(11, 8)
  expiresAt DateTime @map("expires_at")
  revokedAt DateTime? @map("revoked_at")
  
  createdAt DateTime @default(now()) @map("created_at")
  
  @@index([token])
  @@index([userId])
  @@map("location_shares")
}

// ─────────────────────────────────────────────────────────────
// Core: Notifications
// ─────────────────────────────────────────────────────────────

model Notification {
  id        String              @id @default(uuid())
  userId    String              @map("user_id")
  user      User                @relation(fields: [userId], references: [id], onDelete: Cascade)
  title     String
  body      String
  channel   NotificationChannel
  status    NotificationStatus  @default(PENDING)
  sentAt    DateTime?           @map("sent_at")
  readAt    DateTime?           @map("read_at")
  metadata  Json?               // { bookingId, tripId, etc. }
  
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  deletedAt DateTime? @map("deleted_at")
  
  @@index([userId])
  @@index([status])
  @@index([deletedAt])
  @@map("notifications")
}

// ─────────────────────────────────────────────────────────────
// Core: AI Sessions
// ─────────────────────────────────────────────────────────────

model AiSession {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  sessionId String   @map("session_id")
  messages  Json     // [{ role, content, timestamp }]
  context   Json?    // { budget, dates, preferences }
  
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  deletedAt DateTime? @map("deleted_at")
  
  @@index([userId])
  @@index([sessionId])
  @@index([deletedAt])
  @@map("ai_sessions")
}

// ─────────────────────────────────────────────────────────────
// Core: Audit Logs
// ─────────────────────────────────────────────────────────────

model AuditLog {
  id          String     @id @default(uuid())
  userId      String?    @map("user_id")
  action      AuditAction
  entityType  String     @map("entity_type") // e.g., "booking", "payment"
  entityId    String?    @map("entity_id")
  oldValue    Json?      @map("old_value")
  newValue    Json?      @map("new_value")
  ipAddress   String?    @map("ip_address")
  userAgent   String?    @map("user_agent")
  
  createdAt   DateTime @default(now()) @map("created_at")
  
  @@index([userId])
  @@index([action])
  @@index([entityType, entityId])
  @@index([createdAt])
  @@map("audit_logs")
}

// ─────────────────────────────────────────────────────────────
// Core: Festivals
// ─────────────────────────────────────────────────────────────

model Festival {
  id          String   @id @default(uuid())
  slug        String   @unique
  name        String
  description String?
  coverImageUrl String? @map("cover_image_url")
  startDate   DateTime @map("start_date")
  endDate     DateTime @map("end_date")
  location    String
  latitude    Decimal? @db.Decimal(10, 8)
  longitude   Decimal? @db.Decimal(11, 8)
  status      TripStatus @default(ACTIVE)
  
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")
  deletedAt   DateTime? @map("deleted_at")
  
  @@index([slug])
  @@index([startDate, endDate])
  @@index([status])
  @@index([deletedAt])
  @@map("festivals")
}
```

---

## Schema Statistics

| Metric | Count |
|--------|-------|
| Models | 20 |
| Enums | 18 |
| Indexes | 60+ |
| Relations | 30+ |

---

## Change Process

1. Edit this `SCHEMA.md` document
2. Update `prisma/schema.prisma` to match
3. Generate migration: `npx prisma migrate dev --name <descriptive_name>`
4. Regenerate client: `npx prisma generate`
5. Update seed data if new required fields added
6. Update `API-CONTRACT.md` if response shapes change

---

## References

- Backend foundation: `docs/platform/backend/foundation.md`
- Backend design: `.kiro/specs/backend-nestjs-supabase/design.md`
- Requirements: `.kiro/specs/backend-nestjs-supabase/requirements.md`
