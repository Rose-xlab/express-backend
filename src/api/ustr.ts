import axios from 'axios';
import { createLogger } from '../utils/logger';
import { apiCache } from '../utils/cache';
import { ustrRateLimiter } from '../utils/rate-limiter';
import config from '../config';
import { Section301Tariff, Exclusion, TradeAgreement } from './types';

const logger = createLogger('ustr-api');
const CACHE_KEY_PREFIX = 'ustr';
const BASE_URL = config.apis.ustr.baseUrl;

/**
 * Get all current Section 301 tariffs
 */
export async function getSection301Tariffs(): Promise<Section301Tariff[]> {
  const cacheKey = `${CACHE_KEY_PREFIX}:section301`;
  const cachedData = apiCache.get<Section301Tariff[]>(cacheKey);
  
  if (cachedData) {
    logger.debug('Cache hit for Section 301 tariffs');
    return cachedData;
  }

  try {
    logger.info('Fetching Section 301 tariffs');
    
    // Apply rate limiting
    await ustrRateLimiter.throttle('section301');
    
    const response = await axios.get(`${BASE_URL}/section301/current`);
    
    if (response.status !== 200) {
      throw new Error(`Failed to fetch Section 301 tariffs: Status ${response.status}`);
    }
    
    // Process and validate the response
    const data = Array.isArray(response.data) ? response.data : [];
    
    // Cache the result
    apiCache.set(cacheKey, data, 3600 * 12); // Cache for 12 hours
    return data;
  } catch (error) {
    logger.error('Error fetching Section 301 tariffs', error as Error);
    throw error;
  }
}

/**
 * Get exclusions for a specific HTS code
 */
export async function getExclusions(htsCode: string): Promise<Exclusion[]> {
  const cacheKey = `${CACHE_KEY_PREFIX}:exclusions:${htsCode}`;
  const cachedData = apiCache.get<Exclusion[]>(cacheKey);
  
  if (cachedData) {
    logger.debug(`Cache hit for exclusions ${htsCode}`);
    return cachedData;
  }

  try {
    logger.info(`Fetching exclusions for HTS code ${htsCode}`);
    
    // Apply rate limiting
    await ustrRateLimiter.throttle('exclusions');
    
    const response = await axios.get(`${BASE_URL}/exclusions/${htsCode}`);
    
    if (response.status !== 200) {
      throw new Error(`Failed to fetch exclusions for HTS code ${htsCode}: Status ${response.status}`);
    }
    
    // Process and validate the response
    const data = Array.isArray(response.data) ? response.data : [];
    
    // Cache the result
    apiCache.set(cacheKey, data, 3600 * 12); // Cache for 12 hours
    return data;
  } catch (error) {
    logger.error(`Error fetching exclusions for HTS code ${htsCode}`, error as Error);
    throw error;
  }
}

/**
 * Get all trade agreements
 */
export async function getTradeAgreements(): Promise<TradeAgreement[]> {
  const cacheKey = `${CACHE_KEY_PREFIX}:agreements`;
  const cachedData = apiCache.get<TradeAgreement[]>(cacheKey);
  
  if (cachedData) {
    logger.debug('Cache hit for trade agreements');
    return cachedData;
  }

  try {
    logger.info('Fetching trade agreements');
    
    // Apply rate limiting
    await ustrRateLimiter.throttle('agreements');
    
    const response = await axios.get(`${BASE_URL}/agreements`);
    
    if (response.status !== 200) {
      throw new Error(`Failed to fetch trade agreements: Status ${response.status}`);
    }
    
    // Process and validate the response
    const data = Array.isArray(response.data) ? response.data : [];
    
    // Cache the result
    apiCache.set(cacheKey, data, 3600 * 24); // Cache for 24 hours
    return data;
  } catch (error) {
    logger.error('Error fetching trade agreements', error as Error);
    throw error;
  }
}