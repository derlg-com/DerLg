import {
  IsBooleanString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import {
  BookingStatus,
  DriverStatus,
  EmergencyAlertStatus,
  EmergencyAlertType,
  MaintenanceStatus,
  VehicleTier,
  VehicleType,
  VerificationStatus,
} from '@prisma/client';

import {
  AdminDateRangeQueryDto,
  AdminListQueryDto,
} from './admin-list-query.dto';

/**
 * `GET /v1/admin/drivers`
 *
 * `has_telegram` is new. The driver list has a "Registered / Not registered"
 * dropdown that has always sent it, but no handler declared it — so the filter
 * did nothing. Now that a DTO exists it must be declared explicitly anyway:
 * `forbidNonWhitelisted` would otherwise reject the whole request with a 400.
 */
export class ListDriversDto extends AdminListQueryDto {
  @IsOptional()
  @IsEnum(DriverStatus)
  status?: DriverStatus;

  @IsOptional()
  @IsBooleanString()
  has_telegram?: string;

  get hasTelegramBool(): boolean | undefined {
    if (this.has_telegram === undefined) return undefined;
    return this.has_telegram === 'true';
  }
}

/**
 * `GET /v1/admin/vehicles`
 *
 * `category` maps to `vehicleType`. It was previously cast straight into the
 * Prisma filter (`where.vehicleType = category as VehicleType`), so
 * `?category=car` produced a Prisma validation error surfacing as a 500.
 */
export class ListVehiclesDto extends AdminListQueryDto {
  @IsOptional()
  @IsEnum(VehicleType)
  category?: VehicleType;

  @IsOptional()
  @IsEnum(VehicleTier)
  tier?: VehicleTier;
}

/**
 * `GET /v1/admin/emergency`
 *
 * Both enums were previously unvalidated casts. The type param is `alert_type`
 * on the wire — that is what the original `@Query('alert_type')` read and what
 * the alerts page sends, so the DTO must use the same name or every request
 * carrying it would 400.
 */
export class ListEmergencyDto extends AdminListQueryDto {
  @IsOptional()
  @IsEnum(EmergencyAlertStatus)
  status?: EmergencyAlertStatus;

  @IsOptional()
  @IsEnum(EmergencyAlertType)
  alert_type?: EmergencyAlertType;
}

/**
 * `GET /v1/admin/bookings`
 *
 * `ai_assisted` and `guide_id` are both new. The bookings page has always
 * rendered an "AI / Manual" filter and the guide detail view has always
 * requested `?guide_id=…`, but no handler read either, so both silently returned
 * the unfiltered list — the guide page showed every booking in the system as if
 * it belonged to that guide.
 */
export class ListAdminBookingsDto extends AdminDateRangeQueryDto {
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @IsOptional()
  @IsString()
  booking_type?: string;

  @IsOptional()
  @IsUUID()
  guide_id?: string;

  /** 'true' | 'false' — query params arrive as text. */
  @IsOptional()
  @IsBooleanString()
  ai_assisted?: string;

  get aiAssistedBool(): boolean | undefined {
    if (this.ai_assisted === undefined) return undefined;
    return this.ai_assisted === 'true';
  }
}

/**
 * `GET /v1/admin/maintenance`
 *
 * `status` is new for the same reason as `ai_assisted` above: the scheduler UI
 * requests `?status=SCHEDULED` and the filter was dropped on the floor.
 */
export class ListMaintenanceDto extends AdminDateRangeQueryDto {
  @IsOptional()
  @IsUUID()
  vehicle_id?: string;

  @IsOptional()
  @IsEnum(MaintenanceStatus)
  status?: MaintenanceStatus;
}

/**
 * `GET /v1/admin/student-verifications`
 *
 * The enum members are lowercase (`pending`), and the UI was sending `PENDING`,
 * which matched no row. Validating here makes that a 400 the developer sees
 * rather than a silently empty queue.
 */
export class ListStudentVerificationsDto extends AdminListQueryDto {
  @IsOptional()
  @IsEnum(VerificationStatus)
  status?: VerificationStatus;
}
