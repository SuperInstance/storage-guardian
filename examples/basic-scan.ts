/**
 * Example: Basic file system scan
 *
 * npx ts-node examples/basic-scan.ts ./some/directory
 */

import { resolve } from 'node:path';
import {
  StorageGuardian,
  FileSystemProvider,
  exportMarkdown,
  evaluateBuiltInRules,
} from '../src';

async function main() {
  const scanPath = process.argv[2] ?? '.';
  const resolvedPath = resolve(scanPath);

  console.log(`Scanning: ${resolvedPath}\n`);

  const provider = new FileSystemProvider({
    rootPath: resolvedPath,
    followSymlinks: false,
    includeHidden: false,
    excludePatterns: ['node_modules', '.git', 'dist', 'coverage'],
  });

  const guardian = new StorageGuardian(provider);
  guardian.setBudget({
    maxTotalBytes: 1024 * 1024 * 500, // 500MB
    maxSingleEntryBytes: 1024 * 1024 * 50, // 50MB
    maxDuplicateRatio: 0.15, // 15%
  });

  const count = await guardian.scan();
  console.log(`Scanned ${count} files\n`);

  const report = guardian.generateReport();
  const alerts = [
    ...guardian.getAlerts(),
    ...evaluateBuiltInRules(report),
  ];

  console.log(exportMarkdown(report, alerts));
}

main().catch(console.error);
