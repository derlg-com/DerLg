export type SearchHitKind = 'trip' | 'place' | 'hotel' | 'guide';

interface SearchHitBase {
  id: string;
  kind: SearchHitKind;
  title: string;
  image: string | null;
}

export interface TripSearchHit extends SearchHitBase {
  kind: 'trip';
  category: string;
  basePriceUsd: number;
}

export interface PlaceSearchHit extends SearchHitBase {
  kind: 'place';
  category: string;
}

export interface HotelSearchHit extends SearchHitBase {
  kind: 'hotel';
  starRating: number | null;
}

export interface GuideSearchHit extends SearchHitBase {
  kind: 'guide';
  province: string;
  pricePerDayUsd: number;
}

export type SearchHit =
  | TripSearchHit
  | PlaceSearchHit
  | HotelSearchHit
  | GuideSearchHit;
