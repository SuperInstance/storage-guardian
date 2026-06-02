#!/usr/bin/env node
"use strict";
/**
 * @superinstance/storage-guardian — CLI
 *
 * Usage:
 *   npx storage-guardian scan ./path/to/dir
 *   npx storage-guardian scan ./path --format json --output report.json
 *   npx storage-guardian scan ./path --format prometheus
 *   npx storage-guardian scan ./path --format slack --webhook https://hooks.slack.com/...
 *   npx storage-guardian trend --history .storage-guardian-history
 *   npx storage-guardian compare <scan-id-1> <scan-id-2>
 */
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = require("path");
const node_fs_1 = require("node:fs");
const guardian_1 = require("./core/guardian");
const filesystem_1 = require("./adapters/filesystem");
const persistence_1 = require("./persistence");
const export_1 = require("./export");
const alerting_1 = require("./alerting");
const trend_1 = require("./trend");
// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------
function parseArgs(argv) {
    const result = {};
    const args = argv.slice(2);
    if (args.length === 0) {
        console.log(`storage-guardian v0.2.0

Usage:
  storage-guardian scan <path> [options]
  storage-guardian trend [--history <dir>]
  storage-guardian compare <scan-id-1> <scan-id-2>

Options:
  --format <json|prometheus|slack|markdown>  Output format (default: markdown)
  --output <file>                            Write output to file
  --history <dir>                            Persistence directory (default: .storage-guardian-history)
  --budget <bytes>                           Storage budget in bytes
  --max-depth <n>                            Max directory depth
  --exclude <patterns>                       Comma-separated exclude patterns
  --include-hidden                           Include hidden files
  --follow-symlinks                          Follow symbolic links
  --no-persist                               Don't save scan to history
`);
        process.exit(0);
    }
    result._command = args[0];
    for (let i = 1; i < args.length; i++) {
        if (args[i].startsWith('--')) {
            const key = args[i].slice(2);
            if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
                result[key] = args[++i];
            }
            else {
                result[key] = true;
            }
        }
        else if (!result._path) {
            result._path = args[i];
        }
    }
    return result;
}
// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
    const args = parseArgs(process.argv);
    const command = args._command;
    const historyDir = args.history ?? '.storage-guardian-history';
    if (command === 'scan') {
        await scanCommand(args, historyDir);
    }
    else if (command === 'trend') {
        await trendCommand(args, historyDir);
    }
    else if (command === 'compare') {
        await compareCommand(args, historyDir);
    }
    else {
        console.error(`Unknown command: ${command}`);
        process.exit(1);
    }
}
async function scanCommand(args, historyDir) {
    const scanPath = args._path ?? '.';
    const resolvedPath = (0, path_1.resolve)(scanPath);
    const format = args.format ?? 'markdown';
    const outputPath = args.output;
    const noPersist = args['no-persist'] === true;
    console.error(`Scanning: ${resolvedPath}`);
    const provider = new filesystem_1.FileSystemProvider({
        rootPath: resolvedPath,
        followSymlinks: args['follow-symlinks'] === true,
        includeHidden: args['include-hidden'] === true,
        maxDepth: args['max-depth'] ? parseInt(args['max-depth']) : undefined,
        excludePatterns: args.exclude
            ? args.exclude.split(',').map((s) => s.trim())
            : undefined,
    });
    const guardian = new guardian_1.StorageGuardian(provider);
    if (args.budget) {
        guardian.setBudget({ maxTotalBytes: parseInt(args.budget) });
    }
    const startTime = Date.now();
    const count = await guardian.scan();
    const scanDurationMs = Date.now() - startTime;
    const report = guardian.generateReport();
    report.scanDurationMs = scanDurationMs;
    const alerts = [
        ...guardian.getAlerts(),
        ...(0, alerting_1.evaluateBuiltInRules)(report, undefined, args.budget ? { maxTotalBytes: parseInt(args.budget) } : undefined),
    ];
    console.error(`Found ${count} entries in ${scanDurationMs}ms`);
    // Persist
    if (!noPersist) {
        const persistence = new persistence_1.JsonFilePersistence(historyDir);
        const record = await (0, persistence_1.saveScan)(report, alerts, persistence, resolvedPath);
        console.error(`Scan saved: ${record.id}`);
    }
    // Export
    let output;
    switch (format) {
        case 'json':
            output = (0, export_1.exportJson)(report, alerts);
            break;
        case 'prometheus':
            output = (0, export_1.exportPrometheus)(report);
            break;
        case 'slack':
            output = (0, export_1.exportSlack)(report, alerts);
            break;
        case 'markdown':
        default:
            output = (0, export_1.exportMarkdown)(report, alerts);
            break;
    }
    if (outputPath) {
        (0, node_fs_1.writeFileSync)(outputPath, output, 'utf-8');
        console.error(`Report written to: ${outputPath}`);
    }
    else {
        console.log(output);
    }
}
async function trendCommand(args, historyDir) {
    const persistence = new persistence_1.JsonFilePersistence(historyDir);
    const records = await persistence.list({ limit: 30 });
    if (records.length < 2) {
        console.log('Not enough scan history for trend analysis. Run at least 2 scans.');
        process.exit(1);
    }
    const trend = (0, trend_1.analyzeTrend)(records);
    if (!trend) {
        console.log('Could not analyze trends.');
        process.exit(1);
    }
    console.log(`# Trend Analysis`);
    console.log(`Period: ${new Date(trend.period.from).toISOString()} → ${new Date(trend.period.to).toISOString()}`);
    console.log(`Data points: ${trend.dataPoints.length}`);
    console.log(`Duplicate ratio trend: ${trend.summary.duplicateRatioTrend} (${(trend.summary.duplicateRatioDelta * 100).toFixed(1)}% change)`);
    console.log(`Storage growth: ${trend.summary.storageGrowthBytes >= 0 ? '+' : ''}${(trend.summary.storageGrowthBytes / 1024 / 1024).toFixed(1)}MB (${trend.summary.storageGrowthPercent.toFixed(1)}%)`);
    console.log(`New duplicates: ${trend.summary.newDuplicatesCount}`);
    if (trend.alerts.length > 0) {
        console.log('\n## Alerts');
        for (const alert of trend.alerts) {
            console.log(alert);
        }
    }
}
async function compareCommand(args, historyDir) {
    const ids = process.argv.slice(3).filter((a) => !a.startsWith('--'));
    if (ids.length < 2) {
        console.error('Usage: storage-guardian compare <scan-id-1> <scan-id-2>');
        process.exit(1);
    }
    const persistence = new persistence_1.JsonFilePersistence(historyDir);
    const a = await persistence.load(ids[0]);
    const b = await persistence.load(ids[1]);
    if (!a) {
        console.error(`Scan not found: ${ids[0]}`);
        process.exit(1);
    }
    if (!b) {
        console.error(`Scan not found: ${ids[1]}`);
        process.exit(1);
    }
    console.log((0, trend_1.compareReports)(a.report, b.report));
}
main().catch((err) => {
    console.error('Error:', err.message);
    process.exit(1);
});
//# sourceMappingURL=cli.js.map