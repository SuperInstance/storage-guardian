# @superinstance/storage-guardian

Storage Guardian — duplicate detection, deduplication, storage budget enforcement, trend analysis, and alerting for JS/TS projects.

Works with **local file systems**, **S3/cloud storage**, or **in-memory** data. Pluggable architecture lets you add your own storage backend.

## Install

```bash
npm install @superinstance/storage-guardian

# Optional: for S3/cloud storage support
npm install @aws-sdk/client-s3
```

## Quick Start

### In-Memory (v0.1.0 compatible)

```typescript
import { StorageGuardian } from '@superinstance/storage-guardian';

const sg = new StorageGuardian();

// Add content
const entry = sg.add(Buffer.from('file contents'), {
  name: 'document.txt',
  mimeType: 'text/plain',
  tags: ['doc', 'important'],
});

// Detect duplicates
sg.add(Buffer.from('file contents'), { name: 'copy.txt' });
const duplicates = sg.findDuplicates();
console.log(`Found ${duplicates.length} duplicate groups`);

// Deduplicate
const removed = sg.deduplicate();
console.log(`Removed ${removed} duplicate entries`);

// Set budgets
sg.setBudget({
  maxTotalBytes: 1024 * 1024 * 100, // 100MB limit
  maxDuplicateRatio: 0.15,           // Alert if >15% duplicates
});

// Generate report
const report = sg.generateReport();
console.log(`Total: ${report.totalBytes} bytes, Unique: ${report.uniqueBytes} bytes`);
console.log(`Wasted: ${report.wastedBytes} bytes (${(report.duplicateRatio * 100).toFixed(1)}%)`);
```

### File System Scan

```typescript
import {
  StorageGuardian,
  FileSystemProvider,
  exportMarkdown,
  evaluateBuiltInRules,
} from '@superinstance/storage-guardian';

const provider = new FileSystemProvider({
  rootPath: '/path/to/project',
  followSymlinks: false,
  includeHidden: false,
  excludePatterns: ['node_modules', '.git', 'dist'],
  maxDepth: 10,
});

const guardian = new StorageGuardian(provider);
guardian.setBudget({ maxTotalBytes: 1024 * 1024 * 500 });

const fileCount = await guardian.scan();
const report = guardian.generateReport();
const alerts = evaluateBuiltInRules(report);

console.log(exportMarkdown(report, alerts));
```

### S3 / Cloud Storage

```typescript
import { StorageGuardian, S3Provider } from '@superinstance/storage-guardian';

const provider = new S3Provider({
  bucket: 'my-bucket',
  prefix: 'uploads/',
  region: 'us-east-1',
});

const guardian = new StorageGuardian(provider);
await guardian.scan();
const report = guardian.generateReport();
```

### CLI

```bash
# Scan a directory
npx storage-guardian scan ./my-project

# JSON output
npx storage-guardian scan ./my-project --format json

# Prometheus metrics
npx storage-guardian scan ./my-project --format prometheus --output metrics.txt

# With budget and exclusions
npx storage-guardian scan ./my-project \
  --budget 1073741824 \
  --exclude "node_modules,.git,dist" \
  --max-depth 5

# Trend analysis from saved scans
npx storage-guardian trend

# Compare two specific scans
npx storage-guardian compare <scan-id-1> <scan-id-2>
```

### Persistence & Trend Analysis

```typescript
import {
  StorageGuardian,
  FileSystemProvider,
  JsonFilePersistence,
  saveScan,
  analyzeTrend,
  evaluateBuiltInRules,
} from '@superinstance/storage-guardian';

const persistence = new JsonFilePersistence('./scan-history');

// Run and save scan
const provider = new FileSystemProvider({ rootPath: '/data' });
const guardian = new StorageGuardian(provider);
await guardian.scan();
const report = guardian.generateReport();
const record = await saveScan(report, guardian.getAlerts(), persistence);

// Later: analyze trends
const records = await persistence.list({ limit: 30 });
const trend = analyzeTrend(records);
// → { summary: { duplicateRatioTrend: 'increasing', duplicateRatioDelta: 0.06, ... } }
```

## Export Formats

### JSON

```typescript
import { exportJson } from '@superinstance/storage-guardian';
const output = exportJson(report, alerts, { compact: true });
```

### Prometheus

```typescript
import { exportPrometheus } from '@superinstance/storage-guardian';
const output = exportPrometheus(report, { prefix: 'my_app' });
```

### Slack

```typescript
import { exportSlack } from '@superinstance/storage-guardian';
const output = exportSlack(report, alerts);
```

### Markdown

```typescript
import { exportMarkdown } from '@superinstance/storage-guardian';
const output = exportMarkdown(report, alerts, trend);
```

## Alerting

```typescript
import {
  StorageGuardian,
  duplicateRatioThreshold,
  budgetUsageAlert,
  oversizedFileAlert,
  duplicateGrowthAlert,
  evaluateBuiltInRules,
} from '@superinstance/storage-guardian';

// Built-in rules
const alerts = evaluateBuiltInRules(report, previousReport, budget);

// Custom rules
const sg = new StorageGuardian();
sg.addAlertRule(duplicateRatioThreshold(0.15));
sg.addAlertRule(budgetUsageAlert(1024 * 1024 * 1024, 80));
sg.addAlertRule(oversizedFileAlert(1024 * 1024 * 100));
sg.addAlertRule(duplicateGrowthAlert(50));

const customAlerts = sg.evaluateAlertRules(previousReport);
```

## Cron Job

```bash
# Scan every 6 hours
0 */6 * * * npx storage-guardian scan /data --format prometheus --output /metrics/storage.guardian
```

## API Reference

### StorageGuardian

| Method | Description |
|--------|-------------|
| `new StorageGuardian(provider?)` | Create instance with optional storage provider |
| `add(content, opts)` | Add content, auto-detects duplicates |
| `remove(entryId)` | Remove an entry |
| `touch(entryId)` | Update access timestamp |
| `scan()` | Scan storage provider (async) |
| `findDuplicates()` | Find all duplicate groups |
| `deduplicate()` | Remove duplicates, keep canonical |
| `generateReport()` | Full storage report |
| `getAlerts()` / `clearAlerts()` | Manage alerts |
| `setBudget(budget)` / `addBudget(budget)` | Set storage limits |
| `addAlertRule(rule)` | Add custom alert rule |
| `evaluateAlertRules(prevReport?)` | Evaluate custom rules |
| `getEntry(id)` / `getAllEntries()` | Query entries |
| `findByHash(hash)` / `findByTag(tag)` | Look up entries |
| `getTotalBytes()` / `getUniqueBytes()` | Storage metrics |

### Storage Providers

| Provider | Description |
|----------|-------------|
| `FileSystemProvider` | Local file system with streaming walk |
| `S3Provider` | AWS S3 / MinIO / R2 (optional dep) |
| `MemoryProvider` | In-memory for testing |

### Utilities

- `hashContent(data)` — SHA-256 hash of buffer/string
- `formatBytes(bytes)` — Human-readable byte formatting
- `generateId()` — Generate unique ID
- `detectMimeType(fileName)` — MIME type from extension

## Requirements

- Node.js >= 18.0.0
- `@aws-sdk/client-s3` (optional, for S3 support)

## License

MIT
