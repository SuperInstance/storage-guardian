"use strict";
/**
 * @superinstance/storage-guardian — File System Storage Provider
 *
 * Real fs.walk() with streaming, symlink handling, permission awareness, hidden file detection.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileSystemProvider = void 0;
const promises_1 = require("node:fs/promises");
const node_fs_1 = require("node:fs");
const path_1 = require("path");
const node_crypto_1 = require("node:crypto");
const utils_1 = require("../core/utils");
const DEFAULT_EXCLUDE_PATTERNS = [
    'node_modules',
    '.git',
    '.DS_Store',
    'Thumbs.db',
    '.env',
];
class FileSystemProvider {
    constructor(opts) {
        this.name = 'filesystem';
        this.rootPath = opts.rootPath;
        this.followSymlinks = opts.followSymlinks ?? false;
        this.includeHidden = opts.includeHidden ?? false;
        this.maxDepth = opts.maxDepth ?? Infinity;
        this.excludePatterns = [
            ...DEFAULT_EXCLUDE_PATTERNS,
            ...(opts.excludePatterns ?? []),
        ];
        this.concurrency = opts.concurrency ?? 16;
    }
    /**
     * Stream all file entries by walking the directory tree.
     */
    async *scan() {
        yield* this.walk(this.rootPath, 0);
    }
    /**
     * Read file content as a Buffer.
     */
    async read(entry) {
        if (!entry.path)
            throw new Error(`Entry "${entry.name}" has no path`);
        return (0, promises_1.readFile)(entry.path);
    }
    /**
     * Check if a file exists.
     */
    async exists(path) {
        try {
            const s = await (0, promises_1.stat)(path);
            return s.isFile();
        }
        catch {
            return false;
        }
    }
    /**
     * Get metadata for a file path.
     */
    async stat(path) {
        try {
            const lstatResult = await (0, promises_1.lstat)(path);
            const s = this.followSymlinks && lstatResult.isSymbolicLink()
                ? await (0, promises_1.stat)(path)
                : lstatResult;
            return {
                sizeBytes: s.size,
                modifiedAt: s.mtimeMs,
                createdAt: s.birthtimeMs,
                isFile: s.isFile(),
                isDirectory: s.isDirectory(),
                isSymlink: lstatResult.isSymbolicLink(),
                mode: s.mode,
            };
        }
        catch {
            return null;
        }
    }
    /**
     * Internal recursive walk with depth limiting and exclusion.
     */
    async *walk(dir, depth) {
        if (depth > this.maxDepth)
            return;
        let entries;
        try {
            entries = await (0, promises_1.readdir)(dir, { withFileTypes: true });
        }
        catch (err) {
            // Permission denied or other FS errors — skip silently
            if (err?.code === 'EACCES' || err?.code === 'EPERM')
                return;
            throw err;
        }
        // Process in batches for controlled concurrency
        const files = [];
        const dirs = [];
        for (const dirent of entries) {
            const fullPath = (0, path_1.join)(dir, dirent.name);
            // Skip hidden files
            if (!this.includeHidden && dirent.name.startsWith('.'))
                continue;
            // Skip excluded patterns
            if ((0, utils_1.isExcluded)(fullPath, this.excludePatterns))
                continue;
            if (dirent.isDirectory()) {
                dirs.push({ dirent, fullPath });
            }
            else if (dirent.isFile() || (dirent.isSymbolicLink() && this.followSymlinks)) {
                files.push({ dirent, fullPath });
            }
        }
        // Hash files with controlled concurrency
        const semaphore = new Semaphore(this.concurrency);
        const filePromises = files.map(async ({ dirent, fullPath }) => {
            await semaphore.acquire();
            try {
                return await this.processFile(fullPath, dirent);
            }
            catch {
                return null;
            }
            finally {
                semaphore.release();
            }
        });
        // Yield files as they complete
        for (const promise of filePromises) {
            const entry = await promise;
            if (entry)
                yield entry;
        }
        // Recurse into directories
        for (const { fullPath } of dirs) {
            yield* this.walk(fullPath, depth + 1);
        }
    }
    /**
     * Process a single file: stat, hash, build entry.
     */
    async processFile(fullPath, dirent) {
        const meta = await this.stat(fullPath);
        if (!meta || !meta.isFile)
            throw new Error(`Not a file: ${fullPath}`);
        const contentHash = await this.hashFile(fullPath);
        const relPath = (0, path_1.relative)(this.rootPath, fullPath);
        const fileName = dirent.name;
        return {
            id: (0, utils_1.generateId)(),
            contentHash,
            sizeBytes: meta.sizeBytes,
            mimeType: (0, utils_1.detectMimeType)(fileName),
            name: fileName,
            path: fullPath,
            tags: [relPath.split(/[/\\]/).slice(0, -1).join('/') || 'root'],
            createdAt: meta.createdAt ?? meta.modifiedAt,
            accessedAt: meta.modifiedAt,
            refCount: 1,
            isSymlink: meta.isSymlink,
            isHidden: fileName.startsWith('.'),
            mode: meta.mode,
        };
    }
    /**
     * Hash a file using streaming to avoid loading entire file into memory.
     */
    hashFile(filePath) {
        return new Promise((resolve, reject) => {
            const hash = (0, node_crypto_1.createHash)('sha256');
            const stream = (0, node_fs_1.createReadStream)(filePath);
            stream.on('data', (data) => hash.update(data));
            stream.on('end', () => resolve(hash.digest('hex')));
            stream.on('error', reject);
        });
    }
}
exports.FileSystemProvider = FileSystemProvider;
/**
 * Simple semaphore for concurrency control.
 */
class Semaphore {
    constructor(max) {
        this.max = max;
        this.queue = [];
        this.running = 0;
    }
    async acquire() {
        if (this.running < this.max) {
            this.running++;
            return;
        }
        return new Promise((resolve) => {
            this.queue.push(() => {
                this.running++;
                resolve();
            });
        });
    }
    release() {
        this.running--;
        const next = this.queue.shift();
        if (next)
            next();
    }
}
//# sourceMappingURL=filesystem.js.map