import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AdminRole } from '@prisma/client';

import { AuditInterceptor } from '../interceptors/audit.interceptor';
import { AdminRoles } from '../../../common/decorators/admin-roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AdminTripsService } from '../services/admin-trips.service';
import { ListTripsAdminDto } from '../dto/list-trips-admin.dto';
import { CreateTripDto } from '../dto/create-trip.dto';
import { PublishTripDto, UpdateTripDto } from '../dto/update-trip.dto';
import {
  CreateItineraryItemDto,
  ReorderItineraryDto,
  SetTripGuidesDto,
  UpdateItineraryItemDto,
} from '../dto/trip-itinerary.dto';

/**
 * Trip package CRUD for the admin panel.
 *
 * Trips were previously read-only everywhere — the public controller exposes only
 * list/detail/related/share, and no admin surface existed at all, so packages
 * could only be created by the seed script or hand-written SQL.
 *
 * No `v1/` in the path: `main.ts` already calls `setGlobalPrefix('v1')`.
 * Authorisation comes from the globally registered guards; `@AdminRoles` is what
 * activates `AdminRoleGuard`, and a route without it is NOT admin-protected.
 */
@Controller('admin/trips')
@AdminRoles(AdminRole.OPERATIONS_MANAGER, AdminRole.SUPER_ADMIN)
@Throttle({ default: { limit: 60, ttl: 60_000 } })
@UseInterceptors(AuditInterceptor)
export class AdminTripsController {
  constructor(private readonly service: AdminTripsService) {}

  /**
   * Returned directly so `TransformInterceptor` wraps it as
   * `{ success, data: { data, meta } }`, matching admin/hotels. A hand-built
   * envelope with a sibling `meta` would be stripped by the admin frontend's
   * axios interceptor, silently losing pagination.
   */
  @Get()
  async listTrips(@Query() query: ListTripsAdminDto) {
    return this.service.listTrips({
      search: query.search,
      category: query.category,
      isPublished: query.isPublishedBool,
      page: query.page,
      limit: query.limit,
    });
  }

  @Get(':id')
  async getTrip(@Param('id', ParseUUIDPipe) id: string) {
    return {
      success: true,
      data: await this.service.getTripById(id),
      message: 'ok',
      error: null,
    };
  }

  @Post()
  async createTrip(
    @Body() dto: CreateTripDto,
    @CurrentUser('sub') userId?: string,
  ) {
    const trip = await this.service.createTrip(dto);

    await this.service.createAuditLog({
      userId,
      eventType: 'admin_action',
      entityType: 'TRIP',
      entityId: trip.id,
      metadata: {
        action: 'CREATE_TRIP',
        category: trip.category,
        languages: dto.translations.map((t) => t.language),
        isPublished: trip.isPublished,
      },
    });

    return {
      success: true,
      data: trip,
      message: 'Trip created successfully',
      error: null,
    };
  }

  @Patch(':id')
  async updateTrip(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTripDto,
    @CurrentUser('sub') userId?: string,
  ) {
    const trip = await this.service.updateTrip(id, dto);

    await this.service.createAuditLog({
      userId,
      eventType: 'admin_action',
      entityType: 'TRIP',
      entityId: id,
      metadata: {
        action: 'UPDATE_TRIP',
        changedFields: Object.keys(dto),
        ...(dto.translations
          ? { languages: dto.translations.map((t) => t.language) }
          : {}),
      },
    });

    return {
      success: true,
      data: trip,
      message: 'Trip updated successfully',
      error: null,
    };
  }

  @Patch(':id/publish')
  async setPublished(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PublishTripDto,
    @CurrentUser('sub') userId?: string,
  ) {
    const trip = await this.service.setPublished(id, dto.isPublished);

    await this.service.createAuditLog({
      userId,
      eventType: 'admin_action',
      entityType: 'TRIP',
      entityId: id,
      metadata: {
        action: dto.isPublished ? 'PUBLISH_TRIP' : 'UNPUBLISH_TRIP',
      },
    });

    return {
      success: true,
      data: trip,
      message: dto.isPublished ? 'Trip published' : 'Trip unpublished',
      error: null,
    };
  }

