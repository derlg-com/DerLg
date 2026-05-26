import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface OAuthUrlResponse {
  url: string;
}

@Injectable()
export class GoogleAuthUseCase {
  constructor(private readonly configService: ConfigService) {}

  execute(): OAuthUrlResponse {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const redirectUri = `${this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000')}/auth/google/callback`;

    const params = new URLSearchParams({
      client_id: clientId ?? '',
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'consent',
    });

    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    return { url };
  }
}
