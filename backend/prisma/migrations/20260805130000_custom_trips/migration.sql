-- AlterEnum
ALTER TYPE "trip_category" ADD VALUE 'custom';

-- AlterTable
ALTER TABLE "trips" ADD COLUMN "extras" JSONB;
