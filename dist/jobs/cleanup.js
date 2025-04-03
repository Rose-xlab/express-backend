"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupJob = void 0;
const logger_1 = require("../utils/logger");
const database_1 = require("../utils/database");
const cache_1 = require("../utils/cache");
const logger = (0, logger_1.createLogger)('cleanup');
/**
 * Cleanup job to remove old data and cached items
 */
async function cleanupJob() {
    try {
        logger.info('Starting cleanup job');
        // Clear expired cache items
        cache_1.apiCache.flush();
        cache_1.cache.flush();
        // Keep reference cache longer, just log stats
        const referenceStats = cache_1.referenceCache.stats();
        logger.info(`Reference cache stats: ${JSON.stringify(referenceStats)}`);
        // Clean up old sync status records - keep last 100
        await cleanupSyncRecords();
        // Clean up old notifications - keep last 90 days
        await cleanupNotifications();
        // Clean up analytics events - keep last 30 days
        await cleanupAnalyticsEvents();
        logger.info('Cleanup job completed successfully');
    }
    catch (error) {
        logger.error('Error during cleanup job', error);
        throw error;
    }
}
exports.cleanupJob = cleanupJob;
/**
 * Clean up old sync status records
 */
async function cleanupSyncRecords() {
    try {
        logger.info('Cleaning up old sync status records');
        // Get IDs of records to keep
        const { data: recordsToKeep, error: fetchError } = await database_1.supabase
            .from('sync_status')
            .select('id')
            .order('started_at', { ascending: false })
            .limit(100);
        if (fetchError)
            throw fetchError;
        if (!recordsToKeep || recordsToKeep.length === 0) {
            logger.info('No sync status records found, nothing to clean up');
            return;
        }
        // Delete all records except the ones to keep
        const keepIds = recordsToKeep.map(record => record.id);
        const { error: deleteError } = await database_1.supabase
            .from('sync_status')
            .delete()
            .not('id', 'in', `(${keepIds.join(',')})`);
        if (deleteError)
            throw deleteError;
        logger.info('Successfully cleaned up old sync status records');
    }
    catch (error) {
        logger.error('Error cleaning up sync status records', error);
        throw error;
    }
}
/**
 * Clean up old notifications (older than 90 days)
 */
async function cleanupNotifications() {
    try {
        logger.info('Cleaning up old notifications');
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 90);
        const { error } = await database_1.supabase
            .from('notifications')
            .delete()
            .lt('created_at', cutoffDate.toISOString());
        if (error)
            throw error;
        logger.info('Successfully cleaned up old notifications');
    }
    catch (error) {
        logger.error('Error cleaning up notifications', error);
        throw error;
    }
}
/**
 * Clean up old analytics events (older than 30 days)
 */
async function cleanupAnalyticsEvents() {
    try {
        logger.info('Cleaning up old analytics events');
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 30);
        const { error } = await database_1.supabase
            .from('analytics_events')
            .delete()
            .lt('timestamp', cutoffDate.toISOString());
        if (error)
            throw error;
        logger.info('Successfully cleaned up old analytics events');
    }
    catch (error) {
        logger.error('Error cleaning up analytics events', error);
        throw error;
    }
}
