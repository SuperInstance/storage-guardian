/**
 * @superinstance/storage-guardian — Persistence Layer
 *
 * Save/load scan history to track duplicate rates over time.
 */
import { ScanRecord, PersistenceBackend, StorageReport, StorageAlert } from '../core/types';
export declare class JsonFilePersistence implements PersistenceBackend {
    private dir;
    constructor(directory?: string);
    save(record: ScanRecord): Promise<void>;
    load(id: string): Promise<ScanRecord | null>;
    list(opts?: {
        limit?: number;
        since?: number;
    }): Promise<ScanRecord[]>;
    remove(id: string): Promise<boolean>;
    private getFilePath;
    private ensureDir;
}
export declare class MemoryPersistence implements PersistenceBackend {
    private records;
    save(record: ScanRecord): Promise<void>;
    load(id: string): Promise<ScanRecord | null>;
    list(opts?: {
        limit?: number;
        since?: number;
    }): Promise<ScanRecord[]>;
    remove(id: string): Promise<boolean>;
}
export declare function saveScan(report: StorageReport, alerts: StorageAlert[], backend: PersistenceBackend, source?: string): Promise<ScanRecord>;
//# sourceMappingURL=index.d.ts.map