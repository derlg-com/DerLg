# DerLg Backend Error Registry

> Every error code in the system. Before adding a new error code, check this document. No duplicates. No ad-hoc strings.

---

## Code Format

```
<DOMAIN>_<DESCRIPTOR>
```

- `DOMAIN`: 2–5 letter abbreviation (e.g., `AUTH`, `BKNG`, `PAY`)
- `DESCRIPTOR`: `SCREAMING_SNAKE_CASE` describing the error

---

## Auth (`AUTH_`)

| Code | HTTP | Message | Used By |
|------|------|---------|---------|
| `AUTH_INVALID_CREDENTIALS` | 401 | Invalid email or password | Login |
| `AUTH_EMAIL_EXISTS` | 409 | An account with this email already exists | Register |
| `AUTH_INVALID_PASSWORD` | 400 | Password must be at least 8 characters | Register |
| `AUTH_ACCOUNT_SUSPENDED` | 403 | Your account has been suspended | Login |
| `AUTH_INVALID_REFRESH_TOKEN` | 401 | Invalid or expired refresh token | Refresh |
| `AUTH_INVALID_TOKEN` | 401 | Invalid authentication token | Middleware |
| `AUTH_TOKEN_EXPIRED` | 401 | Authentication token has expired | Middleware |
| `AUTH_UNAUTHORIZED` | 401 | Authentication required | Protected routes |
| `AUTH_FORBIDDEN` | 403 | You do not have permission to access this resource | RBAC |
| `AUTH_OAUTH_FAILED` | 400 | Google authentication failed | Google OAuth |
| `AUTH_RESET_TOKEN_INVALID` | 400 | Invalid or expired reset token | Reset password |

---

## Validation (`VAL_`)

| Code | HTTP | Message | Used By |
|------|------|---------|---------|
| `VAL_INVALID_INPUT` | 400 | Invalid input data | Generic validation |
| `VAL_INVALID_DATE_RANGE` | 400 | End date must be after start date | Bookings |
| `VAL_INVALID_UUID` | 400 | Invalid ID format | Path params |
| `VAL_INVALID_EMAIL` | 400 | Invalid email format | Register |
| `VAL_MISSING_REQUIRED_FIELD` | 400 | Missing required field | Generic |
| `VAL_STRING_TOO_LONG` | 400 | Input exceeds maximum length | Text fields |
| `VAL_INVALID_ENUM_VALUE` | 400 | Invalid value for enum field | Enum fields |
| `VAL_NEGATIVE_NUMBER` | 400 | Value must be a positive number | Price, quantity |
| `VAL_FUTURE_DATE_REQUIRED` | 400 | Date must be in the future | Bookings |
| `VAL_INVALID_COORDINATES` | 400 | Invalid latitude or longitude | Location |

---

## User (`USR_`)

| Code | HTTP | Message | Used By |
|------|------|---------|---------|
| `USR_NOT_FOUND` | 404 | User not found | User lookup |
| `USR_PROFILE_INCOMPLETE` | 422 | Please complete your profile before booking | Booking |
| `USR_ALREADY_VERIFIED` | 409 | User is already verified | Verification |

---

## Trip (`TRIP_`)

| Code | HTTP | Message | Used By |
|------|------|---------|---------|
| `TRIP_NOT_FOUND` | 404 | Trip not found | Trip detail |
| `TRIP_INACTIVE` | 403 | This trip is currently unavailable | Booking |
| `TRIP_NO_AVAILABILITY` | 409 | No availability for selected dates | Booking |

---

## Place (`PLACE_`)

| Code | HTTP | Message | Used By |
|------|------|---------|---------|
| `PLACE_NOT_FOUND` | 404 | Place not found | Place detail |
| `PLACE_INACTIVE` | 403 | This place is currently unavailable | — |

---

## Hotel (`HTL_`)

| Code | HTTP | Message | Used By |
|------|------|---------|---------|
| `HTL_NOT_FOUND` | 404 | Hotel not found | Hotel detail |
| `HTL_ROOM_NOT_FOUND` | 404 | Room not found | Room booking |
| `HTL_NO_AVAILABILITY` | 409 | No rooms available for selected dates | Availability |
| `HTL_EXCEEDS_OCCUPANCY` | 400 | Guest count exceeds room capacity | Booking |

---

## Guide (`GDE_`)

| Code | HTTP | Message | Used By |
|------|------|---------|---------|
| `GDE_NOT_FOUND` | 404 | Guide not found | Guide detail |
| `GDE_UNAVAILABLE` | 409 | Guide is not available for selected dates | Booking |
| `GDE_SUSPENDED` | 403 | This guide is currently suspended | Booking |
| `GDE_INACTIVE` | 403 | This guide is currently inactive | Booking |

