import {
  IsNumber,
  IsObject,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Telegram Bot API update payload.
 *
 * Typed all the way down rather than leaning on `any`. The webhook body is
 * attacker-reachable — the only thing standing in front of it is the shared
 * secret header — so every field the handlers read is declared, and
 * `ValidateNested` makes the validation pipe actually check the nested shapes
 * instead of accepting any object.
 *
 * Field names are camelCase to match this codebase; Telegram sends snake_case,
 * so `TelegramService` normalises the incoming body before validation.
 */
export class TelegramUserDto {
  @IsNumber()
  id: number;

  @IsOptional()
  isBot?: boolean;

  @IsOptional()
  firstName?: string;

  @IsOptional()
  username?: string;

  /** Telegram locale, e.g. "en", "zh-hans", "km". Drives the bot's reply language. */
  @IsOptional()
  languageCode?: string;
}

export class TelegramChatDto {
  @IsNumber()
  id: number;

  @IsOptional()
  firstName?: string;

  @IsOptional()
  type?: string;
}

export class TelegramLocationDto {
  @IsNumber()
  latitude: number;

  @IsNumber()
  longitude: number;

  /** Present on live-location updates; absent on a one-off pin. */
  @IsOptional()
  @IsNumber()
  livePeriod?: number;

  @IsOptional()
  @IsNumber()
  horizontalAccuracy?: number;
}

export class TelegramMessageDto {
  @IsOptional()
  @IsNumber()
  messageId?: number;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => TelegramUserDto)
  from?: TelegramUserDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => TelegramChatDto)
  chat?: TelegramChatDto;

  @IsOptional()
  @IsNumber()
  date?: number;

  @IsOptional()
  text?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => TelegramLocationDto)
  location?: TelegramLocationDto;
}

export class TelegramCallbackQueryDto {
  id: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => TelegramUserDto)
  from?: TelegramUserDto;

  /**
   * The message the inline keyboard was attached to. Typed rather than `any`
   * because the callback handler reads `message.chat.id` to reply.
   */
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => TelegramMessageDto)
  message?: TelegramMessageDto;

  /** Inline button payload, e.g. "accept:<assignmentId>". */
  @IsOptional()
  data?: string;
}

export class WebhookUpdateDto {
  @IsNumber()
  updateId: number;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => TelegramMessageDto)
  message?: TelegramMessageDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => TelegramCallbackQueryDto)
  callbackQuery?: TelegramCallbackQueryDto;
}
