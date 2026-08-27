import {
  Injectable,
  OnModuleInit,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';

/**
 * Buckets the admin panel is allowed to address.
 *
 * An allowlist rather than free-form input: the bucket name arrives from an HTTP
 * request, and MinIO would happily hand out a presigned URL for any bucket the
 * service credentials can reach, including ones holding unrelated data.
 */
export const STORAGE_BUCKETS = [
  'tours',
  'vehicles',
  'hotels',
  'rooms',
  'guides',
  'verifications',
  'exports',
] as const;

export type StorageBucket = (typeof STORAGE_BUCKETS)[number];

/** Presigned URL lifetime. Short enough to limit replay, long enough to upload. */
const PRESIGNED_UPLOAD_TTL_SECONDS = 10 * 60;
const PRESIGNED_DOWNLOAD_TTL_SECONDS = 5 * 60;

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  private client!: Minio.Client;
  private defaultBucket!: string;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const endPoint = this.configService.get<string>(
      'MINIO_ENDPOINT',
      'localhost',
    );
    const port = this.configService.get<number>('MINIO_PORT', 9000);
    const useSSL = this.configService.get<string>('MINIO_USE_SSL') === 'true';

    this.client = new Minio.Client({
      endPoint,
      port,
      useSSL,
      accessKey: this.configService.get<string>('MINIO_ACCESS_KEY', ''),
      secretKey: this.configService.get<string>('MINIO_SECRET_KEY', ''),
    });

    this.defaultBucket = this.configService.get<string>(
      'MINIO_BUCKET',
      'derlg-storage',
    );

    // Credentials are never logged, not even at debug level.
    this.logger.log(
      `MinIO client configured for ${endPoint}:${port} (ssl=${useSSL})`,
    );
  }

  getClient(): Minio.Client {
    return this.client;
  }

  getBucketName(): string {
    return this.defaultBucket;
  }

  /**
   * Validates a bucket name against the allowlist.
   *
   * @throws BadRequestException when the bucket is not allowlisted.
   */
  assertBucketAllowed(bucket: string): StorageBucket {
    if (!(STORAGE_BUCKETS as readonly string[]).includes(bucket)) {
      throw new BadRequestException(
        `Unknown bucket '${bucket}'. Allowed: ${STORAGE_BUCKETS.join(', ')}`,
      );
    }
    return bucket as StorageBucket;
  }

  /**
   * Validates an object key.
   *
   * Rejects path traversal and absolute paths. The key reaches us from a client,
   * and MinIO resolves `..` segments, so `vehicles/../verifications/id-card.jpg`
   * would otherwise read a student's ID document out of a different bucket path.
   * Percent-encoded forms are decoded first so `%2e%2e%2f` cannot slip past.
   */
  assertObjectKeySafe(objectKey: string): string {
    if (!objectKey || objectKey.trim() === '') {
      throw new BadRequestException('objectKey must not be empty');
    }

    let decoded = objectKey;
    // Decode repeatedly: a doubly-encoded `%252e%252e` becomes `..` in two passes.
    for (let i = 0; i < 3; i++) {
      try {
        const next = decodeURIComponent(decoded);
        if (next === decoded) break;
        decoded = next;
      } catch {
        throw new BadRequestException(
          'objectKey is not valid URI-encoded text',
        );
      }
    }

    const normalised = decoded.replace(/\\/g, '/');

    if (normalised.startsWith('/')) {
      throw new BadRequestException('objectKey must be relative');
    }
    if (normalised.split('/').some((seg) => seg === '..' || seg === '.')) {
      throw new BadRequestException(
        'objectKey must not contain path traversal',
      );
    }
    if (normalised.includes('\0')) {
      throw new BadRequestException('objectKey must not contain null bytes');
    }
    if (normalised.length > 512) {
      throw new BadRequestException(
        'objectKey must be 512 characters or fewer',
      );
    }

    return normalised;
  }

  async ensureBucket(bucket: string): Promise<void> {
    const exists = await this.client.bucketExists(bucket);
    if (!exists) {
      await this.client.makeBucket(bucket, 'us-east-1');
      this.logger.log(`Bucket '${bucket}' created`);
    }
  }

  /** Presigned PUT so the browser uploads straight to MinIO. */
  async createPresignedUpload(
    bucket: string,
    objectKey: string,
  ): Promise<{
    url: string;
    bucket: string;
    objectKey: string;
    expiresIn: number;
  }> {
    const safeBucket = this.assertBucketAllowed(bucket);
    const safeKey = this.assertObjectKeySafe(objectKey);

    await this.ensureBucket(safeBucket);
    const url = await this.client.presignedPutObject(
      safeBucket,
      safeKey,
      PRESIGNED_UPLOAD_TTL_SECONDS,
    );

    return {
      url,
      bucket: safeBucket,
      objectKey: safeKey,
      expiresIn: PRESIGNED_UPLOAD_TTL_SECONDS,
    };
  }

  /** Presigned GET for private objects such as student verification documents. */
  async createPresignedDownload(
    bucket: string,
    objectKey: string,
  ): Promise<{
    url: string;
    bucket: string;
    objectKey: string;
    expiresIn: number;
  }> {
    const safeBucket = this.assertBucketAllowed(bucket);
    const safeKey = this.assertObjectKeySafe(objectKey);

    const url = await this.client.presignedGetObject(
      safeBucket,
      safeKey,
      PRESIGNED_DOWNLOAD_TTL_SECONDS,
    );

    return {
      url,
      bucket: safeBucket,
      objectKey: safeKey,
      expiresIn: PRESIGNED_DOWNLOAD_TTL_SECONDS,
    };
  }

  async removeObject(bucket: string, objectKey: string): Promise<void> {
    const safeBucket = this.assertBucketAllowed(bucket);
    const safeKey = this.assertObjectKeySafe(objectKey);
    await this.client.removeObject(safeBucket, safeKey);
    this.logger.log(`Removed object`, {
      bucket: safeBucket,
      objectKey: safeKey,
    });
  }

  async healthCheck(): Promise<{
    status: string;
    buckets: string[];
    error?: string;
  }> {
    try {
      const buckets = await this.client.listBuckets();
      return { status: 'ok', buckets: buckets.map((b) => b.name) };
    } catch (error) {
      this.logger.error('MinIO health check failed', {
        error: (error as Error).message,
      });
      return { status: 'error', buckets: [], error: (error as Error).message };
    }
  }

  /** Server-side upload, used by export/backup generation. */
  async uploadFile(
    bucket: string,
    objectKey: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<{ bucket: string; objectKey: string; etag: string }> {
    const safeBucket = this.assertBucketAllowed(bucket);
    const safeKey = this.assertObjectKeySafe(objectKey);

    await this.ensureBucket(safeBucket);
    const result = await this.client.putObject(
      safeBucket,
      safeKey,
      buffer,
      buffer.length,
      { 'Content-Type': mimeType },
    );

    return { bucket: safeBucket, objectKey: safeKey, etag: result.etag };
  }
}
