// =============================================================================
// DerLg — Bulk Dummy Data Generator
// =============================================================================
// Generates ~500 rows for every table, in FK-dependency order.
//  - Geo data = random points inside Cambodia provinces.
//  - Images skipped: array columns = [], required image strings = ''.
//  - Self-generated UUIDs + createMany for speed.
//
// Run (opt-in only — pollutes customer-facing search, load-testing use only):
//   npx ts-node --transpile-only prisma/seeds/dummy-bulk.ts --with-dummy
//   (or set ALLOW_DUMMY=1)
// =============================================================================

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();
const N = 500;

// ---- helpers ----------------------------------------------------------------
const uuid = (): string => randomUUID();
const ri = (n: number): number => Math.floor(Math.random() * n); // 0..n-1
const pick = <T>(a: readonly T[]): T => a[ri(a.length)];
const money = (lo: number, hi: number): number => Number((lo + Math.random() * (hi - lo)).toFixed(2));
const dayMs = 86_400_000;
const dateOff = (lo: number, hi: number): Date => new Date(Date.now() + (lo + ri(hi - lo)) * dayMs);
const ids = (n: number): string[] => Array.from({ length: n }, uuid);
const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i);

const LANGS = ['en', 'zh', 'km'] as const;

// 25 Cambodian provinces with approx. centroid coords.
const PROVINCES: { name: string; lat: number; lng: number }[] = [
  { name: 'Phnom Penh', lat: 11.5564, lng: 104.9282 },
  { name: 'Siem Reap', lat: 13.3633, lng: 103.8564 },
  { name: 'Battambang', lat: 13.0957, lng: 103.2022 },
  { name: 'Preah Sihanouk', lat: 10.6276, lng: 103.5223 },
  { name: 'Kampot', lat: 10.6104, lng: 104.181 },
  { name: 'Kep', lat: 10.4831, lng: 104.3169 },
  { name: 'Kandal', lat: 11.4789, lng: 104.9495 },
  { name: 'Takeo', lat: 10.9908, lng: 104.785 },
  { name: 'Kampong Cham', lat: 11.9934, lng: 105.4636 },
  { name: 'Kampong Thom', lat: 12.7111, lng: 104.8887 },
  { name: 'Kampong Speu', lat: 11.453, lng: 104.5209 },
  { name: 'Kampong Chhnang', lat: 12.2505, lng: 104.666 },
  { name: 'Pursat', lat: 12.5388, lng: 103.9192 },
  { name: 'Banteay Meanchey', lat: 13.5859, lng: 102.989 },
  { name: 'Pailin', lat: 12.8489, lng: 102.6093 },
  { name: 'Koh Kong', lat: 11.6153, lng: 102.9836 },
  { name: 'Kratie', lat: 12.4881, lng: 106.0188 },
  { name: 'Stung Treng', lat: 13.5259, lng: 105.9683 },
  { name: 'Ratanakiri', lat: 13.7394, lng: 106.9873 },
  { name: 'Mondulkiri', lat: 12.447, lng: 107.1877 },
  { name: 'Preah Vihear', lat: 13.8077, lng: 104.97 },
  { name: 'Oddar Meanchey', lat: 14.181, lng: 103.509 },
  { name: 'Prey Veng', lat: 11.487, lng: 105.325 },
  { name: 'Svay Rieng', lat: 11.0877, lng: 105.7993 },
  { name: 'Tboung Khmum', lat: 11.902, lng: 105.688 },
];
const geo = () => {
  const p = pick(PROVINCES);
  return {
    province: p.name,
    latitude: Number((p.lat + (Math.random() - 0.5) * 0.2).toFixed(7)),
    longitude: Number((p.lng + (Math.random() - 0.5) * 0.2).toFixed(7)),
  };
};

