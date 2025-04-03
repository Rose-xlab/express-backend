"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTradeAgreements = exports.getExclusions = exports.getSection301Tariffs = void 0;
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../utils/logger");
const cache_1 = require("../utils/cache");
const rate_limiter_1 = require("../utils/rate-limiter");
const config_1 = __importDefault(require("../config"));
const logger = (0, logger_1.createLogger)('ustr-api');
const CACHE_KEY_PREFIX = 'ustr';
const BASE_URL = config_1.default.apis.ustr.baseUrl;
/**
 * Get all current Section 301 tariffs
 */
async function getSection301Tariffs() {
    const cacheKey = `${CACHE_KEY_PREFIX}:section301`;
    const cachedData = cache_1.apiCache.get(cacheKey);
    if (cachedData) {
        logger.debug('Cache hit for Section 301 tariffs');
        return cachedData;
    }
    try {
        logger.info('Fetching Section 301 tariffs');
        // Apply rate limiting
        await rate_limiter_1.ustrRateLimiter.throttle('section301');
        const response = await axios_1.default.get(`${BASE_URL}/section301/current`);
        if (response.status !== 200) {
            throw new Error(`Failed to fetch Section 301 tariffs: Status ${response.status}`);
        }
        // Process and validate the response
        const data = Array.isArray(response.data) ? response.data : [];
        // Cache the result
        cache_1.apiCache.set(cacheKey, data, 3600 * 12); // Cache for 12 hours
        return data;
    }
    catch (error) {
        logger.error('Error fetching Section 301 tariffs', error);
        throw error;
    }
}
exports.getSection301Tariffs = getSection301Tariffs;
/**
 * Get exclusions for a specific HTS code
 */
async function getExclusions(htsCode) {
    const cacheKey = `${CACHE_KEY_PREFIX}:exclusions:${htsCode}`;
    const cachedData = cache_1.apiCache.get(cacheKey);
    if (cachedData) {
        logger.debug(`Cache hit for exclusions ${htsCode}`);
        return cachedData;
    }
    try {
        logger.info(`Fetching exclusions for HTS code ${htsCode}`);
        // Apply rate limiting
        await rate_limiter_1.ustrRateLimiter.throttle('exclusions');
        const response = await axios_1.default.get(`${BASE_URL}/exclusions/${htsCode}`);
        if (response.status !== 200) {
            throw new Error(`Failed to fetch exclusions for HTS code ${htsCode}: Status ${response.status}`);
        }
        // Process and validate the response
        const data = Array.isArray(response.data) ? response.data : [];
        // Cache the result
        cache_1.apiCache.set(cacheKey, data, 3600 * 12); // Cache for 12 hours
        return data;
    }
    catch (error) {
        logger.error(`Error fetching exclusions for HTS code ${htsCode}`, error);
        throw error;
    }
}
exports.getExclusions = getExclusions;
/**
 * Get all trade agreements
 */
async function getTradeAgreements() {
    const cacheKey = `${CACHE_KEY_PREFIX}:agreements`;
    const cachedData = cache_1.apiCache.get(cacheKey);
    if (cachedData) {
        logger.debug('Cache hit for trade agreements');
        return cachedData;
    }
    try {
        logger.info('Fetching trade agreements');
        // Apply rate limiting
        await rate_limiter_1.ustrRateLimiter.throttle('agreements');
        const response = await axios_1.default.get(`${BASE_URL}/agreements`);
        if (response.status !== 200) {
            throw new Error(`Failed to fetch trade agreements: Status ${response.status}`);
        }
        // Process and validate the response
        const data = Array.isArray(response.data) ? response.data : [];
        // Cache the result
        cache_1.apiCache.set(cacheKey, data, 3600 * 24); // Cache for 24 hours
        return data;
    }
    catch (error) {
        logger.error('Error fetching trade agreements', error);
        throw error;
    }
}
exports.getTradeAgreements = getTradeAgreements;
