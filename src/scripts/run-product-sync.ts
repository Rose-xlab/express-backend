import { syncProducts } from '../jobs/sync-products';
import { createLogger } from '../utils/logger';
import { closeConnections } from '../utils/database';

const logger = createLogger('run-product-sync');

/**
 * Script to run product sync manually
 */
async function main() {
  try {
    const fullSync = process.argv.includes('--full');
    logger.info(`Starting manual product sync (full: ${fullSync})`);
    
    await syncProducts(fullSync);
    
    logger.info('Product sync completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Product sync failed', error as Error);
    await closeConnections();
    process.exit(1);
  }
}

main();