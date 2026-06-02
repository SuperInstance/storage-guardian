/**
 * @superinstance/storage-guardian — Trend Analysis
 *
 * Compare scans over time. Detect growth patterns and duplicate trends.
 */
import { ScanRecord, TrendDataPoint, TrendAnalysis, StorageReport } from '../core/types';
/**
 * Extract a data point from a scan record for trend analysis.
 */
export declare function recordToDataPoint(record: ScanRecord): TrendDataPoint;
/**
 * Perform trend analysis on historical scan records.
 */
export declare function analyzeTrend(records: ScanRecord[]): TrendAnalysis | null;
/**
 * Compare two specific reports and generate a diff.
 */
export declare function compareReports(previous: StorageReport, current: StorageReport): string;
//# sourceMappingURL=index.d.ts.map