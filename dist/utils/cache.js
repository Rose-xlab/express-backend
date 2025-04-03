"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.referenceCache = exports.apiCache = exports.cache = void 0;
const node_cache_1 = __importDefault(require("node-cache"));
const logger_1 = require("./logger");
const logger = (0, logger_1.createLogger)('cache');
class Cache {
    constructor(ttlSeconds = 3600) {
        this.cache = new node_cache_1.default({
            stdTTL: ttlSeconds,
            checkperiod: ttlSeconds * 0.2,
            useClones: false
        });
        this.cache.on('expired', (key, value) => {
            logger.debug(`Cache key expired: ${key}`);
        });
    }
    get(key) {
        return this.cache.get(key);
    }
    set(key, value, ttl) {
        return this.cache.set(key, value, ttl);
    }
    delete(key) {
        return this.cache.del(key);
    }
    flush() {
        this.cache.flushAll();
    }
    stats() {
        return this.cache.getStats();
    }
}
// Default cache with 1 hour TTL
exports.cache = new Cache(3600);
// Short-lived cache for API responses (5 minutes)
exports.apiCache = new Cache(300);
// Long-lived cache for reference data (24 hours)
exports.referenceCache = new Cache(86400);
