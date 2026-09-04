import { IsOptional, IsString } from 'class-validator';

export class GoogleAuthDto {
  @IsOptional()
  @IsString()
  redirectUri?: string;

  @IsOptional()
  @IsString()
  state?: string;
}
