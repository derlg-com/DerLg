import { ConfigService } from '@nestjs/config';

import { AbaKhqrService } from './aba-khqr.service';

/** `TAG + zero-padded length + value`, so fixtures cannot declare a wrong length. */
function tlv(tag: string, value: string): string {
  return `${tag}${String(value.length).padStart(2, '0')}${value}`;
}

/**
 * A structurally valid static KHQR.
 *
 * Built from `tlv()` rather than typed as a literal: a hand-written fixture with a
 * length that does not match its value is not a KHQR string at all, and every
 * assertion against it would be testing the wrong thing.
 *
 * Contains everything the builder edits — static point-of-initiation, a USD
 * currency tag, and a trailing CRC. The CRC value is arbitrary; the builder
 * discards and recomputes it.
 */
const STATIC_QR =
  tlv('00', '01') +
  tlv('01', '11') +
  tlv(
    '30',
    tlv('00', 'abaakhppxxx@abaa') + tlv('01', '123456') + tlv('02', 'ABA BANK'),
  ) +
  tlv('53', '840') +
  tlv('58', 'KH') +
  tlv('59', 'CHOENG RAYU') +
  tlv('60', 'Phnom Penh') +
  tlv('63', 'ABCD');

function buildService(overrides: Record<string, unknown> = {}) {
  const values: Record<string, unknown> = {
    ABA_STATIC_QR: STATIC_QR,
    ABA_QR_TTL_MINUTES: 10,
    ...overrides,
  };
  const config = {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
  return new AbaKhqrService(config);
}

/** Reads a top-level TLV value out of a KHQR string. */
function readTag(qr: string, tag: string): string | null {
  let i = 0;
  while (i + 4 <= qr.length) {
    const currentTag = qr.slice(i, i + 2);
    const length = Number.parseInt(qr.slice(i + 2, i + 4), 10);
    if (Number.isNaN(length)) return null;
    const value = qr.slice(i + 4, i + 4 + length);
    if (currentTag === tag) return value;
    i += 4 + length;
  }
  return null;
}

/** Independent CRC-16/CCITT-FALSE, to check the service's own implementation. */
function referenceCrc16(input: string): string {
  let crc = 0xffff;
  for (const char of input) {
    crc ^= char.charCodeAt(0) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

describe('AbaKhqrService', () => {
  describe('buildDynamicQr', () => {
    it('flips the point of initiation from static to dynamic', () => {
      // Left at 11, ABA ignores the amount and shows "must input the value".
      const { payload } = buildService().buildDynamicQr(5);

      expect(payload).toContain('010212');
      expect(payload).not.toContain('010211');
      expect(readTag(payload, '01')).toBe('12');
    });

    it('inserts the amount immediately after the currency tag', () => {
      const { payload } = buildService().buildDynamicQr(5);

      // Tag 54, length 04, value "5.00" — eight characters total.
      //
      // Note: the ABA integration write-up renders this as "540405.00", which is
      // nine characters and would declare a length of 04 for a 5-character value.
      // That is a typo in the prose, not the format; a scanner reading it would
      // mis-parse every following tag.
      expect(payload).toContain('530384054045.00');
      expect(readTag(payload, '54')).toBe('5.00');
    });

    it('always writes the amount with two decimals', () => {
      // "5" and "5.00" have different tag lengths, which changes the CRC.
      expect(readTag(buildService().buildDynamicQr(5).payload, '54')).toBe(
        '5.00',
      );
      expect(readTag(buildService().buildDynamicQr(0.5).payload, '54')).toBe(
        '0.50',
      );
      expect(readTag(buildService().buildDynamicQr(189).payload, '54')).toBe(
        '189.00',
      );
    });

    it('declares the correct length for a multi-digit amount', () => {
      const { payload } = buildService().buildDynamicQr(1234.5);

      // "1234.50" is 7 characters.
      expect(payload).toContain('54071234.50');
    });

    it('appends a timestamp tag with created and future expiry sub-tags', () => {
      // Without tag 99, ABA rejects a dynamic QR as already expired.
      const before = Date.now();
      const { payload } = buildService().buildDynamicQr(5, 10);

      const timestamp = readTag(payload, '99');
      expect(timestamp).not.toBeNull();

      const created = Number(timestamp!.slice(4, 4 + 13));
      const expires = Number(timestamp!.slice(21, 21 + 13));

      expect(timestamp!.startsWith('0013')).toBe(true);
      expect(timestamp!.slice(17, 21)).toBe('0113');
      expect(created).toBeGreaterThanOrEqual(before);
      expect(expires).toBeGreaterThan(Date.now());
      expect(expires - created).toBe(10 * 60 * 1000);
    });

    it('encodes the expiry in milliseconds, not seconds', () => {
      // A seconds value is ~1970 in millisecond terms, i.e. permanently expired.
      const { payload } = buildService().buildDynamicQr(5);
      const timestamp = readTag(payload, '99')!;

      expect(timestamp.slice(0, 4)).toBe('0013'); // 13 digits = ms
    });

    it('honours the configured TTL', () => {
      const { expiresAt } = buildService({
        ABA_QR_TTL_MINUTES: 3,
      }).buildDynamicQr(5);

      const minutes = (expiresAt.getTime() - Date.now()) / 60_000;
      expect(minutes).toBeGreaterThan(2.5);
      expect(minutes).toBeLessThanOrEqual(3);
    });

    it('lets an explicit TTL override the configured one', () => {
      const { expiresAt } = buildService({
        ABA_QR_TTL_MINUTES: 10,
      }).buildDynamicQr(5, 2);

      expect((expiresAt.getTime() - Date.now()) / 60_000).toBeLessThanOrEqual(
        2,
      );
    });

    it('recomputes the CRC over the payload including the 6304 prefix', () => {
      // The CRC must cover "6304" itself. Computing it over the payload alone
      // yields a QR no scanner accepts.
      const { payload } = buildService().buildDynamicQr(5);

      const body = payload.slice(0, -4);
      expect(body.endsWith('6304')).toBe(true);
      expect(payload.slice(-4)).toBe(referenceCrc16(body));
    });

    it('produces a CRC of exactly four uppercase hex characters', () => {
      for (const amount of [0.01, 1, 7.77, 250, 9999.99]) {
        const { payload } = buildService().buildDynamicQr(amount);
        expect(payload.slice(-4)).toMatch(/^[0-9A-F]{4}$/);
      }
    });

    it('reports the expiry it encoded', () => {
      const { payload, expiresAt } = buildService().buildDynamicQr(5);
      const timestamp = readTag(payload, '99')!;

      expect(Number(timestamp.slice(21, 34))).toBe(expiresAt.getTime());
    });

    it('returns the amount it actually encoded', () => {
      // Rounded to cents, so the caller can persist exactly what was charged.
      expect(buildService().buildDynamicQr(5.004).amountUsd).toBe(5);
      expect(buildService().buildDynamicQr(5.006).amountUsd).toBe(5.01);
    });

    it('leaves an already-dynamic merchant QR dynamic', () => {
      const dynamicSource = STATIC_QR.replace('010211', '010212');
      const { payload } = buildService({
        ABA_STATIC_QR: dynamicSource,
      }).buildDynamicQr(5);

      expect(readTag(payload, '01')).toBe('12');
      expect(readTag(payload, '54')).toBe('5.00');
    });

    describe('refuses to build an unusable QR', () => {
      it('when no merchant QR is configured', () => {
        expect(() =>
          buildService({ ABA_STATIC_QR: '' }).buildDynamicQr(5),
        ).toThrow(/ABA_STATIC_QR is not configured/);
      });

      it('when the amount is zero or negative', () => {
        expect(() => buildService().buildDynamicQr(0)).toThrow(/non-positive/);
        expect(() => buildService().buildDynamicQr(-5)).toThrow(/non-positive/);
      });

      it('when the amount is not a number', () => {
        expect(() => buildService().buildDynamicQr(Number.NaN)).toThrow(
          /non-positive/,
        );
      });

      it('when the merchant QR has no point-of-initiation tag', () => {
        expect(() =>
          buildService({
            ABA_STATIC_QR: '000201' + '5303840' + '6304ABCD',
          }).buildDynamicQr(5),
        ).toThrow(/Point-of-Initiation/);
      });

      it('when the merchant QR has no USD currency tag', () => {
        // A KHR-only merchant QR cannot carry a USD amount.
        const khrOnly = STATIC_QR.replace('5303840', '5303116');
        expect(() =>
          buildService({ ABA_STATIC_QR: khrOnly }).buildDynamicQr(5),
        ).toThrow(/USD currency tag/);
      });

      it('when the merchant QR is truncated and has no CRC tag', () => {
        // Blindly slicing 8 characters off a truncated string silently corrupts
        // it; this fails loudly instead.
        expect(() =>
          buildService({
            ABA_STATIC_QR: STATIC_QR.slice(0, -8),
          }).buildDynamicQr(5),
        ).toThrow(/does not end with a CRC tag/);
      });
    });
  });

  describe('parseCreditAlert', () => {
    const service = buildService();
    const REAL_ALERT =
      '$5.00 paid by TEP SOMNANG (*476) on Jun 23, 03:11 PM via ABA PAY at ' +
      'CHOENG RAYU. Trx. ID: 178220228091798, APV: 400834.';

    it('extracts amount, phone suffix and transaction id', () => {
      expect(service.parseCreditAlert(REAL_ALERT)).toEqual({
        amountUsd: 5,
        phoneSuffix: '476',
        trxId: '178220228091798',
      });
    });

    it('handles a thousands separator', () => {
      // Appears as soon as an amount reaches $1,000 — a plain parseFloat would
      // read "1,250.00" as 1.
      const alert = REAL_ALERT.replace('$5.00', '$1,250.00');

      expect(service.parseCreditAlert(alert)?.amountUsd).toBe(1250);
    });

    it('handles a whole-dollar amount', () => {
      expect(
        service.parseCreditAlert(REAL_ALERT.replace('$5.00', '$12'))?.amountUsd,
      ).toBe(12);
    });

    it('tolerates a missing dollar sign and extra whitespace', () => {
      const alert = REAL_ALERT.replace('$5.00', ' 5.00 ');

      expect(service.parseCreditAlert(alert)?.amountUsd).toBe(5);
    });

    it('matches when the alert is preceded by other text', () => {
      // Some ABA templates prefix the merchant name or a newline.
      expect(service.parseCreditAlert(`ABA PAY\n${REAL_ALERT}`)?.trxId).toBe(
        '178220228091798',
      );
    });

    it('matches across newlines', () => {
      const alert = REAL_ALERT.replace('via ABA PAY', 'via\nABA PAY');

      expect(service.parseCreditAlert(alert)?.amountUsd).toBe(5);
    });

    it.each([
      ['null', null],
      ['undefined', undefined],
      ['empty', ''],
      ['unrelated chatter', 'anyone free for lunch?'],
      ['a debit notice', '$5.00 spent at CHOENG RAYU. Trx. ID: 12345'],
      ['no transaction id', '$5.00 paid by TEP SOMNANG (*476) on Jun 23'],
      [
        'no phone suffix',
        '$5.00 paid by TEP SOMNANG on Jun 23. Trx. ID: 12345',
      ],
    ])('returns null for %s', (_label, input) => {
      expect(service.parseCreditAlert(input)).toBeNull();
    });

    it('returns null for a zero amount rather than settling it', () => {
      const alert = REAL_ALERT.replace('$5.00', '$0.00');

      expect(service.parseCreditAlert(alert)).toBeNull();
    });
  });

  describe('normalizeTelegramId', () => {
    it('treats the three representations of one chat as equal', () => {
      const service = buildService();
      const marked = service.normalizeTelegramId('-1004302307901');
      const bare = service.normalizeTelegramId('4302307901');
      const bigint = service.normalizeTelegramId(BigInt('4302307901'));

      expect(marked).toBe('4302307901');
      expect(bare).toBe(marked);
      expect(bigint).toBe(marked);
    });

    it('strips a plain negative sign', () => {
      expect(buildService().normalizeTelegramId('-12345')).toBe('12345');
    });

    it('returns an empty string for missing ids', () => {
      const service = buildService();
      expect(service.normalizeTelegramId(null)).toBe('');
      expect(service.normalizeTelegramId(undefined)).toBe('');
    });
  });
});
