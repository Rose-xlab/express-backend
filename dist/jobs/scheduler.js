"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stopAllJobs = exports.startAllJobs = exports.cleanupCronJob = exports.updateSyncJob = exports.tariffSyncJob = exports.productSyncJob = void 0;
const cron_1 = require("cron");
const logger_1 = require("../utils/logger");
const sync_products_1 = require("./sync-products");
const sync_tariffs_1 = require("./sync-tariffs");
const sync_updates_1 = require("./sync-updates");
const cleanup_1 = require("./cleanup");
const logger = (0, logger_1.createLogger)('scheduler');
// Products sync job - runs daily at 1:00 AM
exports.productSyncJob = new cron_1.CronJob('0 1 * * *', async () => {
    try {
        logger.info('Starting scheduled product sync job');
        await (0, sync_products_1.syncProducts)();
        logger.info('Product sync job completed successfully');
    }
    catch (error) {
        logger.error('Product sync job failed', error);
    }
});
// Tariffs sync job - runs daily at 2:00 AM
exports.tariffSyncJob = new cron_1.CronJob('0 2 * * *', async () => {
    try {
        logger.info('Starting scheduled tariff sync job');
        await (0, sync_tariffs_1.syncTariffs)();
        logger.info('Tariff sync job completed successfully');
    }
    catch (error) {
        logger.error('Tariff sync job failed', error);
    }
});
// Updates sync job - runs every 4 hours
exports.updateSyncJob = new cron_1.CronJob('0 */4 * * *', async () => {
    try {
        logger.info('Starting scheduled update sync job');
        await (0, sync_updates_1.syncUpdates)();
        logger.info('Update sync job completed successfully');
    }
    catch (error) {
        logger.error('Update sync job failed', error);
    }
});
// Cleanup job - runs daily at 3:00 AM
exports.cleanupCronJob = new cron_1.CronJob('0 3 * * *', async () => {
    try {
        logger.info('Starting scheduled cleanup job');
        await (0, cleanup_1.cleanupJob)();
        logger.info('Cleanup job completed successfully');
    }
    catch (error) {
        logger.error('Cleanup job failed', error);
    }
});
function startAllJobs() {
    exports.productSyncJob.start();
    exports.tariffSyncJob.start();
    exports.updateSyncJob.start();
    exports.cleanupCronJob.start();
    logger.info('All scheduled jobs started');
}
exports.startAllJobs = startAllJobs;
function stopAllJobs() {
    exports.productSyncJob.stop();
    exports.tariffSyncJob.stop();
    exports.updateSyncJob.stop();
    exports.cleanupCronJob.stop();
    logger.info('All scheduled jobs stopped');
}
exports.stopAllJobs = stopAllJobs;
