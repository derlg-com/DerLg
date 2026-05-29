-- Merge BookingMethod enum: drop `private_prebuilt` (M2) and `build_from_scratch` (M3),
-- collapse them into `custom_itinerary`. Also adds `Booking.trip_template_id` so a
-- "private package" booking is represented as a custom_itinerary row with a link back
-- to the seeding Trip, rather than as a distinct booking method.
--
-- Safety: this migration is destructive on the enum type — dropping enum values requires
-- recreating the type and rebinding the column. Verified safe at write time because
-- `SELECT count(*) FROM bookings → 0` on the dev DB. In production this would need an
-- UPDATE step (run BEFORE the rebind, in a separate prior migration that ADD VALUEs
-- 'custom_itinerary' so the new value is committed and writable) to rewrite any
-- existing rows from the doomed values to 'custom_itinerary' first.

-- Step 1: drop the two doomed values via the type-rebind dance (Postgres has no DROP VALUE).
ALTER TYPE "booking_method" RENAME TO "booking_method_old";

CREATE TYPE "booking_method" AS ENUM ('public_package', 'custom_itinerary', 'single_resource');

ALTER TABLE "bookings"
  ALTER COLUMN "method" TYPE "booking_method"
  USING "method"::text::"booking_method";

DROP TYPE "booking_method_old";

-- Step 2: add the trip_template_id column with FK to trips(id).
ALTER TABLE "bookings" ADD COLUMN "trip_template_id" UUID;

ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_trip_template_id_fkey"
  FOREIGN KEY ("trip_template_id") REFERENCES "trips"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "bookings_trip_template_id_idx" ON "bookings"("trip_template_id");
