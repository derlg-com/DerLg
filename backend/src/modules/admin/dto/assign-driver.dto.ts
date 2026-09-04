import { IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class AssignDriverDto {
  @IsUUID()
  @IsNotEmpty()
  driverId: string;

  @IsUUID()
  @IsNotEmpty()
  bookingId: string;

  /**
   * Optional: defaults to the driver's own assigned vehicle.
   *
   * The admin panel's assign dialog picks a driver and nothing else, so it was
   * sending `vehicleId: ''`. As a required `@IsUUID()` field that failed
   * validation, meaning driver assignment always returned 400 from the panel.
   */
  @IsOptional()
  @IsUUID()
  vehicleId?: string;
}
