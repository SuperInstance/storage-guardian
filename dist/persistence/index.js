"use strict";
/**
 * @superinstance/storage-guardian — Persistence Layer
 *
 * Save/load scan history to track duplicate rates over time.
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
exports.MemoryPersistence = exports.JsonFilePersistence = void 0;
exports.saveScan = saveScan;
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const node_fs_1 = require("node:fs");
const utils_1 = require("../core/utils");
// ---------------------------------------------------------------------------
// JSON File Persistence Backend
// ---------------------------------------------------------------------------
class JsonFilePersistence {
    constructor(directory = '.storage-guardian-history') {
        this.dir = directory;
    }
    async save(record) {
        await this.ensureDir();
        const filePath = this.getFilePath(record.id);
        await (0, promises_1.writeFile)(filePath, JSON.stringify(record, null, 2), 'utf-8');
    }
    async load(id) {
        const filePath = this.getFilePath(id);
        try {
            const content = await (0, promises_1.readFile)(filePath, 'utf-8');
            return JSON.parse(content);
        }
        catch {
            return null;
        }
    }
    async list(opts) {
        await this.ensureDir();
        const { readdir } = await Promise.resolve().then(() => __importStar(require('fs/promises')));
        let files;
        try {
            files = await readdir(this.dir);
        }
        catch {
            return [];
        }
        const records = [];
        for (const file of files.sort()) {
            if (!file.startsWith('scan-') || !file.endsWith('.json'))
                continue;
            try {
                const content = await (0, promises_1.readFile)((0, node_path_1.join)(this.dir, file), 'utf-8');
                const record = JSON.parse(content);
                if (opts?.since && record.timestamp < opts.since)
                    continue;
                records.push(record);
            }
            catch {
                continue;
            }
        }
        // Sort newest first
        records.sort((a, b) => b.timestamp - a.timestamp);
        if (opts?.limit)
            return records.slice(0, opts.limit);
        return records;
    }
    async remove(id) {
        const filePath = this.getFilePath(id);
        try {
            await (0, promises_1.unlink)(filePath);
            return true;
        }
        catch {
            return false;
        }
    }
    // ----- Helpers -----
    getFilePath(id) {
        return (0, node_path_1.join)(this.dir, `scan-${id}.json`);
    }
    async ensureDir() {
        if (!(0, node_fs_1.existsSync)(this.dir)) {
            await (0, promises_1.mkdir)(this.dir, { recursive: true });
        }
    }
}
exports.JsonFilePersistence = JsonFilePersistence;
// ---------------------------------------------------------------------------
// In-Memory Persistence Backend (for testing)
// ---------------------------------------------------------------------------
class MemoryPersistence {
    constructor() {
        this.records = new Map();
    }
    async save(record) {
        this.records.set(record.id, record);
    }
    async load(id) {
        return this.records.get(id) ?? null;
    }
    async list(opts) {
        let records = Array.from(this.records.values());
        if (opts?.since) {
            records = records.filter((r) => r.timestamp >= opts.since);
        }
        records.sort((a, b) => b.timestamp - a.timestamp);
        if (opts?.limit)
            records = records.slice(0, opts.limit);
        return records;
    }
    async remove(id) {
        return this.records.delete(id);
    }
}
exports.MemoryPersistence = MemoryPersistence;
// ---------------------------------------------------------------------------
// Convenience: Save a scan
// ---------------------------------------------------------------------------
async function saveScan(report, alerts, backend, source) {
    const record = {
        id: (0, utils_1.generateId)(),
        timestamp: report.generatedAt,
        source: source ?? report.source,
        report,
        alerts,
    };
    await backend.save(record);
    return record;
}
//# sourceMappingURL=index.js.map