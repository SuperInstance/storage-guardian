/**
 * @superinstance/storage-guardian — In-Memory Storage Provider
 *
 * For testing and programmatic use. Compatible with v0.1.0 API.
 */

import {
  StorageProvider,
  EntryMeta,
  StorageEntry,
} from '../core/types';
import { hashContent, generateId } from '../core/utils';

export class MemoryProvider implements StorageProvider {
  readonly name = 'memory';
  private entries: Map<string, { entry: StorageEntry; data: Buffer }> = new Map();

  /**
   * Add content directly to the in-memory store.
   */
  add(
    content: Buffer | string,
    opts: {
      name: string;
      mimeType?: string;
      tags?: string[];
      id?: string;
    },
  ): StorageEntry {
    const data = typeof content === 'string' ? Buffer.from(content) : content;
    const contentHash = hashContent(data);
    const entryId = opts.id ?? generateId();

    const entry: StorageEntry = {
      id: entryId,
      contentHash,
      sizeBytes: data.length,
      mimeType: opts.mimeType,
      name: opts.name,
      tags: opts.tags,
      createdAt: Date.now(),
      accessedAt: Date.now(),
      refCount: 1,
    };

    this.entries.set(entryId, { entry, data });
    return entry;
  }

  remove(entryId: string): boolean {
    return this.entries.delete(entryId);
  }

  getEntry(id: string): StorageEntry | undefined {
    return this.entries.get(id)?.entry;
  }

  getAllEntries(): StorageEntry[] {
    return Array.from(this.entries.values()).map((e) => e.entry);
  }

  async *scan(): AsyncIterable<StorageEntry> {
    for (const { entry } of this.entries.values()) {
      yield entry;
    }
  }

  async read(entry: StorageEntry): Promise<Buffer> {
    const stored = this.entries.get(entry.id);
    if (!stored) throw new Error(`Entry not found: ${entry.id}`);
    return stored.data;
  }

  async exists(path: string): Promise<boolean> {
    return Array.from(this.entries.values()).some((e) => e.entry.name === path);
  }

  async stat(path: string): Promise<EntryMeta | null> {
    const found = Array.from(this.entries.values()).find(
      (e) => e.entry.name === path,
    );
    if (!found) return null;
    return {
      sizeBytes: found.entry.sizeBytes,
      modifiedAt: found.entry.accessedAt,
      createdAt: found.entry.createdAt,
      isFile: true,
      isDirectory: false,
      isSymlink: false,
    };
  }

  clear(): void {
    this.entries.clear();
  }

  get size(): number {
    return this.entries.size;
  }
}
