import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { MinioService, STORAGE_BUCKETS } from './minio.service';

/**
 * The presigned-URL endpoints take a bucket and object key straight from an HTTP
 * request. MinIO resolves `..` segments, so without validation
 * `vehicles/../verifications/id-card.jpg` would read a student's identity
 * document out of a different bucket path.
 */
describe('MinioService', () => {
  let service: MinioService;

  beforeEach(() => {
    const config = {
      get: (key: string, fallback?: unknown) =>
        ({
          MINIO_ENDPOINT: 'localhost',
          MINIO_PORT: 9000,
          MINIO_USE_SSL: 'false',
          MINIO_ACCESS_KEY: 'test-key',
          MINIO_SECRET_KEY: 'test-secret',
          MINIO_BUCKET: 'derlg-storage',
        })[key] ?? fallback,
    } as unknown as ConfigService;

    service = new MinioService(config);
    service.onModuleInit();
  });

  describe('assertBucketAllowed', () => {
    it.each(STORAGE_BUCKETS)(
      'should accept the allowlisted bucket %s',
      (bucket) => {
        expect(service.assertBucketAllowed(bucket)).toBe(bucket);
      },
    );

    it('should reject a bucket outside the allowlist', () => {
      expect(() => service.assertBucketAllowed('derlg-storage')).toThrow(
        BadRequestException,
      );
    });

    it('should reject an empty bucket name', () => {
      expect(() => service.assertBucketAllowed('')).toThrow(
        BadRequestException,
      );
    });

    it('should list the permitted buckets in the error', () => {
      expect(() => service.assertBucketAllowed('secrets')).toThrow(
        /tours, vehicles/,
      );
    });
  });

  describe('assertObjectKeySafe', () => {
    it('should accept a plain key', () => {
      expect(service.assertObjectKeySafe('photo.jpg')).toBe('photo.jpg');
    });

    it('should accept a nested key', () => {
      expect(service.assertObjectKeySafe('2026/08/photo.jpg')).toBe(
        '2026/08/photo.jpg',
      );
    });

    it.each([
      ['parent traversal', '../verifications/id-card.jpg'],
      ['nested traversal', 'vehicles/../../etc/passwd'],
      ['trailing traversal', 'vehicles/photos/..'],
      ['single dot segment', 'vehicles/./photo.jpg'],
      ['absolute path', '/etc/passwd'],
      ['backslash traversal', '..\\..\\windows\\system32'],
      ['percent-encoded traversal', '%2e%2e%2fverifications%2fid.jpg'],
      ['double-encoded traversal', '%252e%252e%252fsecret.jpg'],
    ])('should reject %s', (_label, key) => {
      expect(() => service.assertObjectKeySafe(key)).toThrow(
        BadRequestException,
      );
    });

    it('should reject an empty key', () => {
      expect(() => service.assertObjectKeySafe('')).toThrow(
        BadRequestException,
      );
      expect(() => service.assertObjectKeySafe('   ')).toThrow(
        BadRequestException,
      );
    });

    it('should reject a null byte', () => {
      expect(() => service.assertObjectKeySafe('photo.jpg\0.php')).toThrow(
        BadRequestException,
      );
    });

    it('should reject an over-long key', () => {
      expect(() => service.assertObjectKeySafe('a'.repeat(513))).toThrow(
        BadRequestException,
      );
    });

    it('should normalise backslashes in an otherwise safe key', () => {
      expect(service.assertObjectKeySafe('vehicles\\photo.jpg')).toBe(
        'vehicles/photo.jpg',
      );
    });
  });

  describe('presigned URLs', () => {
    it('should validate the bucket before contacting MinIO', async () => {
      const client = service.getClient();
      const spy = jest.spyOn(client, 'presignedPutObject');

      await expect(
        service.createPresignedUpload('not-a-bucket', 'photo.jpg'),
      ).rejects.toThrow(BadRequestException);

      expect(spy).not.toHaveBeenCalled();
    });

    it('should validate the object key before contacting MinIO', async () => {
      const client = service.getClient();
      const spy = jest.spyOn(client, 'presignedPutObject');

      await expect(
        service.createPresignedUpload('vehicles', '../secrets.env'),
      ).rejects.toThrow(BadRequestException);

      expect(spy).not.toHaveBeenCalled();
    });

    it('should request a bounded lifetime for download URLs', async () => {
      const client = service.getClient();
      jest
        .spyOn(client, 'presignedGetObject')
        .mockResolvedValue('https://minio.local/signed');

      const result = await service.createPresignedDownload(
        'verifications',
        'id-card.jpg',
      );

      expect(result.expiresIn).toBeGreaterThan(0);
      // Never a long-lived link: these URLs need no credentials to use.
      expect(result.expiresIn).toBeLessThanOrEqual(15 * 60);
      expect(client.presignedGetObject).toHaveBeenCalledWith(
        'verifications',
        'id-card.jpg',
        result.expiresIn,
      );
    });
  });
});
