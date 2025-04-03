"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getImplementationGuidance = exports.getRulings = void 0;
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../utils/logger");
const cache_1 = require("../utils/cache");
const rate_limiter_1 = require("../utils/rate-limiter");
const config_1 = __importDefault(require("../config"));
const logger = (0, logger_1.createLogger)('cbp-api');
const CACHE_KEY_PREFIX = 'cbp';
const BASE_URL = config_1.default.apis.cbp.baseUrl;
/**
 * Get rulings for a specific HTS code
 */
async function getRulings(htsCode) {
    const cacheKey = `${CACHE_KEY_PREFIX}:rulings:${htsCode}`;
    const cachedData = cache_1.apiCache.get(cacheKey);
    if (cachedData) {
        logger.debug(`Cache hit for CBP rulings ${htsCode}`);
        return cachedData;
    }
    try {
        logger.info(`Fetching CBP rulings for HTS code ${htsCode}`);
        // Apply rate limiting
        await rate_limiter_1.cbpRateLimiter.throttle('rulings');
        const response = await axios_1.default.get(`${BASE_URL}/rulings/${htsCode}`);
        if (response.status !== 200) {
            throw new Error(`Failed to fetch rulings for HTS code ${htsCode}: Status ${response.status}`);
        }
        // Process and validate the response
        const data = Array.isArray(response.data) ? response.data : [];
        // Cache the result
        cache_1.apiCache.set(cacheKey, data, 3600 * 12); // Cache for 12 hours
        return data;
    }
    catch (error) {
        logger.error(`Error fetching CBP rulings for HTS code ${htsCode}`, error);
        throw error;
    }
}
exports.getRulings = getRulings;
/**
 * Get implementation guidance for a specific topic
 */
async function getImplementationGuidance(topic) {
    const cacheKey = `${CACHE_KEY_PREFIX}:guidance:${topic}`;
    const cachedData = cache_1.apiCache.get(cacheKey);
    if (cachedData) {
        logger.debug(`Cache hit for implementation guidance on ${topic}`);
        return cachedData;
    }
    try {
        logger.info(`Fetching implementation guidance for ${topic}`);
        // Apply rate limiting
        await rate_limiter_1.cbpRateLimiter.throttle('guidance');
        const response = await axios_1.default.get(`${BASE_URL}/guidance/${topic}`);
        if (response.status !== 200) {
            throw new Error(`Failed to fetch guidance for ${topic}: Status ${response.status}`);
        }
        // Cache the result
        cache_1.apiCache.set(cacheKey, response.data, 3600 * 24); // Cache for 24 hours
        return response.data;
    }
    catch (error) {
        logger.error(`Error fetching implementation guidance for ${topic}`, error);
        throw error;
    }
}
exports.getImplementationGuidance = getImplementationGuidance;
