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
import { ServiceKeyGuard } from '../common/guards/service-key.guard';
import { AiToolsService } from './ai-tools.service';
import {
  SearchTripsDto,
  SearchHotelsDto,
  SearchGuidesDto,
  CheckAvailabilityDto,
  CreateBookingHoldDto,
  GetWeatherDto,
  GetEmergencyContactsDto,
  SendSosAlertDto,
  GetUserLoyaltyDto,
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

  @Get('availability')
  async checkAvailability(@Query() dto: CheckAvailabilityDto) {
    return { success: true, data: await this.service.checkAvailability(dto) };
  }

  @Post('bookings')
  @HttpCode(HttpStatus.OK)
  async createBookingHold(@Body() dto: CreateBookingHoldDto) {
    return { success: true, data: await this.service.createBookingHold(dto) };
  }

  @Get('weather')
  getWeather(@Query() dto: GetWeatherDto) {
    return { success: true, data: this.service.getWeather(dto.location, dto.date) };
  }

  @Get('emergency-contacts')
  getEmergencyContacts(@Query() dto: GetEmergencyContactsDto) {
    return { success: true, data: this.service.getEmergencyContacts(dto.location) };
  }

  @Post('sos')
  @HttpCode(HttpStatus.OK)
  async sendSosAlert(@Body() dto: SendSosAlertDto) {
    return { success: true, data: await this.service.sendSosAlert(dto) };
  }

  @Get('loyalty')
  async getUserLoyalty(@Query() dto: GetUserLoyaltyDto) {
    return { success: true, data: await this.service.getUserLoyalty(dto.user_id) };
  }
}
