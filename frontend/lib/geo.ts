/** Capital of Cambodia — used as the distance origin for trip maps. */
export const PHNOM_PENH = { lat: 11.5564, lng: 104.9282 }

export interface LatLng {
  lat: number
  lng: number
}

/** Great-circle distance in km between two points (haversine). */
export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}
