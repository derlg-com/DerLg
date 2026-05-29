-- CreateEnum
CREATE TYPE "booking_method" AS ENUM ('public_package', 'private_prebuilt', 'build_from_scratch', 'single_resource');

-- CreateEnum
CREATE TYPE "single_resource_kind" AS ENUM ('transportation', 'hotel', 'guide', 'trip');

-- AlterEnum
ALTER TYPE "booking_status" RENAME VALUE 'reserved' TO 'hold';

-- AlterEnum
ALTER TYPE "booking_status" ADD VALUE 'pending_payment';

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN "method" "booking_method" NOT NULL,
ADD COLUMN "single_resource_kind" "single_resource_kind",
ADD COLUMN "deleted_at" TIMESTAMPTZ,
ALTER COLUMN "status" SET DEFAULT 'hold';

-- AlterTable
ALTER TABLE "booking_items" ADD COLUMN "start_date" DATE NOT NULL,
ADD COLUMN "end_date" DATE NOT NULL,
ADD COLUMN "snapshot" JSONB NOT NULL,
DROP COLUMN "date";

-- CreateIndex
CREATE INDEX "bookings_method_idx" ON "bookings"("method");

-- CreateIndex
CREATE INDEX "bookings_deleted_at_idx" ON "bookings"("deleted_at");

-- CreateIndex
CREATE INDEX "booking_items_start_date_end_date_idx" ON "booking_items"("start_date", "end_date");
