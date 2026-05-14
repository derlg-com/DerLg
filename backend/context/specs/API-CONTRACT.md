# DerLg Backend API Contract

> Consolidated TypeScript contracts for all endpoints. This document maps every route to its request DTO, response type, auth requirements, and error codes. Generated from `docs/modules/*/api.yaml` but expressed as TypeScript — the language we actually implement in.

---

## Conventions

- All routes prefixed with `/v1/` (configured in `main.ts`)
- All responses wrapped in `ApiResponse<T>`: `{ success: boolean, data?: T, error?: { code, message } }`
- Pagination: `PaginatedResponse<T>` = `{ items: T[], total, page, limit, totalPages }`
- Auth: Bearer JWT in `Authorization` header
- Idempotency: `Idempotency-Key` header for mutating endpoints

---

## Global Types

```typescript
// Shared response envelope
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

// Pagination
interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Common params
interface ListParams {
  page?: number;   // default: 1
  limit?: number;  // default: 20, max: 50
}

// Auth context (injected via @CurrentUser())
interface UserPayload {
  sub: string;      // user ID
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
}

type UserRole = 'user' | 'student' | 'guide' | 'admin';
```

---

## 1. Authentication (`/v1/auth`)

### POST `/v1/auth/register`
Create a new user account.

**Request:**
```typescript
interface RegisterRequest {
  email: string;
  password: string;      // min 8 chars
  name?: string;
  phone?: string;
}
```

**Response:** `ApiResponse<{ user: UserSummary; accessToken: string }>`

**Errors:** `AUTH_EMAIL_EXISTS`, `AUTH_INVALID_PASSWORD`

---

### POST `/v1/auth/login`
Authenticate and receive tokens.

**Request:**
```typescript
interface LoginRequest {
  email: string;
  password: string;
}
```

**Response:** `ApiResponse<{ accessToken: string }>`
(Refresh token set as httpOnly cookie)

**Errors:** `AUTH_INVALID_CREDENTIALS`, `AUTH_ACCOUNT_SUSPENDED`

---

### POST `/v1/auth/google`
Initiate Google OAuth flow. Returns redirect URL.

**Response:** `ApiResponse<{ url: string }>`

---

### GET `/v1/auth/google/callback`
OAuth callback. Creates or links user.

**Query:** `?code=`

**Response:** `ApiResponse<{ accessToken: string }>`

---

### POST `/v1/auth/refresh`
Exchange refresh token for new access token.

**Cookie:** `refresh_token`

**Response:** `ApiResponse<{ accessToken: string }>`

**Errors:** `AUTH_INVALID_REFRESH_TOKEN`

---

### POST `/v1/auth/logout`
Invalidate refresh token.

**Cookie:** `refresh_token`

**Response:** `ApiResponse<{ message: string }>`

---

### POST `/v1/auth/forgot-password`
Send password reset email.

**Request:** `{ email: string }`

**Response:** `ApiResponse<{ message: string }>`

---

### POST `/v1/auth/reset-password`
Reset password with token.

**Request:** `{ token: string; newPassword: string }`

**Response:** `ApiResponse<{ message: string }>`

**Errors:** `AUTH_INVALID_TOKEN`, `AUTH_TOKEN_EXPIRED`

---

## 2. Users (`/v1/users`)

### GET `/v1/users/me`
Get current user profile.

**Auth:** Bearer JWT

**Response:** `ApiResponse<UserProfile>`

```typescript
interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  avatarUrl: string | null;
  role: UserRole;
  loyaltyPoints: number;
  isStudent: boolean;
  createdAt: string; // ISO 8601
}
```

---

### PATCH `/v1/users/me`
Update current user profile.

**Auth:** Bearer JWT

**Request:** `Partial<Pick<UserProfile, 'name' | 'phone' | 'avatarUrl'>>`

**Response:** `ApiResponse<UserProfile>`

---

## 3. Trips (`/v1/trips`)

### GET `/v1/trips`
List trips with filtering.

