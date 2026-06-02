# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] — 2026-06-02

### Added

- **File system adapter** — `FileSystemProvider` with real `fs.walk()` streaming, symlink handling, hidden file detection, permission awareness, and configurable concurrency
- **S3/Cloud Storage adapter** — `S3Provider` for AWS S3, MinIO, R2, and any S3-compatible storage (optional peer dep)
- **Storage provider interface** — Pluggable `StorageProvider` abstract interface; works with local fs OR cloud buckets
- **Persistence** — `JsonFilePersistence` and `MemoryPersistence` backends for saving/loading scan history
- **Export formats** — JSON, Prometheus metrics, Slack message, and Markdown report formatters
- **Alerting engine** — Configurable alert rules with built-in rules for duplicate ratio thresholds, budget usage, oversized files, and duplicate growth detection
- **Trend analysis** — Compare scans over time, detect growth patterns, generate trend alerts ("Duplicate percentage grew from 8% to 14% over 30 days")
- **CLI** — `storage-guardian scan`, `trend`, and `compare` commands with format options and persistence
- **MIME type detection** — Automatic MIME type inference from file extensions
- **Concurrency control** — Semaphore-based concurrency for file system scanning
- **Streaming file hashing** — SHA-256 via Node.js streams to avoid loading large files into memory
- **CI** — GitHub Actions workflow for Node 18/20/22 with lint, type-check, and test

### Changed

- `StorageAlert` now includes `timestamp` and `entryName` fields
- `StorageReport` now includes `source` and `scanDurationMs` fields
- `StorageBudget` now supports `maxDuplicateRatio` constraint
- `StorageEntry` now includes `path`, `isSymlink`, `isHidden`, and `mode` fields
- Full backward compatibility with v0.1.0 API

### Removed

- Nothing removed; v0.1.0 API fully preserved

## [0.1.0] — 2025-01-15

### Added

- Initial release
- `StorageGuardian` class with in-memory content-addressable storage
- Duplicate detection via SHA-256 content hashing
- Automatic deduplication with reference counting
- Storage budget enforcement (total bytes, entry count, single-entry size)
- Duplicate alerts on content insertion
- Storage report generation
- Entry querying by hash, tag, ID
- `hashContent()` and `formatBytes()` utility functions
