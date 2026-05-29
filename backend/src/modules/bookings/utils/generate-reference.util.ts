import { randomUUID } from 'node:crypto';

export type ReferenceKind =
  | 'GDE'
  | 'HTL'
  | 'TRN'
  | 'TRP'
  | 'PKG'
  | 'PRV'
  | 'CSM';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Generates `<KIND>-<6CHAR>` (e.g. "GDE-7K2QRX"). The 6-char body is
 * base32-uppercase derived from a fresh UUID. Collision probability with
 * 6 chars over base32 is ~1 in 1B; the unique constraint on
 * `Booking.reference` plus a retry on P2002 in the calling use case covers
 * the residual risk.
 */
export function generateReference(kind: ReferenceKind): string {
  const uuid = randomUUID().replace(/-/g, '');
  let value = BigInt('0x' + uuid.slice(0, 16));
  let body = '';
  for (let i = 0; i < 6; i++) {
    body = BASE32_ALPHABET[Number(value & 31n)] + body;
    value = value >> 5n;
  }
  return `${kind}-${body}`;
}
