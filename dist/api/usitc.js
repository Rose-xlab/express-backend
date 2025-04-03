"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGeneralRates = exports.searchHtsCodes = exports.getHtsChapter = void 0;
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../utils/logger");
const cache_1 = require("../utils/cache");
const rate_limiter_1 = require("../utils/rate-limiter");
const config_1 = __importDefault(require("../config"));
const logger = (0, logger_1.createLogger)('usitc-api');
const CACHE_KEY_PREFIX = 'usitc';
const BASE_URL = config_1.default.apis.usitc.baseUrl;
/**
 * Get data for an entire HTS chapter
 */
async function getHtsChapter(chapter) {
    const cacheKey = `${CACHE_KEY_PREFIX}:chapter:${chapter}`;
    const cachedData = cache_1.apiCache.get(cacheKey);
    if (cachedData) {
        logger.debug(`Cache hit for HTS chapter ${chapter}`);
        return cachedData;
    }
    try {
        logger.info(`Fetching HTS chapter ${chapter}`);
        // Apply rate limiting
        await rate_limiter_1.usitcRateLimiter.throttle('chapter');
        const response = await axios_1.default.get(`${BASE_URL}/chapters/${chapter}`);
        if (response.status !== 200) {
            throw new Error(`Failed to fetch HTS chapter ${chapter}: Status ${response.status}`);
        }
        // Process and validate the response data
        const data = validateHtsChapter(response.data);
        // Cache the result
        cache_1.apiCache.set(cacheKey, data, 3600); // Cache for 1 hour
        return data;
    }
    catch (error) {
        logger.error(`Error fetching HTS chapter ${chapter}`, error);
        throw error;
    }
}
exports.getHtsChapter = getHtsChapter;
/**
 * Search for HTS codes by query
 */
async function searchHtsCodes(query) {
    const cacheKey = `${CACHE_KEY_PREFIX}:search:${query}`;
    const cachedData = cache_1.apiCache.get(cacheKey);
    if (cachedData) {
        logger.debug(`Cache hit for HTS search "${query}"`);
        return cachedData;
    }
    try {
        logger.info(`Searching HTS codes for "${query}"`);
        // Apply rate limiting
        await rate_limiter_1.usitcRateLimiter.throttle('search');
        const response = await axios_1.default.get(`${BASE_URL}/search`, {
            params: { q: query }
        });
        if (response.status !== 200) {
            throw new Error(`Failed to search HTS codes: Status ${response.status}`);
        }
        // Process and validate the response
        const data = Array.isArray(response.data) ? response.data : [];
        // Cache the result
        cache_1.apiCache.set(cacheKey, data, 1800); // Cache for 30 minutes
        return data;
    }
    catch (error) {
        logger.error(`Error searching HTS codes for "${query}"`, error);
        throw error;
    }
}
exports.searchHtsCodes = searchHtsCodes;
/**
 * Get rates for a specific HTS code
 */
async function getGeneralRates(htsCode) {
    const cacheKey = `${CACHE_KEY_PREFIX}:rates:${htsCode}`;
    const cachedData = cache_1.apiCache.get(cacheKey);
    if (cachedData) {
        logger.debug(`Cache hit for HTS rates ${htsCode}`);
        return cachedData;
    }
    try {
        logger.info(`Fetching rates for HTS code ${htsCode}`);
        // Apply rate limiting
        await rate_limiter_1.usitcRateLimiter.throttle('rates');
        const response = await axios_1.default.get(`${BASE_URL}/rates/${htsCode}`);
        if (response.status !== 200) {
            throw new Error(`Failed to fetch rates for HTS code ${htsCode}: Status ${response.status}`);
        }
        // Cache the result
        cache_1.apiCache.set(cacheKey, response.data, 3600); // Cache for 1 hour
        return response.data;
    }
    catch (error) {
        logger.error(`Error fetching rates for HTS code ${htsCode}`, error);
        throw error;
    }
}
exports.getGeneralRates = getGeneralRates;
/**
 * Validate HTS chapter data structure
 */
function validateHtsChapter(data) {
    if (!data || typeof data !== 'object') {
        throw new Error('Invalid HTS chapter data format');
    }
    if (!data.chapter || !data.description || !Array.isArray(data.sections)) {
        throw new Error('Missing required fields in HTS chapter data');
    }
    return {
        chapter: data.chapter,
        description: data.description,
        sections: data.sections.map((section) => ({
            code: section.code || '',
            description: section.description || '',
            rates: Array.isArray(section.rates) ? section.rates : []
        }))
    };
}
