/**
 * @superinstance/storage-guardian — Utilities
 */
/**
 * Compute SHA-256 hash of a string or buffer.
 */
export declare function hashContent(data: Buffer | string): string;
/**
 * Format bytes into human-readable string.
 */
export declare function formatBytes(bytes: number): string;
/**
 * Format a timestamp to ISO date string.
 */
export declare function formatDate(ts: number): string;
/**
 * Generate a unique ID.
 */
export declare function generateId(): string;
/**
 * Convert glob patterns to RegExp.
 */
export declare function globToRegex(pattern: string): RegExp;
/**
 * Check if a file path should be excluded based on patterns.
 */
export declare function isExcluded(filePath: string, patterns: string[]): boolean;
/**
 * Detect MIME type from file extension.
 */
export declare function detectMimeType(fileName: string): string;
//# sourceMappingURL=utils.d.ts.map