const FIRST = ['Sokha', 'Dara', 'Sopheap', 'Channary', 'Veasna', 'Bopha', 'Chenda', 'Kosal', 'Mealea', 'Nimol', 'Phalla', 'Rith', 'Sothea', 'Thida', 'Vanna', 'Wei', 'Fang', 'Jing', 'Lei', 'Yan', 'James', 'Sarah', 'Ben', 'Emma', 'Liam', 'Olivia', 'Noah', 'Ava'];
const LAST = ['Chan', 'Sok', 'Kim', 'Heng', 'Ly', 'Meas', 'Pich', 'Sar', 'Tan', 'Vong', 'Wang', 'Li', 'Zhang', 'Smith', 'Brown', 'Nguyen'];
const name = (): string => `${pick(FIRST)} ${pick(LAST)}`;
const phone = (): string => `+8559${(10_000_000 + ri(89_999_999)).toString()}`;

// localized text helper for translation tables
const tx = (lang: string, en: string): string =>
  lang === 'zh' ? `${en}（中文）` : lang === 'km' ? `${en} (ខ្មែរ)` : en;

async function main(): Promise<void> {
  // Guard: this generator inserts 500 placeholder rows per table ("Hotel #N",
  // "Cambodia Trip #N", "Place #N", etc.) with no images. Those surface in the
  // customer-facing search tools (hotels/trips/places/guides/transport) and look
  // like junk to visitors. It is for load/volume testing ONLY — require explicit
  // opt-in so a normal reseed can never silently re-introduce the placeholders.
  if (!process.argv.includes('--with-dummy') && process.env.ALLOW_DUMMY !== '1') {
    console.error(
      '⛔ dummy-bulk seed is gated (it pollutes customer-facing search with ~500 placeholder rows/table).\n' +
      '   Re-run with `--with-dummy` or ALLOW_DUMMY=1 only if you explicitly want bulk load-test data.',
    );
    process.exit(1);
  }

  console.log('🌱 DerLg — bulk dummy data (~500 rows/table)\n');

  // ---- 1. USERS (500 customers + 500 guide accounts) ------------------------
  const customerIds = ids(N);
  const guideUserIds = ids(N);
  const userRows = [
    ...customerIds.map((id, i) => ({
      id,
      supabaseUid: `sb-cust-${i}-${uuid().slice(0, 8)}`,
      email: `cust.${i}.${uuid().slice(0, 6)}@derlg.demo`,
      role: pick(['user', 'user', 'user', 'student', 'admin'] as const),
      preferredLanguage: pick(LANGS),
      passwordHash: null,
      fullName: name(),
      phone: phone(),
      emergencyContactName: name(),
      emergencyContactPhone: phone(),
      loyaltyPoints: ri(5000),
      isStudentVerified: Math.random() < 0.2,
      referralCode: `REF-${i}-${uuid().slice(0, 6)}`,
    })),
    ...guideUserIds.map((id, i) => ({
      id,
      supabaseUid: `sb-guide-${i}-${uuid().slice(0, 8)}`,
      email: `guide.${i}.${uuid().slice(0, 6)}@derlg.demo`,
      role: 'guide' as const,
      preferredLanguage: pick(LANGS),
      fullName: name(),
      phone: phone(),
      referralCode: `REFG-${i}-${uuid().slice(0, 6)}`,
    })),
  ];
  await prisma.user.createMany({ data: userRows, skipDuplicates: true });
  console.log(`  ✅ users: ${userRows.length}`);

  // ---- 2. REFRESH TOKENS ----------------------------------------------------
  await prisma.refreshToken.createMany({
    data: range(N).map((i) => ({
      tokenId: `tok-${i}-${uuid()}`,
      userId: pick(customerIds),
      expiresAt: dateOff(1, 30),
      revokedAt: Math.random() < 0.2 ? dateOff(-10, 0) : null,
    })),
  });
  console.log(`  ✅ refresh_tokens: ${N}`);

  // ---- 3. EXCHANGE RATES (capped by unique [from,to]) -----------------------
  const CCY = ['usd', 'khr', 'cny', 'thb', 'vnd', 'eur', 'gbp', 'jpy', 'sgd', 'myr', 'aud', 'cad', 'chf', 'hkd', 'krw', 'inr', 'idr', 'php', 'lak', 'mmk', 'nzd', 'twd', 'brl'];
  const rates: { fromCurrency: string; toCurrency: string; rate: number }[] = [];
  for (const f of CCY) for (const t of CCY) if (f !== t) rates.push({ fromCurrency: f, toCurrency: t, rate: money(0.0001, 4100) });
  await prisma.exchangeRate.createMany({ data: rates, skipDuplicates: true });
  console.log(`  ✅ exchange_rates: ${rates.length} (max pairs from ${CCY.length} currencies)`);

  // ---- 4. EMERGENCY CONTACTS (capped by unique [province,serviceName]) ------
  const SVC = ['Police Station', 'Tourist Police', 'Provincial Hospital', 'Fire Brigade', 'Ambulance Service', 'District Clinic', 'Red Cross', 'Traffic Police', 'Immigration Office', 'Coast Guard', 'Rescue Unit', 'Poison Control', 'Womens Hospital', 'Childrens Hospital', 'Pharmacy 24h', 'Embassy Hotline', 'Disaster Response', 'Mountain Rescue', 'Water Rescue', 'Tourist Helpline'];
  const ecRows: any[] = [];
  for (const p of PROVINCES) for (const s of SVC) ecRows.push({ province: p.name, serviceName: s, phone: phone(), address: `${s}, ${p.name}, Cambodia`, isActive: true });
  await prisma.emergencyContact.createMany({ data: ecRows, skipDuplicates: true });
  console.log(`  ✅ emergency_contacts: ${ecRows.length}`);

  // ---- 5. STRIPE EVENTS -----------------------------------------------------
  await prisma.stripeEvent.createMany({
    data: range(N).map((i) => ({ stripeEventId: `evt_${i}_${uuid().slice(0, 12)}`, eventType: pick(['payment_intent.succeeded', 'payment_intent.payment_failed', 'charge.refunded', 'checkout.session.completed']) })),
  });
  console.log(`  ✅ stripe_events: ${N}`);

  // ---- 6. PLACES + translations ---------------------------------------------
  const placeIds = ids(N);
  const PLACE_CAT = ['temple', 'museum', 'nature', 'market', 'beach', 'mountain'] as const;
  await prisma.place.createMany({
    data: placeIds.map((id) => {
      const g = geo();
      return { id, category: pick(PLACE_CAT), latitude: g.latitude, longitude: g.longitude, images: [], entryFeeUsd: money(0, 40), openingHours: '08:00–17:00', dressCode: 'Casual', isPublished: true };
    }),
  });
  await prisma.placeTranslation.createMany({
    data: placeIds.flatMap((placeId, i) => LANGS.map((l) => ({ placeId, language: l, name: tx(l, `Place #${i}`), description: tx(l, 'A notable Cambodian destination.'), visitorTips: tx(l, 'Arrive early.'), address: `${pick(PROVINCES).name}, Cambodia` }))),
    skipDuplicates: true,
  });
  console.log(`  ✅ places: ${N}  +  place_translations: ${N * 3}`);

  // ---- 7. HOTELS + translations + rooms -------------------------------------
  const hotelIds = ids(N);
  await prisma.hotel.createMany({
    data: hotelIds.map((id) => {
      const g = geo();
      return { id, latitude: g.latitude, longitude: g.longitude, starRating: 1 + ri(5), images: [], amenities: ['wifi', 'pool', 'breakfast'], isPublished: true };
    }),
  });
  await prisma.hotelTranslation.createMany({
    data: hotelIds.flatMap((hotelId, i) => LANGS.map((l) => ({ hotelId, language: l, name: tx(l, `Hotel #${i}`), address: `${pick(PROVINCES).name}, Cambodia`, description: tx(l, 'Comfortable stay in Cambodia.') }))),
    skipDuplicates: true,
  });
  const hotelRoomIds = ids(N);
  await prisma.hotelRoom.createMany({
    data: hotelRoomIds.map((id, i) => ({ id, hotelId: hotelIds[i], roomType: pick(['Single', 'Double', 'Twin', 'Suite', 'Deluxe']), maxOccupancy: 1 + ri(4), priceUsd: money(15, 250), amenities: ['ac', 'tv'], images: [], isActive: true })),
  });
  console.log(`  ✅ hotels: ${N}  +  hotel_translations: ${N * 3}  +  hotel_rooms: ${N}`);

  // ---- 8. TRANSPORTATION VEHICLES -------------------------------------------
  const vehicleIds = ids(N);
  const VTYPE = ['tuk_tuk', 'van', 'bus'] as const;
  await prisma.transportationVehicle.createMany({
    data: vehicleIds.map((id, i) => {
      const vt = pick(VTYPE);
      return { id, vehicleType: vt, name: `${vt} #${i}`, licensePlate: `${pick(PROVINCES).name.slice(0, 2).toUpperCase()}-${1000 + ri(8999)}`, capacity: vt === 'bus' ? 40 : vt === 'van' ? 12 : 4, pricingModel: pick(['per_day', 'per_km'] as const), priceUsd: money(5, 200), province: pick(PROVINCES).name, images: [], isActive: true };
    }),
  });
  console.log(`  ✅ transportation_vehicles: ${N}`);

  // ---- 9. GUIDES + languages + specialities ---------------------------------
  const guideIds = ids(N);
  await prisma.guide.createMany({
    data: guideIds.map((id, i) => ({ id, userId: guideUserIds[i], bio: `Experienced Cambodian tour guide #${i}.`, avatarUrl: '', images: [], pricePerDayUsd: money(25, 90), isVerified: Math.random() < 0.7, province: pick(PROVINCES).name, provinces: [pick(PROVINCES).name, pick(PROVINCES).name], isActive: true })),
  });
  const SPEC = ['Angkor Wat historian', 'Street food expert', 'Nature trekking', 'Photography guide', 'Khmer mythology', 'Village homestays', 'Archaeology specialist', 'Sunrise tours'];
  await prisma.guideLanguage.createMany({
    data: guideIds.flatMap((guideId) => [...new Set([pick(LANGS), pick(LANGS)])].map((language) => ({ guideId, language }))),
    skipDuplicates: true,
  });
  await prisma.guideSpeciality.createMany({
    data: guideIds.flatMap((guideId) => [...new Set([pick(SPEC), pick(SPEC)])].map((speciality) => ({ guideId, speciality }))),
    skipDuplicates: true,
  });
  console.log(`  ✅ guides: ${N}  +  guide_languages & guide_specialities (~${N}+ each)`);

  // ---- 10. TRIPS + translations + itinerary items + their translations ------
  const tripIds = ids(N);
  const TRIP_CAT = ['temples', 'nature', 'culture', 'adventure', 'food'] as const;
  await prisma.trip.createMany({
    data: tripIds.map((id) => ({ id, category: pick(TRIP_CAT), durationDays: 1 + ri(7), basePriceUsd: money(40, 600), maxCapacity: 4 + ri(20), coverImage: null, images: [], isPublished: true })),
  });
  await prisma.tripTranslation.createMany({
    data: tripIds.flatMap((tripId, i) => LANGS.map((l) => ({ tripId, language: l, title: tx(l, `Cambodia Trip #${i}`), subtitle: tx(l, 'Discover the Kingdom of Wonder'), description: tx(l, 'A curated multi-day Cambodian experience.'), includedItems: ['guide', 'transport'], excludedItems: ['flights'], cancellationPolicy: tx(l, '100% refund if cancelled 7+ days before.'), meetingPoint: `${pick(PROVINCES).name} city center` }))),
    skipDuplicates: true,
  });
  const itinIds = ids(N);
  await prisma.tripItineraryItem.createMany({
    data: itinIds.map((id, i) => ({ id, tripId: tripIds[i], dayNumber: 1 + ri(5), sortOrder: ri(5), placeId: Math.random() < 0.7 ? pick(placeIds) : null, hotelId: Math.random() < 0.5 ? pick(hotelIds) : null })),
  });
  await prisma.tripItineraryItemTranslation.createMany({
    data: itinIds.flatMap((itineraryItemId, i) => LANGS.map((l) => ({ itineraryItemId, language: l, title: tx(l, `Day activity #${i}`), description: tx(l, 'Explore, eat, and relax.') }))),
    skipDuplicates: true,
  });
  console.log(`  ✅ trips: ${N}  +  trip_translations: ${N * 3}  +  itinerary_items: ${N}  +  item_translations: ${N * 3}`);

  // ---- 11. FESTIVALS + translations -----------------------------------------
  const festivalIds = ids(N);
  await prisma.festival.createMany({
    data: festivalIds.map((id) => ({ id, startDate: dateOff(0, 300), endDate: dateOff(301, 360), province: pick(PROVINCES).name, images: [], isPublished: true })),
  });
  await prisma.festivalTranslation.createMany({
    data: festivalIds.flatMap((festivalId, i) => LANGS.map((l) => ({ festivalId, language: l, name: tx(l, `Festival #${i}`), description: tx(l, 'A vibrant Cambodian cultural festival.'), location: `${pick(PROVINCES).name}, Cambodia` }))),
    skipDuplicates: true,
  });
  console.log(`  ✅ festivals: ${N}  +  festival_translations: ${N * 3}`);

  // ---- 12. DISCOUNT CODES ---------------------------------------------------
  const BTYPE = ['trip_package', 'hotel_room', 'transportation', 'tour_guide'] as const;
  await prisma.discountCode.createMany({
    data: range(N).map((i) => ({
      code: `SAVE-${i}-${uuid().slice(0, 5).toUpperCase()}`,
      discountType: pick(['percentage', 'fixed_amount'] as const),
      value: money(5, 50),
      maxUses: 1 + ri(500),
      currentUses: ri(50),
      minBookingUsd: money(20, 100),
      validFrom: dateOff(-30, 0),
      validUntil: dateOff(1, 200),
      isActive: true,
      festivalId: Math.random() < 0.4 ? pick(festivalIds) : null,
      bookingType: Math.random() < 0.5 ? pick(BTYPE) : null,
      userId: Math.random() < 0.3 ? pick(customerIds) : null,
    })),
    skipDuplicates: true,
  });
  console.log(`  ✅ discount_codes: ${N}`);

  // ---- 13. BOOKINGS ---------------------------------------------------------
  const bookingIds = ids(N);
  const BSTATUS = ['hold', 'pending_payment', 'confirmed', 'cancelled', 'completed', 'expired'] as const;
  const BMETHOD = ['public_package', 'custom_itinerary', 'single_resource'] as const;
  const SRK = ['transportation', 'hotel', 'guide', 'trip'] as const;
  await prisma.booking.createMany({
    data: bookingIds.map((id, i) => {
      const method = pick(BMETHOD);
      const sub = money(40, 800);
      const disc = money(0, 40);
      return { id, userId: pick(customerIds), reference: `BK-${i}-${uuid().slice(0, 6).toUpperCase()}`, method, singleResourceKind: method === 'single_resource' ? pick(SRK) : null, tripTemplateId: Math.random() < 0.4 ? pick(tripIds) : null, startDate: dateOff(1, 120), endDate: dateOff(121, 130), status: pick(BSTATUS), expiresAt: dateOff(0, 1), subtotalUsd: sub, discountUsd: disc, loyaltyDiscountUsd: money(0, 10), totalUsd: Number((sub - disc).toFixed(2)), qrCodeUrl: '', passengerCount: 1 + ri(6), roomCount: 1 + ri(3) };
    }),
  });
  console.log(`  ✅ bookings: ${N}`);

  // ---- 14. BOOKING ITEMS (polymorphic) --------------------------------------
  await prisma.bookingItem.createMany({
    data: bookingIds.map((bookingId) => {
      const bookingType = pick(BTYPE);
      const price = money(20, 300);
      const qty = 1 + ri(4);
      return {
        bookingId,
        bookingType,
        tripId: bookingType === 'trip_package' ? pick(tripIds) : null,
        hotelRoomId: bookingType === 'hotel_room' ? pick(hotelRoomIds) : null,
        vehicleId: bookingType === 'transportation' ? pick(vehicleIds) : null,
        guideId: bookingType === 'tour_guide' ? pick(guideIds) : null,
        startDate: dateOff(1, 120),
        endDate: dateOff(121, 130),
        quantity: qty,
        unitPriceUsd: price,
        subtotalUsd: Number((price * qty).toFixed(2)),
        snapshot: { name: `${bookingType} snapshot`, priceUsd: price, cancellationPolicy: '100% refund if 7+ days' },
      };
    }),
  });
  console.log(`  ✅ booking_items: ${N}`);

  // ---- 15. PAYMENTS ---------------------------------------------------------
  const paymentIds = ids(N);
  const PSTATUS = ['pending', 'processing', 'succeeded', 'failed', 'refunded'] as const;
  await prisma.payment.createMany({
    data: paymentIds.map((id, i) => ({ id, bookingId: bookingIds[i], userId: pick(customerIds), provider: pick(['stripe', 'bakong'] as const), providerPaymentId: `pp_${uuid().slice(0, 12)}`, amountUsd: money(40, 800), currency: pick(['usd', 'khr', 'cny']), exchangeRate: money(1, 4100), status: pick(PSTATUS), refundedAmountUsd: 0, stripePaymentIntentId: `pi_${uuid().slice(0, 14)}`, clientSecret: '', qrCodeUrl: '', idempotencyKey: `idem-${i}-${uuid()}`, paidAt: dateOff(-30, 0) })),
    skipDuplicates: true,
  });
  console.log(`  ✅ payments: ${N}`);

  // ---- 16. REFUNDS ----------------------------------------------------------
  await prisma.refund.createMany({
    data: paymentIds.map((paymentId) => ({ paymentId, amountUsd: money(10, 400), providerRefundId: `re_${uuid().slice(0, 12)}`, reason: pick(['User cancelled', 'Trip unavailable', 'Duplicate charge', 'Weather cancellation']), percentage: pick([0, 50, 100]), status: pick(PSTATUS), processedById: Math.random() < 0.5 ? pick(customerIds) : null })),
  });
  console.log(`  ✅ refunds: ${N}`);

  // ---- 17. LOYALTY TRANSACTIONS ---------------------------------------------
  await prisma.loyaltyTransaction.createMany({
    data: range(N).map(() => {
      const pts = (Math.random() < 0.5 ? 1 : -1) * (10 + ri(500));
      return { userId: pick(customerIds), type: pick(['earned', 'redeemed', 'adjusted', 'expired', 'referral'] as const), points: pts, balanceAfter: ri(5000), bookingId: Math.random() < 0.6 ? pick(bookingIds) : null, reference: 'loyalty activity' };
    }),
  });
  console.log(`  ✅ loyalty_transactions: ${N}`);

  // ---- 18. STUDENT VERIFICATIONS --------------------------------------------
  await prisma.studentVerification.createMany({
    data: customerIds.map((userId) => ({ userId, idCardImageUrl: '', selfieImageUrl: '', status: pick(['pending', 'approved', 'rejected'] as const), reviewedById: Math.random() < 0.5 ? pick(customerIds) : null, reviewNotes: 'auto-generated', reviewedAt: Math.random() < 0.5 ? dateOff(-20, 0) : null, expiresAt: dateOff(200, 365) })),
  });
  console.log(`  ✅ student_verifications: ${N}`);

  // ---- 19. EMERGENCY ALERTS -------------------------------------------------
  await prisma.emergencyAlert.createMany({
    data: range(N).map(() => {
      const g = geo();
      return { userId: pick(customerIds), alertType: pick(['sos', 'medical', 'theft', 'lost'] as const), status: pick(['triggered', 'acknowledged', 'resolved', 'cancelled'] as const), latitude: g.latitude, longitude: g.longitude, accuracyMeters: money(1, 50), acknowledgedAt: Math.random() < 0.5 ? dateOff(-5, 0) : null, acknowledgedBy: Math.random() < 0.5 ? pick(customerIds) : null, notes: 'auto-generated alert', driverId: Math.random() < 0.3 ? pick(guideUserIds) : null };
    }),
  });
  console.log(`  ✅ emergency_alerts: ${N}`);

  // ---- 20. LOCATION SHARES --------------------------------------------------
  await prisma.locationShare.createMany({
    data: range(N).map((i) => {
      const g = geo();
      return { userId: pick(customerIds), shareToken: `share-${i}-${uuid()}`, expiresAt: dateOff(1, 7), updateIntervalMinutes: pick([1, 5, 10, 15]), latitude: g.latitude, longitude: g.longitude, lastUpdateAt: dateOff(-1, 0), isActive: true };
    }),
    skipDuplicates: true,
  });
  console.log(`  ✅ location_shares: ${N}`);

  // ---- 21. REVIEWS (polymorphic) --------------------------------------------
  await prisma.review.createMany({
    data: range(N).map(() => {
      const subj = ri(3);
      return { userId: pick(customerIds), tripId: subj === 0 ? pick(tripIds) : null, hotelId: subj === 1 ? pick(hotelIds) : null, guideId: subj === 2 ? pick(guideIds) : null, rating: 1 + ri(5), text: pick(['Great experience!', 'Highly recommend.', 'Could be better.', 'Amazing guide and views.']), images: [], isVerifiedBooking: Math.random() < 0.6, isFlagged: Math.random() < 0.05 };
    }),
  });
  console.log(`  ✅ reviews: ${N}`);

  // ---- 22. FAVORITES (unique [userId, X] -> pair user[i] with trip[i]) -------
  await prisma.favorite.createMany({
    data: range(N).map((i) => ({ userId: customerIds[i], tripId: tripIds[i] })),
    skipDuplicates: true,
  });
  console.log(`  ✅ favorites: ${N}`);

  // ---- 23. AI CHAT SESSIONS + messages --------------------------------------
  const sessionIds = ids(N);
  await prisma.aIChatSession.createMany({
    data: sessionIds.map((id, i) => ({ id, userId: pick(customerIds), title: `Trip planning chat #${i}`, isActive: Math.random() < 0.7, language: pick(LANGS), lastMessageAt: dateOff(-10, 0) })),
  });
  await prisma.aIChatMessage.createMany({
    data: sessionIds.flatMap((sessionId) => [
      { sessionId, role: 'user', content: 'I want a 3-day temple tour near Siem Reap.', messageType: 'text', metadata: { intent: 'discover' } },
      { sessionId, role: 'assistant', content: 'Great! I found 3 packages that match your vibe.', messageType: 'trip_card', metadata: { count: 3 } },
    ]),
  });
  console.log(`  ✅ ai_chat_sessions: ${N}  +  ai_chat_messages: ${N * 2}`);

  // ---- 24. NOTIFICATIONS ----------------------------------------------------
  await prisma.notification.createMany({
    data: range(N).map((i) => ({ userId: pick(customerIds), channel: pick(['email', 'push', 'in_app'] as const), status: pick(['pending', 'sent', 'delivered', 'failed', 'read'] as const), title: `Notification #${i}`, body: 'Your booking update is here.', language: pick(LANGS), templateKey: pick(['booking_confirmed', 'payment_received', 'trip_reminder']), bookingId: Math.random() < 0.6 ? pick(bookingIds) : null, sentAt: dateOff(-10, 0), retryCount: ri(3) })),
  });
  console.log(`  ✅ notifications: ${N}`);

  // ---- 25. PUSH DEVICE TOKENS -----------------------------------------------
  await prisma.pushDeviceToken.createMany({
    data: range(N).map((i) => ({ userId: pick(customerIds), token: `fcm-${i}-${uuid()}`, platform: pick(['ios', 'android', 'web']), isActive: Math.random() < 0.8 })),
    skipDuplicates: true,
  });
  console.log(`  ✅ push_device_tokens: ${N}`);

  // ---- 26. AUDIT LOGS -------------------------------------------------------
  await prisma.auditLog.createMany({
    data: range(N).map(() => ({ userId: Math.random() < 0.8 ? pick(customerIds) : null, eventType: pick(['booking_created', 'booking_confirmed', 'payment_succeeded', 'payment_failed', 'user_login', 'admin_action', 'security_event'] as const), entityType: pick(['booking', 'payment', 'user']), entityId: pick(bookingIds), ipAddress: `${ri(255)}.${ri(255)}.${ri(255)}.${ri(255)}`, userAgent: 'Mozilla/5.0 (demo)', metadata: { source: 'seed' } })),
  });
  console.log(`  ✅ audit_logs: ${N}`);

  console.log('\n✅ Bulk dummy data complete.\n');
}

main()
  .catch((e) => {
    console.error('❌ Bulk seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
