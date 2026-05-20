import { IsEnum, IsOptional } from 'class-validator';
import { VehicleType } from '@prisma/client';
import { ListQueryDto } from '../../../common/dto/list-query.dto';

export class ListVehiclesDto extends ListQueryDto {
  @IsOptional()
  @IsEnum(VehicleType)
  type?: VehicleType;
}
