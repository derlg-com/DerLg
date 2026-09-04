import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { StorageModule } from '../storage/storage.module';
import { TelegramModule } from '../telegram/telegram.module';

// Controllers
import { AdminDashboardController } from './controllers/admin-dashboard.controller';
import { AdminDriversController } from './controllers/admin-drivers.controller';
import { AdminVehiclesController } from './controllers/admin-vehicles.controller';
import { AdminMaintenanceController } from './controllers/admin-maintenance.controller';
import { AdminAssignmentsController } from './controllers/admin-assignments.controller';
import { AdminBookingsController } from './controllers/admin-bookings.controller';
import { AdminHotelsController } from './controllers/admin-hotels.controller';
import { AdminTripsController } from './controllers/admin-trips.controller';
import { AdminGuidesController } from './controllers/admin-guides.controller';
import { AdminEmergencyController } from './controllers/admin-emergency.controller';
import {
  AdminCustomersController,
  AdminLoyaltyController,
} from './controllers/admin-customers.controller';
import {
  AdminDiscountsController,
  AdminStudentVerificationsController,
} from './controllers/admin-discounts.controller';
import { AdminAnalyticsController } from './controllers/admin-analytics.controller';
import { AdminUsersController } from './controllers/admin-users.controller';
import { AdminAuditController } from './controllers/admin-audit.controller';
import { PaymentsModule } from '../payments/payments.module';
import { AdminExportController } from './controllers/admin-export.controller';
import {
  AdminPaymentsController,
  AdminRefundsController,
} from './controllers/admin-payments.controller';
import { AdminAIMonitoringController } from './controllers/admin-ai-monitoring.controller';
import { AdminTelegramController } from './controllers/admin-telegram.controller';

// Services
import { AdminDashboardService } from './services/admin-dashboard.service';
import { AdminDriversService } from './services/admin-drivers.service';
import { AdminVehiclesService } from './services/admin-vehicles.service';
import { AdminMaintenanceService } from './services/admin-maintenance.service';
import { AdminAssignmentsService } from './services/admin-assignments.service';
import { AdminBookingsService } from './services/admin-bookings.service';
import { AdminHotelsService } from './services/admin-hotels.service';
import { AdminTripsService } from './services/admin-trips.service';
import { AdminGuidesService } from './services/admin-guides.service';
import { AdminEmergencyService } from './services/admin-emergency.service';
import { AdminCustomersService } from './services/admin-customers.service';
import { AdminDiscountsService } from './services/admin-discounts.service';
import { AdminAnalyticsService } from './services/admin-analytics.service';
import { AdminUsersService } from './services/admin-users.service';
import { AdminAuditService } from './services/admin-audit.service';
import { AdminExportService } from './services/admin-export.service';
import { AdminPaymentsService } from './services/admin-payments.service';
import { AdminAIMonitoringService } from './services/admin-ai-monitoring.service';
import { AdminTelegramService } from './services/admin-telegram.service';

// Cross-cutting
// Provided locally rather than by importing CommonModule: CommonModule registers
// the global guards and imports PrismaModule, and pulling it in here would create
// a cycle. CacheInvalidationService is stateless and only needs RedisService,
// which this module already has via RedisModule.
import { CacheInvalidationService } from '../../common/cache/cache-invalidation.service';
import { AuditInterceptor } from './interceptors/audit.interceptor';
import { AdminGateway } from './websocket/admin.gateway';
import { AdminEventsService } from './websocket/admin-events.service';

/**
 * Admin panel API, merged in from the standalone `derlg-system-admin` service.
 *
 * Authorisation is not declared here: `JwtAuthGuard`, `RolesGuard` and
 * `AdminRoleGuard` are all registered globally in `common.module.ts`. Controllers
 * opt in with `@AdminRoles(...)`, which is what activates `AdminRoleGuard`. The
 * old standalone `AdminGuard` is gone — it gated on a `'support'` role that does
 * not exist in the `user_role` enum, so it could never have passed.
 */
@Module({
  imports: [
    // Supplies PaymentsService. The admin controllers never write to `payments`
    // themselves — settlement and refund totals have exactly one owner.
    PaymentsModule,
    PrismaModule,
    RedisModule,
    StorageModule,
    TelegramModule,
    JwtModule.register({}),
  ],
  controllers: [
    AdminDashboardController,
    AdminDriversController,
    AdminVehiclesController,
    AdminMaintenanceController,
    AdminAssignmentsController,
    AdminBookingsController,
    AdminHotelsController,
    AdminTripsController,
    AdminGuidesController,
    AdminEmergencyController,
    AdminCustomersController,
    AdminLoyaltyController,
    AdminDiscountsController,
    AdminStudentVerificationsController,
    AdminAnalyticsController,
    AdminUsersController,
    AdminAuditController,
    AdminExportController,
    AdminPaymentsController,
    AdminRefundsController,
    AdminAIMonitoringController,
    AdminTelegramController,
  ],
  providers: [
    AdminDashboardService,
    AdminDriversService,
    AdminVehiclesService,
    AdminMaintenanceService,
    AdminAssignmentsService,
    AdminBookingsService,
    AdminHotelsService,
    AdminTripsService,
    AdminGuidesService,
    AdminEmergencyService,
    AdminCustomersService,
    AdminDiscountsService,
    AdminAnalyticsService,
    AdminUsersService,
    AdminAuditService,
    AdminExportService,
    AdminPaymentsService,
    AdminAIMonitoringService,
    AdminTelegramService,
    CacheInvalidationService,
    AuditInterceptor,
    AdminGateway,
    AdminEventsService,
  ],
  exports: [AdminEventsService],
})
export class AdminModule {}