---

## Transportation (`TRNS_`)

| Code | HTTP | Message | Used By |
|------|------|---------|---------|
| `TRNS_VEHICLE_NOT_FOUND` | 404 | Vehicle not found | Vehicle detail |
| `TRNS_UNAVAILABLE` | 409 | Vehicle is not available for selected dates | Booking |

---

## Booking (`BKNG_`)

| Code | HTTP | Message | Used By |
|------|------|---------|---------|
| `BKNG_NOT_FOUND` | 404 | Booking not found | Booking detail |
| `BKNG_UNAVAILABLE` | 409 | Selected dates are no longer available | Create/Update |
| `BKNG_INVALID_DATE_RANGE` | 400 | Invalid date range | Create |
| `BKNG_CONFIRMED_CANNOT_MODIFY` | 403 | Confirmed bookings cannot be modified | Update |
| `BKNG_NON_REFUNDABLE_WINDOW` | 422 | Cancellation is no longer refundable | Cancel |
| `BKNG_NOT_AUTHOR` | 403 | You are not authorized to modify this booking | Update/Cancel |
| `BKNG_ALREADY_CANCELLED` | 400 | This booking has already been cancelled | Cancel |
| `BKNG_EXPIRED` | 400 | This booking has expired | Payment |
| `BKNG_PAYMENT_PENDING` | 409 | Payment is still being processed | Cancel |
| `BKNG_EXCEEDS_OCCUPANCY` | 400 | Guest count exceeds maximum capacity | Hotel booking |

---

## Payment (`PAY_`)

| Code | HTTP | Message | Used By |
|------|------|---------|---------|
| `PAY_INTENT_FAILED` | 400 | Failed to create payment intent | Create intent |
| `PAY_NOT_FOUND` | 404 | Payment not found | Status check |
| `PAY_ALREADY_REFUNDED` | 400 | This payment has already been refunded | Refund |
| `PAY_NON_REFUNDABLE` | 422 | This payment is not eligible for refund | Refund |
| `PAY_STRIPE_ERROR` | 502 | Payment processor error | Stripe ops |
| `PAY_WEBHOOK_INVALID` | 400 | Invalid webhook signature | Stripe webhook |
| `PAY_WEBHOOK_DUPLICATE` | 200 | Webhook already processed (idempotent) | Stripe webhook |
| `PAY_AMOUNT_MISMATCH` | 400 | Payment amount does not match booking total | Webhook |
| `PAY_METHOD_NOT_SUPPORTED` | 400 | Payment method not supported | Create intent |
| `PAY_QR_EXPIRED` | 400 | QR code has expired | QR payment |

---

## Review (`REV_`)

| Code | HTTP | Message | Used By |
|------|------|---------|---------|
| `REV_NOT_FOUND` | 404 | Review not found | Update/Delete |
| `REV_NOT_AUTHOR` | 403 | You can only modify your own reviews | Update/Delete |
| `REV_NO_COMPLETED_BOOKING` | 403 | You must complete a booking to leave a review | Create |
| `REV_EDIT_WINDOW_EXPIRED` | 403 | Reviews can only be edited within 7 days | Update |
| `REV_ALREADY_EXISTS` | 409 | You have already reviewed this trip | Create |
| `REV_INVALID_RATING` | 400 | Rating must be between 1 and 5 | Create |

---

## Favorite (`FAV_`)

| Code | HTTP | Message | Used By |
|------|------|---------|---------|
| `FAVORITE_NOT_FOUND` | 404 | Favorite not found | Remove |
| `FAVORITES_LIMIT_EXCEEDED` | 400 | You can only save up to 100 favorites | Add |
| `FAVORITE_ALREADY_EXISTS` | 409 | This trip is already in your favorites | Add |

---

## Search (`SRCH_`)

| Code | HTTP | Message | Used By |
|------|------|---------|---------|
| `SRCH_QUERY_TOO_SHORT` | 400 | Search query must be at least 1 character | Search |
| `SRCH_QUERY_TOO_LONG` | 400 | Search query must not exceed 100 characters | Search |

---

## Student Verification (`STD_`)

| Code | HTTP | Message | Used By |
|------|------|---------|---------|
| `STD_VERIFICATION_NOT_FOUND` | 404 | Verification request not found | Admin review |
| `STD_ALREADY_VERIFIED` | 409 | You are already verified as a student | Submit |
| `STD_VERIFICATION_PENDING` | 409 | Your verification is still pending | Submit |
| `STD_DOCUMENT_REQUIRED` | 400 | Student ID document is required | Submit |

