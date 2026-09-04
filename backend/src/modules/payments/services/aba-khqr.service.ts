import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Parsed shape of an ABA credit alert.
 */
export interface AbaCreditAlert {
  /** Amount credited, in USD. */
  amountUsd: number;
  /** Last three digits of the payer's phone, e.g. `476` from `(*476)`. */
  phoneSuffix: string;
  /** ABA transaction id. The settlement idempotency key. */
  trxId: string;
}

/**
 * EMVCo / KHQR tag identifiers used here.
 *
 * Every field in a KHQR string is `TAG(2) + LENGTH(2) + VALUE`, so
 * `540405.00` is tag 54, length 04, value "5.00".
 */
const TAG = {
  /** Point of Initiation: 11 = static, 12 = dynamic. */
  POINT_OF_INITIATION: '01',
  /** Transaction currency (ISO 4217 numeric). 840 = USD. */
  CURRENCY: '53',
  /** Transaction amount. Only honoured when the QR is dynamic. */
  AMOUNT: '54',
  /** CRC-16 checksum over everything preceding it. */
  CRC: '63',
  /** KHQR timestamp: sub-tag 00 = created, 01 = expires (both unix ms). */
  TIMESTAMP: '99',
} as const;

const POI_STATIC = `${TAG.POINT_OF_INITIATION}0211`;
const POI_DYNAMIC = `${TAG.POINT_OF_INITIATION}0212`;
/** Tag 53, length 03, value 840 (USD). The amount tag is inserted after it. */
const CURRENCY_USD = `${TAG.CURRENCY}03840`;
/** Tag 63 + length 04. The CRC is computed over the string *including* this. */
const CRC_PREFIX = `${TAG.CRC}04`;

/**
 * Builds dynamic KHQR codes for ABA, and parses ABA's Telegram credit alerts.
 *
 * ## Why this exists
 *
 * ABA publishes no payment API. Two open surfaces are available instead:
 *
 *  - **KHQR**, an open EMVCo-derived spec, which lets us turn the merchant's
 *    static QR into a dynamic one with the amount pre-filled.
 *  - **The Telegram credit alert** ABA's own bot posts when money arrives, which
 *    is the only signal that a payment actually settled.
 *
 * This service owns the first surface and the parsing half of the second. It is
 * deliberately free of I/O and database access so the tag arithmetic can be
 * tested directly.
 */
@Injectable()
export class AbaKhqrService {
  private readonly logger = new Logger(AbaKhqrService.name);

  constructor(private readonly config: ConfigService) {}

  /** Whether a merchant QR is configured. */
  isConfigured(): boolean {
    return (this.config.get<string>('ABA_STATIC_QR') ?? '') !== '';
  }

  /**
   * Converts the configured static merchant QR into a dynamic one for `amountUsd`.
   *
   * Four edits, all of which are required — omitting any one produces a QR that
   * fails in a different way in ABA Mobile:
   *
   * | Edit | Omitting it causes |
   * |------|--------------------|
   * | Point of Initiation 11 → 12 | Amount ignored: "must input the value" |
   * | Insert amount (tag 54)      | No preset amount |
   * | Append timestamp (tag 99)   | "the QR code is expired" |
   * | Recompute CRC (tag 63)      | Will not scan at all |
   *
   * @returns the KHQR string and the expiry it encodes.
   */
  buildDynamicQr(
    amountUsd: number,
    ttlMinutes?: number,
  ): { payload: string; expiresAt: Date; amountUsd: number } {
    const staticQr = this.config.get<string>('ABA_STATIC_QR') ?? '';
    if (staticQr === '') {
      throw new Error('ABA_STATIC_QR is not configured');
    }
    if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
      throw new Error(
        `Refusing to build a QR for a non-positive amount: ${amountUsd}`,
      );
    }

    const ttl =
      ttlMinutes ?? this.config.get<number>('ABA_QR_TTL_MINUTES') ?? 10;

    // 1. Static → dynamic. Without this ABA ignores tag 54 entirely.
    if (!staticQr.includes(POI_STATIC) && !staticQr.includes(POI_DYNAMIC)) {
      throw new Error(
        'ABA_STATIC_QR contains no Point-of-Initiation tag (expected "010211" or "010212"). ' +
          'Confirm the QR string with ABA merchant support.',
      );
    }
    let qr = staticQr.replace(POI_STATIC, POI_DYNAMIC);

    // 2. Drop the existing CRC. It covers the old content and is recomputed last.
    qr = this.stripCrc(qr);

    // 3. Insert the amount immediately after the currency tag.
    if (!qr.includes(CURRENCY_USD)) {
      throw new Error(
        `ABA_STATIC_QR has no USD currency tag ("${CURRENCY_USD}"); a KHR-only merchant QR cannot carry a USD amount.`,
      );
    }
    // Two decimals: KHQR amounts are decimal strings, and "5" vs "5.00" changes
    // the tag length, which changes the CRC.
    const amountValue = amountUsd.toFixed(2);
    qr = qr.replace(
      CURRENCY_USD,
      CURRENCY_USD + this.tag(TAG.AMOUNT, amountValue),
    );

