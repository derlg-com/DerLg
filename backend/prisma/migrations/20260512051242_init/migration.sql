-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('user', 'guide', 'admin', 'student');

-- CreateEnum
CREATE TYPE "booking_status" AS ENUM ('reserved', 'confirmed', 'payment_failed', 'expired', 'cancelled', 'completed', 'no_show');

-- CreateEnum
CREATE TYPE "booking_type" AS ENUM ('trip_package', 'hotel_room', 'transportation', 'tour_guide');

-- CreateEnum
CREATE TYPE "payment_provider" AS ENUM ('stripe', 'bakong');

-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('pending', 'processing', 'succeeded', 'failed', 'refunded', 'partially_refunded');

-- CreateEnum
CREATE TYPE "discount_type" AS ENUM ('percentage', 'fixed_amount');

-- CreateEnum
CREATE TYPE "loyalty_transaction_type" AS ENUM ('earned', 'redeemed', 'adjusted', 'expired', 'referral');

-- CreateEnum
CREATE TYPE "verification_status" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "emergency_alert_type" AS ENUM ('sos', 'medical', 'theft', 'lost');

-- CreateEnum
CREATE TYPE "emergency_alert_status" AS ENUM ('triggered', 'acknowledged', 'resolved', 'cancelled');

-- CreateEnum
CREATE TYPE "notification_channel" AS ENUM ('email', 'push', 'in_app');

-- CreateEnum
CREATE TYPE "notification_status" AS ENUM ('pending', 'sent', 'delivered', 'failed', 'read');

-- CreateEnum
CREATE TYPE "supported_language" AS ENUM ('en', 'zh', 'km');

-- CreateEnum
CREATE TYPE "place_category" AS ENUM ('temple', 'museum', 'nature', 'market', 'beach', 'mountain');

-- CreateEnum
CREATE TYPE "trip_category" AS ENUM ('temples', 'nature', 'culture', 'adventure', 'food');

-- CreateEnum
CREATE TYPE "vehicle_type" AS ENUM ('tuk_tuk', 'van', 'bus');

-- CreateEnum
CREATE TYPE "pricing_model" AS ENUM ('per_day', 'per_km');

