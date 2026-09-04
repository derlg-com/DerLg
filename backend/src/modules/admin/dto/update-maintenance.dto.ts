import {
  IsEnum,
  IsOptional,
  IsDateString,
  IsNumber,
  IsString,
  Min,
} from 'class-validator';
import { MaintenanceStatus } from '@prisma/client';

export class UpdateMaintenanceDto {
  @IsEnum(MaintenanceStatus)
  @IsOptional()
  status?: MaintenanceStatus;

  @IsDateString()
  @IsOptional()
  completionDate?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  maintenanceCost?: number;

  @IsString()
  @IsOptional()
  maintenanceNotes?: string;
}
