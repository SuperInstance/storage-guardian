"use strict";
/**
 * @superinstance/storage-guardian — In-Memory Storage Provider
 *
 * For testing and programmatic use. Compatible with v0.1.0 API.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryProvider = void 0;
const utils_1 = require("../core/utils");
class MemoryProvider {
    constructor() {
        this.name = 'memory';
        this.entries = new Map();
    }
    /**
     * Add content directly to the in-memory store.
     */
    add(content, opts) {
        const data = typeof content === 'string' ? Buffer.from(content) : content;
        const contentHash = (0, utils_1.hashContent)(data);
        const entryId = opts.id ?? (0, utils_1.generateId)();
        const entry = {
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
    remove(entryId) {
        return this.entries.delete(entryId);
    }
    getEntry(id) {
        return this.entries.get(id)?.entry;
    }
    getAllEntries() {
        return Array.from(this.entries.values()).map((e) => e.entry);
    }
    async *scan() {
        for (const { entry } of this.entries.values()) {
            yield entry;
        }
    }
    async read(entry) {
        const stored = this.entries.get(entry.id);
        if (!stored)
            throw new Error(`Entry not found: ${entry.id}`);
        return stored.data;
    }
    async exists(path) {
        return Array.from(this.entries.values()).some((e) => e.entry.name === path);
    }
    async stat(path) {
        const found = Array.from(this.entries.values()).find((e) => e.entry.name === path);
        if (!found)
            return null;
        return {
            sizeBytes: found.entry.sizeBytes,
            modifiedAt: found.entry.accessedAt,
            createdAt: found.entry.createdAt,
            isFile: true,
            isDirectory: false,
            isSymlink: false,
        };
    }
    clear() {
        this.entries.clear();
    }
    get size() {
        return this.entries.size;
    }
}
exports.MemoryProvider = MemoryProvider;
//# sourceMappingURL=memory.js.map