-- CreateEnum
CREATE TYPE "vehicle_tier" AS ENUM ('normal', 'vip');

-- CreateEnum
CREATE TYPE "vehicle_subtype" AS ENUM ('starex', 'hiace', 'alphard', 'small_bus', 'big_bus');

-- AlterTable
ALTER TABLE "transportation_vehicles" ADD COLUMN "tier" "vehicle_tier";
ALTER TABLE "transportation_vehicles" ADD COLUMN "subtype" "vehicle_subtype";

-- CreateIndex
CREATE INDEX "transportation_vehicles_tier_idx" ON "transportation_vehicles"("tier");
CREATE INDEX "transportation_vehicles_subtype_idx" ON "transportation_vehicles"("subtype");