**Query:**
```typescript
interface ListTripsParams extends ListParams {
  featured?: boolean;
  category?: 'Temples' | 'Nature' | 'Culture' | 'Adventure' | 'Food';
  location?: string;
  minPrice?: number;
  maxPrice?: number;
  durationDays?: number;
  sort?: 'featured' | 'price_asc' | 'price_desc' | 'duration_asc' | 'rating_desc';
}
```

**Response:** `ApiResponse<PaginatedResponse<TripSummary>>`

```typescript
interface TripSummary {
  id: string;
  slug: string;
  name: string;
  coverImageUrl: string | null;
  durationDays: number;
  priceUsd: number;
  category: string;
  location: string;
  ratingAverage: number | null;
  ratingCount: number;
  isFeatured: boolean;
}
```

---

### GET `/v1/trips/:slug`
Get trip detail.

**Response:** `ApiResponse<TripDetail>`

```typescript
interface TripDetail extends TripSummary {
  description: string | null;
  galleryImageUrls: string[];
  itineraryDays: Array<{
    dayNumber: number;
    title: string;
    description: string;
    durationHours: number;
  }>;
  includedItems: string[];
  excludedItems: string[];
  meetingPoint: {
    description: string;
    latitude: number;
    longitude: number;
  } | null;
  cancellationPolicy: string | null;
  maxGuests: number | null;
  status: 'ACTIVE' | 'INACTIVE' | 'DRAFT';
}
```

**Errors:** `TRIP_NOT_FOUND`

---

### GET `/v1/trips/:slug/related`
Get related trips.

**Query:** `{ limit?: number }` // default: 4, max: 8

**Response:** `ApiResponse<TripSummary[]>`

---

### POST `/v1/trips/:slug/share`
Generate shareable link and QR.

**Auth:** Bearer JWT

**Request:** `{ platform: 'wechat' | 'whatsapp' | 'copy' }`

**Response:** `ApiResponse<{ shareUrl: string; qrCodeUrl: string; expiresAt: string }>`

---

## 4. Reviews (`/v1/trips/:tripId/reviews`)

### GET `/v1/trips/:tripId/reviews`
Get paginated reviews.

**Query:** `ListParams`

**Response:** `ApiResponse<PaginatedResponse<Review> & { averageRating: number }>`

```typescript
interface Review {
  id: string;
  userName: string;
  rating: number; // 1-5
  text: string | null;
  photoUrls: string[];
  isVerified: boolean;
  createdAt: string;
}
```

---

### POST `/v1/trips/:tripId/reviews`
Submit a review.

**Auth:** Bearer JWT

**Request:**
```typescript
interface CreateReviewRequest {
  rating: number;      // 1-5, required
  text?: string;       // max 1000 chars
  photoUrls?: string[]; // max 5
}
```

**Response:** `ApiResponse<Review>` (201)

**Errors:** `REVIEW_NO_COMPLETED_BOOKING`

---

### PATCH `/v1/trips/:tripId/reviews/:reviewId`
Update a review (within 7 days).

**Auth:** Bearer JWT

**Request:** `Partial<CreateReviewRequest>`

**Response:** `ApiResponse<Review>`

**Errors:** `REVIEW_NOT_AUTHOR`, `REVIEW_EDIT_WINDOW_EXPIRED`

---

### DELETE `/v1/trips/:tripId/reviews/:reviewId`
Delete a review.

**Auth:** Bearer JWT

**Response:** `204 No Content`

**Errors:** `REVIEW_NOT_AUTHOR`

---

## 5. Favorites (`/v1/users/me/favorites`)

### GET `/v1/users/me/favorites`
Get user's favorite trips.

**Auth:** Bearer JWT

**Query:** `ListParams`

**Response:** `ApiResponse<PaginatedResponse<TripSummary>>`

---

### POST `/v1/users/me/favorites/:tripId`
Add trip to favorites.

**Auth:** Bearer JWT

**Response:** `201` (new) or `200` (already exists)

**Errors:** `FAVORITES_LIMIT_EXCEEDED`

---

### DELETE `/v1/users/me/favorites/:tripId`
Remove from favorites.

**Auth:** Bearer JWT

