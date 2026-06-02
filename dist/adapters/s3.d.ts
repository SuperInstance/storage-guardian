/**
 * @superinstance/storage-guardian — S3/Cloud Storage Provider
 *
 * Abstract S3-compatible storage provider. Works with AWS S3, MinIO, R2, etc.
 * Requires @aws-sdk/client-s3 as a peer dependency (optional).
 */
import { StorageProvider, EntryMeta, S3ProviderOptions, StorageEntry } from '../core/types';
export declare class S3Provider implements StorageProvider {
    private opts;
    readonly name = "s3";
    private bucket;
    private prefix;
    private client;
    constructor(opts: S3ProviderOptions);
    private getClient;
    scan(): AsyncIterable<StorageEntry>;
    read(entry: StorageEntry): Promise<Buffer>;
    exists(path: string): Promise<boolean>;
    stat(path: string): Promise<EntryMeta | null>;
}
//# sourceMappingURL=s3.d.ts.map