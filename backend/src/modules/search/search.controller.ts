import { Controller, Get, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { parseAcceptLanguage } from '../../common/i18n';
import { GlobalSearchUseCase } from './use-cases';
import { SearchQueryDto } from './dto';

@Controller('search')
export class SearchController {
  constructor(private readonly globalSearch: GlobalSearchUseCase) {}

  @Public()
  @Get()
  search(@Query() query: SearchQueryDto, @Req() req: Request) {
    return this.globalSearch.execute(query, parseAcceptLanguage(req));
  }
}