**Response:** `204 No Content`

**Errors:** `FAVORITE_NOT_FOUND`

---

## 6. Search (`/v1/search`)

### GET `/v1/search`
Global search.

**Query:**
```typescript
interface SearchParams extends ListParams {
  q: string;           // 1-100 chars
  type?: 'all' | 'trip' | 'place' | 'hotel' | 'guide'; // default: 'all'
}
```

**Response:** `ApiResponse<SearchResults>`

```typescript
interface SearchResults {
  trips: { items: TripSummary[]; total: number };
  places: { items: PlaceSummary[]; total: number };
  hotels: { items: HotelSummary[]; total: number };
  guides: { items: GuideSummary[]; total: number };
}
```

---

## 7. Places (`/v1/places`)

### GET `/v1/places`
List places.

**Query:**
```typescript
interface ListPlacesParams extends ListParams {
  category?: 'Temple' | 'Museum' | 'Nature' | 'Market' | 'Beach' | 'Mountain' | 'Other';
  province?: string;
  sort?: 'popularity' | 'name_asc' | 'name_desc';
}
```

**Response:** `ApiResponse<PaginatedResponse<PlaceSummary>>`

```typescript
interface PlaceSummary {
  id: string;
  slug: string;
  name: string;
  coverImageUrl: string | null;
  category: string;
  province: string;
  latitude: number;
  longitude: number;
  ratingAverage: number | null;
  ratingCount: number;
  entryFeeUsd: number | null;
}
```

---

### GET `/v1/places/:slug`
Get place detail.

**Response:** `ApiResponse<PlaceDetail>`

```typescript
interface PlaceDetail extends PlaceSummary {
  description: string;
  visitorTips: string | null;
  dressCode: string | null;
  galleryImageUrls: string[];
  openingHours: {
    monday?: string;
    tuesday?: string;
    // ... sunday
  } | null;
  status: 'ACTIVE' | 'INACTIVE';
}
```

**Errors:** `PLACE_NOT_FOUND`

---

### GET `/v1/places/:slug/related`
Related places.

**Query:** `{ limit?: number }` // default: 6, max: 20

**Response:** `ApiResponse<PlaceSummary[]>`

---

### GET `/v1/places/:slug/nearby-trips`
Trips visiting this place.

**Query:** `{ limit?: number }` // default: 6, max: 20

**Response:** `ApiResponse<TripBrief[]>`

```typescript
interface TripBrief {
  id: string;
  slug: string;
  name: string;
  coverImageUrl: string | null;
  durationDays: number;
  priceFromUsd: number | null;
  ratingAverage: number | null;
}
```

---

### GET `/v1/places/:slug/nearby`
Places near a place.

**Query:** `{ radius?: number; limit?: number }` // radius default: 5000m, max: 50000

**Response:** `ApiResponse<Array<PlaceSummary & { distanceMeters: number }>>`

---

### GET `/v1/places/nearby`
Places near coordinates.

**Query:** `{ lat: number; lng: number; radius?: number; category?: string; limit?: number }`

**Response:** `ApiResponse<Array<PlaceSummary & { distanceMeters: number }>>`

---

## 8. Hotels (`/v1/hotels`)

### GET `/v1/hotels`
List hotels.

**Query:**
```typescript
interface ListHotelsParams extends ListParams {
  location?: string;
  minPrice?: number;
  maxPrice?: number;
  starRating?: number; // 1-5
  amenities?: string[];
  sort?: 'recommended' | 'price_asc' | 'price_desc' | 'rating_desc';
}
```

**Response:** `ApiResponse<PaginatedResponse<HotelSummary>>`

```typescript
interface HotelSummary {
  id: string;
  slug: string;
  name: string;
  coverImageUrl: string | null;
  location: string;
  starRating: number | null;
  pricePerNightFrom: number | null;
  amenities: string[];
  ratingAverage: number | null;
  ratingCount: number;
}
```

---

### GET `/v1/hotels/:slug`
Hotel detail with rooms.

**Response:** `ApiResponse<HotelDetail>`

