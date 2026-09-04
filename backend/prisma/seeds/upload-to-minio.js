// Upload all seed images to MinIO
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
const imagesDir = path.join(__dirname, 'images');

function escapeXml(unsafe) {
  return String(unsafe).replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

function createSvgPlaceholder(width, height, bgColor, text, subtext, textColor = 'white') {
  const safeText = escapeXml(text);
  const safeSubtext = escapeXml(subtext);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${bgColor};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${shadeColor(bgColor, -20)};stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  <circle cx="${width/2}" cy="${height/2 - 30}" r="50" fill="${shadeColor(bgColor, 20)}" opacity="0.3"/>
  <text x="${width/2}" y="${height/2 - 20}" font-family="Arial, sans-serif" font-size="24" fill="${textColor}" text-anchor="middle" opacity="0.9">${safeText}</text>
  <text x="${width/2}" y="${height/2 + 15}" font-family="Arial, sans-serif" font-size="14" fill="${textColor}" text-anchor="middle" opacity="0.7">${safeSubtext}</text>
</svg>`;
  return Buffer.from(svg);
}

function shadeColor(color, percent) {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, Math.min(255, (num >> 16) + amt));
  const G = Math.max(0, Math.min(255, (num >> 8 & 0x00FF) + amt));
  const B = Math.max(0, Math.min(255, (num & 0x0000FF) + amt));
  return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

const imageConfigs = {
  // Places
  'places/phnom-penh-royal-palace.jpg': { w: 800, h: 600, bg: '#C9A84C', text: 'Royal Palace', sub: 'Phnom Penh' },
  'places/tonle-sap.jpg':               { w: 800, h: 600, bg: '#4682B4', text: 'Tonle Sap', sub: 'Largest Lake in SEA' },
  'places/killing-fields.jpg':          { w: 800, h: 600, bg: '#5D5D5D', text: 'Choeung Ek', sub: 'Memorial Site' },
  'places/national-museum.jpg':         { w: 800, h: 600, bg: '#8B6914', text: 'National Museum', sub: 'Phnom Penh' },
  'places/bokor-mountain.jpg':          { w: 800, h: 600, bg: '#2F4F4F', text: 'Bokor Mountain', sub: 'Kampot Province' },
  'places/ratanakiri-nature.jpg':       { w: 800, h: 600, bg: '#228B22', text: 'Yeak Lom Lake', sub: 'Ratanakiri' },
  // Hotels
  'hotels/sokha-siem-reap.jpg':         { w: 800, h: 600, bg: '#4A0E4E', text: 'Sokha Hotel', sub: 'Siem Reap' },
  'hotels/park-hyatt-phnom-penh.jpg':   { w: 800, h: 600, bg: '#1A1A2E', text: 'Park Hyatt', sub: 'Phnom Penh' },
  'hotels/raffles-grand.jpg':           { w: 800, h: 600, bg: '#16213E', text: 'Raffles Grand', sub: 'Siem Reap' },
  'hotels/belmond-la-residence.jpg':    { w: 800, h: 600, bg: '#0F3460', text: 'Belmond La Residence', sub: 'Phnom Penh' },
  'hotels/shinta-mani.jpg':             { w: 800, h: 600, bg: '#533483', text: 'Shinta Mani', sub: 'Siem Reap' },
  // Trips
  'trips/angkor-classic.jpg':           { w: 800, h: 600, bg: '#FF6B6B', text: 'Angkor Classic', sub: '3 Days' },
  'trips/cambodia-highlights.jpg':      { w: 800, h: 600, bg: '#4ECDC4', text: 'Cambodia Highlights', sub: '7 Days' },
  'trips/adventure-north.jpg':          { w: 800, h: 600, bg: '#45B7D1', text: 'Northern Adventure', sub: '5 Days' },
  'trips/culinary-journey.jpg':         { w: 800, h: 600, bg: '#F7DC6F', text: 'Culinary Journey', sub: '4 Days' },
  'trips/beach-escape.jpg':             { w: 800, h: 600, bg: '#BB8FCE', text: 'Beach Escape', sub: '3 Days' },
  // Transport
  'transport/tuk-tuk.jpg':              { w: 800, h: 600, bg: '#E74C3C', text: 'Tuk Tuk', sub: 'Local Transport' },
  'transport/van.jpg':                  { w: 800, h: 600, bg: '#3498DB', text: 'Van', sub: 'Private Transfer' },
  'transport/bus.jpg':                  { w: 800, h: 600, bg: '#2ECC71', text: 'Bus', sub: 'Shared Transport' },
  // Guides
  'guides/guide-1.jpg':                 { w: 400, h: 400, bg: '#1ABC9C', text: 'Guide Sokha', sub: 'English & Chinese' },
  'guides/guide-2.jpg':                { w: 400, h: 400, bg: '#E67E22', text: 'Guide Dara', sub: 'English & French' },
  'guides/guide-3.jpg':                { w: 400, h: 400, bg: '#9B59B6', text: 'Guide Sopheap', sub: 'English & Khmer' },
  'guides/guide-4.jpg':                { w: 400, h: 400, bg: '#34495E', text: 'Guide Channary', sub: 'English & Chinese' },
  // Festivals
  'festivals/khmer-new-year.jpg':       { w: 800, h: 600, bg: '#FF69B4', text: 'Khmer New Year', sub: 'April' },
  'festivals/water-festival.jpg':       { w: 800, h: 600, bg: '#00CED1', text: 'Water Festival', sub: 'November' },
};

async function main() {
  console.log('🔧 MinIO Upload\n');

  // Check bucket
  const exists = await minioClient.bucketExists(BUCKET).catch(() => false);
  if (!exists) {
    await minioClient.makeBucket(BUCKET, 'ap-southeast-1');
    console.log('  ✅ Created bucket');
  } else {
    console.log('  ℹ️  Bucket exists');
  }

  // Real photos mapping: map named objects to high-res real photos
  const realImages = {
    // Places
    'places/angkor-wat.jpg':              path.join(imagesDir, 'places/angkor-wat.jpg'),
    'places/bayon-temple.jpg':            path.join(imagesDir, 'places/bayon-temple.jpg'),
    'places/ta-prohm.jpg':                path.join(imagesDir, 'places/ta-prohm.jpg'),
    'places/sihanoukville-beach.jpg':     path.join(imagesDir, 'places/sihanoukville-beach.jpg'),
    'places/phnom-penh-royal-palace.jpg': path.join(imagesDir, 'places/phnom-penh-royal-palace.jpg'),
    'places/tonle-sap.jpg':               path.join(imagesDir, 'places/tonle-sap.jpg'),
    'places/killing-fields.jpg':          path.join(imagesDir, 'places/killing-fields.jpg'),
    'places/national-museum.jpg':         path.join(imagesDir, 'places/national-museum.jpg'),
    'places/bokor-mountain.jpg':          path.join(imagesDir, 'places/bokor-mountain.jpg'),
    'places/ratanakiri-nature.jpg':       path.join(imagesDir, 'places/ratanakiri-nature.jpg'),
    // Hotels
    'hotels/sokha-siem-reap.jpg':         path.join(imagesDir, 'hotels/sokha-siem-reap.jpg'),
    'hotels/park-hyatt-phnom-penh.jpg':   path.join(imagesDir, 'hotels/hotels-1.jpg'),
    'hotels/raffles-grand.jpg':           path.join(imagesDir, 'hotels/hotels-2.jpg'),
    'hotels/belmond-la-residence.jpg':    path.join(imagesDir, 'hotels/hotels-3.jpg'),
    'hotels/shinta-mani.jpg':             path.join(imagesDir, 'hotels/hotels-4.jpg'),
    // Trips
    'trips/angkor-classic.jpg':           path.join(imagesDir, 'trips/trips-1.jpg'),
    'trips/cambodia-highlights.jpg':      path.join(imagesDir, 'trips/trips-2.jpg'),
    'trips/adventure-north.jpg':          path.join(imagesDir, 'trips/trips-3.jpg'),
    'trips/culinary-journey.jpg':         path.join(imagesDir, 'trips/trips-4.jpg'),
    'trips/beach-escape.jpg':             path.join(imagesDir, 'trips/trips-5.jpg'),
    // Guides
    'guides/guide-1.jpg':                 path.join(imagesDir, 'guides/guides-1.jpg'),
    'guides/guide-2.jpg':                 path.join(imagesDir, 'guides/guides-2.jpg'),
    'guides/guide-3.jpg':                 path.join(imagesDir, 'guides/guides-3.jpg'),
    'guides/guide-4.jpg':                 path.join(imagesDir, 'guides/guides-4.jpg'),
    // Transport
    'transport/tuk-tuk.jpg':              path.join(imagesDir, 'transport/transport-1.jpg'),
    'transport/van.jpg':                  path.join(imagesDir, 'transport/transport-2.jpg'),
    'transport/bus.jpg':                  path.join(imagesDir, 'transport/transport-3.jpg'),
    // Festivals
    'festivals/khmer-new-year.jpg':       path.join(imagesDir, 'festivals/festivals-1.jpg'),
    'festivals/water-festival.jpg':       path.join(imagesDir, 'festivals/festivals-2.jpg'),
  };

  const uploadedReal = new Set();

  // 1. Upload real photos
  for (const [objectName, filePath] of Object.entries(realImages)) {
    if (fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const mimeType = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'application/octet-stream';
      await minioClient.putObject(BUCKET, objectName, fs.createReadStream(filePath), stat.size, { 'Content-Type': mimeType });
      uploadedReal.add(objectName);
      console.log(`  ✅ Uploaded (real photo): ${objectName}`);
    }
  }

  // 2. Upload all other files in imagesDir recursively
  if (fs.existsSync(imagesDir)) {
    const categories = fs.readdirSync(imagesDir);
    for (const cat of categories) {
      const catDir = path.join(imagesDir, cat);
      if (fs.statSync(catDir).isDirectory()) {
        const files = fs.readdirSync(catDir);
        for (const file of files) {
          const objectName = `${cat}/${file}`;
          const filePath = path.join(catDir, file);
          if (!uploadedReal.has(objectName) && fs.statSync(filePath).isFile()) {
            const stat = fs.statSync(filePath);
            const ext = path.extname(filePath).toLowerCase();
            const mimeType = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'application/octet-stream';
            await minioClient.putObject(BUCKET, objectName, fs.createReadStream(filePath), stat.size, { 'Content-Type': mimeType });
            uploadedReal.add(objectName);
            console.log(`  ✅ Uploaded (gallery image): ${objectName}`);
          }
        }
      }
    }
  }

  // 3. Only upload SVG placeholders for keys that were NOT covered by real images
  for (const [objectName, config] of Object.entries(imageConfigs)) {
    if (!uploadedReal.has(objectName)) {
      const svgBuffer = createSvgPlaceholder(config.w, config.h, config.bg, config.text, config.sub);
      await minioClient.putObject(BUCKET, objectName, svgBuffer, svgBuffer.length, { 'Content-Type': 'image/svg+xml' });
      console.log(`  ✅ Uploaded (svg with viewBox): ${objectName}`);
    }
  }

  // Set public-read policy
  const policy = {
    Version: '2012-10-17',
    Statement: [{
      Effect: 'Allow',
      Principal: { AWS: ['*'] },
      Action: ['s3:GetObject'],
      Resource: [`arn:aws:s3:::${BUCKET}/*`],
    }],
  };
  await minioClient.setBucketPolicy(BUCKET, JSON.stringify(policy));

  console.log('\n✅ MinIO upload complete!\n');
}

main().catch(err => { console.error('❌ Error:', err.message); process.exit(1); });
