// Download 100+ real photos into MinIO, organized by schema entity category.
// Source: picsum.photos (free, no API key, deterministic by seed → stable re-runs).
// Writes files to ./images/<category>/ then uploads to MinIO and rebuilds image-urls.json.
const Minio = require('minio');
const fs = require('fs');
const path = require('path');
const https = require('https');

const minioClient = new Minio.Client({
  endPoint: 'localhost',
  port: 9000,
  useSSL: false,
  accessKey: 'derlg-minio-local-docker',
  secretKey: 'derlg-mini-local-docker',
});

const BUCKET = 'derlg-storage';
const BASE_URL = `http://localhost:9000/${BUCKET}`;
const imagesDir = path.join(__dirname, 'images');

// category → { count, w, h }. Counts sum to 100; picsum seed = `${category}-${n}`.
const CATEGORIES = {
  places:    { count: 30, w: 800, h: 600 },
  hotels:    { count: 20, w: 800, h: 600 },
  trips:     { count: 20, w: 800, h: 600 },
  transport: { count: 12, w: 800, h: 600 },
  guides:    { count: 10, w: 400, h: 400 },
  festivals: { count: 10, w: 800, h: 600 },
};

function fetchBuffer(url, redirects = 5) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        if (redirects <= 0) return reject(new Error('Too many redirects'));
        res.resume();
        return resolve(fetchBuffer(res.headers.location, redirects - 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

async function ensureBucket() {
  const exists = await minioClient.bucketExists(BUCKET).catch(() => false);
  if (!exists) {
    await minioClient.makeBucket(BUCKET, 'ap-southeast-1');
    console.log('  ✅ Created bucket');
  }
  const policy = {
    Version: '2012-10-17',
    Statement: [{ Effect: 'Allow', Principal: { AWS: ['*'] }, Action: ['s3:GetObject'], Resource: [`arn:aws:s3:::${BUCKET}/*`] }],
  };
  await minioClient.setBucketPolicy(BUCKET, JSON.stringify(policy));
}

async function main() {
  console.log('🔧 Downloading real images → MinIO\n');
  await ensureBucket();

  const urlMap = {};
  let total = 0;

  for (const [category, cfg] of Object.entries(CATEGORIES)) {
    const dir = path.join(imagesDir, category);
    fs.mkdirSync(dir, { recursive: true });

    for (let n = 1; n <= cfg.count; n++) {
      const objectName = `${category}/${category}-${n}.jpg`;
      const filePath = path.join(imagesDir, objectName);
      const seed = `${category}-${n}`;
      const src = `https://picsum.photos/seed/${seed}/${cfg.w}/${cfg.h}.jpg`;

      let buffer;
      if (fs.existsSync(filePath)) {
        buffer = fs.readFileSync(filePath);
      } else {
        buffer = await fetchBuffer(src);
        fs.writeFileSync(filePath, buffer);
      }

      await minioClient.putObject(BUCKET, objectName, buffer, buffer.length, { 'Content-Type': 'image/jpeg' });
      urlMap[objectName] = `${BASE_URL}/${objectName}`;
      total++;
      if (total % 10 === 0) console.log(`  …${total} uploaded`);
    }
  }

  // Merge with existing named keys (preserve real curated images already referenced by seeds).
  const urlsFile = path.join(__dirname, 'image-urls.json');
  const existing = fs.existsSync(urlsFile) ? JSON.parse(fs.readFileSync(urlsFile, 'utf8')) : {};
  fs.writeFileSync(urlsFile, JSON.stringify({ ...existing, ...urlMap }, null, 2));

  console.log(`\n✅ Done: ${total} real images in MinIO (image-urls.json updated)\n`);
}

main().catch((err) => { console.error('❌ Error:', err.message); process.exit(1); });
