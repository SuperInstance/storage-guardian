"use strict";
/**
 * @superinstance/storage-guardian — Main Entry Point (v0.2.0)
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordToDataPoint = exports.compareReports = exports.analyzeTrend = exports.evaluateBuiltInRules = exports.budgetToAlertRules = exports.wastedBytesThreshold = exports.duplicateGrowthAlert = exports.oversizedFileAlert = exports.budgetUsageAlert = exports.duplicateRatioThreshold = exports.exportMarkdown = exports.exportSlack = exports.exportPrometheus = exports.exportJson = exports.saveScan = exports.MemoryPersistence = exports.JsonFilePersistence = exports.MemoryProvider = exports.S3Provider = exports.FileSystemProvider = exports.detectMimeType = exports.formatDate = exports.generateId = exports.hashContent = exports.formatBytes = exports.StorageGuardian = void 0;
// Core
var guardian_1 = require("./core/guardian");
Object.defineProperty(exports, "StorageGuardian", { enumerable: true, get: function () { return guardian_1.StorageGuardian; } });
var utils_1 = require("./core/utils");
Object.defineProperty(exports, "formatBytes", { enumerable: true, get: function () { return utils_1.formatBytes; } });
Object.defineProperty(exports, "hashContent", { enumerable: true, get: function () { return utils_1.hashContent; } });
Object.defineProperty(exports, "generateId", { enumerable: true, get: function () { return utils_1.generateId; } });
Object.defineProperty(exports, "formatDate", { enumerable: true, get: function () { return utils_1.formatDate; } });
Object.defineProperty(exports, "detectMimeType", { enumerable: true, get: function () { return utils_1.detectMimeType; } });
// Types — re-export everything
__exportStar(require("./core/types"), exports);
// Adapters
var filesystem_1 = require("./adapters/filesystem");
Object.defineProperty(exports, "FileSystemProvider", { enumerable: true, get: function () { return filesystem_1.FileSystemProvider; } });
var s3_1 = require("./adapters/s3");
Object.defineProperty(exports, "S3Provider", { enumerable: true, get: function () { return s3_1.S3Provider; } });
var memory_1 = require("./adapters/memory");
Object.defineProperty(exports, "MemoryProvider", { enumerable: true, get: function () { return memory_1.MemoryProvider; } });
// Persistence
var persistence_1 = require("./persistence");
Object.defineProperty(exports, "JsonFilePersistence", { enumerable: true, get: function () { return persistence_1.JsonFilePersistence; } });
Object.defineProperty(exports, "MemoryPersistence", { enumerable: true, get: function () { return persistence_1.MemoryPersistence; } });
Object.defineProperty(exports, "saveScan", { enumerable: true, get: function () { return persistence_1.saveScan; } });
// Export formatters
var export_1 = require("./export");
Object.defineProperty(exports, "exportJson", { enumerable: true, get: function () { return export_1.exportJson; } });
Object.defineProperty(exports, "exportPrometheus", { enumerable: true, get: function () { return export_1.exportPrometheus; } });
Object.defineProperty(exports, "exportSlack", { enumerable: true, get: function () { return export_1.exportSlack; } });
Object.defineProperty(exports, "exportMarkdown", { enumerable: true, get: function () { return export_1.exportMarkdown; } });
// Alerting
var alerting_1 = require("./alerting");
Object.defineProperty(exports, "duplicateRatioThreshold", { enumerable: true, get: function () { return alerting_1.duplicateRatioThreshold; } });
Object.defineProperty(exports, "budgetUsageAlert", { enumerable: true, get: function () { return alerting_1.budgetUsageAlert; } });
Object.defineProperty(exports, "oversizedFileAlert", { enumerable: true, get: function () { return alerting_1.oversizedFileAlert; } });
Object.defineProperty(exports, "duplicateGrowthAlert", { enumerable: true, get: function () { return alerting_1.duplicateGrowthAlert; } });
Object.defineProperty(exports, "wastedBytesThreshold", { enumerable: true, get: function () { return alerting_1.wastedBytesThreshold; } });
Object.defineProperty(exports, "budgetToAlertRules", { enumerable: true, get: function () { return alerting_1.budgetToAlertRules; } });
Object.defineProperty(exports, "evaluateBuiltInRules", { enumerable: true, get: function () { return alerting_1.evaluateBuiltInRules; } });
// Trend analysis
var trend_1 = require("./trend");
Object.defineProperty(exports, "analyzeTrend", { enumerable: true, get: function () { return trend_1.analyzeTrend; } });
Object.defineProperty(exports, "compareReports", { enumerable: true, get: function () { return trend_1.compareReports; } });
Object.defineProperty(exports, "recordToDataPoint", { enumerable: true, get: function () { return trend_1.recordToDataPoint; } });
//# sourceMappingURL=index.js.map