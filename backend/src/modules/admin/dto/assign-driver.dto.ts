import { IsNotEmpty, IsUUID } from 'class-validator';

export class AssignDriverDto {
  @IsUUID()
  @IsNotEmpty()
  driverId: string;

  @IsUUID()
  @IsNotEmpty()
  bookingId: string;

  @IsUUID()
  @IsNotEmpty()
  vehicleId: string;
}
