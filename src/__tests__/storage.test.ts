import {
  StorageGuardian,
  MemoryProvider,
  formatBytes,
  hashContent,
  exportJson,
  exportPrometheus,
  exportSlack,
  exportMarkdown,
  evaluateBuiltInRules,
  duplicateRatioThreshold,
  budgetUsageAlert,
  MemoryPersistence,
  saveScan,
  analyzeTrend,
  compareReports,
  generateId,
} from '../index';
import { ScanRecord } from '../index';

// ---------------------------------------------------------------------------
// Core: Adding & Removing
// ---------------------------------------------------------------------------

describe('StorageGuardian — add & remove', () => {
  it('adds entries and tracks them', () => {
    const sg = new StorageGuardian();
    const entry = sg.add(Buffer.from('hello world'), { name: 'test.txt' });

    expect(entry.id).toBeDefined();
    expect(entry.sizeBytes).toBe(11);
    expect(entry.contentHash).toBeDefined();
    expect(sg.getEntry(entry.id)).toBe(entry);
  });

  it('removes entries', () => {
    const sg = new StorageGuardian();
    const entry = sg.add('data', { name: 'test.txt' });

    expect(sg.remove(entry.id)).toBe(true);
    expect(sg.getEntry(entry.id)).toBeUndefined();
  });

  it('returns false when removing non-existent entry', () => {
    const sg = new StorageGuardian();
    expect(sg.remove('nope')).toBe(false);
  });

  it('tracks total bytes', () => {
    const sg = new StorageGuardian();
    sg.add(Buffer.alloc(100), { name: 'a.bin' });
    sg.add(Buffer.alloc(200), { name: 'b.bin' });

    expect(sg.getTotalBytes()).toBe(300);
  });
});

// ---------------------------------------------------------------------------
// Core: Duplicate Detection
// ---------------------------------------------------------------------------

describe('duplicate detection', () => {
  it('detects duplicate content', () => {
    const sg = new StorageGuardian();
    const content = 'duplicate content here';
    sg.add(content, { name: 'file-a.txt' });
    sg.add(content, { name: 'file-b.txt' });

    const dupes = sg.findDuplicates();
    expect(dupes).toHaveLength(1);
    expect(dupes[0].entries).toHaveLength(2);
    expect(dupes[0].wastedBytes).toBe(content.length);
  });

  it('does not flag unique content as duplicate', () => {
    const sg = new StorageGuardian();
    sg.add('unique-a', { name: 'a.txt' });
    sg.add('unique-b', { name: 'b.txt' });

    expect(sg.findDuplicates()).toHaveLength(0);
  });

  it('detects duplicate alerts on add', () => {
    const sg = new StorageGuardian();
    sg.add('same', { name: 'a.txt' });
    sg.add('same', { name: 'b.txt' });

    const alerts = sg.getAlerts();
    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe('duplicate');
    expect(alerts[0].message).toContain('b.txt');
  });

  it('picks oldest entry as canonical', () => {
    const sg = new StorageGuardian();
    const first = sg.add('shared', { name: 'first.txt', id: 'first' });
    sg.add('shared', { name: 'second.txt', id: 'second' });

    const dupes = sg.findDuplicates();
    expect(dupes[0].canonical.id).toBe('first');
  });
});

// ---------------------------------------------------------------------------
// Core: Deduplication
// ---------------------------------------------------------------------------

