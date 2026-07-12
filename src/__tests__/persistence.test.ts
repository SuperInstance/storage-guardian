import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  JsonFilePersistence,
  MemoryPersistence,
  saveScan,
} from '../index';
import { ScanRecord, StorageReport } from '../index';

function makeReport(overrides: Partial<StorageReport> = {}): StorageReport {
  return {
    generatedAt: Date.now(),
    source: 'test',
    totalEntries: 1,
    totalBytes: 10,
    uniqueBytes: 10,
    wastedBytes: 0,
    duplicateRatio: 0,
    duplicateGroups: [],
    budgetViolations: [],
    topConsumers: [],
    scanDurationMs: 5,
    ...overrides,
  };
}

function makeRecord(id: string, ts: number): ScanRecord {
  return {
    id,
    timestamp: ts,
    source: 'test',
    report: makeReport({ generatedAt: ts }),
    alerts: [],
  };
}

// ---------------------------------------------------------------------------
// JsonFilePersistence — real file-per-scan backend used by the CLI
// ---------------------------------------------------------------------------

describe('JsonFilePersistence', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'sg-persist-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('saves and loads a scan record round-trip', async () => {
    const backend = new JsonFilePersistence(dir);
    const record = makeRecord('abc', 1000);
    await backend.save(record);

    const loaded = await backend.load('abc');
    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe('abc');
    expect(loaded!.timestamp).toBe(1000);
    expect(loaded!.report.totalEntries).toBe(1);
  });

  it('returns null when loading a missing record', async () => {
    const backend = new JsonFilePersistence(dir);
    expect(await backend.load('does-not-exist')).toBeNull();
  });

  it('lists records sorted newest-first', async () => {
    const backend = new JsonFilePersistence(dir);
    await backend.save(makeRecord('a', 100));
    await backend.save(makeRecord('b', 300));
    await backend.save(makeRecord('c', 200));

    const all = await backend.list();
    expect(all.map((r) => r.id)).toEqual(['b', 'c', 'a']);
  });

  it('respects the limit option', async () => {
    const backend = new JsonFilePersistence(dir);
    for (let i = 0; i < 4; i++) {
      await backend.save(makeRecord(`r${i}`, 100 + i));
    }
    const limited = await backend.list({ limit: 2 });
    expect(limited).toHaveLength(2);
    // newest first -> r3, r2
    expect(limited.map((r) => r.id)).toEqual(['r3', 'r2']);
  });

  it('filters by the since option', async () => {
    const backend = new JsonFilePersistence(dir);
    await backend.save(makeRecord('old', 100));
    await backend.save(makeRecord('new', 500));

    const recent = await backend.list({ since: 200 });
    expect(recent.map((r) => r.id)).toEqual(['new']);
  });

  it('removes an existing record', async () => {
    const backend = new JsonFilePersistence(dir);
    await backend.save(makeRecord('kill', 100));

    expect(await backend.remove('kill')).toBe(true);
    expect(await backend.load('kill')).toBeNull();
  });

  it('returns false when removing a missing record', async () => {
    const backend = new JsonFilePersistence(dir);
    expect(await backend.remove('nope')).toBe(false);
  });

  it('ignores files that do not match the scan-*.json naming', async () => {
    const backend = new JsonFilePersistence(dir);
    await backend.save(makeRecord('real', 100));
    // Stray files that must not be parsed as records
    await writeFile(join(dir, 'junk.json'), '{not valid');
    await writeFile(join(dir, 'scan-corrupt.json'), '{not valid');
    await writeFile(join(dir, 'README.md'), 'hello');

    const all = await backend.list();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe('real');
  });

  it('returns an empty list when the directory does not exist', async () => {
    const backend = new JsonFilePersistence(join(dir, 'never-created'));
    expect(await backend.list()).toEqual([]);
  });

  it('works end-to-end with saveScan()', async () => {
    const backend = new JsonFilePersistence(dir);
    const record = await saveScan(makeReport(), [], backend);

    const loaded = await backend.load(record.id);
    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe(record.id);
  });
});

// ---------------------------------------------------------------------------
// MemoryPersistence — edge cases
// ---------------------------------------------------------------------------

describe('MemoryPersistence edge cases', () => {
  it('returns null for a missing id', async () => {
    const backend = new MemoryPersistence();
    expect(await backend.load('missing')).toBeNull();
  });

  it('removes and reports existence', async () => {
    const backend = new MemoryPersistence();
    await backend.save(makeRecord('x', 100));
    expect(await backend.remove('x')).toBe(true);
    expect(await backend.remove('x')).toBe(false);
  });

  it('filters by since', async () => {
    const backend = new MemoryPersistence();
    await backend.save(makeRecord('a', 100));
    await backend.save(makeRecord('b', 200));
    const recent = await backend.list({ since: 150 });
    expect(recent.map((r) => r.id)).toEqual(['b']);
  });
});
