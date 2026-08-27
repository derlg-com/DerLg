import { IsString, IsOptional, IsNotEmpty, Length } from 'class-validator';

export class CreateDriverDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 255)
  driverName: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  driverId: string;

  @IsString()
  @IsOptional()
  telegramId?: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 20)
  phone: string;

  @IsString()
  @IsOptional()
  vehicleId?: string;
}
