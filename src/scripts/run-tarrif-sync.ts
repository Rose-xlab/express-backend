import { syncTariffs } from '../jobs/sync-tariffs';
import { createLogger } from '../utils/logger';
import { closeConnections } from '../utils/database';

const logger = createLogger('run-tariff-sync');

/**
 * Script to run tariff sync manually
 */
async function main() {
  try {
    logger.info('Starting manual tariff sync');
    
    await syncTariffs();
    
    logger.info('Tariff sync completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Tariff sync failed', error as Error);
    await closeConnections();
    process.exit(1);
  }
}

main();