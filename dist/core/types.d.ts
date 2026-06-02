/**
 * @superinstance/storage-guardian — Core Types (v0.2.0)
 */
export interface StorageEntry {
    /** Unique identifier */
    id: string;
    /** Content hash (SHA-256) */
    contentHash: string;
    /** Size in bytes */
    sizeBytes: number;
    /** MIME type or custom type label */
    mimeType?: string;
    /** Original filename or path */
    name: string;
    /** Full path (for file system entries) */
    path?: string;
    /** Tags or categories */
    tags?: string[];
    /** Creation timestamp */
    createdAt: number;
    /** Last access timestamp */
    accessedAt: number;
    /** Reference count */
    refCount: number;
    /** Whether this is a symbolic link */
    isSymlink?: boolean;
    /** Whether this is a hidden file (dotfile) */
    isHidden?: boolean;
    /** File permissions (Unix mode) */
    mode?: number;
}
export interface DuplicateGroup {
    contentHash: string;
    wastedBytes: number;
    entries: StorageEntry[];
    canonical: StorageEntry;
}
export interface StorageBudget {
    maxTotalBytes: number;
    maxEntries?: number;
    maxSingleEntryBytes?: number;
    maxDuplicateCount?: number;
    maxDuplicateRatio?: number;
}
export interface StorageReport {
    generatedAt: number;
    source: string;
    totalEntries: number;
    totalBytes: number;
    uniqueBytes: number;
    wastedBytes: number;
    duplicateRatio: number;
    duplicateGroups: DuplicateGroup[];
    budgetViolations: string[];
    topConsumers: StorageEntry[];
    scanDurationMs: number;
}
export interface StorageAlert {
    type: 'duplicate' | 'budget' | 'orphan' | 'oversized' | 'trend' | 'permission';
    severity: 'info' | 'warning' | 'critical';
    message: string;
    entryId?: string;
    entryName?: string;
    details?: Record<string, unknown>;
    timestamp: number;
}
export interface AlertRule {
    type: StorageAlert['type'] | '*';
    condition: (ctx: AlertContext) => boolean;
    severity: StorageAlert['severity'];
    messageTemplate: string;
}
export interface AlertContext {
    report: StorageReport;
    entry?: StorageEntry;
    previousReport?: StorageReport;
}
export interface StorageProvider {
    readonly name: string;
    scan(): AsyncIterable<StorageEntry>;
    read(entry: StorageEntry): Promise<Buffer>;
    exists(path: string): Promise<boolean>;
    stat(path: string): Promise<EntryMeta | null>;
}
export interface EntryMeta {
    sizeBytes: number;
    modifiedAt: number;
    createdAt?: number;
    isFile: boolean;
    isDirectory: boolean;
    isSymlink: boolean;
    mode?: number;
}
export interface FileSystemProviderOptions {
    rootPath: string;
    followSymlinks?: boolean;
    includeHidden?: boolean;
    maxDepth?: number;
    excludePatterns?: string[];
    concurrency?: number;
}
export interface S3ProviderOptions {
    bucket: string;
    prefix?: string;
    region?: string;
    endpoint?: string;
    credentials?: {
        accessKeyId: string;
        secretAccessKey: string;
    };
}
export interface ScanRecord {
    id: string;
    timestamp: number;
    source: string;
    report: StorageReport;
    alerts: StorageAlert[];
}
export interface PersistenceBackend {
    save(record: ScanRecord): Promise<void>;
    load(id: string): Promise<ScanRecord | null>;
    list(opts?: {
        limit?: number;
        since?: number;
    }): Promise<ScanRecord[]>;
    remove(id: string): Promise<boolean>;
}
export interface TrendDataPoint {
    timestamp: number;
    totalEntries: number;
    totalBytes: number;
    uniqueBytes: number;
    wastedBytes: number;
    duplicateRatio: number;
    duplicateGroupCount: number;
}
export interface TrendAnalysis {
    period: {
        from: number;
        to: number;
    };
    dataPoints: TrendDataPoint[];
    summary: {
        duplicateRatioTrend: 'increasing' | 'decreasing' | 'stable';
        duplicateRatioDelta: number;
        storageGrowthBytes: number;
        storageGrowthPercent: number;
        newDuplicatesCount: number;
    };
    alerts: string[];
}
export interface ExportOptions {
    format?: 'json' | 'prometheus' | 'slack' | 'markdown';
    includeAlerts?: boolean;
    includeDuplicates?: boolean;
    includeTopConsumers?: boolean;
    compact?: boolean;
    prefix?: string;
}
//# sourceMappingURL=types.d.ts.map