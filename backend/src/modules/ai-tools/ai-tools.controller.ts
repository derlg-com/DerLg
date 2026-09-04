import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  ParseIntPipe,
} from '@nestjs/common';
import { ServiceKeyGuard } from '../../common/guards/service-key.guard';
import { Public } from '../../common/decorators/public.decorator';
import { RateLimit } from '../../common/throttler/rate-limit';
import { AiToolsService } from './ai-tools.service';
import {
  SearchTripsDto,
  SearchHotelsDto,
  SearchGuidesDto,
  SearchTransportDto,
  CheckAvailabilityDto,
  CreateBookingHoldDto,
  GetWeatherDto,
  GetEmergencyContactsDto,
  SendSosAlertDto,
  GetUserLoyaltyDto,
  CheckPaymentStatusDto,
  GeneratePaymentQrDto,
  EstimateBudgetDto,
  GetPlacesDto,
  GetFestivalsDto,
  CreateCustomTripDto,
  UpsertChatSessionDto,
  RebindChatSessionDto,
  AppendChatMessagesDto,
  ChatMessageFeedbackDto,
} from './ai-tools.dto';

/**
 * Tool surface for the Vibe Booking AI agent.
 *
 * `@Public()` removes the JWT requirement, and `ServiceKeyGuard` replaces it —
 * the agent has no user token, it authenticates as a service.
 *
 * Rate-limited at the service tier rather than the browser default: one
 * conversation turn can fan out several parallel tool calls, and the throttler
 * buckets service-key callers separately from browser IPs. The limit still
 * bounds the damage if the key ever leaks.
 */
@Public()
@UseGuards(ServiceKeyGuard)
@RateLimit('SERVICE')
@Controller('ai-tools')
export class AiToolsController {
  constructor(private readonly service: AiToolsService) {}

  @Post('search/trips')
  @HttpCode(HttpStatus.OK)
  async searchTrips(@Body() dto: SearchTripsDto) {
    return { success: true, data: await this.service.searchTrips(dto) };
  }

  @Get('hotels')
  async searchHotels(@Query() dto: SearchHotelsDto) {
    return { success: true, data: await this.service.searchHotels(dto) };
  }

  @Get('guides')
  async searchGuides(@Query() dto: SearchGuidesDto) {
    return { success: true, data: await this.service.searchGuides(dto) };
  }

  @Get('search/transport')
  async searchTransport(@Query() dto: SearchTransportDto) {
    return { success: true, data: await this.service.searchTransport(dto) };
  }

  @Get('availability')
  async checkAvailability(@Query() dto: CheckAvailabilityDto) {
    return { success: true, data: await this.service.checkAvailability(dto) };
  }

  @Post('trips')
  @HttpCode(HttpStatus.CREATED)
  async createCustomTrip(@Body() dto: CreateCustomTripDto) {
    return { success: true, data: await this.service.createCustomTrip(dto) };
  }

  @Post('bookings')
  @HttpCode(HttpStatus.OK)
  async createBookingHold(@Body() dto: CreateBookingHoldDto) {
    return { success: true, data: await this.service.createBookingHold(dto) };
  }

  @Post('payments/qr')
  @HttpCode(HttpStatus.CREATED)
  async generatePaymentQr(@Body() dto: GeneratePaymentQrDto) {
    return { success: true, data: await this.service.generatePaymentQr(dto) };
  }

  @Get('payments/status')
  async checkPaymentStatus(@Query() dto: CheckPaymentStatusDto) {
    return {
      success: true,
      data: await this.service.checkPaymentStatus(dto.booking_id, dto.user_id),
    };
  }

  @Post('budget/estimate')
  @HttpCode(HttpStatus.OK)
  estimateBudget(@Body() dto: EstimateBudgetDto) {
    return { success: true, data: this.service.estimateBudget(dto) };
  }

  @Get('places')
  async getPlaces(@Query() dto: GetPlacesDto) {
    return { success: true, data: await this.service.getPlaces(dto) };
  }

  @Get('festivals')
  async getFestivals(@Query() dto: GetFestivalsDto) {
    return { success: true, data: await this.service.getFestivals(dto) };
  }

  @Get('weather')
  getWeather(@Query() dto: GetWeatherDto) {
    return {
      success: true,
      data: this.service.getWeather(dto.location, dto.date),
    };
  }

  @Get('emergency-contacts')
  getEmergencyContacts(@Query() dto: GetEmergencyContactsDto) {
    return {
      success: true,
      data: this.service.getEmergencyContacts(dto.location),
    };
  }

  @Post('sos')
  @HttpCode(HttpStatus.OK)
  async sendSosAlert(@Body() dto: SendSosAlertDto) {
    return { success: true, data: await this.service.sendSosAlert(dto) };
  }

  @Get('loyalty')
  async getUserLoyalty(@Query() dto: GetUserLoyaltyDto) {
    return {
      success: true,
      data: await this.service.getUserLoyalty(dto.user_id),
    };
  }

  // -------------------------------------------------------------------------
  // Chat archive
  // -------------------------------------------------------------------------
  // The only sanctioned write path into ai_chat_sessions / ai_chat_messages.
  // The AI agent must never reach Postgres directly, so it posts here behind
  // ServiceKeyGuard instead.

  @Post('chat-sessions')
  @HttpCode(HttpStatus.OK)
  async upsertChatSession(@Body() dto: UpsertChatSessionDto) {
    return { success: true, data: await this.service.upsertChatSession(dto) };
  }

  @Patch('chat-sessions/:sessionId')
  @HttpCode(HttpStatus.OK)
  async rebindChatSession(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() dto: RebindChatSessionDto,
  ) {
    return {
      success: true,
      data: await this.service.rebindChatSession(sessionId, dto),
    };
  }

  @Post('chat-sessions/:sessionId/messages')
  @HttpCode(HttpStatus.OK)
  async appendChatMessages(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() dto: AppendChatMessagesDto,
  ) {
    return {
      success: true,
      data: await this.service.appendChatMessages(sessionId, dto),
    };
  }

  @Patch('chat-sessions/:sessionId/messages/:seq/feedback')
  @HttpCode(HttpStatus.OK)
  async setChatMessageFeedback(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Param('seq', ParseIntPipe) seq: number,
    @Body() dto: ChatMessageFeedbackDto,
  ) {
    return {
      success: true,
      data: await this.service.setChatMessageFeedback(sessionId, seq, dto),
    };
  }
}
