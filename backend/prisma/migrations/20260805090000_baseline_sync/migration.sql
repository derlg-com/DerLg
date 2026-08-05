-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('active', 'inactive', 'suspended');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "user_role" ADD VALUE 'super_admin';
ALTER TYPE "user_role" ADD VALUE 'operations_manager';
ALTER TYPE "user_role" ADD VALUE 'fleet_manager';
ALTER TYPE "user_role" ADD VALUE 'support_agent';

-- AlterTable
ALTER TABLE "emergency_alerts" ADD COLUMN     "driver_id" UUID;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "password_hash" TEXT,
ADD COLUMN     "status" "user_status" NOT NULL DEFAULT 'active';

-- CreateIndex
CREATE INDEX "emergency_alerts_driver_id_idx" ON "emergency_alerts"("driver_id");