```typescript
interface HotelDetail extends HotelSummary {
  description: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  galleryImageUrls: string[];
  checkInTime: string | null;
  checkOutTime: string | null;
  cancellationPolicy: string | null;
  rooms: Room[];
}

interface Room {
  id: string;
  name: string;
  description: string | null;
  bedConfiguration: string | null;
  maxOccupancy: number;
  sizeSqm: number | null;
  amenities: string[];
  imageUrls: string[];
  pricePerNightUsd: number;
  totalRooms: number;
}
```

---

### GET `/v1/hotels/:hotelId/rooms/:roomId/availability`
Check room availability.

**Query:** `{ checkInDate: string; checkOutDate: string; guestsAdults: number }`

**Response:** `ApiResponse<RoomAvailability>`

```typescript
interface RoomAvailability {
  isAvailable: boolean;
  priceTotalUsd: number;
  nights: number;
  availabilityPerNight: Record<string, {
    available: number;
    price: number;
  }>;
}
```

---

## 9. Guides (`/v1/guides`)

### GET `/v1/guides`
List guides.

**Query:**
```typescript
interface ListGuidesParams extends ListParams {
  language?: 'EN' | 'ZH' | 'KM';
  specialty?: 'Temples' | 'Nature' | 'Food' | 'History' | 'Adventure';
  location?: string;
  gender?: 'Male' | 'Female' | 'Other' | 'PreferNotToSay';
  isVerified?: boolean;
  minPrice?: number;
  maxPrice?: number;
  sort?: 'recommended' | 'rating_desc' | 'price_asc' | 'price_desc';
}
```

**Response:** `ApiResponse<PaginatedResponse<GuideSummary>>`

```typescript
interface GuideSummary {
  id: string;
  name: string;
  profilePicture: string | null;
  languages: string[];
  specialties: string[];
  location: string;
  gender: string | null;
  pricePerDayUsd: number;
  pricePerHourUsd: number | null;
  isVerified: boolean;
  ratingAverage: number | null;
  ratingCount: number;
}
```

---

### GET `/v1/guides/:id`
Guide detail.

**Response:** `ApiResponse<GuideDetail>`

```typescript
interface GuideDetail extends GuideSummary {
  bio: string;
  experienceYears: number;
  certifications: string[];
  galleryImageUrls: string[];
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
}
```

**Errors:** `GUIDE_NOT_FOUND`

---

### GET `/v1/guides/:id/availability`
Check guide availability.

**Query:** `{ startDate: string; endDate: string }`

**Response:** `ApiResponse<GuideAvailability>`

```typescript
interface GuideAvailability {
  isAvailable: boolean;
  priceEstimateUsd: number | null;
  days: number | null;
  conflictingBookings: Array<{ startDate: string; endDate: string }>;
}
```

---

## 10. Transportation (`/v1/transportation`)

### GET `/v1/transportation/vehicles`
List vehicles.

**Query:** `ListParams & { type?: TransportationType; minCapacity?: number; maxPrice?: number }`

**Response:** `ApiResponse<PaginatedResponse<VehicleSummary>>`

```typescript
interface VehicleSummary {
  id: string;
  type: string;
  name: string;
  capacity: number;
  pricePerDayUsd: number;
  imageUrls: string[];
  amenities: string[];
  isAvailable: boolean;
  ratingAverage: number | null;
  ratingCount: number;
}
```

---

### GET `/v1/transportation/vehicles/:id`
Vehicle detail.

**Response:** `ApiResponse<VehicleDetail>`

---

### GET `/v1/transportation/vehicles/:id/availability`
Check availability.

**Query:** `{ startDate: string; endDate: string }`

**Response:** `ApiResponse<{ isAvailable: boolean; priceTotalUsd: number }>`

---

## 11. Bookings (`/v1/bookings`, `/v1/guides/:guideId/bookings`, etc.)

### POST `/v1/guides/:guideId/bookings`
Create guide booking.

**Auth:** Bearer JWT  
**Idempotency:** Required

**Request:**
```typescript
interface CreateGuideBookingRequest {
  startDate: string;    // ISO date
  endDate: string;
  linkedTripBookingId?: string;
  specialRequests?: string; // max 1000 chars
}
```

