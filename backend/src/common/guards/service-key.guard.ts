import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ServiceKeyGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string> }>();
    const key = request.headers['x-service-key'];
    const expected = this.configService.get<string>('AI_SERVICE_KEY');

    if (!expected || key !== expected) {
      throw new UnauthorizedException('Invalid service key');
    }
    return true;
  }
}
