import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { AppException } from '../../common/errors/app.exception';
import { ErrorCode } from '../../common/errors/error-codes';

/**
 * Thin wrapper around Cloudflare R2 (S3-compatible) object storage.
 *
 * The client is created lazily and the service reports `isConfigured` so the
 * whole application still boots without storage credentials — the image
 * endpoints and the seed uploader then answer with a clear 503 instead of the
 * process failing at startup. This mirrors StripeService and LlmService so
 * local development and CI never need R2 credentials just to boot.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly accessKeyId?: string;
  private readonly secretAccessKey?: string;
  private readonly accountId?: string;
  private readonly bucket?: string;
  private readonly publicBaseUrl?: string;
  private client?: S3Client;

  constructor(config: ConfigService) {
    this.accessKeyId = config.get<string>('R2_ACCESS_KEY_ID') || undefined;
    this.secretAccessKey = config.get<string>('R2_SECRET_ACCESS_KEY') || undefined;
    this.accountId = config.get<string>('R2_ACCOUNT_ID') || undefined;
    this.bucket = config.get<string>('R2_BUCKET') || undefined;
    this.publicBaseUrl = config.get<string>('R2_PUBLIC_BASE_URL') || undefined;

    if (!this.isConfigured) {
      this.logger.warn(
        'R2 storage is not configured — image endpoints and the seed uploader will return 503 until it is configured.',
      );
    }
  }

  /** All four core credentials must be present before any R2 call is attempted. */
  get isConfigured(): boolean {
    return Boolean(this.accessKeyId && this.secretAccessKey && this.accountId && this.bucket);
  }

  /** Throws a 503 rather than a 500 when storage is not set up. */
  private requireClient(): S3Client {
    if (!this.isConfigured) {
      throw new AppException(
        ErrorCode.STORAGE_UNAVAILABLE,
        'Image storage is not configured on this environment yet.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    // Created on first use so a missing R2 config never blocks boot.
    this.client ??= new S3Client({
      region: 'auto',
      endpoint: `https://${this.accountId}.r2.cloudflarestorage.com`,
      // path-style addressing is off because R2 uses virtual-hosted-style URLs.
      forcePathStyle: false,
      credentials: {
        accessKeyId: this.accessKeyId!,
        secretAccessKey: this.secretAccessKey!,
      },
    });

    return this.client;
  }

  /** Narrowing helper; requireClient already guards this. */
  private requireBucket(): string {
    if (!this.bucket) {
      throw new AppException(
        ErrorCode.STORAGE_UNAVAILABLE,
        'Image storage is not configured on this environment yet.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return this.bucket;
  }

  /**
   * Returns a presigned PUT URL the browser can upload to directly. The signed
   * headers pin Content-Type (and Content-Length when known) so a tampered
   * request body is rejected by R2 — the URL is not a blank cheque.
   */
  async presignPut(input: {
    key: string;
    contentType: string;
    contentLength?: number;
  }): Promise<{ url: string; method: 'PUT'; headers: Record<string, string> }> {
    const client = this.requireClient();
    const bucket = this.requireBucket();

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: input.key,
      ContentType: input.contentType,
      ...(input.contentLength !== undefined ? { ContentLength: input.contentLength } : {}),
    });

    // ~5 minutes: long enough for a user to confirm an upload, short enough
    // that a leaked URL is not reusable for long.
    const url = await getSignedUrl(client, command, { expiresIn: 5 * 60 });

    const headers: Record<string, string> = { 'Content-Type': input.contentType };
    if (input.contentLength !== undefined) {
      headers['Content-Length'] = String(input.contentLength);
    }

    return { url, method: 'PUT', headers };
  }

  /**
   * Public URL for an object. Prefers the custom public base URL (R2 custom
   * domain / Cloudflare CDN) so the request never touches the API; falls back
   * to a 1-hour presigned GET when no public domain is wired up. The fallback
   * is async because AWS SDK v3 signs asynchronously.
   */
  async publicUrl(key: string): Promise<string> {
    if (this.publicBaseUrl) {
      // Trim a trailing slash so the join is stable regardless of env shape.
      const base = this.publicBaseUrl.replace(/\/+$/, '');
      return `${base}/${key}`;
    }

    const client = this.requireClient();
    const bucket = this.requireBucket();
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    return getSignedUrl(client, command, { expiresIn: 60 * 60 });
  }

  /** True if the object already exists; used by the seed for idempotent uploads. */
  async exists(key: string): Promise<boolean> {
    const client = this.requireClient();
    const bucket = this.requireBucket();
    try {
      await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
      return true;
    } catch (error) {
      // NotFound is the only "expected" miss; anything else should bubble up.
      const name = (error as { name?: string })?.name;
      const statusCode = (error as { $metadata?: { httpStatusCode?: number } })?.$metadata
        ?.httpStatusCode;
      if (name === 'NotFound' || statusCode === 404) {
        return false;
      }
      throw error;
    }
  }

  /** Direct upload from in-memory bytes; used by the seed which has the file on disk. */
  async uploadFromBytes(input: {
    key: string;
    body: Buffer;
    contentType: string;
  }): Promise<void> {
    const client = this.requireClient();
    const bucket = this.requireBucket();
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
      }),
    );
  }

  /** Bulk delete; kept for future cleanup tooling. Not used by the seed. */
  async deleteMany(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    const client = this.requireClient();
    const bucket = this.requireBucket();
    await client.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: keys.map((key) => ({ Key: key })) },
      }),
    );
  }

  /**
   * Stable object key matching the existing `/seed/<city>/<place>/<n><ext>` URL
   * shape, so R2 public URLs are a drop-in replacement for the local files.
   */
  keyFor(input: { citySlug: string; placeSlug: string; index: number; ext: string }): string {
    const ext = input.ext.startsWith('.') ? input.ext : `.${input.ext}`;
    return `seed/${input.citySlug}/${input.placeSlug}/${input.index + 1}${ext}`;
  }
}