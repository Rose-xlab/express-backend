"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sync_updates_1 = require("../jobs/sync-updates");
const logger_1 = require("../utils/logger");
const database_1 = require("../utils/database");
const logger = (0, logger_1.createLogger)('run-update-sync');
/**
 * Script to run update sync manually
 */
async function main() {
    try {
        logger.info('Starting manual updates sync');
        await (0, sync_updates_1.syncUpdates)();
        logger.info('Updates sync completed successfully');
        process.exit(0);
    }
    catch (error) {
        logger.error('Updates sync failed', error);
        await (0, database_1.closeConnections)();
        process.exit(1);
    }
}
main();
