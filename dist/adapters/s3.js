"use strict";
/**
 * @superinstance/storage-guardian — S3/Cloud Storage Provider
 *
 * Abstract S3-compatible storage provider. Works with AWS S3, MinIO, R2, etc.
 * Requires @aws-sdk/client-s3 as a peer dependency (optional).
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.S3Provider = void 0;
const utils_1 = require("../core/utils");
class S3Provider {
    constructor(opts) {
        this.opts = opts;
        this.name = 's3';
        this.client = null;
        this.bucket = opts.bucket;
        this.prefix = opts.prefix ?? '';
    }
    async getClient() {
        if (this.client)
            return this.client;
        try {
            // @ts-ignore — optional peer dependency
            const { S3Client } = await Promise.resolve().then(() => __importStar(require('@aws-sdk/client-s3')));
            const config = {};
            if (this.opts.region)
                config.region = this.opts.region;
            if (this.opts.endpoint)
                config.endpoint = this.opts.endpoint;
            if (this.opts.credentials) {
                config.credentials = {
                    accessKeyId: this.opts.credentials.accessKeyId,
                    secretAccessKey: this.opts.credentials.secretAccessKey,
                };
            }
            this.client = new S3Client(config);
            return this.client;
        }
        catch (err) {
            throw new Error('S3 provider requires @aws-sdk/client-s3. Install it with: npm install @aws-sdk/client-s3');
        }
    }
    async *scan() {
        const client = await this.getClient();
        let continuationToken;
        do {
            // @ts-ignore — optional peer dependency
            const { ListObjectsV2Command } = await Promise.resolve().then(() => __importStar(require('@aws-sdk/client-s3')));
            const response = await client.send(new ListObjectsV2Command({
                Bucket: this.bucket,
                Prefix: this.prefix,
                ContinuationToken: continuationToken,
            }));
            for (const obj of response.Contents ?? []) {
                if (!obj.Key)
                    continue;
                const key = obj.Key;
                const fileName = key.split('/').pop() ?? key;
                yield {
                    id: (0, utils_1.generateId)(),
                    contentHash: obj.ETag?.replace(/"/g, '') ?? (0, utils_1.hashContent)(key),
                    sizeBytes: obj.Size ?? 0,
                    mimeType: (0, utils_1.detectMimeType)(fileName),
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
    async read(entry) {
        const client = await this.getClient();
        // @ts-ignore — optional peer dependency
        const { GetObjectCommand } = await Promise.resolve().then(() => __importStar(require('@aws-sdk/client-s3')));
        const key = entry.path?.replace(`s3://${this.bucket}/`, '') ?? entry.name;
        const response = await client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
        if (!response.Body)
            throw new Error(`Empty response for ${key}`);
        const chunks = [];
        for await (const chunk of response.Body) {
            chunks.push(Buffer.from(chunk));
        }
        return Buffer.concat(chunks);
    }
    async exists(path) {
        const meta = await this.stat(path);
        return meta !== null;
    }
    async stat(path) {
        try {
            const client = await this.getClient();
            // @ts-ignore — optional peer dependency
            const { HeadObjectCommand } = await Promise.resolve().then(() => __importStar(require('@aws-sdk/client-s3')));
            const key = path.replace(`s3://${this.bucket}/`, '');
            const response = await client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
            return {
                sizeBytes: response.ContentLength ?? 0,
                modifiedAt: response.LastModified?.getTime() ?? Date.now(),
                createdAt: response.LastModified?.getTime(),
                isFile: true,
                isDirectory: false,
                isSymlink: false,
            };
        }
        catch {
            return null;
        }
    }
}
exports.S3Provider = S3Provider;
//# sourceMappingURL=s3.js.map