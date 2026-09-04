/**
 * Live driver location as stored in Redis under `driver_location:{driverId}`.
 *
 * Declared rather than inferred from `JSON.parse`, which returns `any` and
 * spread untyped values through both the callback and command handlers.
 */
export interface DriverLocation {
  latitude: number;
  longitude: number;
  /** ISO timestamp of the last update. */
  timestamp?: string;
  accuracyMeters?: number;
}

/**
 * Parses a Redis location payload, returning null for anything malformed.
 *
 * Redis holds whatever was last written, which may predate a shape change or
 * have been truncated, so the numeric fields are checked rather than trusted —
 * a NaN latitude would otherwise reach an emergency alert.
 */
export function parseDriverLocation(raw: string | null): DriverLocation | null {
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object') return null;
  const candidate = parsed as Record<string, unknown>;

  const latitude = Number(candidate.latitude);
  const longitude = Number(candidate.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  return {
    latitude,
    longitude,
    timestamp:
      typeof candidate.timestamp === 'string' ? candidate.timestamp : undefined,
    accuracyMeters: Number.isFinite(Number(candidate.accuracyMeters))
      ? Number(candidate.accuracyMeters)
      : undefined,
  };
}
