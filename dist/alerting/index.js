"use strict";
/**
 * @superinstance/storage-guardian — Alerting Engine
 *
 * Built-in alert rules for common conditions.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.duplicateRatioThreshold = duplicateRatioThreshold;
exports.budgetUsageAlert = budgetUsageAlert;
exports.oversizedFileAlert = oversizedFileAlert;
exports.duplicateGrowthAlert = duplicateGrowthAlert;
exports.wastedBytesThreshold = wastedBytesThreshold;
exports.budgetToAlertRules = budgetToAlertRules;
exports.evaluateBuiltInRules = evaluateBuiltInRules;
const utils_1 = require("../core/utils");
// ---------------------------------------------------------------------------
// Built-in Alert Rules
// ---------------------------------------------------------------------------
/**
 * Alert when duplicate percentage exceeds a threshold.
 */
function duplicateRatioThreshold(threshold) {
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
function budgetUsageAlert(budgetBytes, warnPercent = 80) {
    return {
        type: 'budget',
        severity: 'warning',
        messageTemplate: `Storage usage at {totalBytes} is over ${warnPercent}% of budget (${(0, utils_1.formatBytes)(budgetBytes)})`,
        condition: (ctx) => {
            const usage = ctx.report.totalBytes / budgetBytes;
            return usage > warnPercent / 100;
        },
    };
}
/**
 * Alert when new oversized files are detected.
 */
function oversizedFileAlert(maxBytes) {
    return {
        type: 'oversized',
        severity: 'warning',
        messageTemplate: `New oversized files detected (limit: ${(0, utils_1.formatBytes)(maxBytes)})`,
        condition: (ctx) => ctx.report.topConsumers.some((e) => e.sizeBytes > maxBytes),
    };
}
/**
 * Alert when duplicate count is growing between scans.
 */
function duplicateGrowthAlert(maxGrowthPercent = 50) {
    return {
        type: 'trend',
        severity: 'warning',
        messageTemplate: `Duplicate percentage grew significantly between scans`,
        condition: (ctx) => {
            if (!ctx.previousReport)
                return false;
            const prevRatio = ctx.previousReport.duplicateRatio;
            const currRatio = ctx.report.duplicateRatio;
            if (prevRatio === 0)
                return currRatio > 0.05;
            const growth = (currRatio - prevRatio) / prevRatio;
            return growth > maxGrowthPercent / 100;
        },
    };
}
/**
 * Alert when total wasted bytes exceeds a threshold.
 */
function wastedBytesThreshold(maxWasted) {
    return {
        type: 'budget',
        severity: maxWasted > 1024 * 1024 * 1024 ? 'critical' : 'warning',
        messageTemplate: `Wasted storage {wastedBytes} exceeds threshold of ${(0, utils_1.formatBytes)(maxWasted)}`,
        condition: (ctx) => ctx.report.wastedBytes > maxWasted,
    };
}
/**
 * Create standard alert rules from a budget configuration.
 */
function budgetToAlertRules(budget) {
    const rules = [];
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
function evaluateBuiltInRules(report, previousReport, budget) {
    const rules = [
        duplicateRatioThreshold(0.15),
        duplicateGrowthAlert(50),
    ];
    if (budget) {
        rules.push(...budgetToAlertRules(budget));
    }
    const alerts = [];
    for (const rule of rules) {
        try {
            if (rule.condition({ report, previousReport })) {
                alerts.push({
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
            // skip broken rules
        }
    }
    return alerts;
}
//# sourceMappingURL=index.js.map