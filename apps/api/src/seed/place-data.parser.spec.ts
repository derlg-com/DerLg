import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import {
  compareImageNames,
  discoverPlaces,
  parseCreditsFile,
  parseLocationFile,
} from './place-data.parser';

const DATA_ROOT = resolve(__dirname, '../../../../data');

describe('parseLocationFile', () => {
  it('extracts name, city, country, coordinates and maps url', () => {
    const content = [
      'Place      : Angkor Wat',
      'City       : Siem Reap, Cambodia',
      'Google Maps: https://www.google.com/maps/search/?api=1&query=Angkor+Wat',
      'Coordinates: 13.4125, 103.8670 (approx)',
      'Pin link   : https://www.google.com/maps/search/?api=1&query=13.4125,103.8670',
    ].join('\n');

    expect(parseLocationFile(content)).toEqual({
      place: 'Angkor Wat',
      city: 'Siem Reap',
      country: 'Cambodia',
      latitude: 13.4125,
      longitude: 103.867,
      mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Angkor+Wat',
    });
  });

  it('tolerates a byte-order mark and CRLF line endings', () => {
    const content = '\ufeffPlace      : Wat Phnom\r\nCity       : Phnom Penh, Cambodia\r\nCoordinates: 11.5764, 104.9200\r\n';

    expect(parseLocationFile(content)).toMatchObject({
      place: 'Wat Phnom',
      city: 'Phnom Penh',
      latitude: 11.5764,
      longitude: 104.92,
    });
  });

  it('defaults the country when the city line has no comma', () => {
    const content = 'Place      : Somewhere\nCity       : Battambang\nCoordinates: 13.1, 103.2';

    expect(parseLocationFile(content)).toMatchObject({ city: 'Battambang', country: 'Cambodia' });
  });

  it('returns null when coordinates are missing or unparseable', () => {
    expect(parseLocationFile('Place: X\nCity: Y, Cambodia')).toBeNull();
    expect(parseLocationFile('Place: X\nCity: Y\nCoordinates: north-ish, west-ish')).toBeNull();
  });

  it('returns null when the place name is missing', () => {
    expect(parseLocationFile('City: Siem Reap\nCoordinates: 13.4, 103.8')).toBeNull();
  });
});

describe('parseCreditsFile', () => {
  it('maps each photo file name to its attribution', () => {
    const content = [
      '\ufeffImage credits for: Silver Pagoda',
      'All images from Wikimedia Commons - safe for commercial use under listed licenses.',
      '----------------------------------------',
      '',
      'Photo 1 (Silver Pagoda-1.jpg)',
      '  Author : Marcin Konsek',
      '  License: CC BY-SA 4.0',
      '  Source : https://commons.wikimedia.org/wiki/File:One.jpg',
      '',
      'Photo 2 (Silver Pagoda-2.jpg)',
      '  Author : Jakub Hałun',
      '  License: Public domain',
      '  Source : https://commons.wikimedia.org/wiki/File:Two.jpg',
      '',
    ].join('\n');

    const credits = parseCreditsFile(content);

    expect(credits.size).toBe(2);
    expect(credits.get('Silver Pagoda-1.jpg')).toEqual({
      fileName: 'Silver Pagoda-1.jpg',
      author: 'Marcin Konsek',
      license: 'CC BY-SA 4.0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:One.jpg',
    });
    expect(credits.get('Silver Pagoda-2.jpg')).toMatchObject({
      author: 'Jakub Hałun',
      license: 'Public domain',
    });
  });

  it('keeps a url containing colons intact', () => {
    const credits = parseCreditsFile(
      'Photo 1 (a.jpg)\n  Source : https://commons.wikimedia.org/wiki/File:2016_x_(02).jpg\n',
    );

    expect(credits.get('a.jpg')?.sourceUrl).toBe(
      'https://commons.wikimedia.org/wiki/File:2016_x_(02).jpg',
    );
  });

  it('returns an empty map for content with no photo blocks', () => {
    expect(parseCreditsFile('nothing here').size).toBe(0);
  });
});

describe('compareImageNames', () => {
  it('sorts numerically so -2 precedes -10', () => {
    const sorted = ['P-10.jpg', 'P-2.jpg', 'P-1.jpg'].sort(compareImageNames);

    expect(sorted).toEqual(['P-1.jpg', 'P-2.jpg', 'P-10.jpg']);
  });
});

// These run against the real repository fixtures, which is the point: the seed
// must survive the actual (slightly inconsistent) hand-collected data.
const hasRealData = existsSync(DATA_ROOT);
const describeRealData = hasRealData ? describe : describe.skip;

describeRealData('discoverPlaces against the real data/ folder', () => {
  it('finds the documented places and skips the one without location.txt', () => {
    const skipped: Array<{ directory: string; reason: string }> = [];
    const places = discoverPlaces(DATA_ROOT, {
      onSkip: (directory, reason) => skipped.push({ directory, reason }),
    });

    expect(places.length).toBeGreaterThanOrEqual(39);
    expect(skipped.some((entry) => entry.reason === 'missing location.txt')).toBe(true);
    expect(places.every((place) => place.images.length > 0)).toBe(true);
    expect(places.every((place) => place.images.length <= 5)).toBe(true);
    expect(places.every((place) => Number.isFinite(place.location.latitude))).toBe(true);
  });

  it('attaches attribution to images from folders that ship credits.txt', () => {
    const places = discoverPlaces(DATA_ROOT);
    const silverPagoda = places.find((place) => place.location.place === 'Silver Pagoda');

    expect(silverPagoda).toBeDefined();
    expect(silverPagoda?.images[0].credit?.license).toContain('CC BY-SA');
    expect(silverPagoda?.images[0].credit?.author).toBeTruthy();
  });

  it('parses every real location.txt it keeps', () => {
    const places = discoverPlaces(DATA_ROOT);

    for (const place of places) {
      const raw = readFileSync(join(place.directory, 'location.txt'), 'utf8');
      expect(parseLocationFile(raw)).not.toBeNull();
    }
  });
});
