import { Router } from 'express';
import { createLogger } from '../utils/logger';
import { supabase } from '../utils/database';
import { apiCache, cache, referenceCache } from '../utils/cache';

const router = Router();
const logger = createLogger('status-routes');

/**
 * Authentication middleware for secure routes
 */
function requireAuth(req: any, res: any, next: any) {
  const apiKey = req.headers['x-api-key'];
  
  // Simple API key check - in production, use a more secure method
  if (apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  next();
}

/**
 * Get sync job status
 */
router.get('/sync', requireAuth, async (req, res) => {
  try {
    const jobType = req.query.type as string;
    
    let query = supabase
      .from('sync_status')
      .select('*')
      .order('started_at', { ascending: false });
      
    if (jobType) {
      query = query.eq('type', jobType);
    }
    
    const { data, error } = await query.limit(10);
      
    if (error) throw error;
    
    res.json({ data });
  } catch (error) {
    logger.error('Error fetching sync status', error as Error);
    res.status(500).json({
      error: 'Failed to fetch sync status',
      details: error instanceof Error ? error.message : undefined
    });
  }
});

/**
 * Get cache statistics
 */
router.get('/cache', requireAuth, async (req, res) => {
  try {
    const stats = {
      apiCache: apiCache.stats(),
      generalCache: cache.stats(),
      referenceCache: referenceCache.stats()
    };
    
    res.json({ data: stats });
  } catch (error) {
    logger.error('Error fetching cache stats', error as Error);
    res.status(500).json({
      error: 'Failed to fetch cache stats',
      details: error instanceof Error ? error.message : undefined
    });
  }
});

/**
 * Clear cache
 */
router.post('/cache/clear', requireAuth, async (req, res) => {
  try {
    const cacheType = req.query.type as string;
    
    if (cacheType === 'api') {
      apiCache.flush();
    } else if (cacheType === 'general') {
      cache.flush();
    } else if (cacheType === 'reference') {
      referenceCache.flush();
    } else {
      // Clear all caches
      apiCache.flush();
      cache.flush();
      referenceCache.flush();
    }
    
    res.json({
      message: `Cache${cacheType ? ` (${cacheType})` : ''} cleared successfully`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error clearing cache', error as Error);
    res.status(500).json({
      error: 'Failed to clear cache',
      details: error instanceof Error ? error.message : undefined
    });
  }
});

/**
 * Get database statistics
 */
router.get('/database', requireAuth, async (req, res) => {
  try {
    // Get table counts
    const [
      productsCount,
      tariffRatesCount,
      tradeUpdatesCount,
      notificationsCount,
      analyticsEventsCount
    ] = await Promise.all([
      supabase.from('products').select('*', { count: 'exact', head: true }),
      supabase.from('tariff_rates').select('*', { count: 'exact', head: true }),
      supabase.from('trade_updates').select('*', { count: 'exact', head: true }),
      supabase.from('notifications').select('*', { count: 'exact', head: true }),
      supabase.from('analytics_events').select('*', { count: 'exact', head: true })
    ]);
    
    res.json({
      data: {
        counts: {
          products: productsCount.count,
          tariffRates: tariffRatesCount.count,
          tradeUpdates: tradeUpdatesCount.count,
          notifications: notificationsCount.count,
          analyticsEvents: analyticsEventsCount.count
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching database stats', error as Error);
    res.status(500).json({
      error: 'Failed to fetch database stats',
      details: error instanceof Error ? error.message : undefined
    });
  }
});

export default router;