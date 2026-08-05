/**
 * Converts a jsonwebtoken-style TTL ("15m", "1h", "3600") into whole seconds.
 * Seconds are used everywhere downstream because `@nestjs/jwt` types only accept
 * a number or an `ms` template-literal string, and a number is unambiguous.
 */
export function parseTtlSeconds(ttl: string, fallbackSeconds = 900): number {
  const match = /^(\d+)\s*([smhd])?$/.exec(ttl.trim());
  if (!match) {
    return fallbackSeconds;
  }

  const value = Number(match[1]);
  switch (match[2]) {
    case 'd':
      return value * 86_400;
    case 'h':
      return value * 3_600;
    case 'm':
      return value * 60;
    default:
      return value;
  }
}