    // 4. Append created/expiry. ABA treats a dynamic QR with no tag 99 as expired.
    const createdAt = Date.now();
    const expiresAtMs = createdAt + ttl * 60 * 1000;
    const timestampValue =
      this.tag('00', String(createdAt)) + this.tag('01', String(expiresAtMs));
    qr += this.tag(TAG.TIMESTAMP, timestampValue);

    // 5. Recompute the checksum over the payload *plus* the "6304" prefix.
    const withCrcPrefix = qr + CRC_PREFIX;
    const payload = withCrcPrefix + this.crc16(withCrcPrefix);

    return {
      payload,
      expiresAt: new Date(expiresAtMs),
      amountUsd: Number(amountValue),
    };
  }

  /**
   * Parses an ABA credit alert.
   *
   * The alert looks like:
   *
   * ```
   * $5.00 paid by TEP SOMNANG (*476) on Jun 23, 03:11 PM via ABA PAY at CHOENG RAYU. Trx. ID: 178220228091798, APV: 400834.
   * ```
   *
   * Returns `null` for anything that is not an alert — the listener sees every
   * message in the group, most of which are not payments.
   *
   * If ABA changes the wording this regex stops matching and payments stop
   * auto-settling. That is the intended failure direction: a parser that guesses
   * would settle the wrong booking.
   */
  parseCreditAlert(text: string | null | undefined): AbaCreditAlert | null {
    if (!text) return null;

    const match = text.match(
      /\$?\s*([\d,]+(?:\.\d{1,2})?)\s+paid by\s+.+?\(\*(\d{3})\).+?Trx\.\s*ID:\s*(\d+)/is,
    );
    if (!match) return null;

    // Thousands separators appear once an amount reaches $1,000.
    const amountUsd = Number.parseFloat(match[1].replace(/,/g, ''));
    if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
      this.logger.warn('Ignored ABA alert with an unusable amount', {
        raw: match[1],
      });
      return null;
    }

    return { amountUsd, phoneSuffix: match[2], trxId: match[3] };
  }

  /**
   * Normalises a Telegram chat or user id for comparison.
   *
   * The same chat is `-1004302307901` from the Bot API, `4302307901` as a bare
   * channel id, and a `BigInteger` instance from GramJS. Stripping the `-100`
   * prefix and the sign makes all three compare equal.
   */
  normalizeTelegramId(id: unknown): string {
    return this.stringifyId(id).replace(/^-100/, '').replace(/^-/, '');
  }

  /**
   * Converts an id of unknown runtime type to a string.
   *
   * GramJS hands back `BigInteger` objects, whose `toString()` is meaningful, so a
   * blanket `String(id)` is right for them — but wrong for any other object, which
   * would stringify to `[object Object]` and then silently fail to match any
   * configured id. Objects are therefore only accepted when they actually override
   * `toString`.
   */
  private stringifyId(id: unknown): string {
    if (id === undefined || id === null) return '';
    if (typeof id === 'string') return id;
    if (typeof id === 'number' || typeof id === 'bigint') return id.toString();
    if (typeof id === 'object') {
      const asObject = id as { toString?: () => string };
      if (
        typeof asObject.toString === 'function' &&
        asObject.toString !== Object.prototype.toString
      ) {
        return asObject.toString();
      }
      this.logger.warn('Could not read a Telegram id from an unexpected value');
      return '';
    }
    return '';
  }

  /** `TAG + zero-padded length + value`. */
  private tag(tag: string, value: string): string {
    return `${tag}${String(value.length).padStart(2, '0')}${value}`;
  }

  /**
   * Removes a trailing CRC tag if present.
   *
   * Slicing a blind 8 characters assumes the CRC is last and is exactly
   * `6304XXXX`. That holds for a well-formed KHQR string, but silently corrupts
   * anything else — so the shape is checked first.
   */
  private stripCrc(qr: string): string {
    const tail = qr.slice(-8);
    if (tail.startsWith(CRC_PREFIX)) return qr.slice(0, -8);
    throw new Error(
      'ABA_STATIC_QR does not end with a CRC tag ("6304" + 4 hex). The string is probably truncated.',
    );
  }

  /**
   * CRC-16/CCITT-FALSE, as required by EMVCo.
   *
   * Polynomial 0x1021, initial value 0xFFFF, no reflection, no final XOR.
   * Returned as 4 uppercase hex characters.
   */
  private crc16(input: string): string {
    let crc = 0xffff;
    for (let i = 0; i < input.length; i += 1) {
      crc ^= input.charCodeAt(i) << 8;
      for (let bit = 0; bit < 8; bit += 1) {
        crc =
          crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
      }
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
  }
}
