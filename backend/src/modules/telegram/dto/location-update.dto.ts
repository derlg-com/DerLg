import { IsString, IsNumber, IsNotEmpty } from 'class-validator';

export class LocationUpdateDto {
  @IsString()
  @IsNotEmpty()
  telegramId: string;

  @IsNumber()
  @IsNotEmpty()
  latitude: number;

  @IsNumber()
  @IsNotEmpty()
  longitude: number;
}
