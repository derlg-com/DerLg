import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuditInterceptor } from '../interceptors/audit.interceptor';
import { AdminRoles } from '../../../common/decorators/admin-roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AdminHotelsService } from '../services/admin-hotels.service';
import { AdminRole } from '@prisma/client';
import { CreateHotelDto } from '../dto/create-hotel.dto';
import { UpdateHotelDto } from '../dto/update-hotel.dto';
import { CreateRoomDto } from '../dto/create-room.dto';
import { UpdateRoomDto } from '../dto/update-room.dto';

@Controller('admin/hotels')
@AdminRoles(AdminRole.OPERATIONS_MANAGER, AdminRole.SUPER_ADMIN)
@Throttle({ default: { limit: 60, ttl: 60_000 } })
@UseInterceptors(AuditInterceptor)
export class AdminHotelsController {
  constructor(private readonly service: AdminHotelsService) {}

  @Get()
  async getAllHotels(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getAllHotels({ search, page, limit });
  }

  @Get(':id')
  async getHotelById(@Param('id') id: string) {
    return this.service.getHotelById(id);
  }

  @Post()
  async createHotel(
    @Body() dto: CreateHotelDto,
    @CurrentUser('sub') userId?: string,
  ) {
    const hotel = await this.service.createHotel(dto);

    await this.service.createAuditLog({
      userId,
      eventType: 'admin_action',
      entityType: 'HOTEL',
      entityId: hotel.id,
      metadata: {
        action: 'CREATE_HOTEL',
        name: hotel.name,
      },
    });

    return {
      success: true,
      data: hotel,
      message: 'ok',
      error: null,
    };
  }

  @Patch(':id')
  async updateHotel(
    @Param('id') id: string,
    @Body() dto: UpdateHotelDto,
    @CurrentUser('sub') userId?: string,
  ) {
    const hotel = await this.service.updateHotel(id, dto);

    await this.service.createAuditLog({
      userId,
      eventType: 'admin_action',
      entityType: 'HOTEL',
      entityId: id,
      metadata: {
        action: 'UPDATE_HOTEL',
        changedFields: Object.keys(dto),
      },
    });

    return {
      success: true,
      data: hotel,
      message: 'ok',
      error: null,
    };
  }

  @Get(':id/rooms')
  async getHotelRooms(@Param('id') id: string) {
    const rooms = await this.service.getHotelRooms(id);
    return {
      success: true,
      data: rooms,
      message: 'ok',
      error: null,
    };
  }

  @Post(':id/rooms')
  async createRoom(
    @Param('id') id: string,
    @Body() dto: CreateRoomDto,
    @CurrentUser('sub') userId?: string,
  ) {
    const room = await this.service.createRoom(id, dto);

    await this.service.createAuditLog({
      userId,
      eventType: 'admin_action',
      entityType: 'HOTEL_ROOM',
      entityId: room.id,
      metadata: {
        action: 'CREATE_ROOM',
        hotelId: id,
        roomType: room.roomType,
      },
    });

    return {
      success: true,
      data: room,
      message: 'ok',
      error: null,
    };
  }

  @Patch(':hotelId/rooms/:roomId')
  async updateRoom(
    @Param('hotelId') hotelId: string,
    @Param('roomId') roomId: string,
    @Body() dto: UpdateRoomDto,
    @CurrentUser('sub') userId?: string,
  ) {
    const room = await this.service.updateRoom(hotelId, roomId, dto);

    await this.service.createAuditLog({
      userId,
      eventType: 'admin_action',
      entityType: 'HOTEL_ROOM',
      entityId: roomId,
      metadata: {
        action: 'UPDATE_ROOM',
        hotelId,
        changedFields: Object.keys(dto),
      },
    });

    return {
      success: true,
      data: room,
      message: 'ok',
      error: null,
    };
  }

  @Get(':hotelId/rooms/:roomId/availability')
  async getRoomAvailability(
    @Param('hotelId') hotelId: string,
    @Param('roomId') roomId: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    if (!startDate || !endDate) {
      return {
        success: false,
        data: null,
        message: 'start_date and end_date are required',
        error: 'Missing required query parameters',
      };
    }

    const result = await this.service.getRoomAvailability(
      roomId,
      startDate,
      endDate,
    );
    return {
      success: true,
      data: result,
      message: 'ok',
      error: null,
    };
  }
}
