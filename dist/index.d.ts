/**
 * @superinstance/storage-guardian — Main Entry Point (v0.2.0)
 */
export { StorageGuardian } from './core/guardian';
export { formatBytes, hashContent, generateId, formatDate, detectMimeType } from './core/utils';
export * from './core/types';
export { FileSystemProvider } from './adapters/filesystem';
export { S3Provider } from './adapters/s3';
export { MemoryProvider } from './adapters/memory';
export { JsonFilePersistence, MemoryPersistence, saveScan, } from './persistence';
export { exportJson, exportPrometheus, exportSlack, exportMarkdown, } from './export';
export { duplicateRatioThreshold, budgetUsageAlert, oversizedFileAlert, duplicateGrowthAlert, wastedBytesThreshold, budgetToAlertRules, evaluateBuiltInRules, } from './alerting';
export { analyzeTrend, compareReports, recordToDataPoint, } from './trend';
//# sourceMappingURL=index.d.ts.map