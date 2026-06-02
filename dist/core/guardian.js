"use strict";
/**
 * @superinstance/storage-guardian — Core StorageGuardian (v0.2.0)
 *
 * Content-addressable storage with duplicate detection, deduplication,
 * budget enforcement, alerting, and pluggable storage adapters.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageGuardian = void 0;
const utils_1 = require("./utils");
// ---------------------------------------------------------------------------
// StorageGuardian class
// ---------------------------------------------------------------------------
class StorageGuardian {
    constructor(provider) {
        this.entries = new Map();
        this.hashIndex = new Map();
        this.budgets = [];
        this.alerts = [];
        this.alertRules = [];
        this.provider = null;
        this.source = 'memory';
        if (provider) {
            this.provider = provider;
            this.source = provider.name;
        }
    }
    // ----- Provider-based scanning --------------------------------------------
    /**
     * Scan a storage provider and ingest all entries.
     * Returns the number of entries discovered.
     */
    async scan() {
        if (!this.provider) {
            throw new Error('No storage provider configured. Pass a provider to the constructor.');
        }
        let count = 0;
        for await (const entry of this.provider.scan()) {
            // Check if we already have this content hash
            const existingIds = this.hashIndex.get(entry.contentHash);
            if (existingIds && existingIds.length > 0) {
                const existing = this.entries.get(existingIds[0]);
                if (existing) {
                    this.alerts.push({
                        type: 'duplicate',
                        severity: 'info',
                        message: `Duplicate content: "${entry.name}" matches "${existing.name}" (${(0, utils_1.formatBytes)(entry.sizeBytes)})`,
                        entryId: entry.id,
                        entryName: entry.name,
                        details: { contentHash: entry.contentHash, existingId: existing.id },
                        timestamp: Date.now(),
                    });
                }
            }
            this.entries.set(entry.id, entry);
            if (!this.hashIndex.has(entry.contentHash)) {
                this.hashIndex.set(entry.contentHash, []);
            }
            this.hashIndex.get(entry.contentHash).push(entry.id);
            count++;
            // Check oversized alerts
            for (const budget of this.budgets) {
                if (budget.maxSingleEntryBytes && entry.sizeBytes > budget.maxSingleEntryBytes) {
                    this.alerts.push({
                        type: 'oversized',
                        severity: 'warning',
                        message: `Entry "${entry.name}" (${(0, utils_1.formatBytes)(entry.sizeBytes)}) exceeds single-entry limit of ${(0, utils_1.formatBytes)(budget.maxSingleEntryBytes)}`,
                        entryId: entry.id,
                        entryName: entry.name,
                        timestamp: Date.now(),
                    });
                }
            }
        }
        return count;
    }
    // ----- Adding / Removing (in-memory / v0.1.0 compat) ----------------------
    /**
     * Add content to storage. If content with the same hash already exists,
     * creates a logical reference and generates a duplicate alert.
     */
    add(content, opts) {
        const data = typeof content === 'string' ? Buffer.from(content) : content;
        const contentHash = (0, utils_1.hashContent)(data);
        const entryId = opts.id ?? (0, utils_1.generateId)();
        const existingIds = this.hashIndex.get(contentHash);
        if (existingIds && existingIds.length > 0) {
            const existing = this.entries.get(existingIds[0]);
            if (existing) {
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
                this.entries.set(entryId, entry);
                this.hashIndex.get(contentHash).push(entryId);
                this.alerts.push({
                    type: 'duplicate',
                    severity: 'info',
                    message: `Duplicate content detected: "${opts.name}" matches "${existing.name}" (${(0, utils_1.formatBytes)(data.length)})`,
                    entryId,
                    entryName: opts.name,
                    details: { contentHash, existingId: existing.id, sizeBytes: data.length },
                    timestamp: Date.now(),
                });
                return entry;
            }
        }
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
        this.entries.set(entryId, entry);
        if (!this.hashIndex.has(contentHash)) {
            this.hashIndex.set(contentHash, []);
        }
        this.hashIndex.get(contentHash).push(entryId);
        for (const budget of this.budgets) {
            if (budget.maxSingleEntryBytes && entry.sizeBytes > budget.maxSingleEntryBytes) {
                this.alerts.push({
                    type: 'oversized',
                    severity: 'warning',
                    message: `Entry "${entry.name}" (${(0, utils_1.formatBytes)(entry.sizeBytes)}) exceeds single-entry limit of ${(0, utils_1.formatBytes)(budget.maxSingleEntryBytes)}`,
                    entryId,
                    entryName: entry.name,
                    timestamp: Date.now(),
                });
            }
        }
        return entry;
    }
    remove(entryId) {
        const entry = this.entries.get(entryId);
        if (!entry)
            return false;
        this.entries.delete(entryId);
        const hashEntries = this.hashIndex.get(entry.contentHash);
        if (hashEntries) {
            const idx = hashEntries.indexOf(entryId);
            if (idx >= 0)
                hashEntries.splice(idx, 1);
            if (hashEntries.length === 0) {
                this.hashIndex.delete(entry.contentHash);
            }
        }
        return true;
    }
    touch(entryId) {
        const entry = this.entries.get(entryId);
        if (!entry)
            return false;
        entry.accessedAt = Date.now();
        return true;
    }
    // ----- Budget management --------------------------------------------------
    setBudget(budget) {
        this.budgets = [budget];
    }
    addBudget(budget) {
        this.budgets.push(budget);
    }
    // ----- Alert rules --------------------------------------------------------
    addAlertRule(rule) {
        this.alertRules.push(rule);
    }
    // ----- Duplicate detection ------------------------------------------------
    findDuplicates() {
        const groups = [];
        for (const [hash, entryIds] of this.hashIndex) {
            if (entryIds.length <= 1)
                continue;
            const entries = entryIds
                .map((id) => this.entries.get(id))
                .filter(Boolean);
            if (entries.length <= 1)
                continue;
            const canonical = this.entries.get(entryIds[0]);
            groups.push({
                contentHash: hash,
                wastedBytes: canonical.sizeBytes * (entries.length - 1),
                entries,
                canonical,
            });
        }
        return groups.sort((a, b) => b.wastedBytes - a.wastedBytes);
    }
    deduplicate() {
        const groups = this.findDuplicates();
        let removed = 0;
        for (const group of groups) {
            const toRemove = group.entries.filter((e) => e.id !== group.canonical.id);
            for (const entry of toRemove) {
                this.remove(entry.id);
                group.canonical.refCount++;
                removed++;
            }
        }
        return removed;
    }
    // ----- Reporting ----------------------------------------------------------
    generateReport() {
        const start = Date.now();
        const allEntries = Array.from(this.entries.values());
        const duplicates = this.findDuplicates();
        const totalBytes = allEntries.reduce((s, e) => s + e.sizeBytes, 0);
        const uniqueHashes = new Set(allEntries.map((e) => e.contentHash));
        const uniqueBytes = Array.from(uniqueHashes)
            .map((h) => this.hashIndex.get(h)?.[0])
            .filter(Boolean)
            .map((id) => this.entries.get(id).sizeBytes)
            .reduce((s, b) => s + b, 0);
        const wastedBytes = totalBytes - uniqueBytes;
        const violations = [];
        for (const budget of this.budgets) {
            if (totalBytes > budget.maxTotalBytes) {
                violations.push(`Total storage ${(0, utils_1.formatBytes)(totalBytes)} exceeds limit of ${(0, utils_1.formatBytes)(budget.maxTotalBytes)}`);
            }
            if (budget.maxEntries && allEntries.length > budget.maxEntries) {
                violations.push(`Total entries (${allEntries.length}) exceeds limit of ${budget.maxEntries}`);
            }
            if (budget.maxDuplicateCount) {
                const dupeCount = duplicates.reduce((s, g) => s + g.entries.length - 1, 0);
                if (dupeCount > budget.maxDuplicateCount) {
                    violations.push(`Duplicate count (${dupeCount}) exceeds limit of ${budget.maxDuplicateCount}`);
                }
            }
            if (budget.maxDuplicateRatio) {
                const ratio = totalBytes > 0 ? wastedBytes / totalBytes : 0;
                if (ratio > budget.maxDuplicateRatio) {
                    violations.push(`Duplicate ratio (${(ratio * 100).toFixed(1)}%) exceeds limit of ${(budget.maxDuplicateRatio * 100).toFixed(1)}%`);
                }
            }
        }
        const topConsumers = [...allEntries]
            .sort((a, b) => b.sizeBytes - a.sizeBytes)
            .slice(0, 10);
        return {
            generatedAt: Date.now(),
            source: this.source,
            totalEntries: allEntries.length,
            totalBytes,
            uniqueBytes,
            wastedBytes,
            duplicateRatio: totalBytes > 0 ? wastedBytes / totalBytes : 0,
            duplicateGroups: duplicates,
            budgetViolations: violations,
            topConsumers,
            scanDurationMs: Date.now() - start,
        };
    }
    // ----- Evaluate custom alert rules ----------------------------------------
    evaluateAlertRules(previousReport) {
        const report = this.generateReport();
        const newAlerts = [];
        for (const rule of this.alertRules) {
            const ctx = { report, previousReport };
            try {
                if (rule.condition(ctx)) {
                    newAlerts.push({
                        type: rule.type === '*' ? 'budget' : rule.type,
                        severity: rule.severity,
                        message: rule.messageTemplate
                            .replace('{duplicateRatio}', `${(report.duplicateRatio * 100).toFixed(1)}%`)
                            .replace('{totalBytes}', (0, utils_1.formatBytes)(report.totalBytes))
                            .replace('{wastedBytes}', (0, utils_1.formatBytes)(report.wastedBytes))
                            .replace('{totalEntries}', String(report.totalEntries)),
                        timestamp: Date.now(),
                    });
                }
            }
            catch {
                // Skip broken rules
            }
        }
        this.alerts.push(...newAlerts);
        return newAlerts;
    }
    // ----- Querying -----------------------------------------------------------
    getAlerts() {
        return [...this.alerts];
    }
    clearAlerts() {
        this.alerts = [];
    }
    getEntry(id) {
        return this.entries.get(id);
    }
    getAllEntries() {
        return Array.from(this.entries.values());
    }
    findByHash(contentHash) {
        const ids = this.hashIndex.get(contentHash) ?? [];
        return ids.map((id) => this.entries.get(id)).filter(Boolean);
    }
    findByTag(tag) {
        return this.getAllEntries().filter((e) => e.tags?.includes(tag));
    }
    getTotalBytes() {
        return this.getAllEntries().reduce((s, e) => s + e.sizeBytes, 0);
    }
    getUniqueBytes() {
        const seen = new Set();
        let total = 0;
        for (const entry of this.entries.values()) {
            if (!seen.has(entry.contentHash)) {
                seen.add(entry.contentHash);
                total += entry.sizeBytes;
            }
        }
        return total;
    }
    getProvider() {
        return this.provider;
    }
    setProvider(provider) {
        this.provider = provider;
        this.source = provider.name;
    }
}
exports.StorageGuardian = StorageGuardian;
//# sourceMappingURL=guardian.js.map