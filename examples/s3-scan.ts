/**
 * Example: S3 bucket scan
 *
 * npx ts-node examples/s3-scan.ts --bucket my-bucket --prefix data/
 */

import {
  StorageGuardian,
  S3Provider,
  exportJson,
  evaluateBuiltInRules,
} from '../src';

async function main() {
  const args = process.argv.slice(2);
  const bucket = args[args.indexOf('--bucket') + 1] ?? 'my-bucket';
  const prefix = args[args.indexOf('--prefix') + 1] ?? '';

  const provider = new S3Provider({
    bucket,
    prefix,
    region: process.env.AWS_REGION ?? 'us-east-1',
  });

  const guardian = new StorageGuardian(provider);

  const count = await guardian.scan();
  console.log(`Scanned ${count} S3 objects\n`);

  const report = guardian.generateReport();
  const alerts = evaluateBuiltInRules(report);

  console.log(exportJson(report, alerts));
}

main().catch(console.error);
