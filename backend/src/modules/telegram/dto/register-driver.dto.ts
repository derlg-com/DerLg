import { IsString, IsNotEmpty } from 'class-validator';

export class RegisterDriverDto {
  @IsString()
  @IsNotEmpty()
  telegramId: string;

  @IsString()
  @IsNotEmpty()
  driverId: string;

  @IsString()
  @IsNotEmpty()
  pin: string;
}
