import { createLogger } from '../utils/logger';
import { supabase } from '../utils/database';
import { apiCache, cache, referenceCache } from '../utils/cache';

const logger = createLogger('cleanup');

/**
 * Cleanup job to remove old data and cached items
 */
export async function cleanupJob(): Promise<void> {
  try {
    logger.info('Starting cleanup job');
    
    // Clear expired cache items
    apiCache.flush();
    cache.flush();
    
    // Keep reference cache longer, just log stats
    const referenceStats = referenceCache.stats();
    logger.info(`Reference cache stats: ${JSON.stringify(referenceStats)}`);
    
    // Clean up old sync status records - keep last 100
    await cleanupSyncRecords();
    
    // Clean up old notifications - keep last 90 days
    await cleanupNotifications();
    
    // Clean up analytics events - keep last 30 days
    await cleanupAnalyticsEvents();
    
    logger.info('Cleanup job completed successfully');
  } catch (error) {
    logger.error('Error during cleanup job', error as Error);
    throw error;
  }
}

/**
 * Clean up old sync status records
 */
async function cleanupSyncRecords(): Promise<void> {
  try {
    logger.info('Cleaning up old sync status records');
    
    // Get IDs of records to keep
    const { data: recordsToKeep, error: fetchError } = await supabase
      .from('sync_status')
      .select('id')
      .order('started_at', { ascending: false })
      .limit(100);
      
    if (fetchError) throw fetchError;
    
    if (!recordsToKeep || recordsToKeep.length === 0) {
      logger.info('No sync status records found, nothing to clean up');
      return;
    }
    
    // Delete all records except the ones to keep
    const keepIds = recordsToKeep.map(record => record.id);
    const { error: deleteError } = await supabase
      .from('sync_status')
      .delete()
      .not('id', 'in', `(${keepIds.join(',')})`);
      
    if (deleteError) throw deleteError;
    
    logger.info('Successfully cleaned up old sync status records');
  } catch (error) {
    logger.error('Error cleaning up sync status records', error as Error);
    throw error;
  }
}

/**
 * Clean up old notifications (older than 90 days)
 */
async function cleanupNotifications(): Promise<void> {
  try {
    logger.info('Cleaning up old notifications');
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);
    
    const { error } = await supabase
      .from('notifications')
      .delete()
      .lt('created_at', cutoffDate.toISOString());
      
    if (error) throw error;
    
    logger.info('Successfully cleaned up old notifications');
  } catch (error) {
    logger.error('Error cleaning up notifications', error as Error);
    throw error;
  }
}

/**
 * Clean up old analytics events (older than 30 days)
 */
async function cleanupAnalyticsEvents(): Promise<void> {
  try {
    logger.info('Cleaning up old analytics events');
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);
    
    const { error } = await supabase
      .from('analytics_events')
      .delete()
      .lt('timestamp', cutoffDate.toISOString());
      
    if (error) throw error;
    
    logger.info('Successfully cleaned up old analytics events');
  } catch (error) {
    logger.error('Error cleaning up analytics events', error as Error);
    throw error;
  }
}