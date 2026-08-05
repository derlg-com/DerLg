export type UserRole = 'TRAVELER' | 'ADMIN';

export interface PublicUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  locale: string;
  createdAt: string;
}

export interface AuthSession {
  user: PublicUser;
  accessToken: string;
  expiresIn: number;
}
