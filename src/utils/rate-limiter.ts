import { createLogger } from './logger';

const logger = createLogger('rate-limiter');

interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
}

export class RateLimiter {
  private requests: Map<string, number[]>;
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(options: RateLimiterOptions) {
    this.requests = new Map();
    this.windowMs = options.windowMs;
    this.maxRequests = options.maxRequests;
  }

  async throttle(key: string): Promise<void> {
    if (this.shouldThrottle(key)) {
      const delay = this.calculateDelay(key);
      logger.debug(`Throttling request for key ${key}, delaying ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    this.addRequest(key);
  }

  private shouldThrottle(key: string): boolean {
    const timestamps = this.getTimestamps(key);
    const windowStart = Date.now() - this.windowMs;
    
    // Count requests in the current window
    const requestsInWindow = timestamps.filter(time => time > windowStart);
    
    return requestsInWindow.length >= this.maxRequests;
  }

  private calculateDelay(key: string): number {
    const timestamps = this.getTimestamps(key);
    const windowStart = Date.now() - this.windowMs;
    
    // Find the oldest timestamp in the window
    const oldestInWindow = timestamps
      .filter(time => time > windowStart)
      .sort((a, b) => a - b)[0];
    
    if (!oldestInWindow) return 0;
    
    // Calculate when a slot will be available
    return oldestInWindow + this.windowMs - Date.now() + 100; // Add 100ms buffer
  }

  private addRequest(key: string): void {
    const timestamps = this.getTimestamps(key);
    const now = Date.now();
    
    // Add current timestamp
    timestamps.push(now);
    
    // Remove expired timestamps
    const windowStart = now - this.windowMs;
    const validTimestamps = timestamps.filter(time => time > windowStart);
    
    this.requests.set(key, validTimestamps);
  }

  private getTimestamps(key: string): number[] {
    return this.requests.get(key) || [];
  }

  reset(): void {
    this.requests.clear();
  }
}

// Pre-configured rate limiters for different APIs
export const usitcRateLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 60      // 60 requests per minute
});

export const ustrRateLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 30      // 30 requests per minute
});

export const cbpRateLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 30      // 30 requests per minute
});

export const federalRegisterRateLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 20      // 20 requests per minute
});