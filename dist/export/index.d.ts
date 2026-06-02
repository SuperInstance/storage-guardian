/**
 * @superinstance/storage-guardian — Export Formats
 *
 * JSON, Prometheus, Slack, and Markdown export formatters.
 */
import { StorageReport, StorageAlert, ExportOptions, TrendAnalysis } from '../core/types';
export declare function exportJson(report: StorageReport, alerts: StorageAlert[], opts?: ExportOptions): string;
export declare function exportPrometheus(report: StorageReport, opts?: ExportOptions): string;
export declare function exportSlack(report: StorageReport, alerts: StorageAlert[], opts?: ExportOptions): string;
export declare function exportMarkdown(report: StorageReport, alerts: StorageAlert[], trend?: TrendAnalysis, opts?: ExportOptions): string;
//# sourceMappingURL=index.d.ts.map