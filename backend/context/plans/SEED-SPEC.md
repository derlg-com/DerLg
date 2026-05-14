# DerLg Seed Data Specification

> What data to seed, in what order, for which environment, and why. Seed data is not optional — it is required for local development, E2E tests, and demo environments.

---

## Environments

| Environment | Database | Seed Data | Purpose |
|-------------|----------|-----------|---------|
| Local dev | Docker Postgres | Full seed | Developer daily use |
| E2E tests | Docker Postgres (test DB) | Minimal seed | Test isolation |
| Staging | Supabase | Full seed | QA, demo |
| Production | Supabase | No seed (manual admin) | Live users |

---

## Seed Order

Dependencies determine order. Seed in this exact sequence:

```
1. Users (admins, test users, guide users)
2. Guides
3. Hotels + HotelRooms
4. Places
5. Trips
6. TransportationVehicles
7. Bookings (optional for local dev)
8. Reviews (optional for local dev)
9. DiscountCodes
10. Festivals
```

---

## Seed Data Sets

### 1. Users

**Count:** 5 users

| Email | Role | Name | Purpose |
|-------|------|------|---------|
| admin@derlg.com | ADMIN | Admin User | Admin portal access |
| user@derlg.com | USER | Test User | Standard user testing |
| student@derlg.com | STUDENT | Student User | Student discount testing |
| guide@derlg.com | GUIDE | Guide User | Guide profile testing |
| user2@derlg.com | USER | Second User | Multi-user testing |

**Password:** `TestPass123!` (all users, bcrypt hashed)

```typescript
// prisma/seed/users.ts
export const seedUsers = async (prisma: PrismaClient) => {
  const passwordHash = await bcrypt.hash('TestPass123!', 12);

  await prisma.user.createMany({
    data: [
      {
        id: '00000000-0000-0000-0000-000000000001',
        email: 'admin@derlg.com',
        passwordHash,
        name: 'Admin User',
        role: 'ADMIN',
        status: 'ACTIVE',
      },
      {
        id: '00000000-0000-0000-0000-000000000002',
        email: 'user@derlg.com',
        passwordHash,
        name: 'Test User',
        role: 'USER',
        status: 'ACTIVE',
      },
      {
        id: '00000000-0000-0000-0000-000000000003',
        email: 'student@derlg.com',
        passwordHash,
        name: 'Student User',
        role: 'STUDENT',
        status: 'ACTIVE',
        studentVerification: {
          create: {
            status: 'APPROVED',
            institution: 'Royal University of Phnom Penh',
            studentIdNumber: 'RUPP2024001',
            verifiedAt: new Date(),
          },
        },
      },
      {
        id: '00000000-0000-0000-0000-000000000004',
        email: 'guide@derlg.com',
        passwordHash,
        name: 'Guide User',
        role: 'GUIDE',
        status: 'ACTIVE',
      },
      {
        id: '00000000-0000-0000-0000-000000000005',
        email: 'user2@derlg.com',
        passwordHash,
        name: 'Second User',
        role: 'USER',
        status: 'ACTIVE',
      },
    ],
  });
};
```

---

### 2. Guides

**Count:** 5 guides

| Name | Languages | Specialties | Location | Price/Day | Verified |
|------|-----------|-------------|----------|-----------|----------|
| Sopheap | [EN, KM] | [Temples, History] | Siem Reap | $45 | true |
| Li Wei | [ZH, EN] | [Food, Culture] | Phnom Penh | $55 | true |
| Dara | [EN, KM, ZH] | [Nature, Adventure] | Kampot | $40 | true |
| Monika | [EN] | [Temples, Nature] | Siem Reap | $50 | false |
| Chhay | [KM] | [History] | Battambang | $35 | true |

