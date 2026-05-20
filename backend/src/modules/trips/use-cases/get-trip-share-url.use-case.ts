import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CachedService } from '../../../common/cache/cached.service';
import { tripShareKey } from '../../../common/cache/cache-keys';

@Injectable()
export class GetTripShareUrlUseCase {
  private readonly frontendUrl: string;

  constructor(
    private readonly cache: CachedService,
    private readonly config: ConfigService,
  ) {
    this.frontendUrl = this.config.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );
  }

  async execute(id: string): Promise<{ url: string }> {
    return this.cache.getOrSet(tripShareKey(id), 86_400, () =>
      Promise.resolve({ url: `${this.frontendUrl}/trips/${id}` }),
    );
  }
}
