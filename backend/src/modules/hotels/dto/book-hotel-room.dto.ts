import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class BookHotelRoomDto {
  @IsUUID()
  roomId!: string;

  @IsDateString()
  checkInDate!: string;

  @IsDateString()
  checkOutDate!: string;

  @IsInt()
  @Min(1)
  guestsAdults!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  guestsChildren?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  specialRequests?: string;
}
