import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsOptional,
  Length,
} from 'class-validator';

export class ScheduleMaintenanceDto {
  @IsString()
  @IsNotEmpty()
  vehicleId: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  maintenanceType: string;

  @IsDateString()
  scheduledDate: string;

  @IsString()
  @IsOptional()
  maintenanceNotes?: string;
}
