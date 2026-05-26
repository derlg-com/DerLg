import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ServiceKeyGuard } from '../../common/guards/service-key.guard';
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
} from './ai-tools.dto';

@UseGuards(ServiceKeyGuard)
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
      data: await this.service.checkPaymentStatus(dto.booking_id),
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
}
