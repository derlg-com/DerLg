// =============================================================================
// Seed: 15 — Rich Admin & Operations Mock Data (F110–F118)
// =============================================================================
// Populates realistic mock data for all admin system views:
//  - International & local users / travelers
//  - Active & historical bookings across all statuses
//  - Payment transactions & refunds (Stripe & Bakong KHQR)
//  - Verified reviews for trips, hotels, and guides
//  - Fleet drivers, assignments, and vehicle maintenance logs
//  - Support tickets with priorities and admin assignments
//  - Broadcast announcements & emergency alerts
//  - Student verification requests & audit logs
// =============================================================================

import bcrypt from 'bcrypt';
import type { 
  PrismaClient, 
  BookingStatus, 
  BookingMethod, 
  SingleResourceKind,
  PaymentProvider, 
  PaymentStatus, 
  SupportedLanguage,
  DriverStatus,
  AssignmentStatus,
  TicketStatus,
  TicketPriority,
  BroadcastStatus,
  EmergencyAlertType,
  EmergencyAlertStatus,
  VerificationStatus,
  AuditEventType
} from '@prisma/client';

import imageUrls = require('./image-urls.json');

export = async function seed(prisma: PrismaClient): Promise<void> {
  console.log('  • admin system mock data & operations');

  const defaultPasswordHash = await bcrypt.hash('DerLgCustomer!2026', 10);
  const driverPinHash = await bcrypt.hash('1234', 10);

  // ---------------------------------------------------------------------------
  // 1. Travelers / Customers
  // ---------------------------------------------------------------------------
  const customerProfiles = [
    { name: 'Chen Wei', email: 'chen.wei@example.cn', lang: 'zh' as SupportedLanguage, phone: '+8613800138000', points: 350, isStudent: false },
    { name: 'Zhang Min', email: 'zhang.min@example.cn', lang: 'zh' as SupportedLanguage, phone: '+8613911122233', points: 120, isStudent: true },
    { name: 'Li Na', email: 'li.na@example.cn', lang: 'zh' as SupportedLanguage, phone: '+8613766655544', points: 500, isStudent: false },
    { name: 'Wang Qiang', email: 'wang.qiang@example.cn', lang: 'zh' as SupportedLanguage, phone: '+8613588899900', points: 0, isStudent: false },
    { name: 'Alex Johnson', email: 'alex.j@example.com', lang: 'en' as SupportedLanguage, phone: '+14155552671', points: 280, isStudent: false },
    { name: 'Emily Davis', email: 'emily.d@example.com', lang: 'en' as SupportedLanguage, phone: '+12065559812', points: 150, isStudent: true },
    { name: 'Michael Brown', email: 'mbrown@example.co.uk', lang: 'en' as SupportedLanguage, phone: '+447911123456', points: 80, isStudent: false },
    { name: 'Sophie Martin', email: 'sophie.m@example.fr', lang: 'fr' as SupportedLanguage, phone: '+33612345678', points: 420, isStudent: false },
    { name: 'Lucas Dubois', email: 'lucas.d@example.fr', lang: 'fr' as SupportedLanguage, phone: '+33698765432', points: 90, isStudent: true },
    { name: 'Hannah Schmidt', email: 'hannah.s@example.de', lang: 'de' as SupportedLanguage, phone: '+4915123456789', points: 310, isStudent: false },
    { name: 'Kenji Sato', email: 'kenji.sato@example.jp', lang: 'ja' as SupportedLanguage, phone: '+819012345678', points: 640, isStudent: false },
    { name: 'Min-jun Kim', email: 'minjun.kim@example.kr', lang: 'ko' as SupportedLanguage, phone: '+821012345678', points: 200, isStudent: false },
    { name: 'Sokchea Meas', email: 'sokchea.meas@example.kh', lang: 'km' as SupportedLanguage, phone: '+85512345678', points: 450, isStudent: false },
    { name: 'Bopha Pich', email: 'bopha.pich@example.kh', lang: 'km' as SupportedLanguage, phone: '+85598765432', points: 180, isStudent: true },
    { name: 'Dara Heng', email: 'dara.heng@example.kh', lang: 'km' as SupportedLanguage, phone: '+85577665544', points: 50, isStudent: false },
    { name: 'Elena Rossi', email: 'elena.rossi@example.it', lang: 'en' as SupportedLanguage, phone: '+39021234567', points: 220, isStudent: false },
    { name: 'Carlos Gomez', email: 'carlos.g@example.es', lang: 'es' as SupportedLanguage, phone: '+34600112233', points: 140, isStudent: false },
    { name: 'Somchai Prasert', email: 'somchai.p@example.th', lang: 'th' as SupportedLanguage, phone: '+66812345678', points: 90, isStudent: false },
    { name: 'Nguyen Van Minh', email: 'minh.nguyen@example.vn', lang: 'vi' as SupportedLanguage, phone: '+84912345678', points: 160, isStudent: false },
    { name: 'Chloe Taylor', email: 'chloe.taylor@example.au', lang: 'en' as SupportedLanguage, phone: '+61412345678', points: 510, isStudent: false },
  ];

  const createdUsers: any[] = [];

  for (const c of customerProfiles) {
    const user = await prisma.user.upsert({
      where: { email: c.email },
      update: {
        fullName: c.name,
        preferredLanguage: c.lang,
        phone: c.phone,
        loyaltyPoints: c.points,
        isStudentVerified: c.isStudent,
      },
      create: {
        supabaseUid: `seed-user-${c.email.replace(/[@.]/g, '-')}`,
        email: c.email,
        fullName: c.name,
        preferredLanguage: c.lang,
        phone: c.phone,
        passwordHash: defaultPasswordHash,
        loyaltyPoints: c.points,
        isStudentVerified: c.isStudent,
        emergencyContactName: 'Emergency Contact',
        emergencyContactPhone: '+85512999888',
        status: 'active',
      },
    });
    createdUsers.push(user);
  }

  // ---------------------------------------------------------------------------
  // 2. Fetch reference data for bookings & relationships
  // ---------------------------------------------------------------------------
  const trips = await prisma.trip.findMany({ include: { translations: true } });
  const hotelRooms = await prisma.hotelRoom.findMany({ include: { hotel: { include: { translations: true } } } });
  const vehicles = await prisma.transportationVehicle.findMany();
  const guides = await prisma.guide.findMany();
  const adminUsers = await prisma.user.findMany({
    where: { adminProfile: { isNot: null } },
    include: { adminProfile: true },
  });

  const supportAgent = adminUsers.find(a => a.adminProfile?.adminRole === 'SUPPORT_AGENT') || adminUsers[0];
  const opsManager = adminUsers.find(a => a.adminProfile?.adminRole === 'OPERATIONS_MANAGER') || adminUsers[0];

  // ---------------------------------------------------------------------------
  // 3. Additional Drivers and Vehicles
  // ---------------------------------------------------------------------------
  const extraDriversData = [
    { driverName: 'Heng Sovann', driverId: 'DRV-005', phone: '+85592111005', vehicleIdx: 0, status: 'AVAILABLE' as DriverStatus },
    { driverName: 'Khem Sreymom', driverId: 'DRV-006', phone: '+85592111006', vehicleIdx: 1, status: 'BUSY' as DriverStatus },
    { driverName: 'Oun Chanarith', driverId: 'DRV-007', phone: '+85592111007', vehicleIdx: 2, status: 'AVAILABLE' as DriverStatus },
    { driverName: 'Chea Vichea', driverId: 'DRV-008', phone: '+85592111008', vehicleIdx: 3, status: 'OFFLINE' as DriverStatus },
  ];

  const allDrivers: any[] = await prisma.driver.findMany();

  for (const d of extraDriversData) {
    const vId = vehicles[d.vehicleIdx % vehicles.length]?.id;
    const driver = await prisma.driver.upsert({
      where: { driverId: d.driverId },
      update: {
        driverName: d.driverName,
        phone: d.phone,
        status: d.status,
        vehicleId: vId,
      },
      create: {
        driverId: d.driverId,
        driverName: d.driverName,
        phone: d.phone,
        authPin: driverPinHash,
        status: d.status,
        vehicleId: vId,
        preferredLanguage: 'en',
      },
    });
    allDrivers.push(driver);
  }

  // ---------------------------------------------------------------------------
  // 4. Vehicle Maintenance Records
  // ---------------------------------------------------------------------------
  const maintenanceData = [
    {
      vehicleId: vehicles[0]?.id,
      maintenanceType: 'Brake pad replacement & oil change',
      scheduledDate: new Date('2026-08-10'),
      completionDate: new Date('2026-08-11'),
      maintenanceCost: 85.00,
      maintenanceNotes: 'Front and rear brake pads replaced. Synthetic 5W-30 engine oil.',
      status: 'COMPLETED' as const,
    },
    {
      vehicleId: vehicles[1 % vehicles.length]?.id,
      maintenanceType: 'Air conditioning system overhaul',
      scheduledDate: new Date('2026-08-25'),
      completionDate: new Date('2026-08-26'),
      maintenanceCost: 140.00,
      maintenanceNotes: 'AC compressor serviced, refrigerant topped up.',
      status: 'COMPLETED' as const,
    },
    {
      vehicleId: vehicles[2 % vehicles.length]?.id,
      maintenanceType: 'Tire rotation and alignment',
      scheduledDate: new Date('2026-09-05'),
      maintenanceCost: 60.00,
      maintenanceNotes: 'Scheduled routine inspection for high-mileage van.',
      status: 'SCHEDULED' as const,
    },
    {
      vehicleId: vehicles[3 % vehicles.length]?.id,
      maintenanceType: 'Transmission fluid flush & diagnostic',
      scheduledDate: new Date('2026-08-30'),
      maintenanceCost: 210.00,
      maintenanceNotes: 'Gear shifting lag observed during airport shuttle.',
      status: 'IN_MAINTENANCE' as const,
    },
  ];

  for (const m of maintenanceData) {
    if (m.vehicleId) {
      await prisma.vehicleMaintenance.create({
        data: m,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 5. Rich Bookings with Payments and Items
  // ---------------------------------------------------------------------------
  const bookingConfigs: {
    ref: string;
    user: any;
    method: BookingMethod;
    status: BookingStatus;
    resourceKind?: SingleResourceKind;
    startDate: Date;
    endDate: Date;
    passengers: number;
    rooms: number;
    subtotal: number;
    discount: number;
    loyaltyDiscount: number;
    total: number;
    paymentProvider: PaymentProvider;
    paymentStatus: PaymentStatus;
    tripTemplateId?: string;
  }[] = [
    {
      ref: 'DLG-2026-8801',
      user: createdUsers[0], // Chen Wei
      method: 'public_package',
      status: 'confirmed',
      startDate: new Date('2026-09-10'),
      endDate: new Date('2026-09-13'),
      passengers: 2,
      rooms: 1,
      subtotal: 480.00,
      discount: 20.00,
      loyaltyDiscount: 10.00,
      total: 450.00,
      paymentProvider: 'bakong',
      paymentStatus: 'succeeded',
      tripTemplateId: trips[0]?.id,
    },
    {
      ref: 'DLG-2026-8802',
      user: createdUsers[4], // Alex Johnson
      method: 'custom_itinerary',
      status: 'confirmed',
      startDate: new Date('2026-09-15'),
      endDate: new Date('2026-09-20'),
      passengers: 4,
      rooms: 2,
      subtotal: 1150.00,
      discount: 50.00,
      loyaltyDiscount: 0,
      total: 1100.00,
      paymentProvider: 'stripe',
      paymentStatus: 'succeeded',
      tripTemplateId: trips[1 % trips.length]?.id,
    },
    {
      ref: 'DLG-2026-8803',
      user: createdUsers[7], // Sophie Martin
      method: 'single_resource',
      resourceKind: 'hotel',
      status: 'confirmed',
      startDate: new Date('2026-09-12'),
      endDate: new Date('2026-09-16'),
      passengers: 2,
      rooms: 1,
      subtotal: 520.00,
      discount: 0,
      loyaltyDiscount: 20.00,
      total: 500.00,
      paymentProvider: 'stripe',
      paymentStatus: 'succeeded',
    },
    {
      ref: 'DLG-2026-8804',
      user: createdUsers[1], // Zhang Min (Student)
      method: 'public_package',
      status: 'confirmed',
      startDate: new Date('2026-09-18'),
      endDate: new Date('2026-09-21'),
      passengers: 1,
      rooms: 1,
      subtotal: 260.00,
      discount: 39.00, // 15% student discount
      loyaltyDiscount: 0,
      total: 221.00,
      paymentProvider: 'bakong',
      paymentStatus: 'succeeded',
      tripTemplateId: trips[2 % trips.length]?.id,
    },
    {
      ref: 'DLG-2026-8805',
      user: createdUsers[10], // Kenji Sato
      method: 'custom_itinerary',
      status: 'completed',
      startDate: new Date('2026-08-15'),
      endDate: new Date('2026-08-20'),
      passengers: 2,
      rooms: 1,
      subtotal: 980.00,
      discount: 0,
      loyaltyDiscount: 30.00,
      total: 950.00,
      paymentProvider: 'stripe',
      paymentStatus: 'succeeded',
      tripTemplateId: trips[3 % trips.length]?.id,
    },
    {
      ref: 'DLG-2026-8806',
      user: createdUsers[12], // Sokchea Meas
      method: 'single_resource',
      resourceKind: 'transportation',
      status: 'completed',
      startDate: new Date('2026-08-20'),
      endDate: new Date('2026-08-21'),
      passengers: 6,
      rooms: 0,
      subtotal: 160.00,
      discount: 10.00,
      loyaltyDiscount: 0,
      total: 150.00,
      paymentProvider: 'bakong',
      paymentStatus: 'succeeded',
    },
    {
      ref: 'DLG-2026-8807',
      user: createdUsers[6], // Michael Brown
      method: 'public_package',
      status: 'pending_payment',
      startDate: new Date('2026-09-25'),
      endDate: new Date('2026-09-28'),
      passengers: 2,
      rooms: 1,
      subtotal: 420.00,
      discount: 0,
      loyaltyDiscount: 0,
      total: 420.00,
      paymentProvider: 'stripe',
      paymentStatus: 'pending',
      tripTemplateId: trips[0]?.id,
    },
    {
      ref: 'DLG-2026-8808',
      user: createdUsers[9], // Hannah Schmidt
      method: 'single_resource',
      resourceKind: 'guide',
      status: 'confirmed',
      startDate: new Date('2026-09-08'),
      endDate: new Date('2026-09-10'),
      passengers: 2,
      rooms: 0,
      subtotal: 150.00,
      discount: 0,
      loyaltyDiscount: 0,
      total: 150.00,
      paymentProvider: 'stripe',
      paymentStatus: 'succeeded',
    },
    {
      ref: 'DLG-2026-8809',
      user: createdUsers[3], // Wang Qiang
      method: 'public_package',
      status: 'cancelled',
      startDate: new Date('2026-09-01'),
      endDate: new Date('2026-09-04'),
      passengers: 3,
      rooms: 1,
      subtotal: 620.00,
      discount: 20.00,
      loyaltyDiscount: 0,
      total: 600.00,
      paymentProvider: 'bakong',
      paymentStatus: 'refunded',
      tripTemplateId: trips[1 % trips.length]?.id,
    },
    {
      ref: 'DLG-2026-8810',
      user: createdUsers[19], // Chloe Taylor
      method: 'custom_itinerary',
      status: 'hold',
      startDate: new Date('2026-10-02'),
      endDate: new Date('2026-10-06'),
      passengers: 2,
      rooms: 1,
      subtotal: 780.00,
      discount: 40.00,
      loyaltyDiscount: 0,
      total: 740.00,
      paymentProvider: 'stripe',
      paymentStatus: 'pending',
      tripTemplateId: trips[4 % trips.length]?.id,
    },
  ];

  const createdBookings: any[] = [];

  for (const b of bookingConfigs) {
    if (!b.user) continue;

    const expiresAt = new Date(b.startDate.getTime() + 24 * 3600 * 1000);
    const booking = await prisma.booking.upsert({
      where: { reference: b.ref },
      update: {
        status: b.status,
        subtotalUsd: b.subtotal,
        discountUsd: b.discount,
        loyaltyDiscountUsd: b.loyaltyDiscount,
        totalUsd: b.total,
        passengerCount: b.passengers,
        roomCount: b.rooms,
      },
      create: {
        reference: b.ref,
        userId: b.user.id,
        method: b.method,
        singleResourceKind: b.resourceKind,
        tripTemplateId: b.tripTemplateId,
        startDate: b.startDate,
        endDate: b.endDate,
        status: b.status,
        expiresAt,
        subtotalUsd: b.subtotal,
        discountUsd: b.discount,
        loyaltyDiscountUsd: b.loyaltyDiscount,
        totalUsd: b.total,
        passengerCount: b.passengers,
        roomCount: b.rooms,
        qrCodeUrl: `https://derlg.demo/qr/${b.ref}`,
      },
    });

    createdBookings.push(booking);

    // Create BookingItem
    await prisma.bookingItem.deleteMany({ where: { bookingId: booking.id } });

    if (b.tripTemplateId) {
      await prisma.bookingItem.create({
        data: {
          bookingId: booking.id,
          bookingType: 'trip_package',
          tripId: b.tripTemplateId,
          startDate: b.startDate,
          endDate: b.endDate,
          quantity: b.passengers,
          unitPriceUsd: (b.subtotal / b.passengers),
          subtotalUsd: b.subtotal,
          snapshot: {
            tripName: 'Cambodia Explorer Experience',
            durationDays: 4,
            inclusions: ['Private guide', 'Air-conditioned van', 'Temple passes', 'Bottled water'],
          },
        },
      });
    } else if (b.resourceKind === 'hotel' && hotelRooms.length > 0) {
      const room = hotelRooms[0];
      await prisma.bookingItem.create({
        data: {
          bookingId: booking.id,
          bookingType: 'hotel_room',
          hotelRoomId: room.id,
          startDate: b.startDate,
          endDate: b.endDate,
          quantity: b.rooms || 1,
          unitPriceUsd: room.priceUsd,
          subtotalUsd: b.subtotal,
          snapshot: {
            hotelName: room.hotel.translations[0]?.name || 'Luxury Resort',
            roomType: room.roomType,
            amenities: room.amenities,
          },
        },
      });
    } else if (b.resourceKind === 'transportation' && vehicles.length > 0) {
      const v = vehicles[0];
      await prisma.bookingItem.create({
        data: {
          bookingId: booking.id,
          bookingType: 'transportation',
          vehicleId: v.id,
          startDate: b.startDate,
          endDate: b.endDate,
          quantity: 1,
          unitPriceUsd: v.priceUsd,
          subtotalUsd: b.subtotal,
          snapshot: {
            vehicleName: v.name,
            vehicleType: v.vehicleType,
            licensePlate: v.licensePlate,
          },
        },
      });
    } else if (b.resourceKind === 'guide' && guides.length > 0) {
      const g = guides[0];
      await prisma.bookingItem.create({
        data: {
          bookingId: booking.id,
          bookingType: 'tour_guide',
          guideId: g.id,
          startDate: b.startDate,
          endDate: b.endDate,
          quantity: 1,
          unitPriceUsd: g.pricePerDayUsd,
          subtotalUsd: b.subtotal,
          snapshot: {
            province: g.province,
            pricePerDay: Number(g.pricePerDayUsd),
          },
        },
      });
    }

    // Create Payment Record
    await prisma.payment.deleteMany({ where: { bookingId: booking.id } });
    const payment = await prisma.payment.create({
      data: {
        bookingId: booking.id,
        userId: b.user.id,
        provider: b.paymentProvider,
        providerPaymentId: `${b.paymentProvider}_txn_${b.ref.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
        amountUsd: b.total,
        currency: 'usd',
        status: b.paymentStatus,
        stripePaymentIntentId: b.paymentProvider === 'stripe' ? `pi_mock_${b.ref.toLowerCase().replace(/[^a-z0-9]/g, '')}` : null,
        qrCodeUrl: b.paymentProvider === 'bakong' ? `https://bakong.kh/qr/${b.ref}` : null,
        paidAt: b.paymentStatus === 'succeeded' ? new Date() : null,
        refundedAmountUsd: b.paymentStatus === 'refunded' ? b.total : 0,
      },
    });

    // If refunded, add a refund record
    if (b.paymentStatus === 'refunded') {
      await prisma.refund.create({
        data: {
          paymentId: payment.id,
          amountUsd: b.total,
          providerRefundId: `re_mock_${b.ref.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
          reason: 'Customer requested cancellation more than 48h before tour',
          percentage: 100,
          status: 'succeeded',
        },
      });
    }

    // Create Driver Assignment for confirmed / completed bookings
    if ((b.status === 'confirmed' || b.status === 'completed') && allDrivers.length > 0) {
      const driver = allDrivers[createdBookings.length % allDrivers.length];
      const vehicle = vehicles.find(v => v.id === driver.vehicleId) || vehicles[0];

      if (vehicle) {
        await prisma.driverAssignment.create({
          data: {
            driverId: driver.id,
            bookingId: booking.id,
            vehicleId: vehicle.id,
            status: b.status === 'completed' ? 'COMPLETED' : 'ACCEPTED',
            assignmentTimestamp: new Date(b.startDate.getTime() - 2 * 86400000),
            responseTimestamp: new Date(b.startDate.getTime() - 2 * 86400000 + 300000),
            tripStartTime: b.startDate,
            completionTimestamp: b.status === 'completed' ? b.endDate : null,
            telegramNotified: true,
          },
        });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 6. Realistic Customer Reviews
  // ---------------------------------------------------------------------------
  await prisma.review.deleteMany({});

  const reviewsData = [
    {
      user: createdUsers[0],
      tripId: trips[0]?.id,
      rating: 5,
      text: 'Amazing sunrise tour at Angkor Wat! Our tour guide was so knowledgeable about Khmer history and the photography spots were incredible. Highly recommended for first-time visitors.',
      isVerified: true,
    },
    {
      user: createdUsers[1],
      hotelId: hotelRooms[0]?.hotelId,
      rating: 5,
      text: '绝佳的度假体验！酒店的高棉风格建筑非常漂亮，无边泳池正对热带花园，早餐丰富，服务非常贴心周到。',
      isVerified: true,
    },
    {
      user: createdUsers[4],
      guideId: guides[0]?.id,
      rating: 5,
      text: 'Sokha is an outstanding guide! Fluent English, very respectful, and took us to quiet temple corridors away from the main tourist crowds. 10/10.',
      isVerified: true,
    },
    {
      user: createdUsers[7],
      tripId: trips[1 % trips.length]?.id,
      rating: 4,
      text: 'Un voyage inoubliable au Cambodge. Les paysages étaient magnifiques et le chauffeur était toujours ponctuel et très prudent sur la route.',
      isVerified: true,
    },
    {
      user: createdUsers[10],
      hotelId: hotelRooms[1 % hotelRooms.length]?.hotelId,
      rating: 5,
      text: '素晴らしいホテルでした。清潔感があり、スタッフの対応も丁寧です。立地も良くプノンペン市内の観光に最適でした。',
      isVerified: true,
    },
    {
      user: createdUsers[12],
      tripId: trips[2 % trips.length]?.id,
      rating: 5,
      text: 'ដំណើរកម្សាន្តល្អណាស់! សេវាកម្មរហ័សទាន់ចិត្ត និងមានសុវត្ថិភាពខ្ពស់។ ខ្ញុំពិតជាពេញចិត្តយ៉ាងខ្លាំង។',
      isVerified: true,
    },
    {
      user: createdUsers[5],
      tripId: trips[0]?.id,
      rating: 4,
      text: 'Loved the tour! The van was modern, cold AC, and cold water bottles provided all day. Ta Prohm was magical.',
      isVerified: true,
    },
  ];

  for (const r of reviewsData) {
    if (r.user && (r.tripId || r.hotelId || r.guideId)) {
      await prisma.review.create({
        data: {
          userId: r.user.id,
          tripId: r.tripId,
          hotelId: r.hotelId,
          guideId: r.guideId,
          rating: r.rating,
          text: r.text,
          isVerifiedBooking: r.isVerified,
          images: [imageUrls['places/places-1.jpg'] || ''],
        },
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 7. Support Tickets
  // ---------------------------------------------------------------------------
  await prisma.supportTicket.deleteMany({});

  const ticketsData = [
    {
      ticketId: 'TCK-2026-001',
      driverId: allDrivers[0]?.id,
      message: 'Passenger left an iPhone 15 Pro in the back seat of vehicle Siem Reap Tuk-Tuk Classic after airport transfer. Safely kept with driver.',
      status: 'IN_PROGRESS' as TicketStatus,
      priority: 'HIGH' as TicketPriority,
      assignedTo: supportAgent?.id,
    },
    {
      ticketId: 'TCK-2026-002',
      driverId: allDrivers[1 % allDrivers.length]?.id,
      message: 'Flight delay notification for booking DLG-2026-8802. Customer landed 2 hours late; need dispatch to update schedule.',
      status: 'RESOLVED' as TicketStatus,
      priority: 'NORMAL' as TicketPriority,
      assignedTo: opsManager?.id,
      resolvedAt: new Date(),
    },
    {
      ticketId: 'TCK-2026-003',
      driverId: allDrivers[2 % allDrivers.length]?.id,
      message: 'Flat tire near Tonle Sap dock. Replacement vehicle requested for afternoon temple return leg.',
      status: 'RESOLVED' as TicketStatus,
      priority: 'URGENT' as TicketPriority,
      assignedTo: opsManager?.id,
      resolvedAt: new Date(),
    },
    {
      ticketId: 'TCK-2026-004',
      driverId: allDrivers[3 % allDrivers.length]?.id,
      message: 'Inquiry regarding toll fee reimbursement for Phnom Penh to Sihanoukville expressway trip.',
      status: 'OPEN' as TicketStatus,
      priority: 'LOW' as TicketPriority,
      assignedTo: supportAgent?.id,
    },
  ];

  for (const t of ticketsData) {
    if (t.driverId) {
      await prisma.supportTicket.create({
        data: t,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 8. Broadcast Messages (Admin announcements)
  // ---------------------------------------------------------------------------
  await prisma.broadcastMessage.deleteMany({});

  const broadcastsData = [
    {
      messageId: 'BC-2026-001',
      content: '🚨 Notice: Route detour near Wat Phnom due to city marathon this Sunday morning (6:00 AM - 10:00 AM). Please use Norodom Blvd instead.',
      targetFilter: { province: 'Phnom Penh', status: 'AVAILABLE' },
      sentBy: opsManager.id,
      status: 'COMPLETED' as BroadcastStatus,
      sentCount: 8,
      failedCount: 0,
      completedAt: new Date('2026-08-28T09:00:00Z'),
    },
    {
      messageId: 'BC-2026-002',
      content: '🎉 High season peak bonus! Extra $15 payout per completed multi-day package booking during September festival weekends.',
      targetFilter: { status: 'AVAILABLE' },
      sentBy: opsManager.id,
      status: 'COMPLETED' as BroadcastStatus,
      sentCount: 12,
      failedCount: 0,
      completedAt: new Date('2026-08-30T10:30:00Z'),
    },
  ];

  for (const bc of broadcastsData) {
    await prisma.broadcastMessage.create({
      data: bc,
    });
  }

  // ---------------------------------------------------------------------------
  // 9. Emergency Safety Alerts (SOS)
  // ---------------------------------------------------------------------------
  await prisma.emergencyAlert.deleteMany({});

  const alertsData = [
    {
      userId: createdUsers[0].id,
      alertType: 'medical' as EmergencyAlertType,
      status: 'resolved' as EmergencyAlertStatus,
      latitude: 13.3633,
      longitude: 103.8564,
      accuracyMeters: 5.2,
      acknowledgedAt: new Date('2026-08-20T14:15:00Z'),
      acknowledgedBy: opsManager.id,
      resolvedAt: new Date('2026-08-20T15:00:00Z'),
      notes: 'Heat exhaustion during midday temple visit. Tourist provided water and rested at air-conditioned clinic in Siem Reap.',
    },
    {
      userId: createdUsers[4].id,
      alertType: 'lost' as EmergencyAlertType,
      status: 'resolved' as EmergencyAlertStatus,
      latitude: 11.5691,
      longitude: 104.9308,
      accuracyMeters: 8.0,
      acknowledgedAt: new Date('2026-08-25T18:30:00Z'),
      acknowledgedBy: supportAgent.id,
      resolvedAt: new Date('2026-08-25T19:10:00Z'),
      notes: 'Lost backpack with passport at restaurant. Staff coordinated with venue manager and recovered all belongings intact.',
    },
  ];

  for (const a of alertsData) {
    await prisma.emergencyAlert.create({
      data: a,
    });
  }

  // ---------------------------------------------------------------------------
  // 10. Student Verifications
  // ---------------------------------------------------------------------------
  await prisma.studentVerification.deleteMany({});

  const studentVerifications = [
    {
      userId: createdUsers[1].id, // Zhang Min
      idCardImageUrl: 'http://localhost:9000/derlg-storage/places/places-1.jpg',
      selfieImageUrl: 'http://localhost:9000/derlg-storage/guides/guides-1.jpg',
      status: 'approved' as VerificationStatus,
      reviewedById: opsManager.id,
      reviewNotes: 'Verified Tsinghua University Student ID card valid through 2027.',
      reviewedAt: new Date('2026-08-15'),
      expiresAt: new Date('2027-08-15'),
    },
    {
      userId: createdUsers[5].id, // Emily Davis
      idCardImageUrl: 'http://localhost:9000/derlg-storage/places/places-2.jpg',
      selfieImageUrl: 'http://localhost:9000/derlg-storage/guides/guides-2.jpg',
      status: 'approved' as VerificationStatus,
      reviewedById: opsManager.id,
      reviewNotes: 'Verified University of Washington ID card valid through 2027.',
      reviewedAt: new Date('2026-08-18'),
      expiresAt: new Date('2027-08-18'),
    },
    {
      userId: createdUsers[8].id, // Lucas Dubois
      idCardImageUrl: 'http://localhost:9000/derlg-storage/places/places-3.jpg',
      selfieImageUrl: 'http://localhost:9000/derlg-storage/guides/guides-3.jpg',
      status: 'pending' as VerificationStatus,
      reviewNotes: null,
    },
  ];

  for (const sv of studentVerifications) {
    await prisma.studentVerification.create({
      data: sv,
    });
  }

  // ---------------------------------------------------------------------------
  // 11. Audit Logs (Admin & System events)
  // ---------------------------------------------------------------------------
  await prisma.auditLog.deleteMany({});

  const auditEvents: {
    userId?: string;
    eventType: AuditEventType;
    entityType: string;
    entityId?: string;
    ipAddress: string;
    metadata: any;
  }[] = [
    {
      userId: opsManager.id,
      eventType: 'admin_action',
      entityType: 'broadcast_message',
      ipAddress: '192.168.1.50',
      metadata: { action: 'SENT_BROADCAST', messageId: 'BC-2026-001', recipientCount: 8 },
    },
    {
      userId: supportAgent.id,
      eventType: 'admin_action',
      entityType: 'support_ticket',
      ipAddress: '192.168.1.55',
      metadata: { action: 'RESOLVED_TICKET', ticketId: 'TCK-2026-002' },
    },
    {
      userId: createdUsers[0].id,
      eventType: 'booking_confirmed',
      entityType: 'booking',
      entityId: createdBookings[0]?.id,
      ipAddress: '110.235.10.42',
      metadata: { method: 'public_package', amount: 450.00, paymentProvider: 'bakong' },
    },
    {
      userId: createdUsers[4].id,
      eventType: 'payment_succeeded',
      entityType: 'payment',
      ipAddress: '73.189.44.12',
      metadata: { provider: 'stripe', amount: 1100.00, currency: 'usd' },
    },
    {
      userId: opsManager.id,
      eventType: 'admin_action',
      entityType: 'student_verification',
      ipAddress: '192.168.1.50',
      metadata: { action: 'APPROVED_STUDENT_STATUS', applicantEmail: 'zhang.min@example.cn' },
    },
  ];

  for (const log of auditEvents) {
    await prisma.auditLog.create({
      data: log,
    });
  }

  console.log(`  ✅ Created ${createdUsers.length} customer users`);
  console.log(`  ✅ Created ${extraDriversData.length} drivers & maintenance records`);
  console.log(`  ✅ Created ${bookingConfigs.length} bookings with items, payments, and assignments`);
  console.log(`  ✅ Created ${reviewsData.length} customer reviews`);
  console.log(`  ✅ Created ${ticketsData.length} support tickets`);
  console.log(`  ✅ Created ${broadcastsData.length} broadcast messages`);
  console.log(`  ✅ Created ${alertsData.length} emergency alerts`);
  console.log(`  ✅ Created ${studentVerifications.length} student verifications`);
  console.log(`  ✅ Created ${auditEvents.length} audit logs`);
};
