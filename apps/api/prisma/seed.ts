import { PrismaClient } from '@prisma/client';

import { runSeed } from '../src/seed/seed-runner';

/**
 * Entry point for `npm run db:seed`. All logic lives in src/seed/seed-runner.ts
 * so it can be unit tested and reused by the Task 19 R2 migration.
 *
 * Pass `--upload-r2` to upload the place images to Cloudflare R2 instead of
 * (or in addition to) copying them into apps/web/public/seed. Requires R2
 * credentials in the environment; without them the seed aborts up front rather
 * than silently leaving image URLs pointing at a bucket that does not exist.
 */
async function main(): Promise<void> {
  const prisma = new PrismaClient();
  const started = Date.now();
  const uploadR2 = process.argv.includes('--upload-r2');

  try {
    const summary = await runSeed(prisma, {
      uploadR2,
      // eslint-disable-next-line no-console
      log: (message) => console.log(`  ${message}`),
    });

    // eslint-disable-next-line no-console
    console.log(
      `\nSeed complete in ${((Date.now() - started) / 1000).toFixed(1)}s:\n` +
        `  ${summary.cities} cities, ${summary.places} places, ${summary.placeImages} images\n` +
        `  ${summary.hotels} hotels, ${summary.transports} transport routes, ${summary.guides} guides\n` +
        `  ${summary.packages} packages, ${summary.packageDays} days, ${summary.packageDayItems} items`,
    );

    if (uploadR2) {
      // eslint-disable-next-line no-console
      console.log(`  ${summary.r2UploadedImages} R2 images uploaded this run`);
    }

    if (summary.skippedPlaceFolders.length > 0) {
      // eslint-disable-next-line no-console
      console.warn('\nSkipped folders:');
      for (const skipped of summary.skippedPlaceFolders) {
        // eslint-disable-next-line no-console
        console.warn(`  ${skipped.directory} — ${skipped.reason}`);
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  // eslint-disable-next-line no-console
  console.error('Seed failed:', error);
  process.exit(1);
});

void main().catch((error: unknown) => {
  // eslint-disable-next-line no-console
  console.error('Seed failed:', error);
  process.exit(1);
});
