import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface OAuthUrlResponse {
  url: string;
}

@Injectable()
export class GoogleAuthUseCase {
  constructor(private readonly configService: ConfigService) {}

  execute(redirectUriOverride?: string, state?: string): OAuthUrlResponse {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const redirectUri =
      redirectUriOverride ??
      this.configService.get<string>('GOOGLE_REDIRECT_URI') ??
      `${this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000')}/auth/google/callback`;

    const params = new URLSearchParams({
      client_id: clientId ?? '',
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'consent',
    });

    if (state) {
      params.set('state', state);
    }

    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    return { url };
  }
}
