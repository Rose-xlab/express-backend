"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sync_tariffs_1 = require("../jobs/sync-tariffs");
const logger_1 = require("../utils/logger");
const database_1 = require("../utils/database");
const logger = (0, logger_1.createLogger)('run-tariff-sync');
/**
 * Script to run tariff sync manually
 */
async function main() {
    try {
        logger.info('Starting manual tariff sync');
        await (0, sync_tariffs_1.syncTariffs)();
        logger.info('Tariff sync completed successfully');
        process.exit(0);
    }
    catch (error) {
        logger.error('Tariff sync failed', error);
        await (0, database_1.closeConnections)();
        process.exit(1);
    }
}
main();
