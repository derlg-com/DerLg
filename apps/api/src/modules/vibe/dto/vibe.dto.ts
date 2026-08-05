import { Type } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateConversationDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;
}

export class SendMessageDto {
  @Type(() => String)
  @IsString()
  @MinLength(1, { message: 'Say something to the concierge' })
  @MaxLength(2_000, { message: 'That message is too long' })
  message!: string;
}
