import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class AdminExportService {
  private readonly logger = new Logger(AdminExportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private get encryptionKey(): Buffer {
    const key = this.config.get<string>('EXPORT_ENCRYPTION_KEY');
    if (!key) {
      throw new Error('EXPORT_ENCRYPTION_KEY is not configured');
    }
    return scryptSync(key, 'salt', 32);
  }

  async exportBookings(params: {
    startDate?: string;
    endDate?: string;
    format?: string;
  }) {
    const where: Prisma.BookingWhereInput = {
      // Soft-deleted bookings must not appear in an export either.
      deletedAt: null,
    };
    if (params.startDate || params.endDate) {
      where.createdAt = {};
      if (params.startDate) where.createdAt.gte = new Date(params.startDate);
      if (params.endDate) where.createdAt.lte = new Date(params.endDate);
    }

    const bookings = await this.prisma.booking.findMany({
      where,
      include: {
        user: { select: { email: true, fullName: true } },
        payments: { select: { amountUsd: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });

    const mapped = bookings.map((b) => ({
      id: b.id,
      reference: b.reference,
      customerEmail: b.user?.email || '',
      customerName: b.user?.fullName || '',
      startDate: b.startDate?.toISOString() || '',
      endDate: b.endDate?.toISOString() || '',
      status: b.status,
      totalUsd: Number(b.totalUsd),
      paymentStatus: b.payments[0]?.status || '',
      passengerCount: b.passengerCount,
      createdAt: b.createdAt.toISOString(),
    }));

    if (params.format === 'json') {
      return { format: 'json', content: JSON.stringify(mapped, null, 2) };
    }

    return { format: 'csv', content: this.toCsv(mapped) };
  }

  async exportDrivers() {
    const drivers = await this.prisma.driver.findMany({
      include: {
        assignments: {
          where: { status: 'COMPLETED' },
          select: { id: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const mapped = drivers.map((d) => ({
      id: d.id,
      driverId: d.driverId,
      driverName: d.driverName,
      phone: d.phone,
      status: d.status,
      telegramId: d.telegramId ? String(d.telegramId) : '',
      totalAssignments: d.assignments.length,
      createdAt: d.createdAt.toISOString(),
    }));

    return { format: 'csv', content: this.toCsv(mapped) };
  }

  async exportPayments() {
    const payments = await this.prisma.payment.findMany({
      include: {
        user: { select: { email: true, fullName: true } },
        booking: { select: { reference: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });

    const mapped = payments.map((p) => ({
      id: p.id,
      bookingReference: p.booking?.reference || '',
      customerEmail: p.user?.email || '',
      provider: p.provider,
      amountUsd: Number(p.amountUsd),
      currency: p.currency,
      status: p.status,
      paidAt: p.paidAt?.toISOString() || '',
      createdAt: p.createdAt.toISOString(),
    }));

    const csv = this.toCsv(mapped);
    const encrypted = this.encrypt(csv);

    return {
      format: 'csv.encrypted',
      content: encrypted.encryptedData,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
    };
  }

  async triggerBackup(userId: string) {
    const backupId = crypto.randomUUID();
    const backupUrl = `https://storage.supabase.co/backups/${backupId}.sql`;

    const backup = await this.prisma.backup.create({
      data: {
        backupFileUrl: backupUrl,
        backupSizeBytes: BigInt(0),
        createdByAdminId: userId,
      },
    });

    return {
      id: backup.id,
      backupFileUrl: backup.backupFileUrl,
      createdByAdminId: backup.createdByAdminId,
      createdAt: backup.createdAt,
    };
  }

  async getBackups() {
    return this.prisma.backup.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Serialises rows to CSV.
   *
   * Values are quoted whenever they contain a comma, quote or newline, with
   * embedded quotes doubled per RFC 4180. The previous versions only quoted on a
   * comma, so a value containing a bare quote or a newline — a cancellation
   * reason typed by an admin, for instance — corrupted the row.
   */
  private toCsv(data: Array<Record<string, unknown>>): string {
    if (!data.length) return '';
    const headers = Object.keys(data[0]);

    const escape = (value: unknown): string => {
      if (value === null || value === undefined) return '';
      const raw =
        typeof value === 'string'
          ? value
          : typeof value === 'number' || typeof value === 'boolean'
            ? String(value)
            : value instanceof Date
              ? value.toISOString()
              : JSON.stringify(value);
      return /["\n\r,]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
    };

    const rows = data.map((row) =>
      headers.map((h) => escape(row[h])).join(','),
    );
    return [headers.map(escape).join(','), ...rows].join('\n');
  }

  private encrypt(plaintext: string): {
    encryptedData: string;
    iv: string;
    authTag: string;
  } {
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    return {
      encryptedData: encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
    };
  }

  decrypt(encryptedData: string, iv: string, authTag: string): string {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.encryptionKey,
      Buffer.from(iv, 'hex'),
    );
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}
