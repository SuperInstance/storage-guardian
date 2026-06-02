/**
 * @superinstance/storage-guardian — Alerting Engine
 *
 * Built-in alert rules for common conditions.
 */

import {
  StorageAlert,
  StorageReport,
  AlertRule,
  StorageBudget,
} from '../core/types';
import { formatBytes } from '../core/utils';

// ---------------------------------------------------------------------------
// Built-in Alert Rules
// ---------------------------------------------------------------------------

/**
 * Alert when duplicate percentage exceeds a threshold.
 */
export function duplicateRatioThreshold(threshold: number): AlertRule {
  return {
    type: 'duplicate',
    severity: threshold > 0.25 ? 'critical' : 'warning',
    messageTemplate: `Duplicate ratio {duplicateRatio} exceeds threshold of ${(threshold * 100).toFixed(0)}%`,
    condition: (ctx) => ctx.report.duplicateRatio > threshold,
  };
}

/**
 * Alert when total storage exceeds a percentage of budget.
 */
export function budgetUsageAlert(budgetBytes: number, warnPercent: number = 80): AlertRule {
  return {
    type: 'budget',
    severity: 'warning',
    messageTemplate: `Storage usage at {totalBytes} is over ${warnPercent}% of budget (${formatBytes(budgetBytes)})`,
    condition: (ctx) => {
      const usage = ctx.report.totalBytes / budgetBytes;
      return usage > warnPercent / 100;
    },
  };
}

/**
 * Alert when new oversized files are detected.
 */
export function oversizedFileAlert(maxBytes: number): AlertRule {
  return {
    type: 'oversized',
    severity: 'warning',
    messageTemplate: `New oversized files detected (limit: ${formatBytes(maxBytes)})`,
    condition: (ctx) => ctx.report.topConsumers.some((e) => e.sizeBytes > maxBytes),
  };
}

/**
 * Alert when duplicate count is growing between scans.
 */
export function duplicateGrowthAlert(maxGrowthPercent: number = 50): AlertRule {
  return {
    type: 'trend',
    severity: 'warning',
    messageTemplate: `Duplicate percentage grew significantly between scans`,
    condition: (ctx) => {
      if (!ctx.previousReport) return false;
      const prevRatio = ctx.previousReport.duplicateRatio;
      const currRatio = ctx.report.duplicateRatio;
      if (prevRatio === 0) return currRatio > 0.05;
      const growth = (currRatio - prevRatio) / prevRatio;
      return growth > maxGrowthPercent / 100;
    },
  };
}

/**
 * Alert when total wasted bytes exceeds a threshold.
 */
export function wastedBytesThreshold(maxWasted: number): AlertRule {
  return {
    type: 'budget',
    severity: maxWasted > 1024 * 1024 * 1024 ? 'critical' : 'warning',
    messageTemplate: `Wasted storage {wastedBytes} exceeds threshold of ${formatBytes(maxWasted)}`,
    condition: (ctx) => ctx.report.wastedBytes > maxWasted,
  };
}

/**
 * Create standard alert rules from a budget configuration.
 */
export function budgetToAlertRules(budget: StorageBudget): AlertRule[] {
  const rules: AlertRule[] = [];

  if (budget.maxTotalBytes) {
    rules.push(budgetUsageAlert(budget.maxTotalBytes));
  }

  if (budget.maxSingleEntryBytes) {
    rules.push(oversizedFileAlert(budget.maxSingleEntryBytes));
  }

  if (budget.maxDuplicateRatio) {
    rules.push(duplicateRatioThreshold(budget.maxDuplicateRatio));
  }

  return rules;
}

/**
 * Convenience: evaluate all built-in rules and return alerts.
 */
export function evaluateBuiltInRules(
  report: StorageReport,
  previousReport?: StorageReport,
  budget?: StorageBudget,
): StorageAlert[] {
  const rules: AlertRule[] = [
    duplicateRatioThreshold(0.15),
    duplicateGrowthAlert(50),
  ];

  if (budget) {
    rules.push(...budgetToAlertRules(budget));
  }

  const alerts: StorageAlert[] = [];

  for (const rule of rules) {
    try {
      if (rule.condition({ report, previousReport })) {
        alerts.push({
          type: rule.type === '*' ? 'budget' : rule.type,
          severity: rule.severity,
          message: rule.messageTemplate
            .replace('{duplicateRatio}', `${(report.duplicateRatio * 100).toFixed(1)}%`)
            .replace('{totalBytes}', formatBytes(report.totalBytes))
            .replace('{wastedBytes}', formatBytes(report.wastedBytes))
            .replace('{totalEntries}', String(report.totalEntries)),
          timestamp: Date.now(),
        });
      }
    } catch {
      // skip broken rules
    }
  }

  return alerts;
}
