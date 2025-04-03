import { syncUpdates } from '../jobs/sync-updates';
import { createLogger } from '../utils/logger';
import { closeConnections } from '../utils/database';

const logger = createLogger('run-update-sync');

/**
 * Script to run update sync manually
 */
async function main() {
  try {
    logger.info('Starting manual updates sync');
    
    await syncUpdates();
    
    logger.info('Updates sync completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Updates sync failed', error as Error);
    await closeConnections();
    process.exit(1);
  }
}

main();