**Response:** `ApiResponse<GuideBooking>` (201)

```typescript
interface GuideBooking {
  id: string;
  reference: string;
  guideId: string;
  guideName: string;
  startDate: string;
  endDate: string;
  days: number;
  specialRequests: string | null;
  linkedTripBookingId: string | null;
  status: BookingStatus;
  totalPriceUsd: number;
  holdExpiresAt: string | null;
  createdAt: string;
}
```

**Errors:** `BKNG_UNAVAILABLE`, `BKNG_INVALID_DATE_RANGE`, `GUIDE_SUSPENDED`

---

### POST `/v1/hotels/:hotelId/bookings`
Create hotel booking.

**Auth:** Bearer JWT  
**Idempotency:** Required

**Request:**
```typescript
interface CreateHotelBookingRequest {
  roomId: string;
  checkInDate: string;
  checkOutDate: string;
  guestsAdults: number;     // min 1
  guestsChildren?: number;  // default 0
  specialRequests?: string;
}
```

**Response:** `ApiResponse<HotelBooking>` (201)

```typescript
interface HotelBooking {
  id: string;
  reference: string;
  hotelId: string;
  roomId: string;
  roomName: string;
  checkInDate: string;
  checkOutDate: string;
  guestsAdults: number;
  guestsChildren: number;
  specialRequests: string | null;
  status: BookingStatus;
  totalPriceUsd: number;
  holdExpiresAt: string | null;
  createdAt: string;
}
```

**Errors:** `BKNG_UNAVAILABLE`, `BKNG_EXCEEDS_OCCUPANCY`

---

### POST `/v1/transportation/bookings`
Create transportation booking.

**Auth:** Bearer JWT  
**Idempotency:** Required

**Request:** `{ vehicleId: string; startDate: string; endDate: string; specialRequests?: string }`

**Response:** `ApiResponse<TransportationBooking>` (201)

---

### GET `/v1/bookings`
My bookings (unified).

**Auth:** Bearer JWT

**Query:** `ListParams & { status?: BookingStatus }`

**Response:** `ApiResponse<PaginatedResponse<UnifiedBooking>>`

```typescript
interface UnifiedBooking {
  id: string;
  reference: string;
  type: 'trip' | 'guide' | 'hotel' | 'transportation';
  name: string;           // e.g., guide name, hotel name
  startDate: string;
  endDate: string;
  status: BookingStatus;
  totalPriceUsd: number;
  coverImageUrl: string | null;
}
```

---

### GET `/v1/bookings/:id`
Booking detail.

**Auth:** Bearer JWT

**Response:** `ApiResponse<BookingDetail>` (type varies by booking type)

**Errors:** `BKNG_NOT_FOUND`

---

### PATCH `/v1/bookings/:id`
Update booking (before confirmation).

**Auth:** Bearer JWT

**Request:** `Partial<CreateBookingRequest>`

**Response:** `ApiResponse<Booking>`

**Errors:** `BKNG_CONFIRMED_CANNOT_MODIFY`, `BKNG_UNAVAILABLE`

---

### POST `/v1/bookings/:id/cancel`
Cancel booking.

**Auth:** Bearer JWT

**Request:** `{ reason?: string }` // max 500 chars

**Response:** `ApiResponse<{ refundAmountUsd: number; refundPercentage: number; refundMethod: string | null }>`

**Errors:** `BKNG_NON_REFUNDABLE_WINDOW`, `BKNG_NOT_AUTHOR`

---

### GET `/v1/bookings/:id/qr`
Get booking QR code.

**Auth:** Bearer JWT

**Response:** `ApiResponse<{ qrCodeUrl: string }>`

---

### GET `/v1/bookings/:id/ical`
Download iCalendar file.

**Auth:** Bearer JWT

**Response:** `text/calendar` attachment

---

## 12. Payments (`/v1/payments`)

### POST `/v1/payments/intent`
Create payment intent.

**Auth:** Bearer JWT

**Request:** `{ bookingId: string; method: PaymentMethod }`

