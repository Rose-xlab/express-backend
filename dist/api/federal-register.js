"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEffectiveDates = exports.getTariffNotices = void 0;
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../utils/logger");
const cache_1 = require("../utils/cache");
const rate_limiter_1 = require("../utils/rate-limiter");
const config_1 = __importDefault(require("../config"));
const logger = (0, logger_1.createLogger)('federal-register-api');
const CACHE_KEY_PREFIX = 'fr';
const BASE_URL = config_1.default.apis.federalRegister.baseUrl;
/**
 * Get tariff-related notices from the Federal Register
 */
async function getTariffNotices() {
    const cacheKey = `${CACHE_KEY_PREFIX}:notices`;
    const cachedData = cache_1.apiCache.get(cacheKey);
    if (cachedData) {
        logger.debug('Cache hit for Federal Register notices');
        return cachedData;
    }
    try {
        logger.info('Fetching tariff notices from Federal Register');
        // Apply rate limiting
        await rate_limiter_1.federalRegisterRateLimiter.throttle('notices');
        const response = await axios_1.default.get(`${BASE_URL}/documents`, {
            params: {
                'conditions[type]': 'NOTICE',
                'conditions[topics][]': 'tariffs',
                'per_page': 100,
                'order': 'newest'
            }
        });
        if (response.status !== 200) {
            throw new Error(`Failed to fetch tariff notices: Status ${response.status}`);
        }
        // Process and validate the response
        const data = response.data.results || [];
        // Extract hts_codes from the notice content if possible
        const processedNotices = data.map((notice) => {
            return {
                document_number: notice.document_number,
                title: notice.title,
                abstract: notice.abstract,
                publication_date: notice.publication_date,
                effective_date: notice.effective_date || notice.publication_date,
                html_url: notice.html_url,
                hts_codes: extractHtsCodes(notice.abstract)
            };
        });
        // Cache the result
        cache_1.apiCache.set(cacheKey, processedNotices, 3600 * 4); // Cache for 4 hours
        return processedNotices;
    }
    catch (error) {
        logger.error('Error fetching Federal Register notices', error);
        throw error;
    }
}
exports.getTariffNotices = getTariffNotices;
/**
 * Get effective dates for a specific HTS code
 */
async function getEffectiveDates(htsCode) {
    const cacheKey = `${CACHE_KEY_PREFIX}:dates:${htsCode}`;
    const cachedData = cache_1.apiCache.get(cacheKey);
    if (cachedData) {
        logger.debug(`Cache hit for effective dates ${htsCode}`);
        return cachedData;
    }
    try {
        logger.info(`Fetching effective dates for HTS code ${htsCode}`);
        // Apply rate limiting
        await rate_limiter_1.federalRegisterRateLimiter.throttle('dates');
        const response = await axios_1.default.get(`${BASE_URL}/documents`, {
            params: {
                'conditions[term]': htsCode,
                'per_page': 50,
                'order': 'newest'
            }
        });
        if (response.status !== 200) {
            throw new Error(`Failed to fetch effective dates for HTS code ${htsCode}: Status ${response.status}`);
        }
        // Process and return only relevant notices
        const data = response.data.results || [];
        const relevantNotices = data
            .filter((notice) => notice.abstract.includes(htsCode) ||
            (notice.title && notice.title.includes('Tariff')))
            .map((notice) => ({
            document_number: notice.document_number,
            title: notice.title,
            abstract: notice.abstract,
            publication_date: notice.publication_date,
            effective_date: notice.effective_date || notice.publication_date,
            html_url: notice.html_url
        }));
        // Cache the result
        cache_1.apiCache.set(cacheKey, relevantNotices, 3600 * 12); // Cache for 12 hours
        return relevantNotices;
    }
    catch (error) {
        logger.error(`Error fetching effective dates for HTS code ${htsCode}`, error);
        throw error;
    }
}
exports.getEffectiveDates = getEffectiveDates;
/**
 * Extract HTS codes from text (simple regex-based extraction)
 */
function extractHtsCodes(text) {
    if (!text)
        return [];
    // Regular expression to match HTS codes (XXXX.XX.XXXX format)
    const htsRegex = /\b\d{4}\.\d{2}\.\d{4}\b/g;
    // Find all matches
    const matches = text.match(htsRegex) || [];
    // Return unique HTS codes
    return [...new Set(matches)];
}
