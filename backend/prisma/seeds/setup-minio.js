// =============================================================================
// MinIO Setup — Create bucket and upload placeholder images
// =============================================================================

const Minio = require('minio');
const fs = require('fs');
const path = require('path');

const minioClient = new Minio.Client({
  endPoint: 'localhost',
  port: 9000,
  useSSL: false,
  accessKey: 'derlg-minio-local-docker',
  secretKey: 'derlg-mini-local-docker',
});

const BUCKET = 'derlg-storage';

async function setupBucket() {
  console.log('🔧 MinIO Setup\n');

  // Check if bucket exists
  const exists = await minioClient.bucketExists(BUCKET).catch(() => false);
  if (!exists) {
    await minioClient.makeBucket(BUCKET, 'ap-southeast-1');
    console.log(`  ✅ Created bucket: ${BUCKET}`);
  } else {
    console.log(`  ℹ️  Bucket already exists: ${BUCKET}`);
  }

  // Set bucket policy to public read
  const policy = {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: { AWS: ['*'] },
        Action: ['s3:GetObject'],
        Resource: [`arn:aws:s3:::${BUCKET}/*`],
      },
    ],
  };
  await minioClient.setBucketPolicy(BUCKET, JSON.stringify(policy));
  console.log('  ✅ Set bucket policy to public-read');
}

async function uploadPlaceholderImage(objectName, color, label) {
  // Create a simple SVG placeholder
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">
    <rect width="800" height="600" fill="${color}"/>
    <text x="400" y="300" font-family="Arial" font-size="32" fill="white" text-anchor="middle" dy=".3em">${label}</text>
  </svg>`;

  const buffer = Buffer.from(svg);

  await minioClient.putObject(BUCKET, objectName, buffer, buffer.length, {
    'Content-Type': 'image/svg+xml',
  });
  console.log(`  ✅ Uploaded: ${objectName}`);
  return `http://localhost:9000/${BUCKET}/${objectName}`;
}

async function main() {
  await setupBucket();

  console.log('\n📤 Uploading placeholder images...\n');

  const images = {
    // Places
    'places/angkor-wat.jpg': ['#8B4513', 'Angkor Wat'],
    'places/bayon-temple.jpg': ['#A0522D', 'Bayon Temple'],
    'places/ta-prohm.jpg': ['#556B2F', 'Ta Prohm'],
    'places/phnom-penh-royal-palace.jpg': ['#DAA520', 'Royal Palace'],
    'places/sihanoukville-beach.jpg': ['#20B2AA', 'Sihanoukville Beach'],
    'places/tonle-sap.jpg': ['#4682B4', 'Tonle Sap Lake'],
    'places/killing-fields.jpg': ['#696969', 'Killing Fields'],
    'places/national-museum.jpg': ['#8B7355', 'National Museum'],
    'places/bokor-mountain.jpg': ['#2F4F4F', 'Bokor Mountain'],
    'places/ratanakiri-nature.jpg': ['#228B22', 'Ratanakiri Nature'],

    // Hotels
    'hotels/sokha-siem-reap.jpg': ['#4A0E4E', 'Sokha Siem Reap'],
    'hotels/park-hyatt-phnom-penh.jpg': ['#1A1A2E', 'Park Hyatt Phnom Penh'],
    'hotels/raffles-grand.jpg': ['#16213E', 'Raffles Grand'],
    'hotels/belmond-la-residence.jpg': ['#0F3460', 'Belmond La Residence'],
    'hotels/shinta-mani.jpg': ['#533483', 'Shinta Mani'],

    // Trips
    'trips/angkor-classic.jpg': ['#FF6B6B', 'Angkor Classic Tour'],
    'trips/cambodia-highlights.jpg': ['#4ECDC4', 'Cambodia Highlights'],
    'trips/adventure-north.jpg': ['#45B7D1', 'Northern Adventure'],
    'trips/culinary-journey.jpg': ['#F7DC6F', 'Culinary Journey'],
    'trips/beach-escape.jpg': ['#BB8FCE', 'Beach Escape'],

    // Transport
    'transport/tuk-tuk.jpg': ['#E74C3C', 'Tuk Tuk'],
    'transport/van.jpg': ['#3498DB', 'Van'],
    'transport/bus.jpg': ['#2ECC71', 'Bus'],

    // Guides
    'guides/guide-1.jpg': ['#1ABC9C', 'Guide Sokha'],
    'guides/guide-2.jpg': ['#E67E22', 'Guide Dara'],
    'guides/guide-3.jpg': ['#9B59B6', 'Guide Sopheap'],
    'guides/guide-4.jpg': ['#34495E', 'Guide Channary'],

    // Festivals
    'festivals/khmer-new-year.jpg': ['#FF69B4', 'Khmer New Year'],
    'festivals/water-festival.jpg': ['#00CED1', 'Water Festival'],
  };

  const urls = {};
  for (const [objectName, [color, label]] of Object.entries(images)) {
    urls[objectName] = await uploadPlaceholderImage(objectName, color, label);
  }

  // Save URLs to a JSON file for seed scripts to use
  const urlsPath = path.join(__dirname, 'image-urls.json');
  fs.writeFileSync(urlsPath, JSON.stringify(urls, null, 2));
  console.log(`\n💾 Image URLs saved to: ${urlsPath}`);

  console.log('\n✅ MinIO setup complete.\n');
}

main().catch((err) => {
  console.error('❌ MinIO setup failed:', err);
  process.exit(1);
});