**Response:** `ApiResponse<{ clientSecret: string; paymentIntentId: string }>`

---

### POST `/v1/payments/qr`
Generate QR payment.

**Auth:** Bearer JWT

**Request:** `{ bookingId: string; provider: 'bakong' | 'aba' }`

**Response:** `ApiResponse<{ qrCodeUrl: string; expiresAt: string }>`

---

### GET `/v1/payments/:id/status`
Check payment status.

**Auth:** Bearer JWT

**Response:** `ApiResponse<{ status: PaymentStatus; amountUsd: number }>`

---

### POST `/v1/payments/:id/refund`
Request refund.

**Auth:** Bearer JWT

**Response:** `ApiResponse<Refund>`

**Errors:** `PAY_ALREADY_REFUNDED`, `PAY_NON_REFUNDABLE`

---

### POST `/v1/discount-codes/validate`
Validate discount code.

**Request:** `{ code: string; bookingValueUsd: number }`

**Response:** `ApiResponse<{ valid: boolean; discountPercent: number | null; message: string }>`

---

### POST `/v1/webhooks/stripe`
Stripe webhook.

**Headers:** `Stripe-Signature`

**Response:** `200 OK`

**Idempotency:** `stripe_event_id`

---

## 13. Student Discount (`/v1/student-verification`)

### POST `/v1/student-verification`
Submit verification.

**Auth:** Bearer JWT

**Request:** `{ institution: string; studentIdNumber: string; documentUrl: string }`

**Response:** `ApiResponse<StudentVerification>`

---

## 14. Loyalty (`/v1/loyalty`)

### GET `/v1/loyalty/balance`
Get points balance.

**Auth:** Bearer JWT

**Response:** `ApiResponse<{ points: number }>`

---

### GET `/v1/loyalty/transactions`
Get transaction history.

**Auth:** Bearer JWT

**Query:** `ListParams`

**Response:** `ApiResponse<PaginatedResponse<LoyaltyTransaction>>`

```typescript
interface LoyaltyTransaction {
  id: string;
  action: 'EARNED' | 'REDEEMED' | 'EXPIRED';
  points: number;
  description: string | null;
  createdAt: string;
}
```

---

### POST `/v1/loyalty/redeem`
Redeem points.

**Auth:** Bearer JWT

**Request:** `{ points: number; bookingId?: string }`

**Response:** `ApiResponse<{ discountUsd: number }>`

---

## 15. Emergency (`/v1/emergency`)

### POST `/v1/emergency/alerts`
Create emergency alert.

**Auth:** Bearer JWT

**Request:** `{ type: string; description?: string; latitude?: number; longitude?: number }`

**Response:** `ApiResponse<EmergencyAlert>`

---

### GET `/v1/emergency/alerts/:id/status`
Get alert status.

**Auth:** Bearer JWT

**Response:** `ApiResponse<EmergencyAlert>`

---

### POST `/v1/emergency/alerts/:id/acknowledge`
Acknowledge alert.

**Auth:** Bearer JWT (admin)

**Response:** `ApiResponse<EmergencyAlert>`

---

### POST `/v1/emergency/alerts/:id/resolve`
Resolve alert.

**Auth:** Bearer JWT (admin)

**Response:** `ApiResponse<EmergencyAlert>`

---

### POST `/v1/location-shares`
Create location share.

**Auth:** Bearer JWT

**Request:** `{ latitude: number; longitude: number; expiresAt: string }`

**Response:** `ApiResponse<{ token: string; shareUrl: string }>`

---

### GET `/v1/location-shares/:token`
View shared location.

**Response:** `ApiResponse<{ latitude: number; longitude: number; expiresAt: string }>`

---

### POST `/v1/location-shares/:token/revoke`
Revoke share.

**Auth:** Bearer JWT (owner)

**Response:** `ApiResponse<{ message: string }>`

---

### GET `/v1/emergency/contacts`
Get emergency contacts.

**Response:** `ApiResponse<{ contacts: Array<{ name: string; phone: string; type: string }> }>`

---