  @Delete(':id')
  async deleteTrip(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('sub') userId?: string,
  ) {
    const result = await this.service.deleteTrip(id);

    await this.service.createAuditLog({
      userId,
      eventType: 'admin_action',
      entityType: 'TRIP',
      entityId: id,
      metadata: { action: 'DELETE_TRIP' },
    });

    return {
      success: true,
      data: result,
      message: 'Trip deleted successfully',
      error: null,
    };
  }

  // ------------------------------------------------------------------ itinerary

  @Get(':id/itinerary')
  async listItinerary(@Param('id', ParseUUIDPipe) id: string) {
    return {
      success: true,
      data: await this.service.listItinerary(id),
      message: 'ok',
      error: null,
    };
  }

  @Post(':id/itinerary')
  async createItineraryItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateItineraryItemDto,
    @CurrentUser('sub') userId?: string,
  ) {
    const itinerary = await this.service.createItineraryItem(id, dto);

    await this.service.createAuditLog({
      userId,
      eventType: 'admin_action',
      entityType: 'TRIP_ITINERARY_ITEM',
      entityId: id,
      metadata: { action: 'CREATE_ITINERARY_ITEM', dayNumber: dto.dayNumber },
    });

    return {
      success: true,
      data: itinerary,
      message: 'Itinerary item created successfully',
      error: null,
    };
  }

  /**
   * Declared before `:tripId/itinerary/:itemId` so the literal `reorder` segment
   * is matched first — otherwise it would bind as an itemId and 404.
   */
  @Patch(':id/itinerary/reorder')
  async reorderItinerary(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReorderItineraryDto,
    @CurrentUser('sub') userId?: string,
  ) {
    const itinerary = await this.service.reorderItinerary(id, dto);

    await this.service.createAuditLog({
      userId,
      eventType: 'admin_action',
      entityType: 'TRIP_ITINERARY_ITEM',
      entityId: id,
      metadata: { action: 'REORDER_ITINERARY', itemCount: dto.items.length },
    });

    return {
      success: true,
      data: itinerary,
      message: 'Itinerary reordered successfully',
      error: null,
    };
  }

  @Patch(':id/itinerary/:itemId')
  async updateItineraryItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateItineraryItemDto,
    @CurrentUser('sub') userId?: string,
  ) {
    const itinerary = await this.service.updateItineraryItem(id, itemId, dto);

    await this.service.createAuditLog({
      userId,
      eventType: 'admin_action',
      entityType: 'TRIP_ITINERARY_ITEM',
      entityId: itemId,
      metadata: {
        action: 'UPDATE_ITINERARY_ITEM',
        changedFields: Object.keys(dto),
      },
    });

    return {
      success: true,
      data: itinerary,
      message: 'Itinerary item updated successfully',
      error: null,
    };
  }

  @Delete(':id/itinerary/:itemId')
  async deleteItineraryItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @CurrentUser('sub') userId?: string,
  ) {
    const itinerary = await this.service.deleteItineraryItem(id, itemId);

    await this.service.createAuditLog({
      userId,
      eventType: 'admin_action',
      entityType: 'TRIP_ITINERARY_ITEM',
      entityId: itemId,
      metadata: { action: 'DELETE_ITINERARY_ITEM' },
    });

    return {
      success: true,
      data: itinerary,
      message: 'Itinerary item deleted successfully',
      error: null,
    };
  }

  // --------------------------------------------------------------------- guides

  /** PUT, not PATCH: the payload replaces the guide set rather than adding to it. */
  @Put(':id/guides')
  async setTripGuides(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetTripGuidesDto,
    @CurrentUser('sub') userId?: string,
  ) {
    const trip = await this.service.setTripGuides(id, dto);

    await this.service.createAuditLog({
      userId,
      eventType: 'admin_action',
      entityType: 'TRIP',
      entityId: id,
      metadata: { action: 'SET_TRIP_GUIDES', guideCount: dto.guideIds.length },
    });

    return {
      success: true,
      data: trip,
      message: 'Trip guides updated successfully',
      error: null,
    };
  }
}
