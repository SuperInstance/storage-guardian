/**
 * @superinstance/storage-guardian — File System Storage Provider
 *
 * Real fs.walk() with streaming, symlink handling, permission awareness, hidden file detection.
 */

import { readdir, stat, lstat, readFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { join, relative } from 'path';
import { createHash } from 'node:crypto';
import {
  StorageProvider,
  EntryMeta,
  FileSystemProviderOptions,
  StorageEntry,
} from '../core/types';
import { generateId, isExcluded, detectMimeType } from '../core/utils';

const DEFAULT_EXCLUDE_PATTERNS = [
  'node_modules',
  '.git',
  '.DS_Store',
  'Thumbs.db',
  '.env',
];

export class FileSystemProvider implements StorageProvider {
  readonly name = 'filesystem';
  private rootPath: string;
  private followSymlinks: boolean;
  private includeHidden: boolean;
  private maxDepth: number;
  private excludePatterns: string[];
  private concurrency: number;

  constructor(opts: FileSystemProviderOptions) {
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
  async *scan(): AsyncIterable<StorageEntry> {
    yield* this.walk(this.rootPath, 0);
  }

  /**
   * Read file content as a Buffer.
   */
  async read(entry: StorageEntry): Promise<Buffer> {
    if (!entry.path) throw new Error(`Entry "${entry.name}" has no path`);
    return readFile(entry.path);
  }

  /**
   * Check if a file exists.
   */
  async exists(path: string): Promise<boolean> {
    try {
      const s = await stat(path);
      return s.isFile();
    } catch {
      return false;
    }
  }

  /**
   * Get metadata for a file path.
   */
  async stat(path: string): Promise<EntryMeta | null> {
    try {
      const lstatResult = await lstat(path);
      const s = this.followSymlinks && lstatResult.isSymbolicLink()
        ? await stat(path)
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
    } catch {
      return null;
    }
  }

  /**
   * Internal recursive walk with depth limiting and exclusion.
   */
  private async *walk(dir: string, depth: number): AsyncIterable<StorageEntry> {
    if (depth > this.maxDepth) return;

    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch (err: any) {
      // Permission denied or other FS errors — skip silently
      if (err?.code === 'EACCES' || err?.code === 'EPERM') return;
      throw err;
    }

    // Process in batches for controlled concurrency
    const files: { dirent: import('fs').Dirent; fullPath: string }[] = [];
    const dirs: { dirent: import('fs').Dirent; fullPath: string }[] = [];

    for (const dirent of entries) {
      const fullPath = join(dir, dirent.name);

      // Skip hidden files
      if (!this.includeHidden && dirent.name.startsWith('.')) continue;

      // Skip excluded patterns
      if (isExcluded(fullPath, this.excludePatterns)) continue;

      if (dirent.isDirectory()) {
        dirs.push({ dirent, fullPath });
      } else if (dirent.isFile() || (dirent.isSymbolicLink() && this.followSymlinks)) {
        files.push({ dirent, fullPath });
      }
    }

    // Hash files with controlled concurrency
    const semaphore = new Semaphore(this.concurrency);
    const filePromises = files.map(async ({ dirent, fullPath }) => {
      await semaphore.acquire();
      try {
        return await this.processFile(fullPath, dirent);
      } catch {
        return null;
      } finally {
        semaphore.release();
      }
    });

    // Yield files as they complete
    for (const promise of filePromises) {
      const entry = await promise;
      if (entry) yield entry;
    }

    // Recurse into directories
    for (const { fullPath } of dirs) {
      yield* this.walk(fullPath, depth + 1);
    }
  }

  /**
   * Process a single file: stat, hash, build entry.
   */
  private async processFile(
    fullPath: string,
    dirent: import('fs').Dirent,
  ): Promise<StorageEntry> {
    const meta = await this.stat(fullPath);
    if (!meta || !meta.isFile) throw new Error(`Not a file: ${fullPath}`);

    const contentHash = await this.hashFile(fullPath);
    const relPath = relative(this.rootPath, fullPath);
    const fileName = dirent.name;

    return {
      id: generateId(),
      contentHash,
      sizeBytes: meta.sizeBytes,
      mimeType: detectMimeType(fileName),
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
  private hashFile(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = createHash('sha256');
      const stream = createReadStream(filePath);
      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }
}

/**
 * Simple semaphore for concurrency control.
 */
class Semaphore {
  private queue: (() => void)[] = [];
  private running = 0;

  constructor(private max: number) {}

  async acquire(): Promise<void> {
    if (this.running < this.max) {
      this.running++;
      return;
    }
    return new Promise<void>((resolve) => {
      this.queue.push(() => {
        this.running++;
        resolve();
      });
    });
  }

  release(): void {
    this.running--;
    const next = this.queue.shift();
    if (next) next();
  }
}
