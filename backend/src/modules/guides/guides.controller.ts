import {
  Controller,
  Get,
  Post,
  Body,
  Headers,
  Param,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { parseAcceptLanguage } from '../../common/i18n';
import {
  ListGuidesUseCase,
  GetGuideDetailUseCase,
  GetGuideAvailabilityUseCase,
  BookGuideUseCase,
} from './use-cases';
import { ListGuidesDto, AvailabilityQueryDto, BookGuideDto } from './dto';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';

@Controller('guides')
export class GuidesController {
  constructor(
    private readonly listGuides: ListGuidesUseCase,
    private readonly getGuideDetail: GetGuideDetailUseCase,
    private readonly getGuideAvailability: GetGuideAvailabilityUseCase,
    private readonly bookGuide: BookGuideUseCase,
  ) {}

  @Public()
  @Get()
  list(@Query() query: ListGuidesDto, @Req() req: Request) {
    return this.listGuides.execute(query, parseAcceptLanguage(req));
  }

  @Public()
  @Get(':id')
  detail(@Param('id') id: string, @Req() req: Request) {
    return this.getGuideDetail.execute(id, parseAcceptLanguage(req));
  }

  @Public()
  @Get(':id/availability')
  availability(@Param('id') id: string, @Query() query: AvailabilityQueryDto) {
    return this.getGuideAvailability.execute(id, query);
  }

  @Post(':guideId/bookings')
  book(
    @CurrentUser() user: JwtPayload,
    @Param('guideId') guideId: string,
    @Body() dto: BookGuideDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.bookGuide.execute(user, guideId, dto, idempotencyKey);
  }
}
