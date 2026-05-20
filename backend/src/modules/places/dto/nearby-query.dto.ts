import { IsNumber, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class NearbyQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  radiusKm?: number = 20;
}
