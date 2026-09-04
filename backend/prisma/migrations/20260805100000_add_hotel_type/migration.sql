-- CreateEnum
CREATE TYPE "hotel_type" AS ENUM ('resort', 'boutique', 'hotel', 'guesthouse', 'hostel', 'villa');

-- AlterTable
ALTER TABLE "hotels" ADD COLUMN "type" "hotel_type";

-- CreateIndex
CREATE INDEX "hotels_type_idx" ON "hotels"("type");
