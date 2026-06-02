"use strict";
/**
 * @superinstance/storage-guardian — Utilities
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashContent = hashContent;
exports.formatBytes = formatBytes;
exports.formatDate = formatDate;
exports.generateId = generateId;
exports.globToRegex = globToRegex;
exports.isExcluded = isExcluded;
exports.detectMimeType = detectMimeType;
const node_crypto_1 = require("node:crypto");
/**
 * Compute SHA-256 hash of a string or buffer.
 */
function hashContent(data) {
    const buf = typeof data === 'string' ? Buffer.from(data) : data;
    return (0, node_crypto_1.createHash)('sha256').update(buf).digest('hex');
}
/**
 * Format bytes into human-readable string.
 */
function formatBytes(bytes) {
    if (bytes < 1024)
        return `${bytes}B`;
    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(1)}KB`;
    if (bytes < 1024 * 1024 * 1024)
        return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
}
/**
 * Format a timestamp to ISO date string.
 */
function formatDate(ts) {
    return new Date(ts).toISOString();
}
/**
 * Generate a unique ID.
 */
function generateId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
/**
 * Convert glob patterns to RegExp.
 */
function globToRegex(pattern) {
    const escaped = pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.');
    return new RegExp(`^${escaped}$`, 'i');
}
/**
 * Check if a file path should be excluded based on patterns.
 */
function isExcluded(filePath, patterns) {
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
function detectMimeType(fileName) {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const mimeMap = {
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
//# sourceMappingURL=utils.js.map