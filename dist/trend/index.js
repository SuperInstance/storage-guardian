"use strict";
/**
 * @superinstance/storage-guardian — Trend Analysis
 *
 * Compare scans over time. Detect growth patterns and duplicate trends.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordToDataPoint = recordToDataPoint;
exports.analyzeTrend = analyzeTrend;
exports.compareReports = compareReports;
const utils_1 = require("../core/utils");
/**
 * Extract a data point from a scan record for trend analysis.
 */
function recordToDataPoint(record) {
    return {
        timestamp: record.timestamp,
        totalEntries: record.report.totalEntries,
        totalBytes: record.report.totalBytes,
        uniqueBytes: record.report.uniqueBytes,
        wastedBytes: record.report.wastedBytes,
        duplicateRatio: record.report.duplicateRatio,
        duplicateGroupCount: record.report.duplicateGroups.length,
    };
}
/**
 * Perform trend analysis on historical scan records.
 */
function analyzeTrend(records) {
    if (records.length < 2)
        return null;
    const sorted = [...records].sort((a, b) => a.timestamp - b.timestamp);
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const dataPoints = sorted.map(recordToDataPoint);
    const firstReport = first.report;
    const lastReport = last.report;
    // Calculate duplicate ratio trend
    const ratioDelta = lastReport.duplicateRatio - firstReport.duplicateRatio;
    let ratioTrend;
    if (Math.abs(ratioDelta) < 0.02) {
        ratioTrend = 'stable';
    }
    else {
        ratioTrend = ratioDelta > 0 ? 'increasing' : 'decreasing';
    }
    // Storage growth
    const storageGrowth = lastReport.totalBytes - firstReport.totalBytes;
    const storageGrowthPercent = firstReport.totalBytes > 0
        ? (storageGrowth / firstReport.totalBytes) * 100
        : 0;
    // New duplicate groups
    const newDuplicateCount = Math.max(0, lastReport.duplicateGroups.length - firstReport.duplicateGroups.length);
    // Generate trend alerts
    const alerts = [];
    if (ratioTrend === 'increasing' && ratioDelta > 0.05) {
        alerts.push(`⚠️ Duplicate percentage grew from ${(firstReport.duplicateRatio * 100).toFixed(1)}% to ${(lastReport.duplicateRatio * 100).toFixed(1)}% over ${formatDuration(last.timestamp - first.timestamp)}`);
    }
    if (storageGrowthPercent > 50) {
        alerts.push(`📈 Storage grew by ${(0, utils_1.formatBytes)(storageGrowth)} (${storageGrowthPercent.toFixed(1)}%) over ${formatDuration(last.timestamp - first.timestamp)}`);
    }
    if (newDuplicateCount > 5) {
        alerts.push(`🔄 ${newDuplicateCount} new duplicate groups appeared since last analysis`);
    }
    // Check for sudden spikes
    for (let i = 1; i < dataPoints.length; i++) {
        const prev = dataPoints[i - 1];
        const curr = dataPoints[i];
        const spike = curr.duplicateRatio - prev.duplicateRatio;
        if (spike > 0.1) {
            alerts.push(`🚨 Sudden duplicate spike of ${(spike * 100).toFixed(1)}% detected at ${(0, utils_1.formatDate)(curr.timestamp)}`);
        }
    }
    return {
        period: { from: first.timestamp, to: last.timestamp },
        dataPoints,
        summary: {
            duplicateRatioTrend: ratioTrend,
            duplicateRatioDelta: ratioDelta,
            storageGrowthBytes: storageGrowth,
            storageGrowthPercent,
            newDuplicatesCount: newDuplicateCount,
        },
        alerts,
    };
}
/**
 * Compare two specific reports and generate a diff.
 */
function compareReports(previous, current) {
    const lines = [
        `# Report Comparison`,
        ``,
        `| Metric | Previous | Current | Delta |`,
        `|--------|----------|---------|-------|`,
        `| Entries | ${previous.totalEntries} | ${current.totalEntries} | ${current.totalEntries - previous.totalEntries >= 0 ? '+' : ''}${current.totalEntries - previous.totalEntries} |`,
        `| Total Size | ${(0, utils_1.formatBytes)(previous.totalBytes)} | ${(0, utils_1.formatBytes)(current.totalBytes)} | ${current.totalBytes - previous.totalBytes >= 0 ? '+' : ''}${(0, utils_1.formatBytes)(current.totalBytes - previous.totalBytes)} |`,
        `| Unique | ${(0, utils_1.formatBytes)(previous.uniqueBytes)} | ${(0, utils_1.formatBytes)(current.uniqueBytes)} | ${current.uniqueBytes - previous.uniqueBytes >= 0 ? '+' : ''}${(0, utils_1.formatBytes)(current.uniqueBytes - previous.uniqueBytes)} |`,
        `| Wasted | ${(0, utils_1.formatBytes)(previous.wastedBytes)} | ${(0, utils_1.formatBytes)(current.wastedBytes)} | ${current.wastedBytes - previous.wastedBytes >= 0 ? '+' : ''}${(0, utils_1.formatBytes)(current.wastedBytes - previous.wastedBytes)} |`,
        `| Dup Ratio | ${(previous.duplicateRatio * 100).toFixed(1)}% | ${(current.duplicateRatio * 100).toFixed(1)}% | ${((current.duplicateRatio - previous.duplicateRatio) * 100).toFixed(1)}% |`,
        `| Dup Groups | ${previous.duplicateGroups.length} | ${current.duplicateGroups.length} | ${current.duplicateGroups.length - previous.duplicateGroups.length >= 0 ? '+' : ''}${current.duplicateGroups.length - previous.duplicateGroups.length} |`,
    ];
    return lines.join('\n') + '\n';
}
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatDuration(ms) {
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    if (days > 30) {
        const months = Math.floor(days / 30);
        return `${months} month${months > 1 ? 's' : ''}`;
    }
    if (days > 0)
        return `${days} day${days > 1 ? 's' : ''}`;
    const hours = Math.floor(ms / (1000 * 60 * 60));
    return `${hours} hour${hours > 1 ? 's' : ''}`;
}
//# sourceMappingURL=index.js.map