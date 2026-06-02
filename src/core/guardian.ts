/**
 * @superinstance/storage-guardian — Core StorageGuardian (v0.2.0)
 *
 * Content-addressable storage with duplicate detection, deduplication,
 * budget enforcement, alerting, and pluggable storage adapters.
 */

import { createHash } from 'node:crypto';
import {
  StorageEntry,
  DuplicateGroup,
  StorageBudget,
  StorageReport,
  StorageAlert,
  StorageProvider,
  AlertRule,
  AlertContext,
} from './types';
import { hashContent, formatBytes, generateId } from './utils';

// ---------------------------------------------------------------------------
// StorageGuardian class
// ---------------------------------------------------------------------------

export class StorageGuardian {
  private entries: Map<string, StorageEntry> = new Map();
  private hashIndex: Map<string, string[]> = new Map();
  private budgets: StorageBudget[] = [];
  private alerts: StorageAlert[] = [];
  private alertRules: AlertRule[] = [];
  private provider: StorageProvider | null = null;
  private source: string = 'memory';

  constructor(provider?: StorageProvider) {
    if (provider) {
      this.provider = provider;
      this.source = provider.name;
    }
  }

  // ----- Provider-based scanning --------------------------------------------

  /**
   * Scan a storage provider and ingest all entries.
   * Returns the number of entries discovered.
   */
  async scan(): Promise<number> {
    if (!this.provider) {
      throw new Error('No storage provider configured. Pass a provider to the constructor.');
    }

    let count = 0;
    for await (const entry of this.provider.scan()) {
      // Check if we already have this content hash
      const existingIds = this.hashIndex.get(entry.contentHash);
      if (existingIds && existingIds.length > 0) {
        const existing = this.entries.get(existingIds[0]);
        if (existing) {
          this.alerts.push({
            type: 'duplicate',
            severity: 'info',
            message: `Duplicate content: "${entry.name}" matches "${existing.name}" (${formatBytes(entry.sizeBytes)})`,
            entryId: entry.id,
            entryName: entry.name,
            details: { contentHash: entry.contentHash, existingId: existing.id },
            timestamp: Date.now(),
          });
        }
      }

      this.entries.set(entry.id, entry);
      if (!this.hashIndex.has(entry.contentHash)) {
        this.hashIndex.set(entry.contentHash, []);
      }
      this.hashIndex.get(entry.contentHash)!.push(entry.id);
      count++;

      // Check oversized alerts
      for (const budget of this.budgets) {
        if (budget.maxSingleEntryBytes && entry.sizeBytes > budget.maxSingleEntryBytes) {
          this.alerts.push({
            type: 'oversized',
            severity: 'warning',
            message: `Entry "${entry.name}" (${formatBytes(entry.sizeBytes)}) exceeds single-entry limit of ${formatBytes(budget.maxSingleEntryBytes)}`,
            entryId: entry.id,
            entryName: entry.name,
            timestamp: Date.now(),
          });
        }
      }
    }

    return count;
  }

  // ----- Adding / Removing (in-memory / v0.1.0 compat) ----------------------

