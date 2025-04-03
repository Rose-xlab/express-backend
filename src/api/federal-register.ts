import axios from 'axios';
import { createLogger } from '../utils/logger';
import { apiCache } from '../utils/cache';
import { federalRegisterRateLimiter } from '../utils/rate-limiter';
import config from '../config';
import { FederalRegisterNotice } from './types';

const logger = createLogger('federal-register-api');
const CACHE_KEY_PREFIX = 'fr';
const BASE_URL = config.apis.federalRegister.baseUrl;

/**
 * Get tariff-related notices from the Federal Register
 */
export async function getTariffNotices(): Promise<FederalRegisterNotice[]> {
  const cacheKey = `${CACHE_KEY_PREFIX}:notices`;
  const cachedData = apiCache.get<FederalRegisterNotice[]>(cacheKey);
  
  if (cachedData) {
    logger.debug('Cache hit for Federal Register notices');
    return cachedData;
  }

  try {
    logger.info('Fetching tariff notices from Federal Register');
    
    // Apply rate limiting
    await federalRegisterRateLimiter.throttle('notices');
    
    const response = await axios.get(`${BASE_URL}/documents`, {
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
    const processedNotices = data.map((notice: any) => {
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
    apiCache.set(cacheKey, processedNotices, 3600 * 4); // Cache for 4 hours
    return processedNotices;
  } catch (error) {
    logger.error('Error fetching Federal Register notices', error as Error);
    throw error;
  }
}

/**
 * Get effective dates for a specific HTS code
 */
export async function getEffectiveDates(htsCode: string): Promise<FederalRegisterNotice[]> {
  const cacheKey = `${CACHE_KEY_PREFIX}:dates:${htsCode}`;
  const cachedData = apiCache.get<FederalRegisterNotice[]>(cacheKey);
  
  if (cachedData) {
    logger.debug(`Cache hit for effective dates ${htsCode}`);
    return cachedData;
  }

  try {
    logger.info(`Fetching effective dates for HTS code ${htsCode}`);
    
    // Apply rate limiting
    await federalRegisterRateLimiter.throttle('dates');
    
    const response = await axios.get(`${BASE_URL}/documents`, {
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
      .filter((notice: any) => 
        notice.abstract.includes(htsCode) || 
        (notice.title && notice.title.includes('Tariff'))
      )
      .map((notice: any) => ({
        document_number: notice.document_number,
        title: notice.title,
        abstract: notice.abstract,
        publication_date: notice.publication_date,
        effective_date: notice.effective_date || notice.publication_date,
        html_url: notice.html_url
      }));
    
    // Cache the result
    apiCache.set(cacheKey, relevantNotices, 3600 * 12); // Cache for 12 hours
    return relevantNotices;
  } catch (error) {
    logger.error(`Error fetching effective dates for HTS code ${htsCode}`, error as Error);
    throw error;
  }
}

/**
 * Extract HTS codes from text (simple regex-based extraction)
 */
function extractHtsCodes(text: string): string[] {
  if (!text) return [];
  
  // Regular expression to match HTS codes (XXXX.XX.XXXX format)
  const htsRegex = /\b\d{4}\.\d{2}\.\d{4}\b/g;
  
  // Find all matches
  const matches = text.match(htsRegex) || [];
  
  // Return unique HTS codes
  return [...new Set(matches)];
}