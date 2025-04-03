"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sync_products_1 = require("../jobs/sync-products");
const logger_1 = require("../utils/logger");
const database_1 = require("../utils/database");
const logger = (0, logger_1.createLogger)('run-product-sync');
/**
 * Script to run product sync manually
 */
async function main() {
    try {
        const fullSync = process.argv.includes('--full');
        logger.info(`Starting manual product sync (full: ${fullSync})`);
        await (0, sync_products_1.syncProducts)(fullSync);
        logger.info('Product sync completed successfully');
        process.exit(0);
    }
    catch (error) {
        logger.error('Product sync failed', error);
        await (0, database_1.closeConnections)();
        process.exit(1);
    }
}
main();
