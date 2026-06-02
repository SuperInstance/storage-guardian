/**
 * @superinstance/storage-guardian — Persistence Layer
 *
 * Save/load scan history to track duplicate rates over time.
 */

import { writeFile, readFile, mkdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { ScanRecord, PersistenceBackend, StorageReport, StorageAlert } from '../core/types';
import { generateId } from '../core/utils';

// ---------------------------------------------------------------------------
// JSON File Persistence Backend
// ---------------------------------------------------------------------------

export class JsonFilePersistence implements PersistenceBackend {
  private dir: string;

  constructor(directory: string = '.storage-guardian-history') {
    this.dir = directory;
  }

  async save(record: ScanRecord): Promise<void> {
    await this.ensureDir();
    const filePath = this.getFilePath(record.id);
    await writeFile(filePath, JSON.stringify(record, null, 2), 'utf-8');
  }

  async load(id: string): Promise<ScanRecord | null> {
    const filePath = this.getFilePath(id);
    try {
      const content = await readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  async list(opts?: { limit?: number; since?: number }): Promise<ScanRecord[]> {
    await this.ensureDir();
    const { readdir } = await import('fs/promises');
    let files: string[];

    try {
      files = await readdir(this.dir);
    } catch {
      return [];
    }

    const records: ScanRecord[] = [];

    for (const file of files.sort()) {
      if (!file.startsWith('scan-') || !file.endsWith('.json')) continue;
      try {
        const content = await readFile(join(this.dir, file), 'utf-8');
        const record: ScanRecord = JSON.parse(content);

        if (opts?.since && record.timestamp < opts.since) continue;
        records.push(record);
      } catch {
        continue;
      }
    }

    // Sort newest first
    records.sort((a, b) => b.timestamp - a.timestamp);

    if (opts?.limit) return records.slice(0, opts.limit);
    return records;
  }

  async remove(id: string): Promise<boolean> {
    const filePath = this.getFilePath(id);
    try {
      await unlink(filePath);
      return true;
    } catch {
      return false;
    }
  }

  // ----- Helpers -----

  private getFilePath(id: string): string {
    return join(this.dir, `scan-${id}.json`);
  }

  private async ensureDir(): Promise<void> {
    if (!existsSync(this.dir)) {
      await mkdir(this.dir, { recursive: true });
    }
  }
}

// ---------------------------------------------------------------------------
// In-Memory Persistence Backend (for testing)
// ---------------------------------------------------------------------------

export class MemoryPersistence implements PersistenceBackend {
  private records: Map<string, ScanRecord> = new Map();

  async save(record: ScanRecord): Promise<void> {
    this.records.set(record.id, record);
  }

  async load(id: string): Promise<ScanRecord | null> {
    return this.records.get(id) ?? null;
  }

  async list(opts?: { limit?: number; since?: number }): Promise<ScanRecord[]> {
    let records = Array.from(this.records.values());
    if (opts?.since) {
      records = records.filter((r) => r.timestamp >= opts.since!);
    }
    records.sort((a, b) => b.timestamp - a.timestamp);
    if (opts?.limit) records = records.slice(0, opts.limit);
    return records;
  }

  async remove(id: string): Promise<boolean> {
    return this.records.delete(id);
  }
}

// ---------------------------------------------------------------------------
// Convenience: Save a scan
// ---------------------------------------------------------------------------

export async function saveScan(
  report: StorageReport,
  alerts: StorageAlert[],
  backend: PersistenceBackend,
  source?: string,
): Promise<ScanRecord> {
  const record: ScanRecord = {
    id: generateId(),
    timestamp: report.generatedAt,
    source: source ?? report.source,
    report,
    alerts,
  };

  await backend.save(record);
  return record;
}
