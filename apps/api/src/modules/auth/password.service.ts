import { createHash, randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

/**
 * Password and refresh-token cryptography, isolated so the parameters are
 * auditable in one place.
 *
 * Passwords use argon2id with OWASP-recommended parameters (19 MiB, 2 passes).
 * Refresh tokens are 256 bits of randomness stored as a SHA-256 digest: they
 * are high-entropy already, so a slow KDF buys nothing, and a fast digest keeps
 * the rotation path cheap. Only the digest is ever persisted, so a database
 * leak cannot be replayed against the refresh endpoint.
 */
@Injectable()
export class PasswordService {
  private readonly argonOptions: argon2.HashOptions = {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  };

  hash(plain: string): Promise<string> {
    return argon2.hash(plain, this.argonOptions);
  }

  async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      // A malformed stored hash must read as "wrong password", never as a 500.
      return false;
    }
  }

  generateRefreshToken(): string {
    return randomBytes(32).toString('base64url');
  }

  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