describe('deduplication', () => {
  it('removes duplicates and increments refCount', () => {
    const sg = new StorageGuardian();
    sg.add('shared-content', { name: 'a.txt' });
    sg.add('shared-content', { name: 'b.txt' });
    sg.add('shared-content', { name: 'c.txt' });

    const removed = sg.deduplicate();
    expect(removed).toBe(2);
    expect(sg.getAllEntries()).toHaveLength(1);
    expect(sg.getAllEntries()[0].refCount).toBe(3);
  });

  it('preserves unique entries', () => {
    const sg = new StorageGuardian();
    sg.add('unique-1', { name: 'a.txt' });
    sg.add('unique-2', { name: 'b.txt' });

    const removed = sg.deduplicate();
    expect(removed).toBe(0);
    expect(sg.getAllEntries()).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Core: Budget Enforcement
// ---------------------------------------------------------------------------

describe('budget enforcement', () => {
  it('detects total storage budget violation', () => {
    const sg = new StorageGuardian();
    sg.setBudget({ maxTotalBytes: 50 });

    sg.add(Buffer.alloc(100), { name: 'oversized.bin' });

    const report = sg.generateReport();
    expect(report.budgetViolations.length).toBeGreaterThanOrEqual(1);
    expect(report.budgetViolations[0]).toContain('exceeds limit');
  });

  it('detects max entries violation', () => {
    const sg = new StorageGuardian();
    sg.setBudget({ maxTotalBytes: Infinity, maxEntries: 2 });

    sg.add('a', { name: 'a.txt' });
    sg.add('b', { name: 'b.txt' });
    sg.add('c', { name: 'c.txt' });

    const report = sg.generateReport();
    expect(report.budgetViolations).toContainEqual(
      expect.stringContaining('exceeds limit of 2'),
    );
  });

  it('detects single-entry size violation', () => {
    const sg = new StorageGuardian();
    sg.addBudget({ maxTotalBytes: Infinity, maxSingleEntryBytes: 50 });

    sg.add(Buffer.alloc(100), { name: 'big.bin' });

    const alerts = sg.getAlerts();
    const oversized = alerts.find((a) => a.type === 'oversized');
    expect(oversized).toBeDefined();
    expect(oversized!.message).toContain('big.bin');
  });

  it('flags oversized limit for duplicate content too', () => {
    // Regression: add() used to skip the maxSingleEntryBytes check when the
    // content already existed (early return on the duplicate path), so an
    // oversized duplicate produced no oversized alert.
    const sg = new StorageGuardian();
    sg.addBudget({ maxTotalBytes: Infinity, maxSingleEntryBytes: 50 });

    sg.add(Buffer.alloc(100), { name: 'big-first.bin' });
    sg.add(Buffer.alloc(100), { name: 'big-dup.bin' }); // same content -> duplicate

    const alerts = sg.getAlerts();
    const oversized = alerts.filter((a) => a.type === 'oversized');
    // Both the unique and the duplicate oversized entries must be flagged.
    expect(oversized).toHaveLength(2);
    expect(oversized.some((a) => a.message.includes('big-dup.bin'))).toBe(true);
    // The duplicate alert is still emitted alongside the oversized alert.
    expect(alerts.some((a) => a.type === 'duplicate')).toBe(true);
  });

  it('passes when within budget', () => {
    const sg = new StorageGuardian();
    sg.setBudget({ maxTotalBytes: 1000, maxEntries: 10 });

    sg.add(Buffer.alloc(50), { name: 'small.bin' });

    const report = sg.generateReport();
    expect(report.budgetViolations).toHaveLength(0);
  });

  it('detects duplicate ratio violation', () => {
    const sg = new StorageGuardian();
    sg.setBudget({ maxTotalBytes: Infinity, maxDuplicateRatio: 0.1 });

    sg.add('same-content', { name: 'a.txt' });
    sg.add('same-content', { name: 'b.txt' });
    sg.add('same-content', { name: 'c.txt' });

    const report = sg.generateReport();
    expect(report.budgetViolations).toContainEqual(
      expect.stringContaining('Duplicate ratio'),
    );
  });
});

// ---------------------------------------------------------------------------
// Core: Reporting
// ---------------------------------------------------------------------------

describe('reporting', () => {
  it('generates a comprehensive report', () => {
    const sg = new StorageGuardian();
    sg.add('file-a content', { name: 'a.txt', mimeType: 'text/plain' });
    sg.add('file-b content', { name: 'b.txt' });
    sg.add('file-a content', { name: 'a-copy.txt' });

    const report = sg.generateReport();
    expect(report.totalEntries).toBe(3);
    expect(report.totalBytes).toBeGreaterThan(0);
    expect(report.uniqueBytes).toBeLessThan(report.totalBytes);
    expect(report.wastedBytes).toBeGreaterThan(0);
    expect(report.duplicateRatio).toBeGreaterThan(0);
    expect(report.duplicateGroups).toHaveLength(1);
    expect(report.topConsumers.length).toBeGreaterThan(0);
    expect(report.scanDurationMs).toBeGreaterThanOrEqual(0);
    expect(report.source).toBe('memory');
  });
});

// ---------------------------------------------------------------------------
// Core: Querying
// ---------------------------------------------------------------------------

describe('querying', () => {
  it('finds entries by hash', () => {
    const sg = new StorageGuardian();
    const e = sg.add('findme', { name: 'test.txt' });

    const found = sg.findByHash(e.contentHash);
    expect(found).toHaveLength(1);
    expect(found[0].id).toBe(e.id);
  });

  it('finds entries by tag', () => {
    const sg = new StorageGuardian();
    sg.add('a', { name: 'a.txt', tags: ['doc', 'important'] });
    sg.add('b', { name: 'b.txt', tags: ['image'] });
    sg.add('c', { name: 'c.txt', tags: ['doc'] });

    const docs = sg.findByTag('doc');
    expect(docs).toHaveLength(2);
  });

  it('touches entries to update accessedAt', () => {
    const sg = new StorageGuardian();
    const entry = sg.add('data', { name: 'test.txt' });
    const originalAccess = entry.accessedAt;

    const start = Date.now();
    while (Date.now() === start) {}

    sg.touch(entry.id);
    expect(entry.accessedAt).toBeGreaterThanOrEqual(originalAccess);
  });
});

// ---------------------------------------------------------------------------
// Memory Provider
// ---------------------------------------------------------------------------

describe('MemoryProvider', () => {
  it('can scan entries', async () => {
    const provider = new MemoryProvider();
    provider.add('content-a', { name: 'a.txt' });
    provider.add('content-b', { name: 'b.txt' });

    const entries = [];
    for await (const entry of provider.scan()) {
      entries.push(entry);
    }

    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.name)).toContain('a.txt');
  });

  it('can read entries', async () => {
    const provider = new MemoryProvider();
    provider.add('hello', { name: 'test.txt' });

    const entries = [];
    for await (const entry of provider.scan()) {
      entries.push(entry);
    }

    const data = await provider.read(entries[0]);
    expect(data.toString()).toBe('hello');
  });

  it('works with StorageGuardian.scan()', async () => {
    const provider = new MemoryProvider();
    provider.add('data-1', { name: 'a.txt' });
    provider.add('data-2', { name: 'b.txt' });
    provider.add('data-1', { name: 'dup.txt' });

    const sg = new StorageGuardian(provider);
    const count = await sg.scan();

    expect(count).toBe(3);
    const report = sg.generateReport();
    expect(report.duplicateGroups).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Export Formatters
// ---------------------------------------------------------------------------

describe('export formats', () => {
  function setupGuardian() {
    const sg = new StorageGuardian();
    sg.add('file-a content here', { name: 'a.txt', mimeType: 'text/plain' });
    sg.add('file-b content here', { name: 'b.txt' });
    sg.add('file-a content here', { name: 'a-copy.txt' });
    return sg;
  }

  it('exports JSON', () => {
    const sg = setupGuardian();
    const report = sg.generateReport();
    const output = exportJson(report, sg.getAlerts());

    const parsed = JSON.parse(output);
    expect(parsed.summary.totalEntries).toBe(3);
    expect(parsed.summary.duplicateGroups).toBe(1);
    expect(parsed.alerts).toBeDefined();
    expect(parsed.topConsumers).toBeDefined();
  });

  it('exports JSON compact', () => {
    const sg = setupGuardian();
    const report = sg.generateReport();
    const output = exportJson(report, sg.getAlerts(), { compact: true });

    expect(output).not.toContain('\n  ');
    const parsed = JSON.parse(output);
    expect(parsed.summary).toBeDefined();
  });

  it('exports Prometheus metrics', () => {
    const sg = setupGuardian();
    const report = sg.generateReport();
    const output = exportPrometheus(report);

    expect(output).toContain('storage_guardian_total_entries 3');
    expect(output).toContain('# TYPE storage_guardian_total_bytes gauge');
    expect(output).toContain('storage_guardian_duplicate_ratio');
  });

  it('exports Prometheus with custom prefix', () => {
    const sg = setupGuardian();
    const report = sg.generateReport();
    const output = exportPrometheus(report, { prefix: 'my_app' });

    expect(output).toContain('my_app_total_entries 3');
  });

  it('exports Slack message', () => {
    const sg = setupGuardian();
    const report = sg.generateReport();
    const output = exportSlack(report, sg.getAlerts());

    expect(output).toContain('*Storage Guardian Report*');
    expect(output).toContain('Total:');
  });

  it('exports Markdown report', () => {
    const sg = setupGuardian();
    const report = sg.generateReport();
    const output = exportMarkdown(report, sg.getAlerts());

    expect(output).toContain('# Storage Guardian Report');
    expect(output).toContain('| Metric | Value |');
    expect(output).toContain('Duplicate Groups');
  });
});

// ---------------------------------------------------------------------------
// Alerting
// ---------------------------------------------------------------------------

describe('alerting', () => {
  it('duplicateRatioThreshold triggers', () => {
    const rule = duplicateRatioThreshold(0.1);
    const sg = new StorageGuardian();
    sg.add('same', { name: 'a.txt' });
    sg.add('same', { name: 'b.txt' });
    sg.add('unique', { name: 'c.txt' });

    const report = sg.generateReport();
    expect(rule.condition({ report })).toBe(true);
  });

  it('evaluateBuiltInRules returns alerts for high duplicate ratio', () => {
    const sg = new StorageGuardian();
    sg.add('same', { name: 'a.txt' });
    sg.add('same', { name: 'b.txt' });
    sg.add('same', { name: 'c.txt' });

    const report = sg.generateReport();
    const alerts = evaluateBuiltInRules(report);

    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts.some((a) => a.type === 'duplicate')).toBe(true);
  });

  it('evaluateBuiltInRules with budget', () => {
    const sg = new StorageGuardian();
    sg.add(Buffer.alloc(100), { name: 'a.bin' });

    const report = sg.generateReport();
    const alerts = evaluateBuiltInRules(report, undefined, {
      maxTotalBytes: 50,
    });

    expect(alerts.some((a) => a.type === 'budget')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

describe('persistence', () => {
  it('saves and loads scans', async () => {
    const backend = new MemoryPersistence();
    const sg = new StorageGuardian();
    sg.add('test', { name: 'a.txt' });

    const report = sg.generateReport();
    const alerts = sg.getAlerts();
    const record = await saveScan(report, alerts, backend);

    expect(record.id).toBeDefined();

    const loaded = await backend.load(record.id);
    expect(loaded).not.toBeNull();
    expect(loaded!.report.totalEntries).toBe(1);
  });

  it('lists scans', async () => {
    const backend = new MemoryPersistence();
    const sg = new StorageGuardian();

    for (let i = 0; i < 5; i++) {
      sg.add(`content-${i}`, { name: `file-${i}.txt` });
      const report = sg.generateReport();
      await saveScan(report, [], backend);
    }

    const all = await backend.list();
    expect(all).toHaveLength(5);

    const limited = await backend.list({ limit: 2 });
    expect(limited).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Trend Analysis
// ---------------------------------------------------------------------------

describe('trend analysis', () => {
  it('analyzes trends from multiple scans', async () => {
    const backend = new MemoryPersistence();
    const now = Date.now();

    // Scan 1: low duplicates
    await backend.save({
      id: 'scan-1',
      timestamp: now - 30 * 24 * 60 * 60 * 1000,
      source: 'test',
      report: {
        generatedAt: now - 30 * 24 * 60 * 60 * 1000,
        source: 'test',
        totalEntries: 100,
        totalBytes: 10000,
        uniqueBytes: 9200,
        wastedBytes: 800,
        duplicateRatio: 0.08,
        duplicateGroups: [],
        budgetViolations: [],
        topConsumers: [],
        scanDurationMs: 100,
      },
      alerts: [],
    });

    // Scan 2: higher duplicates
    await backend.save({
      id: 'scan-2',
      timestamp: now,
      source: 'test',
      report: {
        generatedAt: now,
        source: 'test',
        totalEntries: 150,
        totalBytes: 15000,
        uniqueBytes: 12900,
        wastedBytes: 2100,
        duplicateRatio: 0.14,
        duplicateGroups: [],
        budgetViolations: [],
        topConsumers: [],
        scanDurationMs: 120,
      },
      alerts: [],
    });

    const records = await backend.list();
    const trend = analyzeTrend(records);

    expect(trend).not.toBeNull();
    expect(trend!.summary.duplicateRatioTrend).toBe('increasing');
    expect(trend!.summary.duplicateRatioDelta).toBeCloseTo(0.06, 1);
    expect(trend!.dataPoints).toHaveLength(2);
  });

  it('returns null with insufficient data', async () => {
    const backend = new MemoryPersistence();
    const records = await backend.list();
    const trend = analyzeTrend(records);
    expect(trend).toBeNull();
  });

  it('compares two reports', () => {
    const prev: any = {
      generatedAt: 1000,
      source: 'test',
      totalEntries: 50,
      totalBytes: 5000,
      uniqueBytes: 4500,
      wastedBytes: 500,
      duplicateRatio: 0.1,
      duplicateGroups: [],
      budgetViolations: [],
      topConsumers: [],
      scanDurationMs: 50,
    };

    const curr: any = {
      generatedAt: 2000,
      source: 'test',
      totalEntries: 75,
      totalBytes: 8000,
      uniqueBytes: 6400,
      wastedBytes: 1600,
      duplicateRatio: 0.2,
      duplicateGroups: [],
      budgetViolations: [],
      topConsumers: [],
      scanDurationMs: 60,
    };

    const output = compareReports(prev, curr);
    expect(output).toContain('Report Comparison');
    expect(output).toContain('75');
    expect(output).toContain('+25');
  });
});

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

describe('utilities', () => {
  it('formatBytes handles various sizes', () => {
    expect(formatBytes(50)).toBe('50B');
    expect(formatBytes(1024)).toBe('1.0KB');
    expect(formatBytes(1024 * 1024)).toBe('1.0MB');
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1.0GB');
  });

  it('hashContent produces consistent hashes', () => {
    const h1 = hashContent('test');
    const h2 = hashContent('test');
    const h3 = hashContent('different');

    expect(h1).toBe(h2);
    expect(h1).not.toBe(h3);
    expect(h1).toHaveLength(64);
  });

  it('generateId produces unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });
});
