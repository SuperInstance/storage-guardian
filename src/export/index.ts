/**
 * @superinstance/storage-guardian — Export Formats
 *
 * JSON, Prometheus, Slack, and Markdown export formatters.
 */

import {
  StorageReport,
  StorageAlert,
  ExportOptions,
  TrendAnalysis,
} from '../core/types';
import { formatBytes, formatDate } from '../core/utils';

// ---------------------------------------------------------------------------
// JSON Export
// ---------------------------------------------------------------------------

export function exportJson(
  report: StorageReport,
  alerts: StorageAlert[],
  opts?: ExportOptions,
): string {
  const includeAlerts = opts?.includeAlerts !== false;
  const includeDuplicates = opts?.includeDuplicates !== false;
  const includeTopConsumers = opts?.includeTopConsumers !== false;

  const output: any = {
    generatedAt: formatDate(report.generatedAt),
    source: report.source,
    summary: {
      totalEntries: report.totalEntries,
      totalBytes: report.totalBytes,
      totalBytesHuman: formatBytes(report.totalBytes),
      uniqueBytes: report.uniqueBytes,
      uniqueBytesHuman: formatBytes(report.uniqueBytes),
      wastedBytes: report.wastedBytes,
      wastedBytesHuman: formatBytes(report.wastedBytes),
      duplicateRatio: `${(report.duplicateRatio * 100).toFixed(1)}%`,
      duplicateGroups: report.duplicateGroups.length,
      scanDurationMs: report.scanDurationMs,
    },
    budgetViolations: report.budgetViolations,
  };

  if (includeDuplicates) {
    output.duplicateGroups = report.duplicateGroups.map((g) => ({
      contentHash: g.contentHash,
      wastedBytes: g.wastedBytes,
      wastedBytesHuman: formatBytes(g.wastedBytes),
      duplicateCount: g.entries.length,
      files: g.entries.map((e) => e.name),
    }));
  }

  if (includeTopConsumers) {
    output.topConsumers = report.topConsumers.map((e) => ({
      name: e.name,
      path: e.path,
      sizeBytes: e.sizeBytes,
      sizeHuman: formatBytes(e.sizeBytes),
    }));
  }

  if (includeAlerts) {
    output.alerts = alerts.map((a) => ({
      type: a.type,
      severity: a.severity,
      message: a.message,
      timestamp: formatDate(a.timestamp),
    }));
  }

  return JSON.stringify(output, null, opts?.compact ? 0 : 2);
}

// ---------------------------------------------------------------------------
// Prometheus Export
// ---------------------------------------------------------------------------