  /**
   * Add content to storage. If content with the same hash already exists,
   * creates a logical reference and generates a duplicate alert.
   */
  add(
    content: Buffer | string,
    opts: {
      name: string;
      mimeType?: string;
      tags?: string[];
      id?: string;
    },
  ): StorageEntry {
    const data = typeof content === 'string' ? Buffer.from(content) : content;
    const contentHash = hashContent(data);
    const entryId = opts.id ?? generateId();

    const existingIds = this.hashIndex.get(contentHash);
    if (existingIds && existingIds.length > 0) {
      const existing = this.entries.get(existingIds[0]);
      if (existing) {
        const entry: StorageEntry = {
          id: entryId,
          contentHash,
          sizeBytes: data.length,
          mimeType: opts.mimeType,
          name: opts.name,
          tags: opts.tags,
          createdAt: Date.now(),
          accessedAt: Date.now(),
          refCount: 1,
        };
        this.entries.set(entryId, entry);
        this.hashIndex.get(contentHash)!.push(entryId);

        this.alerts.push({
          type: 'duplicate',
          severity: 'info',
          message: `Duplicate content detected: "${opts.name}" matches "${existing.name}" (${formatBytes(data.length)})`,
          entryId,
          entryName: opts.name,
          details: { contentHash, existingId: existing.id, sizeBytes: data.length },
          timestamp: Date.now(),
        });

        return entry;
      }
    }

    const entry: StorageEntry = {
      id: entryId,
      contentHash,
      sizeBytes: data.length,
      mimeType: opts.mimeType,
      name: opts.name,
      tags: opts.tags,
      createdAt: Date.now(),
      accessedAt: Date.now(),
      refCount: 1,
    };

    this.entries.set(entryId, entry);
    if (!this.hashIndex.has(contentHash)) {
      this.hashIndex.set(contentHash, []);
    }
    this.hashIndex.get(contentHash)!.push(entryId);

    for (const budget of this.budgets) {
      if (budget.maxSingleEntryBytes && entry.sizeBytes > budget.maxSingleEntryBytes) {
        this.alerts.push({
          type: 'oversized',
          severity: 'warning',
          message: `Entry "${entry.name}" (${formatBytes(entry.sizeBytes)}) exceeds single-entry limit of ${formatBytes(budget.maxSingleEntryBytes)}`,
          entryId,
          entryName: entry.name,
          timestamp: Date.now(),
        });
      }
    }

    return entry;
  }

  remove(entryId: string): boolean {
    const entry = this.entries.get(entryId);
    if (!entry) return false;

    this.entries.delete(entryId);

    const hashEntries = this.hashIndex.get(entry.contentHash);
    if (hashEntries) {
      const idx = hashEntries.indexOf(entryId);
      if (idx >= 0) hashEntries.splice(idx, 1);
      if (hashEntries.length === 0) {
        this.hashIndex.delete(entry.contentHash);
      }
    }

    return true;
  }

  touch(entryId: string): boolean {
    const entry = this.entries.get(entryId);
    if (!entry) return false;
    entry.accessedAt = Date.now();
    return true;
  }

  // ----- Budget management --------------------------------------------------

  setBudget(budget: StorageBudget): void {
    this.budgets = [budget];
  }

  addBudget(budget: StorageBudget): void {
    this.budgets.push(budget);
  }

  // ----- Alert rules --------------------------------------------------------

  addAlertRule(rule: AlertRule): void {
    this.alertRules.push(rule);
  }

  // ----- Duplicate detection ------------------------------------------------

  findDuplicates(): DuplicateGroup[] {
    const groups: DuplicateGroup[] = [];

    for (const [hash, entryIds] of this.hashIndex) {
      if (entryIds.length <= 1) continue;

      const entries = entryIds
        .map((id) => this.entries.get(id)!)
        .filter(Boolean);

      if (entries.length <= 1) continue;

      const canonical = this.entries.get(entryIds[0])!;

      groups.push({
        contentHash: hash,
        wastedBytes: canonical.sizeBytes * (entries.length - 1),
        entries,
        canonical,
      });
    }

    return groups.sort((a, b) => b.wastedBytes - a.wastedBytes);
  }

  deduplicate(): number {
    const groups = this.findDuplicates();
    let removed = 0;

    for (const group of groups) {
      const toRemove = group.entries.filter((e) => e.id !== group.canonical.id);
      for (const entry of toRemove) {
        this.remove(entry.id);
        group.canonical.refCount++;
        removed++;
      }
    }

    return removed;
  }

  // ----- Reporting ----------------------------------------------------------

