import type { Lang } from '../i18n';

/** All catalog cache keys are prefixed with `cat:` */

export const tripListKey = (query: Record<string, unknown>, lang: Lang) =>
  `cat:trip:list:${lang}:${JSON.stringify(query)}`;

export const tripDetailKey = (id: string, lang: Lang) =>
  `cat:trip:detail:${id}:${lang}`;

export const tripRelatedKey = (id: string, lang: Lang) =>
  `cat:trip:related:${id}:${lang}`;

export const tripShareKey = (id: string) => `cat:trip:share:${id}`;

export const placeListKey = (query: Record<string, unknown>, lang: Lang) =>
  `cat:place:list:${lang}:${JSON.stringify(query)}`;

export const placeDetailKey = (id: string, lang: Lang) =>
  `cat:place:detail:${id}:${lang}`;

export const placeRelatedKey = (id: string, lang: Lang) =>
  `cat:place:related:${id}:${lang}`;

export const nearbyTripsKey = (placeId: string, radiusKm: number, lang: Lang) =>
  `cat:place:nearby-trips:${placeId}:${radiusKm}:${lang}`;

export const nearbyPlacesKey = (
  placeId: string,
  radiusKm: number,
  lang: Lang,
) => `cat:place:nearby-places:${placeId}:${radiusKm}:${lang}`;

export const hotelListKey = (query: Record<string, unknown>, lang: Lang) =>
  `cat:hotel:list:${lang}:${JSON.stringify(query)}`;

export const hotelDetailKey = (id: string, lang: Lang) =>
  `cat:hotel:detail:${id}:${lang}`;

export const hotelRoomsKey = (
  hotelId: string,
  checkIn: string,
  checkOut: string,
) => `cat:hotel:rooms:${hotelId}:${checkIn}:${checkOut}`;

export const guideListKey = (query: Record<string, unknown>, lang: Lang) =>
  `cat:guide:list:${lang}:${JSON.stringify(query)}`;

export const guideDetailKey = (id: string, lang: Lang) =>
  `cat:guide:detail:${id}:${lang}`;

export const guideAvailabilityKey = (id: string, from: string, to: string) =>
  `cat:guide:availability:${id}:${from}:${to}`;

export const vehicleListKey = (query: Record<string, unknown>) =>
  `cat:vehicle:list:${JSON.stringify(query)}`;

export const vehicleDetailKey = (id: string, lang: Lang) =>
  `cat:vehicle:detail:${id}:${lang}`;

export const vehicleAvailabilityKey = (id: string, from: string, to: string) =>
  `cat:vehicle:availability:${id}:${from}:${to}`;

export const searchKey = (
  q: string,
  type: string,
  page: number,
  limit: number,
  lang: Lang,
) => `cat:search:${lang}:${type}:${page}:${limit}:${q}`;
