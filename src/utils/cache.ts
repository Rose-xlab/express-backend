import NodeCache from 'node-cache';
import { createLogger } from './logger';

const logger = createLogger('cache');

class Cache {
  private cache: NodeCache;
  
  constructor(ttlSeconds: number = 3600) {
    this.cache = new NodeCache({
      stdTTL: ttlSeconds,
      checkperiod: ttlSeconds * 0.2,
      useClones: false
    });
    
    this.cache.on('expired', (key, value) => {
      logger.debug(`Cache key expired: ${key}`);
    });
  }
  
  get<T>(key: string): T | undefined {
    return this.cache.get<T>(key);
  }
  
  set<T>(key: string, value: T, ttl?: number): boolean {
    return this.cache.set<T>(key, value, ttl);
  }
  
  delete(key: string): number {
    return this.cache.del(key);
  }
  
  flush(): void {
    this.cache.flushAll();
  }
  
  stats() {
    return this.cache.getStats();
  }
}

// Default cache with 1 hour TTL
export const cache = new Cache(3600);

// Short-lived cache for API responses (5 minutes)
export const apiCache = new Cache(300);

// Long-lived cache for reference data (24 hours)
export const referenceCache = new Cache(86400);