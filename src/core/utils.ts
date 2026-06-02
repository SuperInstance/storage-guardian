/**
 * @superinstance/storage-guardian — Utilities
 */

import { createHash } from 'node:crypto';

/**
 * Compute SHA-256 hash of a string or buffer.
 */
export function hashContent(data: Buffer | string): string {
  const buf = typeof data === 'string' ? Buffer.from(data) : data;
  return createHash('sha256').update(buf).digest('hex');
}

/**
 * Format bytes into human-readable string.
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
}

/**
 * Format a timestamp to ISO date string.
 */
export function formatDate(ts: number): string {
  return new Date(ts).toISOString();
}

/**
 * Generate a unique ID.
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Convert glob patterns to RegExp.
 */
export function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`, 'i');
}

/**
 * Check if a file path should be excluded based on patterns.
 */
export function isExcluded(filePath: string, patterns: string[]): boolean {
  const parts = filePath.split(/[/\\]/);
  const fileName = parts[parts.length - 1];
  return patterns.some((pattern) => {
    const regex = globToRegex(pattern);
    return regex.test(fileName) || regex.test(filePath);
  });
}

/**
 * Detect MIME type from file extension.
 */
export function detectMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  const mimeMap: Record<string, string> = {
    txt: 'text/plain',
    html: 'text/html',
    css: 'text/css',
    js: 'application/javascript',
    ts: 'application/typescript',
    json: 'application/json',
    xml: 'application/xml',
    pdf: 'application/pdf',
    zip: 'application/zip',
    gz: 'application/gzip',
    tar: 'application/x-tar',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    webp: 'image/webp',
    mp4: 'video/mp4',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    md: 'text/markdown',
    yaml: 'text/yaml',
    yml: 'text/yaml',
    toml: 'text/toml',
    csv: 'text/csv',
  };
  return mimeMap[ext ?? ''] ?? 'application/octet-stream';
}
