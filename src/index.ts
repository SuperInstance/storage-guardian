/**
 * @superinstance/storage-guardian — Main Entry Point (v0.2.0)
 */

// Core
export { StorageGuardian } from './core/guardian';
export { formatBytes, hashContent, generateId, formatDate, detectMimeType } from './core/utils';

// Types — re-export everything
export * from './core/types';

// Adapters
export { FileSystemProvider } from './adapters/filesystem';
export { S3Provider } from './adapters/s3';
export { MemoryProvider } from './adapters/memory';

// Persistence
export {
  JsonFilePersistence,
  MemoryPersistence,
  saveScan,
} from './persistence';

// Export formatters
export {
  exportJson,
  exportPrometheus,
  exportSlack,
  exportMarkdown,
} from './export';

// Alerting
export {
  duplicateRatioThreshold,
  budgetUsageAlert,
  oversizedFileAlert,
  duplicateGrowthAlert,
  wastedBytesThreshold,
  budgetToAlertRules,
  evaluateBuiltInRules,
} from './alerting';

// Trend analysis
export {
  analyzeTrend,
  compareReports,
  recordToDataPoint,
} from './trend';
