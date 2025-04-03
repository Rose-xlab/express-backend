"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.federalRegisterRateLimiter = exports.cbpRateLimiter = exports.ustrRateLimiter = exports.usitcRateLimiter = exports.RateLimiter = void 0;
const logger_1 = require("./logger");
const logger = (0, logger_1.createLogger)('rate-limiter');
class RateLimiter {
    constructor(options) {
        this.requests = new Map();
        this.windowMs = options.windowMs;
        this.maxRequests = options.maxRequests;
    }
    async throttle(key) {
        if (this.shouldThrottle(key)) {
            const delay = this.calculateDelay(key);
            logger.debug(`Throttling request for key ${key}, delaying ${delay}ms`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
        this.addRequest(key);
    }
    shouldThrottle(key) {
        const timestamps = this.getTimestamps(key);
        const windowStart = Date.now() - this.windowMs;
        // Count requests in the current window
        const requestsInWindow = timestamps.filter(time => time > windowStart);
        return requestsInWindow.length >= this.maxRequests;
    }
    calculateDelay(key) {
        const timestamps = this.getTimestamps(key);
        const windowStart = Date.now() - this.windowMs;
        // Find the oldest timestamp in the window
        const oldestInWindow = timestamps
            .filter(time => time > windowStart)
            .sort((a, b) => a - b)[0];
        if (!oldestInWindow)
            return 0;
        // Calculate when a slot will be available
        return oldestInWindow + this.windowMs - Date.now() + 100; // Add 100ms buffer
    }
    addRequest(key) {
        const timestamps = this.getTimestamps(key);
        const now = Date.now();
        // Add current timestamp
        timestamps.push(now);
        // Remove expired timestamps
        const windowStart = now - this.windowMs;
        const validTimestamps = timestamps.filter(time => time > windowStart);
        this.requests.set(key, validTimestamps);
    }
    getTimestamps(key) {
        return this.requests.get(key) || [];
    }
    reset() {
        this.requests.clear();
    }
}
exports.RateLimiter = RateLimiter;
// Pre-configured rate limiters for different APIs
exports.usitcRateLimiter = new RateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60 // 60 requests per minute
});
exports.ustrRateLimiter = new RateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30 // 30 requests per minute
});
exports.cbpRateLimiter = new RateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30 // 30 requests per minute
});
exports.federalRegisterRateLimiter = new RateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 20 // 20 requests per minute
});
