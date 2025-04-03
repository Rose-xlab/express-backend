import { Router } from 'express';
import { createLogger } from '../utils/logger';
import { syncProducts } from '../jobs/sync-products';
import { syncTariffs } from '../jobs/sync-tariffs';
import { syncUpdates } from '../jobs/sync-updates';

const router = Router();
const logger = createLogger('sync-routes');

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
 * Start product sync job
 */
router.post('/products', requireAuth, async (req, res) => {
  try {
    const fullSync = req.query.full === 'true';
    
    // Run sync in background
    syncProducts(fullSync).catch(error => {
      logger.error('Background product sync failed', error);
    });
    
    res.json({
      message: `Product sync job ${fullSync ? '(full sync) ' : ''}started successfully`,
      fullSync,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error starting product sync', error as Error);
    res.status(500).json({
      error: 'Failed to start product sync',
      details: error instanceof Error ? error.message : undefined
    });
  }
});

/**
 * Start tariff sync job
 */
router.post('/tariffs', requireAuth, async (req, res) => {
  try {
    // Run sync in background
    syncTariffs().catch(error => {
      logger.error('Background tariff sync failed', error);
    });
    
    res.json({
      message: 'Tariff sync job started successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error starting tariff sync', error as Error);
    res.status(500).json({
      error: 'Failed to start tariff sync',
      details: error instanceof Error ? error.message : undefined
    });
  }
});

/**
 * Start updates sync job
 */
router.post('/updates', requireAuth, async (req, res) => {
  try {
    // Run sync in background
    syncUpdates().catch(error => {
      logger.error('Background updates sync failed', error);
    });
    
    res.json({
      message: 'Updates sync job started successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error starting updates sync', error as Error);
    res.status(500).json({
      error: 'Failed to start updates sync',
      details: error instanceof Error ? error.message : undefined
    });
  }
});

/**
 * Start all sync jobs
 */
router.post('/all', requireAuth, async (req, res) => {
  try {
    const fullSync = req.query.full === 'true';
    
    // Run syncs in background
    Promise.all([
      syncProducts(fullSync),
      syncTariffs(),
      syncUpdates()
    ]).catch(error => {
      logger.error('Background sync failed', error);
    });
    
    res.json({
      message: 'All sync jobs started successfully',
      fullSync,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error starting sync jobs', error as Error);
    res.status(500).json({
      error: 'Failed to start sync jobs',
      details: error instanceof Error ? error.message : undefined
    });
  }
});

export default router;