-- CreateEnum
CREATE TYPE "audit_event_type" AS ENUM ('booking_created', 'booking_confirmed', 'booking_cancelled', 'payment_succeeded', 'payment_failed', 'refund_issued', 'loyalty_earned', 'loyalty_redeemed', 'user_registered', 'user_login', 'admin_action', 'security_event');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "supabase_uid" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "user_role" NOT NULL DEFAULT 'user',
    "preferred_language" "supported_language" NOT NULL DEFAULT 'en',
    "full_name" TEXT,
    "phone" TEXT,
    "avatar_url" TEXT,
    "emergency_contact_name" TEXT,
    "emergency_contact_phone" TEXT,
    "loyalty_points" INTEGER NOT NULL DEFAULT 0,
    "is_student_verified" BOOLEAN NOT NULL DEFAULT false,
    "referral_code" TEXT,
    "referred_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "token_id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "places" (
    "id" UUID NOT NULL,
    "category" "place_category" NOT NULL,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "entry_fee_usd" DECIMAL(10,2),
    "opening_hours" TEXT,
    "dress_code" TEXT,
    "website" TEXT,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "places_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "place_translations" (
    "id" UUID NOT NULL,
    "place_id" UUID NOT NULL,
    "language" "supported_language" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "visitor_tips" TEXT,
    "address" TEXT,

    CONSTRAINT "place_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trips" (
    "id" UUID NOT NULL,
    "category" "trip_category" NOT NULL,
    "duration_days" INTEGER NOT NULL,
    "base_price_usd" DECIMAL(10,2) NOT NULL,
    "max_capacity" INTEGER NOT NULL DEFAULT 10,
    "cover_image" TEXT,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "trips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_translations" (
    "id" UUID NOT NULL,
    "trip_id" UUID NOT NULL,
    "language" "supported_language" NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "description" TEXT,
    "included_items" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "excluded_items" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cancellation_policy" TEXT,
    "meeting_point" TEXT,

    CONSTRAINT "trip_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_itinerary_items" (
    "id" UUID NOT NULL,
    "trip_id" UUID NOT NULL,
    "day_number" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "place_id" UUID,
    "hotel_id" UUID,

    CONSTRAINT "trip_itinerary_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_itinerary_item_translations" (
    "id" UUID NOT NULL,
    "itinerary_item_id" UUID NOT NULL,
    "language" "supported_language" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "trip_itinerary_item_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "festivals" (
    "id" UUID NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "province" TEXT,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "festivals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "festival_translations" (
    "id" UUID NOT NULL,
    "festival_id" UUID NOT NULL,
    "language" "supported_language" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,

    CONSTRAINT "festival_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hotels" (
    "id" UUID NOT NULL,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "star_rating" INTEGER,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "amenities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "hotels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hotel_translations" (
    "id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "language" "supported_language" NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "description" TEXT,

    CONSTRAINT "hotel_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hotel_rooms" (
    "id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "room_type" TEXT NOT NULL,
    "max_occupancy" INTEGER NOT NULL DEFAULT 2,
    "price_usd" DECIMAL(10,2) NOT NULL,
    "amenities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "hotel_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transportation_vehicles" (
    "id" UUID NOT NULL,
    "vehicle_type" "vehicle_type" NOT NULL,
    "name" TEXT NOT NULL,
    "license_plate" TEXT,
    "capacity" INTEGER NOT NULL DEFAULT 4,
    "pricing_model" "pricing_model" NOT NULL,
    "price_usd" DECIMAL(10,2) NOT NULL,
    "province" TEXT NOT NULL,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "transportation_vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guides" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "bio" TEXT,
    "avatar_url" TEXT,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "price_per_day_usd" DECIMAL(10,2) NOT NULL,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "province" TEXT NOT NULL,
    "provinces" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "guides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guide_languages" (
    "id" UUID NOT NULL,
    "guide_id" UUID NOT NULL,
    "language" "supported_language" NOT NULL,

    CONSTRAINT "guide_languages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guide_specialities" (
    "id" UUID NOT NULL,
    "guide_id" UUID NOT NULL,
    "speciality" TEXT NOT NULL,

    CONSTRAINT "guide_specialities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "status" "booking_status" NOT NULL DEFAULT 'reserved',
    "expires_at" TIMESTAMPTZ NOT NULL,
    "subtotal_usd" DECIMAL(10,2) NOT NULL,
    "discount_usd" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "loyalty_discount_usd" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total_usd" DECIMAL(10,2) NOT NULL,
    "cancelled_at" TIMESTAMPTZ,
    "cancel_reason" TEXT,
    "refund_percentage" INTEGER,
    "qr_code_url" TEXT,
    "passenger_count" INTEGER NOT NULL DEFAULT 1,
    "room_count" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_items" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "booking_type" "booking_type" NOT NULL,
    "trip_id" UUID,
    "hotel_room_id" UUID,
    "vehicle_id" UUID,
    "guide_id" UUID,
    "date" DATE NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price_usd" DECIMAL(10,2) NOT NULL,
    "subtotal_usd" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "booking_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" "payment_provider" NOT NULL,
    "provider_payment_id" TEXT,
    "amount_usd" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "exchange_rate" DECIMAL(10,6) DEFAULT 1.0,
    "status" "payment_status" NOT NULL DEFAULT 'pending',
    "refunded_amount_usd" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "stripe_payment_intent_id" TEXT,
    "client_secret" TEXT,
    "qr_code_url" TEXT,
    "qr_expires_at" TIMESTAMPTZ,
    "idempotency_key" TEXT,
    "paid_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "amount_usd" DECIMAL(10,2) NOT NULL,
    "provider_refund_id" TEXT,
    "reason" TEXT NOT NULL,
    "percentage" INTEGER NOT NULL,
    "status" "payment_status" NOT NULL DEFAULT 'pending',
    "processed_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stripe_events" (
    "id" UUID NOT NULL,
    "stripe_event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "processed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stripe_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discount_codes" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "discount_type" "discount_type" NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "max_uses" INTEGER,
    "current_uses" INTEGER NOT NULL DEFAULT 0,
    "min_booking_usd" DECIMAL(10,2),
    "valid_from" TIMESTAMPTZ NOT NULL,
    "valid_until" TIMESTAMPTZ NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "festival_id" UUID,
    "booking_type" "booking_type",
    "user_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discount_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_transactions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "loyalty_transaction_type" NOT NULL,
    "points" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "booking_id" UUID,
    "reference" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_verifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "id_card_image_url" TEXT NOT NULL,
    "selfie_image_url" TEXT NOT NULL,
    "status" "verification_status" NOT NULL DEFAULT 'pending',
    "reviewed_by_id" UUID,
    "review_notes" TEXT,
    "reviewed_at" TIMESTAMPTZ,
    "expires_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "student_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emergency_alerts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "alert_type" "emergency_alert_type" NOT NULL,
    "status" "emergency_alert_status" NOT NULL DEFAULT 'triggered',
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "accuracy_meters" DECIMAL(7,2),
    "acknowledged_at" TIMESTAMPTZ,
    "acknowledged_by" UUID,
    "resolved_at" TIMESTAMPTZ,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "emergency_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emergency_contacts" (
    "id" UUID NOT NULL,
    "province" TEXT NOT NULL,
    "service_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "emergency_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "location_shares" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "share_token" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "update_interval_minutes" INTEGER NOT NULL DEFAULT 5,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "last_update_at" TIMESTAMPTZ,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "location_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "trip_id" UUID,
    "hotel_id" UUID,
    "guide_id" UUID,
    "rating" INTEGER NOT NULL,
    "text" TEXT,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_verified_booking" BOOLEAN NOT NULL DEFAULT false,
    "is_flagged" BOOLEAN NOT NULL DEFAULT false,
    "flag_reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorites" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "trip_id" UUID,
    "hotel_id" UUID,
    "place_id" UUID,
    "guide_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_chat_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "language" "supported_language" NOT NULL DEFAULT 'en',
    "last_message_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_chat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_chat_messages" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "message_type" TEXT NOT NULL DEFAULT 'text',
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "channel" "notification_channel" NOT NULL,
    "status" "notification_status" NOT NULL DEFAULT 'pending',
    "title" TEXT NOT NULL,
    "body" TEXT,
    "language" "supported_language" NOT NULL DEFAULT 'en',
    "template_key" TEXT,
    "booking_id" UUID,
    "metadata" JSONB,
    "sent_at" TIMESTAMPTZ,
    "delivered_at" TIMESTAMPTZ,
    "read_at" TIMESTAMPTZ,
    "error_message" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_device_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "push_device_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_rates" (
    "id" UUID NOT NULL,
    "from_currency" TEXT NOT NULL,
    "to_currency" TEXT NOT NULL,
    "rate" DECIMAL(12,6) NOT NULL,
    "fetched_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "event_type" "audit_event_type" NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_supabase_uid_key" ON "users"("supabase_uid");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_referral_code_key" ON "users"("referral_code");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_id_key" ON "refresh_tokens"("token_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "places_category_idx" ON "places"("category");

-- CreateIndex
CREATE INDEX "places_is_published_idx" ON "places"("is_published");

-- CreateIndex
CREATE INDEX "place_translations_place_id_idx" ON "place_translations"("place_id");

-- CreateIndex
CREATE UNIQUE INDEX "place_translations_place_id_language_key" ON "place_translations"("place_id", "language");

-- CreateIndex
CREATE INDEX "trips_category_idx" ON "trips"("category");

-- CreateIndex
CREATE INDEX "trips_is_published_idx" ON "trips"("is_published");

-- CreateIndex
CREATE INDEX "trip_translations_trip_id_idx" ON "trip_translations"("trip_id");

-- CreateIndex
CREATE UNIQUE INDEX "trip_translations_trip_id_language_key" ON "trip_translations"("trip_id", "language");

-- CreateIndex
CREATE INDEX "trip_itinerary_items_trip_id_day_number_sort_order_idx" ON "trip_itinerary_items"("trip_id", "day_number", "sort_order");

-- CreateIndex
CREATE INDEX "trip_itinerary_item_translations_itinerary_item_id_idx" ON "trip_itinerary_item_translations"("itinerary_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "trip_itinerary_item_translations_itinerary_item_id_language_key" ON "trip_itinerary_item_translations"("itinerary_item_id", "language");

-- CreateIndex
CREATE INDEX "festivals_start_date_end_date_idx" ON "festivals"("start_date", "end_date");

-- CreateIndex
CREATE INDEX "festival_translations_festival_id_idx" ON "festival_translations"("festival_id");

-- CreateIndex
CREATE UNIQUE INDEX "festival_translations_festival_id_language_key" ON "festival_translations"("festival_id", "language");

-- CreateIndex
CREATE INDEX "hotels_is_published_idx" ON "hotels"("is_published");

-- CreateIndex
CREATE INDEX "hotel_translations_hotel_id_idx" ON "hotel_translations"("hotel_id");

-- CreateIndex
CREATE UNIQUE INDEX "hotel_translations_hotel_id_language_key" ON "hotel_translations"("hotel_id", "language");

-- CreateIndex
CREATE INDEX "hotel_rooms_hotel_id_idx" ON "hotel_rooms"("hotel_id");

-- CreateIndex
CREATE INDEX "transportation_vehicles_vehicle_type_idx" ON "transportation_vehicles"("vehicle_type");

-- CreateIndex
CREATE INDEX "transportation_vehicles_province_idx" ON "transportation_vehicles"("province");

-- CreateIndex
CREATE INDEX "transportation_vehicles_is_active_idx" ON "transportation_vehicles"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "guides_user_id_key" ON "guides"("user_id");

-- CreateIndex
CREATE INDEX "guides_province_idx" ON "guides"("province");

-- CreateIndex
CREATE INDEX "guides_is_verified_idx" ON "guides"("is_verified");

-- CreateIndex
CREATE INDEX "guides_is_active_idx" ON "guides"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "guide_languages_guide_id_language_key" ON "guide_languages"("guide_id", "language");

-- CreateIndex
CREATE UNIQUE INDEX "guide_specialities_guide_id_speciality_key" ON "guide_specialities"("guide_id", "speciality");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_reference_key" ON "bookings"("reference");

-- CreateIndex
CREATE INDEX "bookings_user_id_idx" ON "bookings"("user_id");

-- CreateIndex
CREATE INDEX "bookings_status_idx" ON "bookings"("status");

-- CreateIndex
CREATE INDEX "bookings_expires_at_idx" ON "bookings"("expires_at");

-- CreateIndex
CREATE INDEX "bookings_start_date_idx" ON "bookings"("start_date");

-- CreateIndex
CREATE INDEX "bookings_created_at_idx" ON "bookings"("created_at");

-- CreateIndex
CREATE INDEX "booking_items_booking_id_idx" ON "booking_items"("booking_id");

-- CreateIndex
CREATE INDEX "booking_items_booking_type_idx" ON "booking_items"("booking_type");

-- CreateIndex
CREATE INDEX "booking_items_trip_id_idx" ON "booking_items"("trip_id");

-- CreateIndex
CREATE INDEX "booking_items_hotel_room_id_idx" ON "booking_items"("hotel_room_id");

-- CreateIndex
CREATE INDEX "booking_items_vehicle_id_idx" ON "booking_items"("vehicle_id");

-- CreateIndex
CREATE INDEX "booking_items_guide_id_idx" ON "booking_items"("guide_id");

-- CreateIndex
CREATE INDEX "booking_items_date_idx" ON "booking_items"("date");

-- CreateIndex
CREATE UNIQUE INDEX "payments_idempotency_key_key" ON "payments"("idempotency_key");

-- CreateIndex
CREATE INDEX "payments_booking_id_idx" ON "payments"("booking_id");

-- CreateIndex
CREATE INDEX "payments_user_id_idx" ON "payments"("user_id");

-- CreateIndex
CREATE INDEX "payments_provider_idx" ON "payments"("provider");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE INDEX "payments_stripe_payment_intent_id_idx" ON "payments"("stripe_payment_intent_id");

-- CreateIndex
CREATE INDEX "refunds_payment_id_idx" ON "refunds"("payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "stripe_events_stripe_event_id_key" ON "stripe_events"("stripe_event_id");

-- CreateIndex
CREATE INDEX "stripe_events_stripe_event_id_idx" ON "stripe_events"("stripe_event_id");

-- CreateIndex
CREATE UNIQUE INDEX "discount_codes_code_key" ON "discount_codes"("code");

-- CreateIndex
CREATE INDEX "discount_codes_code_idx" ON "discount_codes"("code");

-- CreateIndex
CREATE INDEX "discount_codes_valid_from_valid_until_idx" ON "discount_codes"("valid_from", "valid_until");

-- CreateIndex
CREATE INDEX "discount_codes_is_active_idx" ON "discount_codes"("is_active");

-- CreateIndex
CREATE INDEX "loyalty_transactions_user_id_idx" ON "loyalty_transactions"("user_id");

-- CreateIndex
CREATE INDEX "loyalty_transactions_type_idx" ON "loyalty_transactions"("type");

-- CreateIndex
CREATE INDEX "loyalty_transactions_booking_id_idx" ON "loyalty_transactions"("booking_id");

-- CreateIndex
CREATE INDEX "loyalty_transactions_created_at_idx" ON "loyalty_transactions"("created_at");

-- CreateIndex
CREATE INDEX "student_verifications_user_id_idx" ON "student_verifications"("user_id");

-- CreateIndex
CREATE INDEX "student_verifications_status_idx" ON "student_verifications"("status");

-- CreateIndex
CREATE INDEX "emergency_alerts_user_id_idx" ON "emergency_alerts"("user_id");

-- CreateIndex
CREATE INDEX "emergency_alerts_status_idx" ON "emergency_alerts"("status");

-- CreateIndex
CREATE INDEX "emergency_alerts_alert_type_idx" ON "emergency_alerts"("alert_type");

-- CreateIndex
CREATE INDEX "emergency_alerts_created_at_idx" ON "emergency_alerts"("created_at");

-- CreateIndex
CREATE INDEX "emergency_contacts_province_idx" ON "emergency_contacts"("province");

-- CreateIndex
CREATE UNIQUE INDEX "emergency_contacts_province_service_name_key" ON "emergency_contacts"("province", "service_name");

-- CreateIndex
CREATE UNIQUE INDEX "location_shares_share_token_key" ON "location_shares"("share_token");

-- CreateIndex
CREATE INDEX "location_shares_user_id_idx" ON "location_shares"("user_id");

-- CreateIndex
CREATE INDEX "location_shares_share_token_idx" ON "location_shares"("share_token");

-- CreateIndex
CREATE INDEX "location_shares_expires_at_idx" ON "location_shares"("expires_at");

-- CreateIndex
CREATE INDEX "reviews_user_id_idx" ON "reviews"("user_id");

-- CreateIndex
CREATE INDEX "reviews_trip_id_idx" ON "reviews"("trip_id");

-- CreateIndex
CREATE INDEX "reviews_hotel_id_idx" ON "reviews"("hotel_id");

-- CreateIndex
CREATE INDEX "reviews_guide_id_idx" ON "reviews"("guide_id");

-- CreateIndex
CREATE INDEX "reviews_rating_idx" ON "reviews"("rating");

-- CreateIndex
CREATE UNIQUE INDEX "favorites_user_id_trip_id_key" ON "favorites"("user_id", "trip_id");

-- CreateIndex
CREATE UNIQUE INDEX "favorites_user_id_hotel_id_key" ON "favorites"("user_id", "hotel_id");

-- CreateIndex
CREATE UNIQUE INDEX "favorites_user_id_place_id_key" ON "favorites"("user_id", "place_id");

-- CreateIndex
CREATE UNIQUE INDEX "favorites_user_id_guide_id_key" ON "favorites"("user_id", "guide_id");

-- CreateIndex
CREATE INDEX "ai_chat_sessions_user_id_idx" ON "ai_chat_sessions"("user_id");

-- CreateIndex
CREATE INDEX "ai_chat_sessions_last_message_at_idx" ON "ai_chat_sessions"("last_message_at");

-- CreateIndex
CREATE INDEX "ai_chat_messages_session_id_created_at_idx" ON "ai_chat_messages"("session_id", "created_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "notifications_status_idx" ON "notifications"("status");

-- CreateIndex
CREATE INDEX "notifications_channel_idx" ON "notifications"("channel");

-- CreateIndex
CREATE INDEX "notifications_booking_id_idx" ON "notifications"("booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "push_device_tokens_token_key" ON "push_device_tokens"("token");

-- CreateIndex
CREATE INDEX "push_device_tokens_user_id_idx" ON "push_device_tokens"("user_id");

-- CreateIndex
CREATE INDEX "exchange_rates_fetched_at_idx" ON "exchange_rates"("fetched_at");

-- CreateIndex
CREATE UNIQUE INDEX "exchange_rates_from_currency_to_currency_key" ON "exchange_rates"("from_currency", "to_currency");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_event_type_idx" ON "audit_logs"("event_type");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- AddForeignKey
ALTER TABLE "place_translations" ADD CONSTRAINT "place_translations_place_id_fkey" FOREIGN KEY ("place_id") REFERENCES "places"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_translations" ADD CONSTRAINT "trip_translations_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_itinerary_items" ADD CONSTRAINT "trip_itinerary_items_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_itinerary_items" ADD CONSTRAINT "trip_itinerary_items_place_id_fkey" FOREIGN KEY ("place_id") REFERENCES "places"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_itinerary_items" ADD CONSTRAINT "trip_itinerary_items_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_itinerary_item_translations" ADD CONSTRAINT "trip_itinerary_item_translations_itinerary_item_id_fkey" FOREIGN KEY ("itinerary_item_id") REFERENCES "trip_itinerary_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "festival_translations" ADD CONSTRAINT "festival_translations_festival_id_fkey" FOREIGN KEY ("festival_id") REFERENCES "festivals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_translations" ADD CONSTRAINT "hotel_translations_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_rooms" ADD CONSTRAINT "hotel_rooms_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guide_languages" ADD CONSTRAINT "guide_languages_guide_id_fkey" FOREIGN KEY ("guide_id") REFERENCES "guides"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guide_specialities" ADD CONSTRAINT "guide_specialities_guide_id_fkey" FOREIGN KEY ("guide_id") REFERENCES "guides"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_items" ADD CONSTRAINT "booking_items_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_items" ADD CONSTRAINT "booking_items_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_items" ADD CONSTRAINT "booking_items_hotel_room_id_fkey" FOREIGN KEY ("hotel_room_id") REFERENCES "hotel_rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_items" ADD CONSTRAINT "booking_items_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "transportation_vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_items" ADD CONSTRAINT "booking_items_guide_id_fkey" FOREIGN KEY ("guide_id") REFERENCES "guides"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_codes" ADD CONSTRAINT "discount_codes_festival_id_fkey" FOREIGN KEY ("festival_id") REFERENCES "festivals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_verifications" ADD CONSTRAINT "student_verifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_alerts" ADD CONSTRAINT "emergency_alerts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_shares" ADD CONSTRAINT "location_shares_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_guide_id_fkey" FOREIGN KEY ("guide_id") REFERENCES "guides"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_place_id_fkey" FOREIGN KEY ("place_id") REFERENCES "places"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_guide_id_fkey" FOREIGN KEY ("guide_id") REFERENCES "guides"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_chat_sessions" ADD CONSTRAINT "ai_chat_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_chat_messages" ADD CONSTRAINT "ai_chat_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "ai_chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_device_tokens" ADD CONSTRAINT "push_device_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
