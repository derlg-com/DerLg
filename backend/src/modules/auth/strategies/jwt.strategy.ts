import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

/** JWT payload shape after token verification. */
export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

/**
 * Extracts and verifies Bearer tokens from the Authorization header.
 * The returned payload is attached to `request.user` for guards and decorators.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_ACCESS_SECRET')!,
    });
  }

  validate(payload: JwtPayload): JwtPayload {
    return payload;
  }
}
