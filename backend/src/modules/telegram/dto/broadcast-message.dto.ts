import { IsString, IsOptional, IsObject, IsNotEmpty } from 'class-validator';

export class BroadcastMessageDto {
  @IsString()
  @IsNotEmpty()
  message: string;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsObject()
  @IsOptional()
  targetFilter?: Record<string, unknown>;
}
