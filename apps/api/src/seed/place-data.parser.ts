import { readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';

/**
 * Parsers for the hand-collected `data/<City>/<Place>/` folders:
 *   location.txt — place name, city, coordinates, Google Maps link
 *   credits.txt  — per-photo author / licence / source (a licence obligation:
 *                  most images are CC BY-SA and the attribution must survive
 *                  into the database and back out onto the page)
 *   *.jpg|jpeg|png|webp — the gallery images
 */

export interface ParsedLocation {
  place: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  mapsUrl?: string;
}

export interface ParsedCredit {
  fileName: string;
  author?: string;
  license?: string;
  sourceUrl?: string;
}

export interface DiscoveredPlace {
  directory: string;
  cityFolder: string;
  location: ParsedLocation;
  images: Array<{ fileName: string; absolutePath: string; credit?: ParsedCredit }>;
}

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

function stripBom(value: string): string {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}

function fieldValue(line: string): string {
  const separator = line.indexOf(':');
  return separator === -1 ? '' : line.slice(separator + 1).trim();
}

/**
 * Reads the fixed-width `Key : Value` shape of location.txt. Returns null when
 * the file is missing the coordinates, because a place we cannot map is not
 * useful to the itinerary engine.
 */
export function parseLocationFile(content: string): ParsedLocation | null {
  const lines = stripBom(content).split(/\r?\n/);

  let place = '';
  let cityRaw = '';
  let mapsUrl: string | undefined;
  let latitude: number | undefined;
  let longitude: number | undefined;

  for (const line of lines) {
    if (/^Place\s*:/i.test(line)) {
      place = fieldValue(line);
    } else if (/^City\s*:/i.test(line)) {
      cityRaw = fieldValue(line);
    } else if (/^Google Maps\s*:/i.test(line)) {
      mapsUrl = fieldValue(line);
    } else if (/^Coordinates\s*:/i.test(line)) {
      const coordinates = fieldValue(line)
        .replace(/\(.*?\)/g, '')
        .trim();
      const [rawLat, rawLng] = coordinates.split(',').map((part) => Number(part.trim()));
      if (Number.isFinite(rawLat) && Number.isFinite(rawLng)) {
        latitude = rawLat;
        longitude = rawLng;
      }
    }
  }

  if (!place || latitude === undefined || longitude === undefined) {
    return null;
  }

  const [cityName, countryName] = cityRaw.split(',').map((part) => part.trim());

  return {
    place,
    city: cityName || 'Unknown',
    country: countryName || 'Cambodia',
    latitude,
    longitude,
    mapsUrl,
  };
}

/**
 * Reads credits.txt blocks shaped as:
 *   Photo 1 (Silver Pagoda-1.jpg)
 *     Author : Marcin Konsek
 *     License: CC BY-SA 4.0
 *     Source : https://commons.wikimedia.org/...
 */
export function parseCreditsFile(content: string): Map<string, ParsedCredit> {
  const credits = new Map<string, ParsedCredit>();
  const lines = stripBom(content).split(/\r?\n/);

  let current: ParsedCredit | null = null;

  const commit = () => {
    if (current) {
      credits.set(current.fileName, current);
      current = null;
    }
  };

  for (const line of lines) {
    const header = /^Photo\s+\d+\s*\((.+)\)\s*$/i.exec(line.trim());
    if (header) {
      commit();
      current = { fileName: header[1].trim() };
      continue;
    }

    if (!current) {
      continue;
    }

    if (/^Author\s*:/i.test(line.trim())) {
      current.author = fieldValue(line) || undefined;
    } else if (/^License\s*:/i.test(line.trim())) {
      current.license = fieldValue(line) || undefined;
    } else if (/^Source\s*:/i.test(line.trim())) {
      current.sourceUrl = fieldValue(line) || undefined;
    }
  }

  commit();
  return credits;
}

/** Natural sort so `Place-2.jpg` precedes `Place-10.jpg`. */
export function compareImageNames(a: string, b: string): number {
  return a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' });
}

function isImage(fileName: string): boolean {
  const dot = fileName.lastIndexOf('.');
  return dot !== -1 && IMAGE_EXTENSIONS.has(fileName.slice(dot).toLowerCase());
}

export interface DiscoverOptions {
  /** Maximum images kept per place; galleries never show more than a handful. */
  maxImagesPerPlace?: number;
  onSkip?: (directory: string, reason: string) => void;
}

/**
 * Walks `data/<CityFolder>/<PlaceFolder>` and returns every place that has both
 * parseable coordinates and at least one image. Folders that fail either check
 * are reported through `onSkip` rather than aborting the whole seed.
 */
export function discoverPlaces(dataRoot: string, options: DiscoverOptions = {}): DiscoveredPlace[] {
  const { maxImagesPerPlace = 5, onSkip } = options;
  const discovered: DiscoveredPlace[] = [];

  const cityFolders = readdirSync(dataRoot).filter((entry) =>
    statSync(join(dataRoot, entry)).isDirectory(),
  );

  for (const cityFolder of cityFolders.sort()) {
    const cityPath = join(dataRoot, cityFolder);
    const placeFolders = readdirSync(cityPath).filter((entry) =>
      statSync(join(cityPath, entry)).isDirectory(),
    );

    for (const placeFolder of placeFolders.sort()) {
      const placePath = join(cityPath, placeFolder);
      const entries = readdirSync(placePath);

      if (!entries.includes('location.txt')) {
        onSkip?.(placePath, 'missing location.txt');
        continue;
      }

      const location = parseLocationFile(readFileSync(join(placePath, 'location.txt'), 'utf8'));
      if (!location) {
        onSkip?.(placePath, 'unparseable location.txt');
        continue;
      }

      const credits = entries.includes('credits.txt')
        ? parseCreditsFile(readFileSync(join(placePath, 'credits.txt'), 'utf8'))
        : new Map<string, ParsedCredit>();

      const images = entries
        .filter(isImage)
        .sort(compareImageNames)
        .slice(0, maxImagesPerPlace)
        .map((fileName) => ({
          fileName,
          absolutePath: join(placePath, fileName),
          credit: credits.get(fileName) ?? credits.get(basename(fileName)),
        }));

      if (images.length === 0) {
        onSkip?.(placePath, 'no images');
        continue;
      }

      discovered.push({ directory: placePath, cityFolder, location, images });
    }
  }

  return discovered;
}
