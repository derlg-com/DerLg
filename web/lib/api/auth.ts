import { api } from '@/lib/api/client'
import type { Locale } from '@/lib/i18n/config'
import { AuthResultSchema, UserSchema } from '@/schemas/domain'

/**
 * Auth endpoints.
 *
 * Every call sends credentials so the httpOnly refresh cookie travels with it.
 * `refresh` returns only a new access token — the user object comes from
 * `register`, `login`, or a follow-up `me()` call.
 */

export interface RegisterInput {
  email: string
  password: string
  /** Both optional in the backend DTO; omitted when blank. */
  name?: string
  phone?: string
}

export interface LoginInput {
  email: string
  password: string
}

export const authApi = {
  async register(input: RegisterInput, locale: Locale) {
    const data = await api.post<unknown>(
      'auth/register',
      // Only send declared fields; the DTO rejects anything else.
      {
        email: input.email,
        password: input.password,
        ...(input.name ? { name: input.name } : {}),
        ...(input.phone ? { phone: input.phone } : {}),
      },
      { locale },
    )
    return AuthResultSchema.parse(data)
  },

  async login(input: LoginInput, locale: Locale) {
    const data = await api.post<unknown>('auth/login', input, { locale })
    return AuthResultSchema.parse(data)
  },

  /** Exchanges the refresh cookie for a new access token. */
  async refresh() {
    const data = await api.post<unknown>('auth/refresh', undefined)
    return AuthResultSchema.parse(data)
  },

  async logout(token: string | null) {
    // Requires the access token; the backend also clears the refresh cookie.
    await api.post<unknown>('auth/logout', undefined, { token })
  },

  async me(token: string, locale: Locale) {
    const data = await api.get<unknown>('users/me', { token, locale })
    return UserSchema.parse(data)
  },
}
