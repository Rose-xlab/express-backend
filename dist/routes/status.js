"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const logger_1 = require("../utils/logger");
const database_1 = require("../utils/database");
const cache_1 = require("../utils/cache");
const router = (0, express_1.Router)();
const logger = (0, logger_1.createLogger)('status-routes');
/**
 * Authentication middleware for secure routes
 */
function requireAuth(req, res, next) {
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
        const jobType = req.query.type;
        let query = database_1.supabase
            .from('sync_status')
            .select('*')
            .order('started_at', { ascending: false });
        if (jobType) {
            query = query.eq('type', jobType);
        }
        const { data, error } = await query.limit(10);
        if (error)
            throw error;
        res.json({ data });
    }
    catch (error) {
        logger.error('Error fetching sync status', error);
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
            apiCache: cache_1.apiCache.stats(),
            generalCache: cache_1.cache.stats(),
            referenceCache: cache_1.referenceCache.stats()
        };
        res.json({ data: stats });
    }
    catch (error) {
        logger.error('Error fetching cache stats', error);
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
        const cacheType = req.query.type;
        if (cacheType === 'api') {
            cache_1.apiCache.flush();
        }
        else if (cacheType === 'general') {
            cache_1.cache.flush();
        }
        else if (cacheType === 'reference') {
            cache_1.referenceCache.flush();
        }
        else {
            // Clear all caches
            cache_1.apiCache.flush();
            cache_1.cache.flush();
            cache_1.referenceCache.flush();
        }
        res.json({
            message: `Cache${cacheType ? ` (${cacheType})` : ''} cleared successfully`,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        logger.error('Error clearing cache', error);
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
        const [productsCount, tariffRatesCount, tradeUpdatesCount, notificationsCount, analyticsEventsCount] = await Promise.all([
            database_1.supabase.from('products').select('*', { count: 'exact', head: true }),
            database_1.supabase.from('tariff_rates').select('*', { count: 'exact', head: true }),
            database_1.supabase.from('trade_updates').select('*', { count: 'exact', head: true }),
            database_1.supabase.from('notifications').select('*', { count: 'exact', head: true }),
            database_1.supabase.from('analytics_events').select('*', { count: 'exact', head: true })
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
    }
    catch (error) {
        logger.error('Error fetching database stats', error);
        res.status(500).json({
            error: 'Failed to fetch database stats',
            details: error instanceof Error ? error.message : undefined
        });
    }
});
exports.default = router;
