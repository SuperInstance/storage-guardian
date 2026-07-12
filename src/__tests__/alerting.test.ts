import {
  StorageGuardian,
  oversizedFileAlert,
  wastedBytesThreshold,
  budgetToAlertRules,
  duplicateGrowthAlert,
  budgetUsageAlert,
  duplicateRatioThreshold,
  evaluateBuiltInRules,
} from '../index';
import { StorageReport, StorageEntry } from '../index';

function makeReport(overrides: Partial<StorageReport> = {}): StorageReport {
  return {
    generatedAt: 1000,
    source: 'test',
    totalEntries: 2,
    totalBytes: 200,
    uniqueBytes: 100,
    wastedBytes: 100,
    duplicateRatio: 0.5,
    duplicateGroups: [],
    budgetViolations: [],
    topConsumers: [],
    scanDurationMs: 5,
    ...overrides,
  };
}

function entry(sizeBytes: number): StorageEntry {
  return {
    id: 'e1',
    contentHash: 'h',
    sizeBytes,
    name: 'big.bin',
    createdAt: 1,
    accessedAt: 1,
    refCount: 1,
  };
}

describe('oversizedFileAlert', () => {
  it('triggers when a top consumer exceeds the limit', () => {
    const rule = oversizedFileAlert(50);
    const report = makeReport({ topConsumers: [entry(100)] });
    expect(rule.condition({ report })).toBe(true);
    expect(rule.type).toBe('oversized');
    expect(rule.severity).toBe('warning');
  });

  it('does not trigger when all consumers are within the limit', () => {
    const rule = oversizedFileAlert(50);
    const report = makeReport({ topConsumers: [entry(40)] });
    expect(rule.condition({ report })).toBe(false);
  });
});

describe('wastedBytesThreshold', () => {
  it('triggers when wasted bytes exceed the threshold', () => {
    const rule = wastedBytesThreshold(50);
    const report = makeReport({ wastedBytes: 100 });
    expect(rule.condition({ report })).toBe(true);
  });

  it('does not trigger when wasted bytes are within the threshold', () => {
    const rule = wastedBytesThreshold(200);
    const report = makeReport({ wastedBytes: 100 });
    expect(rule.condition({ report })).toBe(false);
  });

  it('escalates severity for very large thresholds', () => {
    expect(wastedBytesThreshold(2 * 1024 * 1024 * 1024).severity).toBe('critical');
    expect(wastedBytesThreshold(1024).severity).toBe('warning');
  });
});

describe('budgetToAlertRules', () => {
  it('creates a rule for each configured budget field', () => {
    const rules = budgetToAlertRules({
      maxTotalBytes: 1000,
      maxSingleEntryBytes: 100,
      maxDuplicateRatio: 0.1,
    });
    expect(rules).toHaveLength(3);
  });

  it('creates no rules for an empty budget', () => {
    expect(budgetToAlertRules({ maxTotalBytes: Infinity })).toHaveLength(1);
  });
});

describe('budgetUsageAlert', () => {
  it('triggers when usage exceeds the warn percentage', () => {
    const rule = budgetUsageAlert(1000, 80);
    const report = makeReport({ totalBytes: 900 }); // 90% of 1000
    expect(rule.condition({ report })).toBe(true);
  });

  it('does not trigger below the warn percentage', () => {
    const rule = budgetUsageAlert(1000, 80);
    const report = makeReport({ totalBytes: 500 }); // 50%
    expect(rule.condition({ report })).toBe(false);
  });
});

describe('duplicateGrowthAlert', () => {
  it('triggers when duplicate ratio grows beyond the threshold', () => {
    const rule = duplicateGrowthAlert(50);
    const ctx = {
      report: makeReport({ duplicateRatio: 0.3 }),
      previousReport: makeReport({ duplicateRatio: 0.1 }),
    };
    // growth = (0.3 - 0.1) / 0.1 = 2.0 -> 200% > 50%
    expect(rule.condition(ctx)).toBe(true);
  });

  it('does not trigger without a previous report', () => {
    const rule = duplicateGrowthAlert(50);
    expect(rule.condition({ report: makeReport() })).toBe(false);
  });

  it('handles a previous ratio of zero as a small absolute threshold', () => {
    const rule = duplicateGrowthAlert(50);
    const ctx = {
      report: makeReport({ duplicateRatio: 0.06 }),
      previousReport: makeReport({ duplicateRatio: 0 }),
    };
    expect(rule.condition(ctx)).toBe(true);

    const ctxLow = {
      report: makeReport({ duplicateRatio: 0.02 }),
      previousReport: makeReport({ duplicateRatio: 0 }),
    };
    expect(rule.condition(ctxLow)).toBe(false);
  });
});

describe('duplicateRatioThreshold severity', () => {
  it('is critical above 25% and warning otherwise', () => {
    expect(duplicateRatioThreshold(0.3).severity).toBe('critical');
    expect(duplicateRatioThreshold(0.1).severity).toBe('warning');
  });
});

describe('evaluateBuiltInRules with previous report', () => {
  it('can emit a trend alert on growth', () => {
    const prev = makeReport({ duplicateRatio: 0.1 });
    const curr = makeReport({ duplicateRatio: 0.3 });
    const alerts = evaluateBuiltInRules(curr, prev);
    expect(alerts.some((a) => a.type === 'trend')).toBe(true);
  });
});

describe('StorageGuardian.evaluateAlertRules', () => {
  it('evaluates custom rules and pushes alerts', () => {
    const sg = new StorageGuardian();
    sg.addAlertRule({
      type: 'budget',
      severity: 'critical',
      messageTemplate: 'too many entries: {totalEntries}',
      condition: (ctx) => ctx.report.totalEntries > 1,
    });
    sg.add('a', { name: 'a.txt' });
    sg.add('b', { name: 'b.txt' });

    const alerts = sg.evaluateAlertRules();
    expect(alerts).toHaveLength(1);
    expect(alerts[0].message).toContain('too many entries: 2');
    // The alert is also retained on the guardian
    expect(sg.getAlerts().some((a) => a.message.includes('too many entries'))).toBe(true);
  });

  it('skips a rule whose condition throws without crashing', () => {
    const sg = new StorageGuardian();
    sg.addAlertRule({
      type: 'budget',
      severity: 'warning',
      messageTemplate: 'broken',
      condition: () => {
        throw new Error('boom');
      },
    });
    expect(sg.evaluateAlertRules()).toEqual([]);
  });
});
