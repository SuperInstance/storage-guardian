/**
 * @superinstance/storage-guardian — S3/Cloud Storage Provider
 *
 * Abstract S3-compatible storage provider. Works with AWS S3, MinIO, R2, etc.
 * Requires @aws-sdk/client-s3 as a peer dependency (optional).
 */

/* eslint-disable @typescript-eslint/ban-ts-comment */

import {
  StorageProvider,
  EntryMeta,
  S3ProviderOptions,
  StorageEntry,
} from '../core/types';
import { hashContent, generateId, detectMimeType } from '../core/utils';

export class S3Provider implements StorageProvider {
  readonly name = 's3';
  private bucket: string;
  private prefix: string;
  private client: any = null;

  constructor(private opts: S3ProviderOptions) {
    this.bucket = opts.bucket;
    this.prefix = opts.prefix ?? '';
  }

  private async getClient(): Promise<any> {
    if (this.client) return this.client;

    try {
      // @ts-ignore — optional peer dependency
      const { S3Client } = await import('@aws-sdk/client-s3');

      const config: any = {};
      if (this.opts.region) config.region = this.opts.region;
      if (this.opts.endpoint) config.endpoint = this.opts.endpoint;
      if (this.opts.credentials) {
        config.credentials = {
          accessKeyId: this.opts.credentials.accessKeyId,
          secretAccessKey: this.opts.credentials.secretAccessKey,
        };
      }

      this.client = new S3Client(config);
      return this.client;
    } catch (err: any) {
      throw new Error(
        'S3 provider requires @aws-sdk/client-s3. Install it with: npm install @aws-sdk/client-s3',
      );
    }
  }

  async *scan(): AsyncIterable<StorageEntry> {
    const client = await this.getClient();

    let continuationToken: string | undefined;
    do {
      // @ts-ignore — optional peer dependency
      const { ListObjectsV2Command } = await import('@aws-sdk/client-s3');
      const response = await client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: this.prefix,
          ContinuationToken: continuationToken,
        }),
      );

      for (const obj of response.Contents ?? []) {
        if (!obj.Key) continue;
        const key = obj.Key;
        const fileName = key.split('/').pop() ?? key;

        yield {
          id: generateId(),
          contentHash: obj.ETag?.replace(/"/g, '') ?? hashContent(key),
          sizeBytes: obj.Size ?? 0,
          mimeType: detectMimeType(fileName),
          name: fileName,
          path: `s3://${this.bucket}/${key}`,
          tags: [this.prefix || 'root'],
          createdAt: obj.LastModified?.getTime() ?? Date.now(),
          accessedAt: obj.LastModified?.getTime() ?? Date.now(),
          refCount: 1,
        };
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);
  }

  async read(entry: StorageEntry): Promise<Buffer> {
    const client = await this.getClient();
    // @ts-ignore — optional peer dependency
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');

    const key = entry.path?.replace(`s3://${this.bucket}/`, '') ?? entry.name;
    const response = await client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );

    if (!response.Body) throw new Error(`Empty response for ${key}`);

    const chunks: Buffer[] = [];
    for await (const chunk of response.Body as AsyncIterable<Buffer>) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  async exists(path: string): Promise<boolean> {
    const meta = await this.stat(path);
    return meta !== null;
  }

  async stat(path: string): Promise<EntryMeta | null> {
    try {
      const client = await this.getClient();
      // @ts-ignore — optional peer dependency
      const { HeadObjectCommand } = await import('@aws-sdk/client-s3');

      const key = path.replace(`s3://${this.bucket}/`, '');
      const response = await client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );

      return {
        sizeBytes: response.ContentLength ?? 0,
        modifiedAt: response.LastModified?.getTime() ?? Date.now(),
        createdAt: response.LastModified?.getTime(),
        isFile: true,
        isDirectory: false,
        isSymlink: false,
      };
    } catch {
      return null;
    }
  }
}
