import {
  StorageGuardian,
  formatDate,
  detectMimeType,
  recordToDataPoint,
} from '../index';
import { globToRegex, isExcluded } from '../core/utils';

// ---------------------------------------------------------------------------
// detectMimeType — extension mapping branches
// ---------------------------------------------------------------------------

describe('detectMimeType', () => {
  it('maps common extensions', () => {
    expect(detectMimeType('a.txt')).toBe('text/plain');
    expect(detectMimeType('photo.JPG')).toBe('image/jpeg'); // case-insensitive
    expect(detectMimeType('app.js')).toBe('application/javascript');
    expect(detectMimeType('data.json')).toBe('application/json');
    expect(detectMimeType('config.yaml')).toBe('text/yaml');
  });

  it('falls back to octet-stream for unknown / no extension', () => {
    expect(detectMimeType('archive.xyz')).toBe('application/octet-stream');
    expect(detectMimeType('noext')).toBe('application/octet-stream');
  });
});

// ---------------------------------------------------------------------------
// formatDate
// ---------------------------------------------------------------------------

describe('formatDate', () => {
  it('produces an ISO 8601 string', () => {
    const out = formatDate(0);
    expect(out).toBe('1970-01-01T00:00:00.000Z');
  });
});

// ---------------------------------------------------------------------------
// globToRegex / isExcluded — used by FileSystemProvider exclusion
// ---------------------------------------------------------------------------

describe('globToRegex', () => {
  it('matches literal names exactly, case-insensitively', () => {
    const re = globToRegex('node_modules');
    expect(re.test('node_modules')).toBe(true);
    expect(re.test('Node_Modules')).toBe(true);
    expect(re.test('xnode_modules')).toBe(false);
  });

  it('treats * as a wildcard', () => {
    const re = globToRegex('*.log');
    expect(re.test('app.log')).toBe(true);
    expect(re.test('debug.log')).toBe(true);
    expect(re.test('app.txt')).toBe(false);
  });
});

describe('isExcluded', () => {
  it('matches by file name', () => {
    expect(isExcluded('/proj/node_modules', ['node_modules'])).toBe(true);
    expect(isExcluded('/proj/src/index.ts', ['node_modules'])).toBe(false);
  });

  it('matches multiple patterns', () => {
    expect(isExcluded('/proj/.env', ['.env', '.git'])).toBe(true);
    expect(isExcluded('/proj/.git', ['.env', '.git'])).toBe(true);
    expect(isExcluded('/proj/src/main.ts', ['.env', '.git'])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// StorageGuardian — additional query/metric branches
// ---------------------------------------------------------------------------

describe('StorageGuardian metrics & queries', () => {
  it('getUniqueBytes counts one entry per content hash', () => {
    const sg = new StorageGuardian();
    sg.add('shared', { name: 'a.txt' });
    sg.add('shared', { name: 'b.txt' }); // duplicate hash
    sg.add('other', { name: 'c.txt' });

    // 2 unique hashes; 'shared' (6 bytes) + 'other' (5 bytes)
    expect(sg.getUniqueBytes()).toBe('shared'.length + 'other'.length);
  });

  it('touch returns false for a missing entry', () => {
    const sg = new StorageGuardian();
    expect(sg.touch('no-such-id')).toBe(false);
  });

  it('findByHash returns empty for an unknown hash', () => {
    const sg = new StorageGuardian();
    expect(sg.findByHash('deadbeef')).toEqual([]);
  });

  it('findByTag returns empty when nothing matches', () => {
    const sg = new StorageGuardian();
    sg.add('x', { name: 'x.txt', tags: ['a'] });
    expect(sg.findByTag('zzz')).toEqual([]);
  });

  it('setProvider updates the report source', () => {
    const sg = new StorageGuardian();
    sg.setProvider({
      name: 'custom-store',
      async *scan() { /* empty */ },
      async read() { return Buffer.alloc(0); },
      async exists() { return false; },
      async stat() { return null; },
    });
    expect(sg.generateReport().source).toBe('custom-store');
    expect(sg.getProvider()?.name).toBe('custom-store');
  });

  it('clearAlerts empties the alert list', () => {
    const sg = new StorageGuardian();
    sg.add('x', { name: 'a.txt' });
    sg.add('x', { name: 'b.txt' }); // duplicate alert
    expect(sg.getAlerts().length).toBeGreaterThan(0);
    sg.clearAlerts();
    expect(sg.getAlerts()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// recordToDataPoint
// ---------------------------------------------------------------------------

describe('recordToDataPoint', () => {
  it('maps a scan record onto a trend data point', () => {
    const sg = new StorageGuardian();
    sg.add('dup', { name: 'a.txt' });
    sg.add('dup', { name: 'b.txt' });
    const report = sg.generateReport();

    const dp = recordToDataPoint({
      id: 'r1',
      timestamp: 12345,
      source: 'test',
      report,
      alerts: [],
    });

    expect(dp.timestamp).toBe(12345);
    expect(dp.totalEntries).toBe(report.totalEntries);
    expect(dp.totalBytes).toBe(report.totalBytes);
    expect(dp.uniqueBytes).toBe(report.uniqueBytes);
    expect(dp.wastedBytes).toBe(report.wastedBytes);
    expect(dp.duplicateRatio).toBe(report.duplicateRatio);
    expect(dp.duplicateGroupCount).toBe(report.duplicateGroups.length);
  });
});
