/**
 * Example: Programmatic API with trend tracking
 */

import {
  StorageGuardian,
  MemoryProvider,
  JsonFilePersistence,
  saveScan,
  exportMarkdown,
  analyzeTrend,
  evaluateBuiltInRules,
} from '../src';

async function main() {
  const persistence = new JsonFilePersistence('./scan-history');

  // Simulate scan 1
  const provider1 = new MemoryProvider();
  provider1.add('file-a content', { name: 'a.txt' });
  provider1.add('file-b content', { name: 'b.txt' });
  provider1.add('file-a content', { name: 'copy-of-a.txt' });

  const sg1 = new StorageGuardian(provider1);
  await sg1.scan();
  const report1 = sg1.generateReport();
  const record1 = await saveScan(report1, sg1.getAlerts(), persistence);
  console.log(`Scan 1 saved: ${record1.id}`);

  // Simulate scan 2 (more duplicates)
  const provider2 = new MemoryProvider();
  provider2.add('file-a content', { name: 'a.txt' });
  provider2.add('file-b content', { name: 'b.txt' });
  provider2.add('file-a content', { name: 'copy-of-a.txt' });
  provider2.add('file-a content', { name: 'another-copy.txt' });
  provider2.add('file-b content', { name: 'dup-b.txt' });

  const sg2 = new StorageGuardian(provider2);
  await sg2.scan();
  const report2 = sg2.generateReport();
  const record2 = await saveScan(report2, sg2.getAlerts(), persistence);
  console.log(`Scan 2 saved: ${record2.id}`);

  // Analyze trends
  const records = await persistence.list();
  const trend = analyzeTrend(records);

  if (trend) {
    console.log('\n--- Trend Analysis ---');
    console.log(`Duplicate ratio trend: ${trend.summary.duplicateRatioTrend}`);
    console.log(`Delta: ${(trend.summary.duplicateRatioDelta * 100).toFixed(1)}%`);
    if (trend.alerts.length > 0) {
      console.log('Alerts:');
      trend.alerts.forEach((a) => console.log(`  ${a}`));
    }
  }

  // Generate full report
  const alerts = evaluateBuiltInRules(report2, report1);
  console.log('\n' + exportMarkdown(report2, alerts, trend));
}

main().catch(console.error);
