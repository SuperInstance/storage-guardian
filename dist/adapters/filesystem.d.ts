/**
 * @superinstance/storage-guardian — File System Storage Provider
 *
 * Real fs.walk() with streaming, symlink handling, permission awareness, hidden file detection.
 */
import { StorageProvider, EntryMeta, FileSystemProviderOptions, StorageEntry } from '../core/types';
export declare class FileSystemProvider implements StorageProvider {
    readonly name = "filesystem";
    private rootPath;
    private followSymlinks;
    private includeHidden;
    private maxDepth;
    private excludePatterns;
    private concurrency;
    constructor(opts: FileSystemProviderOptions);
    /**
     * Stream all file entries by walking the directory tree.
     */
    scan(): AsyncIterable<StorageEntry>;
    /**
     * Read file content as a Buffer.
     */
    read(entry: StorageEntry): Promise<Buffer>;
    /**
     * Check if a file exists.
     */
    exists(path: string): Promise<boolean>;
    /**
     * Get metadata for a file path.
     */
    stat(path: string): Promise<EntryMeta | null>;
    /**
     * Internal recursive walk with depth limiting and exclusion.
     */
    private walk;
    /**
     * Process a single file: stat, hash, build entry.
     */
    private processFile;
    /**
     * Hash a file using streaming to avoid loading entire file into memory.
     */
    private hashFile;
}
//# sourceMappingURL=filesystem.d.ts.map