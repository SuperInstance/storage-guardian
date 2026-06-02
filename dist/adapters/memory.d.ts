/**
 * @superinstance/storage-guardian — In-Memory Storage Provider
 *
 * For testing and programmatic use. Compatible with v0.1.0 API.
 */
import { StorageProvider, EntryMeta, StorageEntry } from '../core/types';
export declare class MemoryProvider implements StorageProvider {
    readonly name = "memory";
    private entries;
    /**
     * Add content directly to the in-memory store.
     */
    add(content: Buffer | string, opts: {
        name: string;
        mimeType?: string;
        tags?: string[];
        id?: string;
    }): StorageEntry;
    remove(entryId: string): boolean;
    getEntry(id: string): StorageEntry | undefined;
    getAllEntries(): StorageEntry[];
    scan(): AsyncIterable<StorageEntry>;
    read(entry: StorageEntry): Promise<Buffer>;
    exists(path: string): Promise<boolean>;
    stat(path: string): Promise<EntryMeta | null>;
    clear(): void;
    get size(): number;
}
//# sourceMappingURL=memory.d.ts.map