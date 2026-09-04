import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class GoogleCallbackDto {
  @IsNotEmpty()
  @IsString()
  code!: string;

  @IsOptional()
  @IsString()
  redirectUri?: string;

  @IsOptional()
  @IsString()
  state?: string;
}
