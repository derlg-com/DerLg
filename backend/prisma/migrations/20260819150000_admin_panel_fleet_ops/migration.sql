-- CreateEnum
CREATE TYPE "driver_status" AS ENUM ('AVAILABLE', 'BUSY', 'OFFLINE');

-- CreateEnum
CREATE TYPE "maintenance_status" AS ENUM ('SCHEDULED', 'IN_MAINTENANCE', 'COMPLETED');

-- CreateEnum
CREATE TYPE "admin_role" AS ENUM ('SUPER_ADMIN', 'OPERATIONS_MANAGER', 'FLEET_MANAGER', 'SUPPORT_AGENT');

-- CreateEnum
CREATE TYPE "assignment_status" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ticket_status" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ticket_priority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "broadcast_status" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "drivers" (
    "id" UUID NOT NULL,
    "driver_name" VARCHAR(255) NOT NULL,
    "driver_id" VARCHAR(50) NOT NULL,
    "telegram_id" BIGINT,
    "auth_pin" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "vehicle_id" UUID,
    "status" "driver_status" NOT NULL DEFAULT 'OFFLINE',
    "preferred_language" VARCHAR(5) NOT NULL DEFAULT 'en',
    "last_status_update" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_telegram_activity" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "drivers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "driver_assignments" (
    "id" UUID NOT NULL,
    "driver_id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "status" "assignment_status" NOT NULL DEFAULT 'PENDING',
    "assignment_timestamp" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "response_timestamp" TIMESTAMPTZ,
    "trip_start_time" TIMESTAMPTZ,
    "completion_timestamp" TIMESTAMPTZ,
    "rejection_reason" TEXT,
    "telegram_notified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "driver_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_maintenance" (
    "id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "maintenance_type" VARCHAR(100) NOT NULL,
    "scheduled_date" DATE NOT NULL,
    "completion_date" DATE,
    "maintenance_cost" DECIMAL(10,2),
    "maintenance_notes" TEXT,
    "status" "maintenance_status" NOT NULL DEFAULT 'SCHEDULED',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "vehicle_maintenance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_users" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "admin_role" "admin_role" NOT NULL,
    "permissions" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" UUID NOT NULL,
    "ticket_id" VARCHAR(20) NOT NULL,
    "driver_id" UUID NOT NULL,
    "message" TEXT NOT NULL,
    "status" "ticket_status" NOT NULL DEFAULT 'OPEN',
    "priority" "ticket_priority" NOT NULL DEFAULT 'NORMAL',
    "assigned_to" UUID,
    "resolved_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "broadcast_messages" (
    "id" UUID NOT NULL,
    "message_id" VARCHAR(50) NOT NULL,
    "content" TEXT NOT NULL,
    "image_url" VARCHAR(500),
    "target_filter" JSONB NOT NULL,
    "sent_by" UUID NOT NULL,
    "status" "broadcast_status" NOT NULL DEFAULT 'PENDING',
    "sent_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "completed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "broadcast_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backups" (
    "id" UUID NOT NULL,
    "backup_file_url" TEXT NOT NULL,
    "backup_size_bytes" BIGINT,
    "created_by_admin_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "backups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "drivers_driver_id_key" ON "drivers"("driver_id");

-- CreateIndex
CREATE UNIQUE INDEX "drivers_telegram_id_key" ON "drivers"("telegram_id");

-- CreateIndex
CREATE INDEX "drivers_telegram_id_idx" ON "drivers"("telegram_id");

-- CreateIndex
CREATE INDEX "drivers_status_idx" ON "drivers"("status");

-- CreateIndex
CREATE INDEX "drivers_vehicle_id_idx" ON "drivers"("vehicle_id");

-- CreateIndex
CREATE INDEX "driver_assignments_driver_id_idx" ON "driver_assignments"("driver_id");

-- CreateIndex
CREATE INDEX "driver_assignments_booking_id_idx" ON "driver_assignments"("booking_id");

-- CreateIndex
CREATE INDEX "driver_assignments_vehicle_id_idx" ON "driver_assignments"("vehicle_id");

-- CreateIndex
CREATE INDEX "driver_assignments_status_idx" ON "driver_assignments"("status");

-- CreateIndex
CREATE INDEX "driver_assignments_driver_id_completion_timestamp_idx" ON "driver_assignments"("driver_id", "completion_timestamp");

-- CreateIndex
CREATE INDEX "vehicle_maintenance_vehicle_id_idx" ON "vehicle_maintenance"("vehicle_id");

-- CreateIndex
CREATE INDEX "vehicle_maintenance_status_idx" ON "vehicle_maintenance"("status");

-- CreateIndex
CREATE INDEX "vehicle_maintenance_scheduled_date_idx" ON "vehicle_maintenance"("scheduled_date");

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_user_id_key" ON "admin_users"("user_id");

-- CreateIndex
CREATE INDEX "admin_users_user_id_idx" ON "admin_users"("user_id");

-- CreateIndex
CREATE INDEX "admin_users_admin_role_idx" ON "admin_users"("admin_role");

-- CreateIndex
CREATE UNIQUE INDEX "support_tickets_ticket_id_key" ON "support_tickets"("ticket_id");

-- CreateIndex
CREATE INDEX "support_tickets_driver_id_idx" ON "support_tickets"("driver_id");

-- CreateIndex
CREATE INDEX "support_tickets_status_idx" ON "support_tickets"("status");

-- CreateIndex
CREATE INDEX "support_tickets_assigned_to_idx" ON "support_tickets"("assigned_to");

-- CreateIndex
CREATE UNIQUE INDEX "broadcast_messages_message_id_key" ON "broadcast_messages"("message_id");

-- CreateIndex
CREATE INDEX "broadcast_messages_sent_by_idx" ON "broadcast_messages"("sent_by");

-- CreateIndex
CREATE INDEX "broadcast_messages_status_idx" ON "broadcast_messages"("status");

-- CreateIndex
CREATE INDEX "backups_created_at_idx" ON "backups"("created_at");

-- CreateIndex
CREATE INDEX "backups_created_by_admin_id_idx" ON "backups"("created_by_admin_id");

-- AddForeignKey
ALTER TABLE "emergency_alerts" ADD CONSTRAINT "emergency_alerts_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "transportation_vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_assignments" ADD CONSTRAINT "driver_assignments_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_assignments" ADD CONSTRAINT "driver_assignments_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_assignments" ADD CONSTRAINT "driver_assignments_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "transportation_vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_maintenance" ADD CONSTRAINT "vehicle_maintenance_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "transportation_vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broadcast_messages" ADD CONSTRAINT "broadcast_messages_sent_by_fkey" FOREIGN KEY ("sent_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backups" ADD CONSTRAINT "backups_created_by_admin_id_fkey" FOREIGN KEY ("created_by_admin_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

