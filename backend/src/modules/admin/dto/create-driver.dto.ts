import { IsString, IsOptional, IsNotEmpty, Length } from 'class-validator';

export class CreateDriverDto {
  @IsString()
  @IsOptional()
  @Length(1, 255)
  driverName?: string;

  @IsString()
  @IsOptional()
  @Length(1, 255)
  driver_name?: string;

  @IsString()
  @IsOptional()
  @Length(1, 50)
  driverId?: string;

  @IsString()
  @IsOptional()
  @Length(1, 50)
  driver_id?: string;

  @IsString()
  @IsOptional()
  telegramId?: string;

  @IsString()
  @IsOptional()
  telegram_id?: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 20)
  phone: string;

  @IsString()
  @IsOptional()
  vehicleId?: string;

  @IsString()
  @IsOptional()
  vehicle_id?: string;

  @IsString()
  @IsOptional()
  auth_pin?: string;

  @IsString()
  @IsOptional()
  authPin?: string;

  @IsString()
  @IsOptional()
  @Length(1, 255)
  fullName?: string;
}
