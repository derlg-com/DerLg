import { copyFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

import { PrismaClient } from '@prisma/client';
import type { ConfigService } from '@nestjs/config';
import slugify from 'slugify';

import { GUIDES, HOTELS, PACKAGES, TRANSPORTS, type PackageSeed } from './catalog-data';
import { PLACE_META, inferPlaceMeta } from './place-meta';
import { discoverPlaces, type DiscoveredPlace } from './place-data.parser';
import { StorageService } from '../modules/storage/storage.service';

/**
 * Idempotent catalogue seed.
 *
 * Everything is upserted on a natural key (slug) so the script can be re-run
 * safely — `seed.spec` asserts that running it twice leaves row counts stable.
 *
 * Images are copied into `apps/web/public/seed/<city>/<place>/` and referenced
 * as `/seed/...`. Task 19 replaces this with an R2 upload behind the same
 * `PlaceImage.url` column.
 */

const REPO_ROOT = resolve(__dirname, '../../../..');
const DATA_ROOT = join(REPO_ROOT, 'data');
const PUBLIC_SEED_DIR = join(REPO_ROOT, 'apps/web/public/seed');

export interface SeedOptions {
  dataRoot?: string;
  publicSeedDir?: string;
  /** Skip copying image files (used by tests to keep runs fast). */
  copyImages?: boolean;
  maxImagesPerPlace?: number;
  log?: (message: string) => void;
  /**
   * Upload place images to R2 and store the R2 public URL in PlaceImage.url.
   * The local /seed copy still happens when `copyImages` is on, so the local
   * fallback remains the default when R2 is off. Requires R2 credentials; if
   * the flag is set but R2 is not configured the seed aborts up front rather
   * than silently writing URLs into a bucket nothing can serve.
   */
  uploadR2?: boolean;
  /**
   * StorageService injection point for tests. In production the runner builds
   * one directly from process.env because the seed runs outside the Nest
   * container. Only constructed when `uploadR2` is true.
   */
  storage?: StorageService;
}

export interface SeedSummary {
  cities: number;
  places: number;
  placeImages: number;
  hotels: number;
  transports: number;
  guides: number;
  packages: number;
  packageDays: number;
  packageDayItems: number;
  skippedPlaceFolders: Array<{ directory: string; reason: string }>;
  /** Count of images actually uploaded to R2 this run (skipped-existing ones don't count). */
  r2UploadedImages: number;
}

function toSlug(value: string): string {
  return slugify(value, { lower: true, strict: true, locale: 'en' });
}

function publicUrlFor(citySlug: string, placeSlug: string, fileName: string, index: number): string {
  // Normalise the on-disk name so URLs never contain spaces or odd characters.
  const extension = extname(fileName).toLowerCase() || '.jpg';
  return `/seed/${citySlug}/${placeSlug}/${index + 1}${extension}`;
}

/**
 * Minimal ConfigService stand-in for the seed, which runs outside the Nest
 * container. Reads process.env directly and applies the same `'' → undefined`
 * normalisation that validateEnv uses, so an empty R2_* value is treated as
 * "not configured" and StorageService reports `isConfigured` correctly.
 */
function envConfigFromProcess(): { get: (key: string) => string | undefined } {
  return {
    get: (key: string) => {
      const value = process.env[key];
      return value === '' ? undefined : value;
    },
  };
}

function contentTypeFor(ext: string): string {
  switch (ext.toLowerCase()) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    default:
      return 'application/octet-stream';
  }
}

