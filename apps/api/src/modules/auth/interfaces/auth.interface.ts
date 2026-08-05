import { UserRole } from '@prisma/client';

/** Shape of the signed access-token payload. */
export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
}

/** Authenticated principal attached to `request.user` by the JWT strategy. */
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
}

export interface PublicUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  locale: string;
  createdAt: Date;
}

export interface AuthSession {
  user: PublicUser;
  accessToken: string;
  /** Seconds until the access token expires; the client refreshes before then. */
  expiresIn: number;
}

/** Internal result carrying the raw refresh token that becomes a cookie. */
export interface AuthSessionWithRefresh extends AuthSession {
  refreshToken: string;
  refreshExpiresAt: Date;
}
