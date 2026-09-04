import { mapHotelDetail, type HotelDetailRow } from './map-hotel.util';

const baseRow = (rooms?: { priceUsd: number }[]): HotelDetailRow => ({
  id: 'h1',
  type: null,
  starRating: 4,
  images: ['cover.jpg', 'room.jpg'],
  latitude: 13.3671,
  longitude: 103.8448,
  amenities: ['Pool', 'WiFi'],
  translations: [
    {
      language: 'en',
      name: 'Riverside Hotel',
      address: 'Street 1, Siem Reap',
      description: 'A nice hotel',
    },
  ],
  ...(rooms ? { rooms } : {}),
});

describe('mapHotelDetail', () => {
  it('surfaces priceFromUsd from the cheapest active room', () => {
    // GetHotelDetailUseCase orders rooms by priceUsd asc and takes 1, so the
    // first room is the cheapest.
    const result = mapHotelDetail(baseRow([{ priceUsd: 45 }]), 'en');
    expect(result.priceFromUsd).toBe(45);
    expect(result.name).toBe('Riverside Hotel');
  });

  it('returns null priceFromUsd when the hotel has no active rooms', () => {
    const result = mapHotelDetail(baseRow(), 'en');
    expect(result.priceFromUsd).toBeNull();
  });
});
