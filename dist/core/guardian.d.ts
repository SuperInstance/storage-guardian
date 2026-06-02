/**
 * @superinstance/storage-guardian — Core StorageGuardian (v0.2.0)
 *
 * Content-addressable storage with duplicate detection, deduplication,
 * budget enforcement, alerting, and pluggable storage adapters.
 */
import { StorageEntry, DuplicateGroup, StorageBudget, StorageReport, StorageAlert, StorageProvider, AlertRule } from './types';
export declare class StorageGuardian {
    private entries;
    private hashIndex;
    private budgets;
    private alerts;
    private alertRules;
    private provider;
    private source;
    constructor(provider?: StorageProvider);
    /**
     * Scan a storage provider and ingest all entries.
     * Returns the number of entries discovered.
     */
    scan(): Promise<number>;
    /**
     * Add content to storage. If content with the same hash already exists,
     * creates a logical reference and generates a duplicate alert.
     */
    add(content: Buffer | string, opts: {
        name: string;
        mimeType?: string;
        tags?: string[];
        id?: string;
    }): StorageEntry;
    remove(entryId: string): boolean;
    touch(entryId: string): boolean;
    setBudget(budget: StorageBudget): void;
    addBudget(budget: StorageBudget): void;
    addAlertRule(rule: AlertRule): void;
    findDuplicates(): DuplicateGroup[];
    deduplicate(): number;
    generateReport(): StorageReport;
    evaluateAlertRules(previousReport?: StorageReport): StorageAlert[];
    getAlerts(): StorageAlert[];
    clearAlerts(): void;
    getEntry(id: string): StorageEntry | undefined;
    getAllEntries(): StorageEntry[];
    findByHash(contentHash: string): StorageEntry[];
    findByTag(tag: string): StorageEntry[];
    getTotalBytes(): number;
    getUniqueBytes(): number;
    getProvider(): StorageProvider | null;
    setProvider(provider: StorageProvider): void;
}
//# sourceMappingURL=guardian.d.ts.map