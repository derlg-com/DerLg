import { IsOptional, IsString } from 'class-validator';

export class RevenueAnalyticsDto {
  @IsString()
  @IsOptional()
  startDate?: string;

  @IsString()
  @IsOptional()
  endDate?: string;
}

export class BookingStatisticsDto {
  @IsString()
  @IsOptional()
  status?: string;
}

export class DriverPerformanceDto {
  @IsString()
  @IsOptional()
  driverId?: string;
}

export class ExportDataDto {
  @IsString()
  format: string;

  @IsString()
  @IsOptional()
  metric?: string;

  @IsString()
  @IsOptional()
  startDate?: string;

  @IsString()
  @IsOptional()
  endDate?: string;
}
