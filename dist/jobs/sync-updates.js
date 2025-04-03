"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncUpdates = void 0;
const logger_1 = require("../utils/logger");
const federal_register_1 = require("../api/federal-register");
const notification_service_1 = require("../services/notification-service");
const database_1 = require("../utils/database");
const logger = (0, logger_1.createLogger)('sync-updates');
/**
 * Sync trade updates from Federal Register
 */
async function syncUpdates() {
    try {
        logger.info('Starting trade updates sync');
        // Create sync status record
        const { data: syncRecord, error: syncError } = await database_1.supabase
            .from('sync_status')
            .insert({
            type: 'updates',
            status: 'running',
            started_at: new Date().toISOString()
        })
            .select('id')
            .single();
        if (syncError) {
            logger.error('Failed to create sync status record', syncError);
        }
        const syncId = syncRecord?.id;
        // Get existing updates
        const { data: existingUpdates, error: existingError } = await database_1.supabase
            .from('trade_updates')
            .select('source_reference')
            .order('published_date', { ascending: false })
            .limit(100);
        if (existingError)
            throw existingError;
        // Get latest notices
        const notices = await (0, federal_register_1.getTariffNotices)();
        // Filter out notices that are already processed
        const existingRefs = new Set(existingUpdates.map(u => u.source_reference));
        const newNotices = notices.filter(notice => !existingRefs.has(notice.document_number));
        logger.info(`Found ${newNotices.length} new trade updates`);
        if (newNotices.length > 0) {
            // Process new notices
            for (const notice of newNotices) {
                // Determine impact level
                const impact = determineImpactLevel(notice);
                // Create update record
                const { data: update, error } = await database_1.supabase
                    .from('trade_updates')
                    .insert({
                    title: notice.title,
                    description: notice.abstract,
                    impact,
                    source_url: notice.html_url,
                    source_reference: notice.document_number,
                    published_date: notice.publication_date
                })
                    .select('id')
                    .single();
                if (error)
                    throw error;
                // Notify relevant users
                if (update) {
                    await (0, notification_service_1.notifyAboutTradeUpdates)(update.id);
                }
                logger.info(`Processed trade update: ${notice.document_number}`);
            }
        }
        // Update sync status
        if (syncId) {
            await database_1.supabase
                .from('sync_status')
                .update({
                status: 'completed',
                completed_at: new Date().toISOString()
            })
                .eq('id', syncId);
        }
        logger.info('Trade updates sync completed successfully');
    }
    catch (error) {
        logger.error('Error during trade updates sync', error);
        // Update sync status on error
        await database_1.supabase
            .from('sync_status')
            .update({
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error',
            completed_at: new Date().toISOString()
        })
            .eq('type', 'updates')
            .is('completed_at', null);
        throw error;
    }
}
exports.syncUpdates = syncUpdates;
/**
 * Determine impact level of a notice
 */
function determineImpactLevel(notice) {
    const content = (notice.title + ' ' + notice.abstract).toLowerCase();
    // Check for high impact keywords
    if (content.includes('immediate effect') ||
        content.includes('significant change') ||
        content.includes('major revision') ||
        content.includes('substantial increase')) {
        return 'high';
    }
    // Check for medium impact keywords
    if (content.includes('modification') ||
        content.includes('amendment') ||
        content.includes('updated rates') ||
        content.includes('changes to')) {
        return 'medium';
    }
    // Default to low impact
    return 'low';
}
