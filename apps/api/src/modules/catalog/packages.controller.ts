import { Controller, Get, Param, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { Paginated } from '../../common/interfaces/api-response.interface';
import { CatalogService } from './catalog.service';
import { ListPackagesQueryDto } from './dto/list-packages.query.dto';
import { PackageDetail, PackageSummary } from './interfaces/catalog.interface';

@Controller('packages')
@Throttle({ default: { limit: 120, ttl: 60_000 } })
export class PackagesController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  @ResponseMessage('Packages retrieved')
  list(@Query() query: ListPackagesQueryDto): Promise<Paginated<PackageSummary>> {
    return this.catalog.listPackages(query);
  }

  @Get(':slug')
  @ResponseMessage('Package retrieved')
  detail(@Param('slug') slug: string): Promise<PackageDetail> {
    return this.catalog.getPackageBySlug(slug);
  }
}