---

## Loyalty (`LYL_`)

| Code | HTTP | Message | Used By |
|------|------|---------|---------|
| `LYL_INSUFFICIENT_POINTS` | 400 | Insufficient loyalty points | Redeem |
| `LYL_INVALID_REDEMPTION` | 400 | Invalid redemption amount | Redeem |
| `LYL_TRANSACTION_NOT_FOUND` | 404 | Transaction not found | Lookup |

---

## Emergency (`EMRG_`)

| Code | HTTP | Message | Used By |
|------|------|---------|---------|
| `EMRG_ALERT_NOT_FOUND` | 404 | Emergency alert not found | Status/Resolve |
| `EMRG_ALERT_ALREADY_RESOLVED` | 400 | This alert has already been resolved | Resolve |
| `EMRG_LOCATION_SHARE_NOT_FOUND` | 404 | Location share not found | View/Revoke |
| `EMRG_LOCATION_SHARE_EXPIRED` | 400 | This location share has expired | View |
| `EMRG_LOCATION_SHARE_REVOKED` | 400 | This location share has been revoked | View |

---

## Discount Code (`DSC_`)

| Code | HTTP | Message | Used By |
|------|------|---------|---------|
| `DSC_NOT_FOUND` | 404 | Discount code not found | Validate |
| `DSC_EXPIRED` | 400 | This discount code has expired | Validate |
| `DSC_USAGE_LIMIT_REACHED` | 400 | This discount code has reached its usage limit | Validate |
| `DSC_MIN_VALUE_NOT_MET` | 400 | Booking value does not meet minimum for this code | Validate |

---

## AI Tools (`AI_`)

| Code | HTTP | Message | Used By |
|------|------|---------|---------|
| `AI_INVALID_SERVICE_KEY` | 401 | Invalid service key | All AI endpoints |
| `AI_SERVICE_UNAVAILABLE` | 503 | AI service is temporarily unavailable | All AI endpoints |
| `AI_TIMEOUT` | 504 | AI request timed out | All AI endpoints |
| `AI_INVALID_CONTEXT` | 400 | Invalid or incomplete booking context | Booking tool |

---

## Rate Limit (`RATE_`)

| Code | HTTP | Message | Used By |
|------|------|---------|---------|
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests, please try again later | Throttler |

---

## Generic (`*`)

| Code | HTTP | Message | Used By |
|------|------|---------|---------|
| `NOT_FOUND` | 404 | Resource not found | Generic |
| `UNAUTHORIZED` | 401 | Authentication required | Generic |
| `FORBIDDEN` | 403 | Access denied | Generic |
| `INTERNAL_ERROR` | 500 | An unexpected error occurred | Catch-all |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable | Maintenance |
| `CONFLICT` | 409 | Resource conflict | Generic |
| `UNPROCESSABLE_ENTITY` | 422 | Request could not be processed | Business rules |
| `DUPLICATE_ENTRY` | 409 | This record already exists | Prisma P2002 |
| `RECORD_NOT_FOUND` | 404 | Record not found | Prisma P2025 |

---

## Usage by Module

```
Auth:        AUTH_* (11 codes)
Validation:  VAL_*  (10 codes)
User:        USR_*  (3 codes)
Trip:        TRIP_* (3 codes)
Place:       PLACE_* (2 codes)
Hotel:       HTL_*  (4 codes)
Guide:       GDE_*  (4 codes)
Transport:   TRNS_* (2 codes)
Booking:     BKNG_* (10 codes)
Payment:     PAY_*  (10 codes)
Review:      REV_*  (6 codes)
Favorite:    FAV_*  (3 codes)
Search:      SRCH_* (2 codes)
Student:     STD_*  (4 codes)
Loyalty:     LYL_*  (3 codes)
Emergency:   EMRG_* (5 codes)
Discount:    DSC_*  (4 codes)
AI:          AI_*   (4 codes)
Rate Limit:  RATE_* (1 code)
Generic:     *      (9 codes)
─────────────────────────────────
Total:       ~100 codes
```

---

## Adding New Error Codes

1. Check this document for existing codes in the domain
2. Follow the naming convention: `DOMAIN_DESCRIPTOR`
3. Add to this table with HTTP status, message, and usage
4. Add to `src/common/errors/error-codes.ts` enum
5. Add to `ERROR-REGISTRY.md`

---

## References

- Constitution error handling rules: `CONSTITUTION.md` §2.2, §2.3
- API contract error mappings: `API-CONTRACT.md`
- Module API specs: `docs/modules/*/api.yaml`
