"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkProductChanges = exports.notifyAboutTradeUpdates = exports.notifyUser = exports.notifyProductWatchers = void 0;
const logger_1 = require("../utils/logger");
const database_1 = require("../utils/database");
const logger = (0, logger_1.createLogger)('notification-service');
/**
 * Create a notification for users watching a product
 */
async function notifyProductWatchers(data) {
    try {
        logger.info(`Creating notification for product ${data.productId}`);
        if (!data.productId) {
            throw new Error('Product ID is required for product notifications');
        }
        // Find users watching this product
        const { data: watchlist, error: watchlistError } = await database_1.supabase
            .from('user_watchlists')
            .select('user_id')
            .eq('product_id', data.productId)
            .eq('notify_changes', true);
        if (watchlistError)
            throw watchlistError;
        if (!watchlist || watchlist.length === 0) {
            logger.info(`No watchers found for product ${data.productId}`);
            return;
        }
        // Create notifications for each user
        const notifications = watchlist.map(item => ({
            user_id: item.user_id,
            title: data.title,
            message: data.message,
            type: data.type,
            read: false,
            created_at: new Date().toISOString()
        }));
        const { error } = await database_1.supabase
            .from('notifications')
            .insert(notifications);
        if (error)
            throw error;
        logger.info(`Created notifications for ${notifications.length} users watching product ${data.productId}`);
    }
    catch (error) {
        logger.error(`Error creating notifications for product ${data.productId}`, error);
        throw error;
    }
}
exports.notifyProductWatchers = notifyProductWatchers;
/**
 * Send notification to specific user
 */
async function notifyUser(userId, data) {
    try {
        logger.info(`Sending notification to user ${userId}`);
        const { error } = await database_1.supabase
            .from('notifications')
            .insert({
            user_id: userId,
            title: data.title,
            message: data.message,
            type: data.type,
            read: false,
            created_at: new Date().toISOString()
        });
    }
    finally {
    }
    logger.info(`Completed change check for product ${productId}`);
}
exports.notifyUser = notifyUser;
try { }
catch (error) {
    logger.error(`Error checking product changes for ${productId}`, error);
    throw error;
}
/**
 * Notify users about new trade updates
 */
async function notifyAboutTradeUpdates(updateId) {
    try {
        logger.info(`Notifying users about trade update ${updateId}`);
        // Get update details
        const { data: update, error: updateError } = await database_1.supabase
            .from('trade_updates')
            .select('*')
            .eq('id', updateId)
            .single();
        if (updateError)
            throw updateError;
        // Extract any HTS codes mentioned in the update
        const htsCodeRegex = /\b\d{4}\.\d{2}\.\d{4}\b/g;
        const htsCodes = (update.description.match(htsCodeRegex) || []);
        if (htsCodes.length > 0) {
            // Find products matching these HTS codes
            const { data: products, error: productsError } = await database_1.supabase
                .from('products')
                .select('id, name')
                .in('hts_code', htsCodes);
            if (productsError)
                throw productsError;
            // Notify watchers of each affected product
            for (const product of products) {
                await notifyProductWatchers({
                    title: 'Trade Policy Update',
                    message: `A trade policy update may affect ${product.name}: ${update.title}`,
                    type: 'system',
                    productId: product.id
                });
            }
        }
        logger.info(`Successfully notified users about trade update ${updateId}`);
    }
    catch (error) {
        logger.error(`Error notifying about trade update ${updateId}`, error);
        throw error;
    }
}
exports.notifyAboutTradeUpdates = notifyAboutTradeUpdates;
if (error)
    throw error;
logger.info(`Successfully sent notification to user ${userId}`);
try { }
catch (error) {
    logger.error(`Error sending notification to user ${userId}`, error);
    throw error;
}
/**
 * Check product changes and send notifications
 */
async function checkProductChanges(productId, oldData, newData) {
    try {
        logger.info(`Checking for changes in product ${productId}`);
        // Check for rate changes
        if (oldData.total_rate !== newData.total_rate) {
            await notifyProductWatchers({
                title: 'Tariff Rate Changed',
                message: `The tariff rate for ${newData.name} has changed from ${oldData.total_rate}% to ${newData.total_rate}%`,
                type: 'rate_change',
                productId
            });
        }
        // Check for new rulings
        const oldRulingCount = Array.isArray(oldData.rulings) ? oldData.rulings.length : 0;
        const newRulingCount = Array.isArray(newData.rulings) ? newData.rulings.length : 0;
        if (newRulingCount > oldRulingCount) {
            await notifyProductWatchers({
                title: 'New Ruling Available',
                message: `A new customs ruling has been issued for ${newData.name}`,
                type: 'new_ruling',
                productId
            });
        }
        // Check for new exclusions
        const oldExclusionCount = Array.isArray(oldData.exclusions) ? oldData.exclusions.length : 0;
        const newExclusionCount = Array.isArray(newData.exclusions) ? newData.exclusions.length : 0;
        if (newExclusionCount > oldExclusionCount) {
            await notifyProductWatchers({
                title: 'New Exclusion Available',
                message: `A new exclusion has been added for ${newData.name}`,
                type: 'exclusion',
                productId
            });
        }
    }
    finally { }
}
exports.checkProductChanges = checkProductChanges;
