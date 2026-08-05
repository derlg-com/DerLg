import { ConfigService } from '@nestjs/config';

import { ErrorCode } from '../../common/errors/error-codes';
import { StorageService } from './storage.service';

/**
 * The AWS SDK v3 clients are mocked wholesale: these tests assert how DerLg
 * *uses* R2 (config gating, key shape, public-domain preference, idempotent
 * HEAD), never the SDK's own signing behaviour, and they never touch the
 * network. Mirrors stripe.service.spec.ts.
 */
const send = jest.fn();
const getSignedUrlMock = jest.fn();

jest.mock('@aws-sdk/client-s3', () => {
  // Each command class is a thin stub that records its input — the tests only
  // care that the right command type was constructed with the right bucket/key.
  class StubCommand {
    constructor(public readonly input: Record<string, unknown>) {}
  }
  return {
    __esModule: true,
    S3Client: jest.fn().mockImplementation(() => ({ send })),
    PutObjectCommand: StubCommand,
    GetObjectCommand: StubCommand,
    HeadObjectCommand: StubCommand,
    DeleteObjectsCommand: StubCommand,
  };
});

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  __esModule: true,
  getSignedUrl: (...args: unknown[]) => getSignedUrlMock(...args),
}));

function configWith(values: Record<string, string | undefined>): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

const CONFIGURED = {
  R2_ACCOUNT_ID: 'acct_123',
  R2_ACCESS_KEY_ID: 'access_key_id',
  R2_SECRET_ACCESS_KEY: 'secret_access_key',
  R2_BUCKET: 'derlg-images',
};

describe('StorageService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  describe('when no credentials are configured', () => {
    const service = new StorageService(configWith({}));

    it('reports itself unconfigured instead of throwing at construction', () => {
      expect(service.isConfigured).toBe(false);
    });

    it('presignPut answers 503 with STORAGE_UNAVAILABLE', async () => {
      await expect(
        service.presignPut({ key: 'seed/a/b/1.jpg', contentType: 'image/jpeg' }),
      ).rejects.toMatchObject({ code: ErrorCode.STORAGE_UNAVAILABLE, status: 503 });
    });

    it('publicUrl answers 503 with STORAGE_UNAVAILABLE', async () => {
      await expect(service.publicUrl('seed/a/b/1.jpg')).rejects.toMatchObject({
        code: ErrorCode.STORAGE_UNAVAILABLE,
        status: 503,
      });
    });

    it('uploadFromBytes answers 503 with STORAGE_UNAVAILABLE', async () => {
      await expect(
        service.uploadFromBytes({ key: 'seed/a/b/1.jpg', body: Buffer.from('x'), contentType: 'image/jpeg' }),
      ).rejects.toMatchObject({ code: ErrorCode.STORAGE_UNAVAILABLE, status: 503 });
    });

    it('exists answers 503 with STORAGE_UNAVAILABLE', async () => {
      await expect(service.exists('seed/a/b/1.jpg')).rejects.toMatchObject({
        code: ErrorCode.STORAGE_UNAVAILABLE,
        status: 503,
      });
    });
  });

  describe('keyFor', () => {
    const service = new StorageService(configWith({}));

    it('produces seed/<city>/<place>/<index+1><ext> matching the local /seed shape', () => {
      expect(
        service.keyFor({ citySlug: 'siem-reap', placeSlug: 'angkor-wat', index: 0, ext: '.jpg' }),
      ).toBe('seed/siem-reap/angkor-wat/1.jpg');
    });

    it('normalises an extension missing the leading dot', () => {
      expect(
        service.keyFor({ citySlug: 'siem-reap', placeSlug: 'angkor-wat', index: 2, ext: 'jpg' }),
      ).toBe('seed/siem-reap/angkor-wat/3.jpg');
    });
  });

  describe('when configured', () => {
    let service: StorageService;

    beforeEach(() => {
      service = new StorageService(configWith(CONFIGURED));
    });

    it('reports itself configured', () => {
      expect(service.isConfigured).toBe(true);
    });

    it('publicUrl prefers R2_PUBLIC_BASE_URL and never touches the network', async () => {
      const withBase = new StorageService(
        configWith({ ...CONFIGURED, R2_PUBLIC_BASE_URL: 'https://cdn.derlg.app/' }),
      );
      const url = await withBase.publicUrl('seed/siem-reap/angkor-wat/1.jpg');
      expect(url).toBe('https://cdn.derlg.app/seed/siem-reap/angkor-wat/1.jpg');
      expect(getSignedUrlMock).not.toHaveBeenCalled();
      expect(send).not.toHaveBeenCalled();
    });

    it('publicUrl falls back to a 1h presigned GET when no public base is set', async () => {
      getSignedUrlMock.mockResolvedValue('https://signed.example/obj');
      const url = await service.publicUrl('seed/siem-reap/angkor-wat/1.jpg');
      expect(url).toBe('https://signed.example/obj');
      // expiresIn is capped at 1 hour so a leaked URL is not long-lived.
      expect(getSignedUrlMock).toHaveBeenCalledTimes(1);
      const expiresIn = getSignedUrlMock.mock.calls[0][2];
      expect(expiresIn).toEqual({ expiresIn: 60 * 60 });
    });

    it('presignPut signs a PUT with Content-Type and Content-Length for 5 minutes', async () => {
      getSignedUrlMock.mockResolvedValue('https://signed.example/put');
      const result = await service.presignPut({
        key: 'seed/a/b/1.jpg',
        contentType: 'image/jpeg',
        contentLength: 1234,
      });
      expect(result).toEqual({
        url: 'https://signed.example/put',
        method: 'PUT',
        headers: { 'Content-Type': 'image/jpeg', 'Content-Length': '1234' },
      });
      expect(getSignedUrlMock).toHaveBeenCalledTimes(1);
      expect(getSignedUrlMock.mock.calls[0][2]).toEqual({ expiresIn: 5 * 60 });
    });

    it('uploadFromBytes sends a PutObject with the body and content type', async () => {
      send.mockResolvedValue({});
      await service.uploadFromBytes({
        key: 'seed/a/b/1.jpg',
        body: Buffer.from('bytes'),
        contentType: 'image/jpeg',
      });
      expect(send).toHaveBeenCalledTimes(1);
      const command = send.mock.calls[0][0];
      expect(command.input).toMatchObject({
        Bucket: 'derlg-images',
        Key: 'seed/a/b/1.jpg',
        ContentType: 'image/jpeg',
      });
      expect(command.input.Body).toBeInstanceOf(Buffer);
    });

    it('exists returns false on NotFound, true on a successful HEAD', async () => {
      send.mockResolvedValueOnce({});
      await expect(service.exists('seed/a/b/1.jpg')).resolves.toBe(true);

      const notFound = Object.assign(new Error('not here'), { name: 'NotFound' });
      send.mockRejectedValueOnce(notFound);
      await expect(service.exists('seed/a/b/1.jpg')).resolves.toBe(false);
    });

    it('exists rethrows non-NotFound errors instead of swallowing them', async () => {
      send.mockRejectedValueOnce(Object.assign(new Error('boom'), { name: 'InternalError' }));
      await expect(service.exists('seed/a/b/1.jpg')).rejects.toThrow('boom');
    });

    it('reuses one S3 client across calls rather than constructing per request', async () => {
      send.mockResolvedValue({});
      await service.uploadFromBytes({
        key: 'k',
        body: Buffer.from('x'),
        contentType: 'image/jpeg',
      });
      await service.exists('k');
      const { S3Client } = await import('@aws-sdk/client-s3');
      expect(S3Client).toHaveBeenCalledTimes(1);
    });
  });
});