## 16. AI Tools (`/v1/ai-tools`)

**Auth:** `X-Service-Key` header (NOT Bearer JWT)

### POST `/v1/ai-tools/search/trips`
Search trips for AI.

**Request:** `{ criteria: object }`

**Response:** `ApiResponse<TripSummary[]>`

---

### POST `/v1/ai-tools/bookings`
Create booking from AI context.

**Request:** `{ userId: string; bookingData: object }`

**Response:** `ApiResponse<Booking>`

---

### POST `/v1/ai-tools/payments/qr`
Generate payment QR for AI.

**Request:** `{ bookingId: string }`

**Response:** `ApiResponse<{ qrCodeUrl: string }>`

---

### POST `/v1/ai-tools/budget/estimate`
Estimate trip budget.

**Request:** `{ destinations: string[]; durationDays: number; travelers: number }`

**Response:** `ApiResponse<{ estimateUsd: number; breakdown: object }>`

---

## 17. Admin (`/v1/admin`)

All admin endpoints require `admin` role.

### GET `/v1/admin/student-verifications`
List pending verifications.

**Query:** `ListParams & { status?: StudentVerificationStatus }`

**Response:** `ApiResponse<PaginatedResponse<StudentVerification>>`

---

### POST `/v1/admin/student-verifications/:id/approve`
Approve verification.

**Response:** `ApiResponse<StudentVerification>`

---

### POST `/v1/admin/student-verifications/:id/reject`
Reject verification.

**Request:** `{ reason: string }`

**Response:** `ApiResponse<StudentVerification>`

---

### GET `/v1/admin/analytics`
Key metrics.

**Response:** `ApiResponse<{ users: number; bookings: number; revenue: number }>`

---

### GET `/v1/admin/audit-logs`
Activity log.

**Query:** `ListParams & { userId?: string; action?: AuditAction }`

**Response:** `ApiResponse<PaginatedResponse<AuditLog>>`

---

## 18. Health (`/health`)

### GET `/health`
Basic health check.

**Response:** `{ status: 'ok' | 'error'; info: { database: 'up' | 'down'; redis: 'up' | 'down' } }`

---

## 19. Offline Maps (`/v1/map-packs`)

### GET `/v1/map-packs`
List available map packs.

**Response:** `ApiResponse<Array<{ province: string; sizeMb: number; version: string }>>`

---

### GET `/v1/map-packs/:province/download`
Download map pack.

**Response:** `application/zip` file stream

---

## 20. Festivals (`/v1/festivals`)

### GET `/v1/festivals`
List festivals.

**Query:** `ListParams & { month?: number; year?: number }`

**Response:** `ApiResponse<PaginatedResponse<FestivalSummary>>`

---

### GET `/v1/festivals/:slug`
Festival detail.

**Response:** `ApiResponse<FestivalDetail>`

---

### GET `/v1/festivals/:slug/related-trips`
Related trips.

**Response:** `ApiResponse<TripSummary[]>`

---

## Summary Table

| Module | Endpoints | Auth Required | Idempotency |
|--------|-----------|---------------|-------------|
| Auth | 8 | No | — |
| Users | 2 | Yes | — |
| Trips | 4 | Mixed | — |
| Reviews | 4 | Mixed | — |
| Favorites | 3 | Yes | — |
| Search | 1 | No | — |
| Places | 6 | No | — |
| Hotels | 3 | No | — |
| Guides | 3 | No | — |
| Transportation | 3 | No | — |
| Bookings | 7 | Yes | Yes |
| Payments | 6 | Mixed | Yes |
| Student | 1 | Yes | — |
| Loyalty | 3 | Yes | — |
| Emergency | 7 | Mixed | — |
| AI Tools | 4 | Service Key | Yes |
| Admin | 5 | Admin | — |
| Health | 1 | No | — |
| Offline Maps | 2 | No | — |
| Festivals | 3 | No | — |

**Total:** ~80 endpoints

---

## References

- Module API specs: `docs/modules/*/api.yaml`
- Error codes: `ERROR-REGISTRY.md`
- Schema: `SCHEMA.md`
