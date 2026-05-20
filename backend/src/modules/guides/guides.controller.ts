import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { parseAcceptLanguage } from '../../common/i18n';
import {
  ListGuidesUseCase,
  GetGuideDetailUseCase,
  GetGuideAvailabilityUseCase,
} from './use-cases';
import { ListGuidesDto, AvailabilityQueryDto } from './dto';

@Controller('guides')
export class GuidesController {
  constructor(
    private readonly listGuides: ListGuidesUseCase,
    private readonly getGuideDetail: GetGuideDetailUseCase,
    private readonly getGuideAvailability: GetGuideAvailabilityUseCase,
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
}
