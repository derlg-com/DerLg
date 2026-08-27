import { IsString, IsOptional, IsEnum, IsUUID } from 'class-validator';
import { EmergencyAlertStatus } from '@prisma/client';

export class UpdateEmergencyDto {
  @IsEnum(EmergencyAlertStatus)
  @IsOptional()
  status?: EmergencyAlertStatus;

  @IsUUID()
  @IsOptional()
  acknowledgedBy?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