export async function runSeed(
  prisma: PrismaClient,
  options: SeedOptions = {},
): Promise<SeedSummary> {
  const {
    dataRoot = DATA_ROOT,
    publicSeedDir = PUBLIC_SEED_DIR,
    copyImages = true,
    maxImagesPerPlace = 5,
    log = () => {},
    uploadR2 = false,
    storage: injectedStorage,
  } = options;

  // R2 is constructed outside the Nest container: tests inject a mock, the CLI
  // builds one from process.env. Abort up front if the flag is set but R2 is not
  // configured, so the seed never silently writes URLs to an unreachable bucket.
  const storage =
    injectedStorage ?? (uploadR2 ? new StorageService(envConfigFromProcess() as unknown as ConfigService) : undefined);
  if (uploadR2 && storage && !storage.isConfigured) {
    throw new Error(
      'Seed was run with --upload-r2 but R2 is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET (and optionally R2_PUBLIC_BASE_URL) before re-running.',
    );
  }
  let r2UploadedImages = 0;

  const skippedPlaceFolders: SeedSummary['skippedPlaceFolders'] = [];
  const discovered: DiscoveredPlace[] = discoverPlaces(dataRoot, {
    maxImagesPerPlace,
    onSkip: (directory, reason) => skippedPlaceFolders.push({ directory, reason }),
  });

  log(`Discovered ${discovered.length} place folders (${skippedPlaceFolders.length} skipped)`);

  // ------------------------------------------------------------- cities
  const cityInputs = new Map<string, { name: string; country: string; lat: number; lng: number }>();
  for (const place of discovered) {
    const slug = toSlug(place.location.city);
    const existing = cityInputs.get(slug);
    if (existing) {
      // Average member coordinates so the city pin lands among its places.
      existing.lat = (existing.lat + place.location.latitude) / 2;
      existing.lng = (existing.lng + place.location.longitude) / 2;
    } else {
      cityInputs.set(slug, {
        name: place.location.city,
        country: place.location.country,
        lat: place.location.latitude,
        lng: place.location.longitude,
      });
    }
  }

  const cityIdBySlug = new Map<string, string>();
  for (const [slug, city] of cityInputs) {
    const record = await prisma.city.upsert({
      where: { slug },
      create: {
        slug,
        name: city.name,
        country: city.country,
        latitude: Number(city.lat.toFixed(6)),
        longitude: Number(city.lng.toFixed(6)),
      },
      update: {
        name: city.name,
        country: city.country,
        latitude: Number(city.lat.toFixed(6)),
        longitude: Number(city.lng.toFixed(6)),
      },
      select: { id: true, slug: true },
    });
    cityIdBySlug.set(record.slug, record.id);
  }
  log(`Cities: ${cityIdBySlug.size}`);

  // ------------------------------------------------------------- places
  const placeIdBySlug = new Map<string, string>();
  let placeImageCount = 0;

  for (const place of discovered) {
    const citySlug = toSlug(place.location.city);
    const cityId = cityIdBySlug.get(citySlug);
    if (!cityId) {
      skippedPlaceFolders.push({ directory: place.directory, reason: 'unknown city' });
      continue;
    }

    const placeSlug = toSlug(place.location.place);
    const meta = PLACE_META[place.location.place] ?? inferPlaceMeta(place.location.place);

    const record = await prisma.place.upsert({
      where: { slug: placeSlug },
      create: {
        slug: placeSlug,
        name: place.location.place,
        cityId,
        description: meta.description,
        category: meta.category,
        latitude: place.location.latitude,
        longitude: place.location.longitude,
        entranceFeeCents: meta.entranceFeeCents,
        visitDurationMinutes: meta.visitDurationMinutes,
        dailyCapacity: meta.dailyCapacity,
        mapsUrl: place.location.mapsUrl,
      },
      update: {
        name: place.location.place,
        cityId,
        description: meta.description,
        category: meta.category,
        latitude: place.location.latitude,
        longitude: place.location.longitude,
        entranceFeeCents: meta.entranceFeeCents,
        visitDurationMinutes: meta.visitDurationMinutes,
        dailyCapacity: meta.dailyCapacity,
        mapsUrl: place.location.mapsUrl,
      },
      select: { id: true },
    });
    placeIdBySlug.set(placeSlug, record.id);

    if (copyImages) {
      mkdirSync(join(publicSeedDir, citySlug, placeSlug), { recursive: true });
    }

    // Replace the gallery wholesale: positions must stay contiguous and the
    // source folder is the authority.
    await prisma.placeImage.deleteMany({ where: { placeId: record.id } });

    for (const [index, image] of place.images.entries()) {
      // Local /seed URL is the default; R2 replaces the value when enabled.
      // keyFor reproduces the same /seed/<city>/<place>/<n><ext> shape so the
      // R2 public URL is a drop-in for the local path.
      const ext = extname(image.fileName).toLowerCase() || '.jpg';
      const localFileName = `${index + 1}${ext}`;
      let url = publicUrlFor(citySlug, placeSlug, image.fileName, index);

      if (uploadR2 && storage) {
        const key = storage.keyFor({ citySlug, placeSlug, index, ext });
        // Idempotent: a re-run skips objects that are already in the bucket so
        // the seed can be re-run without re-uploading ~112MB each time.
        const alreadyExists = await storage.exists(key);
        if (!alreadyExists) {
          const body = readFileSync(image.absolutePath);
          await storage.uploadFromBytes({ key, body, contentType: contentTypeFor(ext) });
          r2UploadedImages += 1;
        }
        url = await storage.publicUrl(key);
      }

      if (copyImages) {
        // Derive the destination from the index, not from `url`: a presigned R2
        // GET URL carries query params that would corrupt the filename.
        const destination = join(publicSeedDir, citySlug, placeSlug, localFileName);
        if (!existsSync(destination)) {
          copyFileSync(image.absolutePath, destination);
        }
      }

      await prisma.placeImage.create({
        data: {
          placeId: record.id,
          url,
          position: index,
          // Attribution is a CC BY-SA licence obligation: the R2 rewrite only
          // changes the URL value, never the credit fields.
          author: image.credit?.author,
          license: image.credit?.license,
          sourceUrl: image.credit?.sourceUrl,
        },
      });
      placeImageCount += 1;
    }
  }
  log(`Places: ${placeIdBySlug.size} (${placeImageCount} images)`);

  // ------------------------------------------------------------- hotels
  const hotelIdBySlug = new Map<string, string>();
  for (const hotel of HOTELS) {
    const cityId = cityIdBySlug.get(hotel.citySlug);
    if (!cityId) {
      throw new Error(`Hotel ${hotel.slug} references unknown city ${hotel.citySlug}`);
    }
    const { citySlug: _citySlug, ...fields } = hotel;
    const record = await prisma.hotel.upsert({
      where: { slug: hotel.slug },
      create: { ...fields, cityId },
      update: { ...fields, cityId },
      select: { id: true },
    });
    hotelIdBySlug.set(hotel.slug, record.id);
  }
  log(`Hotels: ${hotelIdBySlug.size}`);

  // ---------------------------------------------------------- transport
  const transportIdBySlug = new Map<string, string>();
  for (const transport of TRANSPORTS) {
    const originCityId = cityIdBySlug.get(transport.originCitySlug);
    const destinationCityId = cityIdBySlug.get(transport.destinationCitySlug);
    if (!originCityId || !destinationCityId) {
      throw new Error(`Transport ${transport.slug} references an unknown city`);
    }
    const {
      originCitySlug: _originCitySlug,
      destinationCitySlug: _destinationCitySlug,
      ...fields
    } = transport;
    const record = await prisma.transport.upsert({
      where: { slug: transport.slug },
      create: { ...fields, originCityId, destinationCityId },
      update: { ...fields, originCityId, destinationCityId },
      select: { id: true },
    });
    transportIdBySlug.set(transport.slug, record.id);
  }
  log(`Transports: ${transportIdBySlug.size}`);

  // ------------------------------------------------------------- guides
  const guideIdBySlug = new Map<string, string>();
  for (const guide of GUIDES) {
    const cityId = cityIdBySlug.get(guide.citySlug);
    if (!cityId) {
      throw new Error(`Guide ${guide.slug} references unknown city ${guide.citySlug}`);
    }
    const { citySlug: _citySlug, ...fields } = guide;
    const record = await prisma.guide.upsert({
      where: { slug: guide.slug },
      create: { ...fields, cityId },
      update: { ...fields, cityId },
      select: { id: true },
    });
    guideIdBySlug.set(guide.slug, record.id);
  }
  log(`Guides: ${guideIdBySlug.size}`);

  // ----------------------------------------------------------- packages
  function resolveRef(pkg: PackageSeed, type: string, refSlug?: string): string | null {
    if (!refSlug) {
      return null;
    }
    const id =
      type === 'PLACE'
        ? placeIdBySlug.get(refSlug)
        : type === 'HOTEL'
          ? hotelIdBySlug.get(refSlug)
          : type === 'TRANSPORT'
            ? transportIdBySlug.get(refSlug)
            : type === 'GUIDE'
              ? guideIdBySlug.get(refSlug)
              : undefined;

    if (!id) {
      throw new Error(`Package ${pkg.slug} references unknown ${type} "${refSlug}"`);
    }
    return id;
  }

  let packageDayCount = 0;
  let packageDayItemCount = 0;

  for (const pkg of PACKAGES) {
    const cityId = cityIdBySlug.get(pkg.citySlug);
    if (!cityId) {
      throw new Error(`Package ${pkg.slug} references unknown city ${pkg.citySlug}`);
    }

    const heroPlaceId = placeIdBySlug.get(pkg.heroPlaceSlug);
    const heroImage = heroPlaceId
      ? await prisma.placeImage.findFirst({
          where: { placeId: heroPlaceId },
          orderBy: { position: 'asc' },
          select: { url: true },
        })
      : null;

    const packageFields = {
      title: pkg.title,
      summary: pkg.summary,
      cityId,
      kind: pkg.kind,
      pricingMode: pkg.pricingMode,
      durationDays: pkg.durationDays,
      basePriceCents: pkg.basePriceCents,
      minGroupSize: pkg.minGroupSize,
      maxGroupSize: pkg.maxGroupSize,
      kidFriendly: pkg.kidFriendly,
      featured: pkg.featured,
      heroImageUrl: heroImage?.url ?? null,
      highlights: pkg.highlights,
      inclusions: pkg.inclusions,
      exclusions: pkg.exclusions,
    };

    const record = await prisma.package.upsert({
      where: { slug: pkg.slug },
      create: { slug: pkg.slug, ...packageFields },
      update: packageFields,
      select: { id: true },
    });

    // Days and items are regenerated from the seed definition, which is the
    // source of truth for template content.
    await prisma.packageDay.deleteMany({ where: { packageId: record.id } });

    for (const day of pkg.days) {
      const dayRecord = await prisma.packageDay.create({
        data: {
          packageId: record.id,
          dayNumber: day.dayNumber,
          title: day.title,
          summary: day.summary,
        },
        select: { id: true },
      });
      packageDayCount += 1;

      for (const [position, item] of day.items.entries()) {
        await prisma.packageDayItem.create({
          data: {
            dayId: dayRecord.id,
            position,
            type: item.type,
            refId: resolveRef(pkg, item.type, item.refSlug),
            title: item.title,
            description: item.description ?? '',
            startTime: item.startTime,
            durationMinutes: item.durationMinutes,
            priceCents: item.priceCents ?? 0,
            // CUSTOM items are never bookable (Task 16 relies on this invariant).
            bookable: item.bookable ?? item.type !== 'CUSTOM',
          },
        });
        packageDayItemCount += 1;
      }
    }
  }
  log(`Packages: ${PACKAGES.length} (${packageDayCount} days, ${packageDayItemCount} items)`);

  return {
    cities: cityIdBySlug.size,
    places: placeIdBySlug.size,
    placeImages: placeImageCount,
    hotels: hotelIdBySlug.size,
    transports: transportIdBySlug.size,
    guides: guideIdBySlug.size,
    packages: PACKAGES.length,
    packageDays: packageDayCount,
    packageDayItems: packageDayItemCount,
    skippedPlaceFolders,
    r2UploadedImages,
  };
}
