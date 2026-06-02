"use strict";
/**
 * @superinstance/storage-guardian — Adapter Exports
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryProvider = exports.S3Provider = exports.FileSystemProvider = void 0;
var filesystem_1 = require("./filesystem");
Object.defineProperty(exports, "FileSystemProvider", { enumerable: true, get: function () { return filesystem_1.FileSystemProvider; } });
var s3_1 = require("./s3");
Object.defineProperty(exports, "S3Provider", { enumerable: true, get: function () { return s3_1.S3Provider; } });
var memory_1 = require("./memory");
Object.defineProperty(exports, "MemoryProvider", { enumerable: true, get: function () { return memory_1.MemoryProvider; } });
//# sourceMappingURL=index.js.map