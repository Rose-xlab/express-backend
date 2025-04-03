import axios from 'axios';
import { createLogger } from '../utils/logger';
import { apiCache } from '../utils/cache';
import { cbpRateLimiter } from '../utils/rate-limiter';
import config from '../config';
import { CBPRuling } from './types';

const logger = createLogger('cbp-api');
const CACHE_KEY_PREFIX = 'cbp';
const BASE_URL = config.apis.cbp.baseUrl;

/**
 * Get rulings for a specific HTS code
 */
export async function getRulings(htsCode: string): Promise<CBPRuling[]> {
  const cacheKey = `${CACHE_KEY_PREFIX}:rulings:${htsCode}`;
  const cachedData = apiCache.get<CBPRuling[]>(cacheKey);
  
  if (cachedData) {
    logger.debug(`Cache hit for CBP rulings ${htsCode}`);
    return cachedData;
  }

  try {
    logger.info(`Fetching CBP rulings for HTS code ${htsCode}`);
    
    // Apply rate limiting
    await cbpRateLimiter.throttle('rulings');
    
    const response = await axios.get(`${BASE_URL}/rulings/${htsCode}`);
    
    if (response.status !== 200) {
      throw new Error(`Failed to fetch rulings for HTS code ${htsCode}: Status ${response.status}`);
    }
    
    // Process and validate the response
    const data = Array.isArray(response.data) ? response.data : [];
    
    // Cache the result
    apiCache.set(cacheKey, data, 3600 * 12); // Cache for 12 hours
    return data;
  } catch (error) {
    logger.error(`Error fetching CBP rulings for HTS code ${htsCode}`, error as Error);
    throw error;
  }
}

/**
 * Get implementation guidance for a specific topic
 */
export async function getImplementationGuidance(topic: string): Promise<any> {
  const cacheKey = `${CACHE_KEY_PREFIX}:guidance:${topic}`;
  const cachedData = apiCache.get(cacheKey);
  
  if (cachedData) {
    logger.debug(`Cache hit for implementation guidance on ${topic}`);
    return cachedData;
  }

  try {
    logger.info(`Fetching implementation guidance for ${topic}`);
    
    // Apply rate limiting
    await cbpRateLimiter.throttle('guidance');
    
    const response = await axios.get(`${BASE_URL}/guidance/${topic}`);
    
    if (response.status !== 200) {
      throw new Error(`Failed to fetch guidance for ${topic}: Status ${response.status}`);
    }
    
    // Cache the result
    apiCache.set(cacheKey, response.data, 3600 * 24); // Cache for 24 hours
    return response.data;
  } catch (error) {
    logger.error(`Error fetching implementation guidance for ${topic}`, error as Error);
    throw error;
  }
}