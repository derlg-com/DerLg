import { IsEnum, IsOptional } from 'class-validator';
import { BookingStatus, BookingMethod } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ListBookingsQueryDto extends PaginationDto {
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @IsOptional()
  @IsEnum(BookingMethod)
  method?: BookingMethod;
}
