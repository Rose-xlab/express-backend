"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncProducts = void 0;
const p_queue_1 = __importDefault(require("p-queue"));
const p_retry_1 = __importDefault(require("p-retry"));
const logger_1 = require("../utils/logger");
const usitc_1 = require("../api/usitc");
const data_aggregator_1 = require("../services/data-aggregator");
const database_1 = require("../utils/database");
const config_1 = __importDefault(require("../config"));
const logger = (0, logger_1.createLogger)('sync-products');
/**
 * Sync all products or update existing ones
 */
async function syncProducts(fullSync = false) {
    const queue = new p_queue_1.default({ concurrency: config_1.default.sync.concurrency });
    try {
        logger.info(`Starting product sync (full sync: ${fullSync})`);
        // Create sync status record
        const { data: syncRecord, error: syncError } = await database_1.supabase
            .from('sync_status')
            .insert({
            type: 'products',
            status: 'running',
            started_at: new Date().toISOString()
        })
            .select('id')
            .single();
        if (syncError) {
            logger.error('Failed to create sync status record', syncError);
        }
        const syncId = syncRecord?.id;
        if (fullSync) {
            // Perform full sync of all HTS chapters
            await fullProductSync(queue);
        }
        else {
            // Update only products that need updating
            await incrementalProductSync(queue);
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
        logger.info('Product sync completed successfully');
    }
    catch (error) {
        logger.error('Error during product sync', error);
        // Update sync status on error
        await database_1.supabase
            .from('sync_status')
            .update({
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error',
            completed_at: new Date().toISOString()
        })
            .eq('type', 'products')
            .is('completed_at', null);
        throw error;
    }
}
exports.syncProducts = syncProducts;
/**
 * Perform full sync of all HTS chapters
 */
async function fullProductSync(queue) {
    logger.info('Starting full product sync');
    // Process all HTS chapters (1-99)
    for (let chapter = 1; chapter <= 99; chapter++) {
        const chapterStr = chapter.toString().padStart(2, '0');
        queue.add(() => (0, p_retry_1.default)(async () => {
            logger.info(`Processing HTS chapter ${chapterStr}`);
            try {
                const chapterData = await (0, usitc_1.getHtsChapter)(chapterStr);
                // Process each section and rate in the chapter
                for (const section of chapterData.sections) {
                    for (const rate of section.rates) {
                        await (0, data_aggregator_1.aggregateProductData)(rate.hts_code, section.description);
                    }
                }
                logger.info(`Completed processing HTS chapter ${chapterStr}`);
            }
            catch (error) {
                logger.error(`Error processing HTS chapter ${chapterStr}`, error);
                throw error;
            }
        }, {
            retries: config_1.default.sync.retries,
            onFailedAttempt: (error) => {
                logger.warn(`Attempt failed for chapter ${chapterStr}: ${error.message}, retrying...`);
            }
        }));
    }
    // Wait for all queue items to complete
    await queue.onIdle();
    logger.info('Full product sync completed');
}
/**
 * Update only products that need updating
 */
async function incrementalProductSync(queue) {
    logger.info('Starting incremental product sync');
    // Find products that need updating
    const htsCodes = await (0, data_aggregator_1.findProductsToUpdate)(config_1.default.sync.batchSize);
    if (htsCodes.length === 0) {
        logger.info('No products need updating');
        return;
    }
    logger.info(`Found ${htsCodes.length} products to update`);
    // Get product categories
    const { data: products, error } = await database_1.supabase
        .from('products')
        .select('hts_code, category')
        .in('hts_code', htsCodes);
    if (error) {
        throw error;
    }
    // Create a lookup map for categories
    const categoryMap = new Map();
    for (const product of products) {
        categoryMap.set(product.hts_code, product.category);
    }
    // Update each product
    for (const htsCode of htsCodes) {
        const category = categoryMap.get(htsCode) || 'Uncategorized';
        queue.add(() => (0, p_retry_1.default)(async () => {
            await (0, data_aggregator_1.aggregateProductData)(htsCode, category);
        }, {
            retries: config_1.default.sync.retries,
            onFailedAttempt: (error) => {
                logger.warn(`Attempt failed for product ${htsCode}: ${error.message}, retrying...`);
            }
        }));
    }
    // Wait for all queue items to complete
    await queue.onIdle();
    logger.info('Incremental product sync completed');
}
