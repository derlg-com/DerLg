import { IsString, IsOptional, IsEnum, IsNotEmpty } from 'class-validator';
import { DriverStatus } from '@prisma/client';

export class DriverStatusWebhookDto {
  @IsString()
  @IsNotEmpty()
  telegramId: string;

  @IsString()
  @IsOptional()
  vehicleId?: string;

  @IsString()
  @IsNotEmpty()
  driverName: string;

  @IsEnum(DriverStatus)
  @IsNotEmpty()
  status: DriverStatus;
}