export function exportPrometheus(
  report: StorageReport,
  opts?: ExportOptions,
): string {
  const prefix = opts?.prefix ?? 'storage_guardian';
  const lines: string[] = [
    `# HELP ${prefix}_total_entries Total number of storage entries`,
    `# TYPE ${prefix}_total_entries gauge`,
    `${prefix}_total_entries ${report.totalEntries}`,
    ``,
    `# HELP ${prefix}_total_bytes Total storage in bytes`,
    `# TYPE ${prefix}_total_bytes gauge`,
    `${prefix}_total_bytes ${report.totalBytes}`,
    ``,
    `# HELP ${prefix}_unique_bytes Unique (deduplicated) storage in bytes`,
    `# TYPE ${prefix}_unique_bytes gauge`,
    `${prefix}_unique_bytes ${report.uniqueBytes}`,
    ``,
    `# HELP ${prefix}_wasted_bytes Wasted storage from duplicates`,
    `# TYPE ${prefix}_wasted_bytes gauge`,
    `${prefix}_wasted_bytes ${report.wastedBytes}`,
    ``,
    `# HELP ${prefix}_duplicate_ratio Duplicate ratio (0-1)`,
    `# TYPE ${prefix}_duplicate_ratio gauge`,
    `${prefix}_duplicate_ratio ${report.duplicateRatio.toFixed(4)}`,
    ``,
    `# HELP ${prefix}_duplicate_groups Number of duplicate groups`,
    `# TYPE ${prefix}_duplicate_groups gauge`,
    `${prefix}_duplicate_groups ${report.duplicateGroups.length}`,
    ``,
    `# HELP ${prefix}_budget_violations Number of budget violations`,
    `# TYPE ${prefix}_budget_violations gauge`,
    `${prefix}_budget_violations ${report.budgetViolations.length}`,
    ``,
    `# HELP ${prefix}_scan_duration_ms Scan duration in milliseconds`,
    `# TYPE ${prefix}_scan_duration_ms gauge`,
    `${prefix}_scan_duration_ms ${report.scanDurationMs}`,
  ];

  // Per-duplicate-group metrics
  if (opts?.includeDuplicates !== false) {
    lines.push('');
    lines.push(`# HELP ${prefix}_duplicate_group_wasted_bytes Wasted bytes per duplicate group`);
    lines.push(`# TYPE ${prefix}_duplicate_group_wasted_bytes gauge`);
    for (const group of report.duplicateGroups) {
      lines.push(
        `${prefix}_duplicate_group_wasted_bytes{hash="${group.contentHash.slice(0, 16)}",count="${group.entries.length}"} ${group.wastedBytes}`,
      );
    }
  }

  return lines.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// Slack Export
// ---------------------------------------------------------------------------

export function exportSlack(
  report: StorageReport,
  alerts: StorageAlert[],
  opts?: ExportOptions,
): string {
  const emoji = report.duplicateRatio > 0.2 ? '🔴' : report.duplicateRatio > 0.1 ? '🟡' : '🟢';
  const lines: string[] = [
    `${emoji} *Storage Guardian Report*`,
    `_${formatDate(report.generatedAt)}_`,
    `Source: \`${report.source}\``,
    ``,
    `*Summary:*`,
    `• Total: ${formatBytes(report.totalBytes)} across ${report.totalEntries} entries`,
    `• Unique: ${formatBytes(report.uniqueBytes)}`,
    `• Wasted: ${formatBytes(report.wastedBytes)} (${(report.duplicateRatio * 100).toFixed(1)}% duplicates)`,
    `• Duplicate groups: ${report.duplicateGroups.length}`,
  ];

  if (report.budgetViolations.length > 0) {
    lines.push('', `⚠️ *Budget Violations:*`);
    for (const v of report.budgetViolations) {
      lines.push(`• ${v}`);
    }
  }

  const criticalAlerts = alerts.filter((a) => a.severity === 'critical');
  const warningAlerts = alerts.filter((a) => a.severity === 'warning');

  if (criticalAlerts.length > 0 || warningAlerts.length > 0) {
    lines.push('', `🔔 *Alerts:*`);
    for (const a of [...criticalAlerts, ...warningAlerts].slice(0, 5)) {
      const icon = a.severity === 'critical' ? '🚨' : '⚠️';
      lines.push(`${icon} ${a.message}`);
    }
    if (criticalAlerts.length + warningAlerts.length > 5) {
      lines.push(`_...and ${criticalAlerts.length + warningAlerts.length - 5} more_`);
    }
  }

  if (opts?.includeTopConsumers !== false && report.topConsumers.length > 0) {
    lines.push('', `*Top Consumers:*`);
    for (const e of report.topConsumers.slice(0, 5)) {
      lines.push(`• \`${e.name}\` — ${formatBytes(e.sizeBytes)}`);
    }
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Markdown Export
// ---------------------------------------------------------------------------

export function exportMarkdown(
  report: StorageReport,
  alerts: StorageAlert[],
  trend?: TrendAnalysis,
  opts?: ExportOptions,
): string {
  const lines: string[] = [
    `# Storage Guardian Report`,
    ``,
    `**Generated:** ${formatDate(report.generatedAt)}`,
    `**Source:** \`${report.source}\``,
    `**Scan Duration:** ${report.scanDurationMs}ms`,
    ``,
    `## Summary`,
    ``,
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Total Entries | ${report.totalEntries} |`,
    `| Total Size | ${formatBytes(report.totalBytes)} |`,
    `| Unique Size | ${formatBytes(report.uniqueBytes)} |`,
    `| Wasted (Duplicates) | ${formatBytes(report.wastedBytes)} (${(report.duplicateRatio * 100).toFixed(1)}%) |`,
    `| Duplicate Groups | ${report.duplicateGroups.length} |`,
    `| Budget Violations | ${report.budgetViolations.length} |`,
  ];

  if (report.budgetViolations.length > 0) {
    lines.push('', `## ⚠️ Budget Violations`, '');
    for (const v of report.budgetViolations) {
      lines.push(`- ${v}`);
    }
  }

  if (report.duplicateGroups.length > 0 && opts?.includeDuplicates !== false) {
    lines.push('', `## Duplicate Groups`, '');
    lines.push('| Hash | Files | Wasted |');
    lines.push('|------|-------|--------|');
    for (const g of report.duplicateGroups.slice(0, 20)) {
      const files = g.entries.map((e) => e.name).join(', ');
      lines.push(
        `| \`${g.contentHash.slice(0, 16)}…\` | ${g.entries.length} (${files.slice(0, 80)}) | ${formatBytes(g.wastedBytes)} |`,
      );
    }
  }

  if (report.topConsumers.length > 0 && opts?.includeTopConsumers !== false) {
    lines.push('', `## Top Consumers`, '');
    lines.push('| File | Size |');
    lines.push('|------|------|');
    for (const e of report.topConsumers) {
      lines.push(`| ${e.path ?? e.name} | ${formatBytes(e.sizeBytes)} |`);
    }
  }

  const significantAlerts = alerts.filter(
    (a) => a.severity === 'warning' || a.severity === 'critical',
  );
  if (significantAlerts.length > 0 && opts?.includeAlerts !== false) {
    lines.push('', `## Alerts`, '');
    for (const a of significantAlerts) {
      const icon = a.severity === 'critical' ? '🚨' : '⚠️';
      lines.push(`${icon} **[${a.severity.toUpperCase()}]** ${a.message}`);
    }
  }

  if (trend) {
    lines.push('', `## Trend Analysis`, '');
    lines.push(`- Period: ${formatDate(trend.period.from)} → ${formatDate(trend.period.to)}`);
    lines.push(`- Duplicate ratio trend: **${trend.summary.duplicateRatioTrend}** (${(trend.summary.duplicateRatioDelta * 100).toFixed(1)}% change)`);
    lines.push(`- Storage growth: ${formatBytes(trend.summary.storageGrowthBytes)} (${trend.summary.storageGrowthPercent.toFixed(1)}%)`);
    lines.push(`- New duplicates: ${trend.summary.newDuplicatesCount}`);

    if (trend.alerts.length > 0) {
      lines.push('', `### Trend Alerts`, '');
      for (const a of trend.alerts) {
        lines.push(`- ${a}`);
      }
    }
  }

  return lines.join('\n') + '\n';
}