  generateReport(): StorageReport {
    const start = Date.now();
    const allEntries = Array.from(this.entries.values());
    const duplicates = this.findDuplicates();
    const totalBytes = allEntries.reduce((s, e) => s + e.sizeBytes, 0);
    const uniqueHashes = new Set(allEntries.map((e) => e.contentHash));
    const uniqueBytes = Array.from(uniqueHashes)
      .map((h) => this.hashIndex.get(h)?.[0])
      .filter(Boolean)
      .map((id) => this.entries.get(id!)!.sizeBytes)
      .reduce((s, b) => s + b, 0);
    const wastedBytes = totalBytes - uniqueBytes;

    const violations: string[] = [];
    for (const budget of this.budgets) {
      if (totalBytes > budget.maxTotalBytes) {
        violations.push(
          `Total storage ${formatBytes(totalBytes)} exceeds limit of ${formatBytes(budget.maxTotalBytes)}`,
        );
      }
      if (budget.maxEntries && allEntries.length > budget.maxEntries) {
        violations.push(
          `Total entries (${allEntries.length}) exceeds limit of ${budget.maxEntries}`,
        );
      }
      if (budget.maxDuplicateCount) {
        const dupeCount = duplicates.reduce((s, g) => s + g.entries.length - 1, 0);
        if (dupeCount > budget.maxDuplicateCount) {
          violations.push(
            `Duplicate count (${dupeCount}) exceeds limit of ${budget.maxDuplicateCount}`,
          );
        }
      }
      if (budget.maxDuplicateRatio) {
        const ratio = totalBytes > 0 ? wastedBytes / totalBytes : 0;
        if (ratio > budget.maxDuplicateRatio) {
          violations.push(
            `Duplicate ratio (${(ratio * 100).toFixed(1)}%) exceeds limit of ${(budget.maxDuplicateRatio * 100).toFixed(1)}%`,
          );
        }
      }
    }

    const topConsumers = [...allEntries]
      .sort((a, b) => b.sizeBytes - a.sizeBytes)
      .slice(0, 10);

    return {
      generatedAt: Date.now(),
      source: this.source,
      totalEntries: allEntries.length,
      totalBytes,
      uniqueBytes,
      wastedBytes,
      duplicateRatio: totalBytes > 0 ? wastedBytes / totalBytes : 0,
      duplicateGroups: duplicates,
      budgetViolations: violations,
      topConsumers,
      scanDurationMs: Date.now() - start,
    };
  }

  // ----- Evaluate custom alert rules ----------------------------------------

  evaluateAlertRules(previousReport?: StorageReport): StorageAlert[] {
    const report = this.generateReport();
    const newAlerts: StorageAlert[] = [];

    for (const rule of this.alertRules) {
      const ctx: AlertContext = { report, previousReport };
      try {
        if (rule.condition(ctx)) {
          newAlerts.push({
            type: rule.type === '*' ? 'budget' : rule.type,
            severity: rule.severity,
            message: rule.messageTemplate
              .replace('{duplicateRatio}', `${(report.duplicateRatio * 100).toFixed(1)}%`)
              .replace('{totalBytes}', formatBytes(report.totalBytes))
              .replace('{wastedBytes}', formatBytes(report.wastedBytes))
              .replace('{totalEntries}', String(report.totalEntries)),
            timestamp: Date.now(),
          });
        }
      } catch {
        // Skip broken rules
      }
    }

    this.alerts.push(...newAlerts);
    return newAlerts;
  }

  // ----- Querying -----------------------------------------------------------

  getAlerts(): StorageAlert[] {
    return [...this.alerts];
  }

  clearAlerts(): void {
    this.alerts = [];
  }

  getEntry(id: string): StorageEntry | undefined {
    return this.entries.get(id);
  }

  getAllEntries(): StorageEntry[] {
    return Array.from(this.entries.values());
  }

  findByHash(contentHash: string): StorageEntry[] {
    const ids = this.hashIndex.get(contentHash) ?? [];
    return ids.map((id) => this.entries.get(id)!).filter(Boolean);
  }

  findByTag(tag: string): StorageEntry[] {
    return this.getAllEntries().filter((e) => e.tags?.includes(tag));
  }

  getTotalBytes(): number {
    return this.getAllEntries().reduce((s, e) => s + e.sizeBytes, 0);
  }

  getUniqueBytes(): number {
    const seen = new Set<string>();
    let total = 0;
    for (const entry of this.entries.values()) {
      if (!seen.has(entry.contentHash)) {
        seen.add(entry.contentHash);
        total += entry.sizeBytes;
      }
    }
    return total;
  }

  getProvider(): StorageProvider | null {
    return this.provider;
  }

  setProvider(provider: StorageProvider): void {
    this.provider = provider;
    this.source = provider.name;
  }
}
