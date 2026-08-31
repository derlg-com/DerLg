import {
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  IsIn,
  IsUUID,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  ArrayMaxSize,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  SupportedLanguage,
  HotelType,
  VehicleTier,
  VehicleSubtype,
} from '@prisma/client';

export class SearchTripsDto {
  @IsString() destination: string;
  @IsOptional() @IsNumber() @Type(() => Number) duration_days?: number;
  @IsOptional() @IsNumber() @Type(() => Number) people_count?: number;
  @IsOptional() @IsNumber() @Type(() => Number) budget_usd?: number;
}

export class SearchHotelsDto {
  @IsString() city: string;
  @IsOptional() @IsDateString() check_in?: string;
  @IsOptional() @IsDateString() check_out?: string;
  @IsOptional() @IsNumber() @Type(() => Number) price_range?: number;
  @IsOptional() @IsIn(Object.values(HotelType)) type?: HotelType;
}

export class SearchGuidesDto {
  @IsString() location: string;
  @IsIn(Object.values(SupportedLanguage)) language: string;
  @IsDateString() date: string;
}

export class SearchTransportDto {
  @IsString() from_location: string;
  @IsString() to_location: string;
  @IsDateString() departure_date: string;
  @IsOptional() @IsNumber() @Type(() => Number) people_count?: number;
  @IsOptional()
  @IsString()
  @IsIn(['van', 'bus', 'tuk_tuk', 'taxi', 'shuttle', 'minivan'])
  mode?: string;
  @IsOptional() @IsIn(Object.values(VehicleTier)) tier?: VehicleTier;
  @IsOptional() @IsIn(Object.values(VehicleSubtype)) subtype?: VehicleSubtype;
}

export class CreateCustomTripExtraDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsNumber()
  @Min(0.01)
  unit_price_usd: number;

  @IsInt()
  @Min(1)
  @Max(99)
  quantity: number;
}

export class CreateCustomTripDto {
  @IsString()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsInt()
  @Min(1)
  @Max(365)
  @Type(() => Number)
  duration_days: number;

  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsUUID()
  hotel_room_id?: string;

  @IsOptional()
  @IsUUID()
  guide_id?: string;

  @IsOptional()
  @IsUUID()
  vehicle_id?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCustomTripExtraDto)
  extras?: CreateCustomTripExtraDto[];
}

export class CheckAvailabilityDto {
  @IsString() @IsIn(['trip', 'hotel', 'guide', 'transport']) item_type: string;
  @IsString() item_id: string;
  @IsDateString() date: string;
}

export class CreateBookingHoldDto {
  @IsString() user_id: string;
  @IsString() @IsIn(['trip', 'hotel', 'guide', 'transport']) item_type: string;
  @IsString() item_id: string;
  @IsDateString() travel_date: string;
  @IsNumber() @Type(() => Number) people_count: number;
}

export class GetWeatherDto {
  @IsString() location: string;
  @IsDateString() date: string;
}

export class GetEmergencyContactsDto {
  @IsString() location: string;
}

export class SendSosAlertDto {
  @IsString() user_id: string;
  @IsString() location: string;
  @IsString() message: string;
}

export class GetUserLoyaltyDto {
  @IsString() user_id: string;
}

export class CheckPaymentStatusDto {
  @IsString() booking_id: string;
}

export class GeneratePaymentQrDto {
  @IsString() booking_id: string;
  @IsString() @IsIn(['BAKONG', 'ABA', 'bakong', 'aba']) provider: string;
}

export class EstimateBudgetDto {
  @IsString() query: string;
  @IsString() @IsIn(['en', 'zh', 'km']) locale: string;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsNumber() @Type(() => Number) duration_days?: number;
  @IsOptional() @IsNumber() @Type(() => Number) people_count?: number;
}

export class GetPlacesDto {
  @IsOptional() @IsString() province?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsNumber() @Type(() => Number) limit?: number;
}

export class GetFestivalsDto {
  @IsOptional() @IsString() month?: string;
  @IsOptional() @IsString() province?: string;
}

// ---------------------------------------------------------------------------
// Chat archive (Vibe Booking transcript persistence)
// ---------------------------------------------------------------------------
// The agent holds the live conversation in Redis under `session:{id}` with a
// 7-day TTL and a 60-turn cap. These endpoints are the only sanctioned write
// path into `ai_chat_sessions` / `ai_chat_messages`: the AI service must never
// touch Postgres directly. Field names stay snake_case to match the rest of this
// agent-facing DTO file.

/** Upsert of the session row, sent once when the WebSocket connects. */
export class UpsertChatSessionDto {
  /** The agent generates this UUID; it is the primary key of the session row. */
  @IsUUID() session_id: string;

  /**
   * Present only once a JWT has been verified. Guests legitimately have no user
   * id, which is why `ai_chat_sessions.user_id` is nullable.
   */
  @IsOptional() @IsUUID() user_id?: string;

  /** Anonymous handle, retained so a guest session can be stitched on login. */
  @IsOptional() @IsString() @MaxLength(128) guest_key?: string;

  @IsOptional() @IsEnum(SupportedLanguage) language?: SupportedLanguage;

  @IsOptional() @IsString() @MaxLength(200) title?: string;
}

/** Rebinds an anonymous session to a real user after mid-chat authentication. */
export class RebindChatSessionDto {
  @IsUUID() user_id: string;
}

export class ChatMessageDto {
  /**
   * Per-session turn ordinal. Paired with the [session_id, seq] unique index it
   * makes a retried flush idempotent: the duplicate collides and is skipped
   * rather than appended twice.
   */
  @IsInt() @Min(0) @Type(() => Number) seq: number;

  @IsString() @IsIn(['user', 'assistant', 'system']) role: string;

  /**
   * Matches the agent's own 2000-char inbound cap (`_MAX_CONTENT_LENGTH` in
   * api/websocket.py) with headroom for assistant replies, which are longer.
   */
  @IsString() @MaxLength(8000) content: string;

  @IsOptional()
  @IsString()
  @IsIn(['text', 'trip_card', 'hotel_card', 'action', 'qr'])
  message_type?: string;

  /** Tool calls, linked entities, and the agent's own message id. */
  @IsOptional() @IsObject() metadata?: Record<string, unknown>;
}

export class AppendChatMessagesDto {
  /**
   * Capped at the agent's `_PERSIST_CAP` (60): a flush can never legitimately
   * carry more turns than the agent retains in session state.
   */
  @IsArray()
  @ArrayMaxSize(60)
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages: ChatMessageDto[];
}

/** "Was this helpful?" vote against one archived turn. */
export class ChatMessageFeedbackDto {
  @IsBoolean() helpful: boolean;
}
