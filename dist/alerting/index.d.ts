/**
 * @superinstance/storage-guardian — Alerting Engine
 *
 * Built-in alert rules for common conditions.
 */
import { StorageAlert, StorageReport, AlertRule, StorageBudget } from '../core/types';
/**
 * Alert when duplicate percentage exceeds a threshold.
 */
export declare function duplicateRatioThreshold(threshold: number): AlertRule;
/**
 * Alert when total storage exceeds a percentage of budget.
 */
export declare function budgetUsageAlert(budgetBytes: number, warnPercent?: number): AlertRule;
/**
 * Alert when new oversized files are detected.
 */
export declare function oversizedFileAlert(maxBytes: number): AlertRule;
/**
 * Alert when duplicate count is growing between scans.
 */
export declare function duplicateGrowthAlert(maxGrowthPercent?: number): AlertRule;
/**
 * Alert when total wasted bytes exceeds a threshold.
 */
export declare function wastedBytesThreshold(maxWasted: number): AlertRule;
/**
 * Create standard alert rules from a budget configuration.
 */
export declare function budgetToAlertRules(budget: StorageBudget): AlertRule[];
/**
 * Convenience: evaluate all built-in rules and return alerts.
 */
export declare function evaluateBuiltInRules(report: StorageReport, previousReport?: StorageReport, budget?: StorageBudget): StorageAlert[];
//# sourceMappingURL=index.d.ts.map