```typescript
await prisma.guide.createMany({
  data: [
    {
      id: '10000000-0000-0000-0000-000000000001',
      name: 'Sopheap',
      languages: ['EN', 'KM'],
      specialties: ['Temples', 'History'],
      location: 'Siem Reap',
      pricePerDayUsd: 45.00,
      isVerified: true,
      bio: 'Local guide with 10 years of experience at Angkor Wat...',
      experienceYears: 10,
      status: 'ACTIVE',
      ratingAverage: 4.8,
      ratingCount: 124,
    },
    // ... 4 more
  ],
});
```

---

### 3. Hotels

**Count:** 3 hotels, 2 rooms each

| Hotel | Location | Stars | Rooms |
|-------|----------|-------|-------|
| Angkor Palace | Siem Reap | 5 | Deluxe ($120), Suite ($250) |
| Riverside Boutique | Phnom Penh | 4 | Standard ($65), Deluxe ($95) |
| Kampot Retreat | Kampot | 3 | Bungalow ($45), Family ($75) |

```typescript
await prisma.hotel.create({
  data: {
    id: '20000000-0000-0000-0000-000000000001',
    slug: 'angkor-palace',
    name: 'Angkor Palace',
    location: 'Siem Reap',
    starRating: 5,
    description: 'Luxury hotel near Angkor Wat...',
    amenities: ['Pool', 'Spa', 'Restaurant', 'WiFi'],
    rooms: {
      create: [
        {
          id: '21000000-0000-0000-0000-000000000001',
          name: 'Deluxe Room',
          maxOccupancy: 2,
          pricePerNightUsd: 120.00,
          totalRooms: 20,
          amenities: ['King Bed', 'AC', 'TV', 'Minibar'],
        },
        {
          id: '21000000-0000-0000-0000-000000000002',
          name: 'Suite',
          maxOccupancy: 4,
          pricePerNightUsd: 250.00,
          totalRooms: 5,
          amenities: ['Living Room', 'Jacuzzi', 'Balcony'],
        },
      ],
    },
  },
});
```

---

### 4. Places

**Count:** 8 places

| Name | Slug | Category | Province | Entry Fee |
|------|------|----------|----------|-----------|
| Angkor Wat | angkor-wat | Temple | Siem Reap | $37 |
| Bayon Temple | bayon-temple | Temple | Siem Reap | $37 |
| Royal Palace | royal-palace | Temple | Phnom Penh | $10 |
| Tuol Sleng | tuol-sleng | Museum | Phnom Penh | $5 |
| Bokor Mountain | bokor-mountain | Nature | Kampot | $0 |
| Kep Beach | kep-beach | Beach | Kep | $0 |
| Psar Thmei | psar-thmei | Market | Phnom Penh | $0 |
| Bamboo Train | bamboo-train | Other | Battambang | $5 |

```typescript
await prisma.place.createMany({
  data: [
    {
      id: '30000000-0000-0000-0000-000000000001',
      slug: 'angkor-wat',
      name: 'Angkor Wat',
      category: 'TEMPLE',
      province: 'Siem Reap',
      latitude: 13.4125,
      longitude: 103.8670,
      entryFeeUsd: 37.00,
      description: 'The largest religious monument in the world...',
      status: 'ACTIVE',
    },
    // ... 7 more
  ],
});
```

---

### 5. Trips

**Count:** 5 trips

| Name | Slug | Category | Duration | Price | Featured |
|------|------|----------|----------|-------|----------|
| Angkor Sunrise | angkor-sunrise | Temples | 3 | $299 | true |
| Phnom Penh Cultural | phnom-penh-cultural | Culture | 2 | $199 | true |
| Kampot Adventure | kampot-adventure | Adventure | 4 | $399 | false |
| Cambodian Food Tour | food-tour | Food | 1 | $89 | false |
| Temples & Nature | temples-nature | Nature | 5 | $499 | true |

