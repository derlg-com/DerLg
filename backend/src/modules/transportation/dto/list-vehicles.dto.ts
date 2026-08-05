import { IsEnum, IsOptional } from 'class-validator';
import { VehicleType, VehicleTier, VehicleSubtype } from '@prisma/client';
import { ListQueryDto } from '../../../common/dto/list-query.dto';

export class ListVehiclesDto extends ListQueryDto {
  @IsOptional()
  @IsEnum(VehicleType)
  type?: VehicleType;

  @IsOptional()
  @IsEnum(VehicleTier)
  tier?: VehicleTier;

  @IsOptional()
  @IsEnum(VehicleSubtype)
  subtype?: VehicleSubtype;
}