```typescript
await prisma.trip.create({
  data: {
    id: '40000000-0000-0000-0000-000000000001',
    slug: 'angkor-sunrise',
    name: 'Angkor Sunrise Experience',
    category: 'TEMPLES',
    durationDays: 3,
    priceUsd: 299.00,
    location: 'Siem Reap',
    isFeatured: true,
    status: 'ACTIVE',
    description: 'Witness the sunrise over Angkor Wat...',
    includedItems: ['Hotel', 'Guide', 'Transport', 'Meals'],
    excludedItems: ['Flights', 'Travel insurance'],
    itineraryDays: [
      { dayNumber: 1, title: 'Arrival & Angkor Wat', description: '...', durationHours: 6 },
      { dayNumber: 2, title: 'Bayon & Ta Prohm', description: '...', durationHours: 5 },
      { dayNumber: 3, title: 'Banteay Srei & Departure', description: '...', durationHours: 4 },
    ],
  },
});
```

---

### 6. Transportation Vehicles

**Count:** 5 vehicles

| Type | Name | Capacity | Price/Day |
|------|------|----------|-----------|
| Car | Toyota Camry | 4 | $50 |
| Van | Hyundai H1 | 10 | $80 |
| Tuk Tuk | Remorque | 3 | $25 |
| Bus | Toyota Coaster | 25 | $150 |
| Bike | Honda Wave | 2 | $15 |

---

### 7. Discount Codes

**Count:** 2 codes

| Code | Discount | Min Value | Valid Until |
|------|----------|-----------|-------------|
| WELCOME20 | 20% | $100 | 2026-12-31 |
| STUDENT15 | 15% | $50 | 2026-12-31 |

---

### 8. Festivals

**Count:** 3 festivals

| Name | Slug | Start | End | Location |
|------|------|-------|-----|----------|
| Khmer New Year | khmer-new-year-2026 | 2026-04-14 | 2026-04-16 | Nationwide |
| Water Festival | water-festival-2026 | 2026-11-05 | 2026-11-07 | Phnom Penh |
| Pchum Ben | pchum-ben-2026 | 2026-10-01 | 2026-10-03 | Nationwide |

---

## Seed Script Structure

```typescript
// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import { seedUsers } from './seed/users';
import { seedGuides } from './seed/guides';
import { seedHotels } from './seed/hotels';
import { seedPlaces } from './seed/places';
import { seedTrips } from './seed/trips';
import { seedVehicles } from './seed/vehicles';
import { seedDiscountCodes } from './seed/discount-codes';
import { seedFestivals } from './seed/festivals';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  await seedUsers(prisma);
  await seedGuides(prisma);
  await seedHotels(prisma);
  await seedPlaces(prisma);
  await seedTrips(prisma);
  await seedVehicles(prisma);
  await seedDiscountCodes(prisma);
  await seedFestivals(prisma);

  console.log('✅ Seed complete');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

---

## E2E Test Seed (Minimal)

For E2E tests, only seed what's needed for the test suite:

```typescript
// test/seed/minimal.ts
export const seedMinimal = async (prisma: PrismaClient) => {
  const passwordHash = await bcrypt.hash('TestPass123!', 12);

  const user = await prisma.user.create({
    data: {
      email: 'e2e@derlg.com',
      passwordHash,
      name: 'E2E User',
      role: 'USER',
    },
  });

  const guide = await prisma.guide.create({
    data: {
      name: 'E2E Guide',
      languages: ['EN'],
      specialties: ['Temples'],
      location: 'Siem Reap',
      pricePerDayUsd: 50.00,
      status: 'ACTIVE',
    },
  });

  return { user, guide };
};
```

---

## Running Seeds

```bash
# Development
npx prisma db seed

# Reset + reseed
npx prisma migrate reset --force

# E2E test seed
NODE_ENV=test npx prisma db seed
```

---

## Image Assets

Seed data references image URLs. Use placeholder images:
- Local: `http://localhost:3001/uploads/placeholder.jpg`
- Staging: Supabase Storage public URL
- Production: CDN URL

**Rule:** Seed scripts must not depend on external image hosting. Use local placeholders or base64 data URIs for dev.

---

## References

- Prisma schema: `SCHEMA.md`
- Test plan: `TEST-PLAN.md`
- Backend requirements: `.kiro/specs/backend-nestjs-supabase/requirements.md`
