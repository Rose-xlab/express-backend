import { CronJob } from 'cron';
import { createLogger } from '../utils/logger';
import { syncProducts } from './sync-products';
import { syncTariffs } from './sync-tariffs';
import { syncUpdates } from './sync-updates';
import { cleanupJob } from './cleanup';

const logger = createLogger('scheduler');

// Products sync job - runs daily at 1:00 AM
export const productSyncJob = new CronJob('0 1 * * *', async () => {
  try {
    logger.info('Starting scheduled product sync job');
    await syncProducts();
    logger.info('Product sync job completed successfully');
  } catch (error) {
    logger.error('Product sync job failed', error as Error);
  }
});

// Tariffs sync job - runs daily at 2:00 AM
export const tariffSyncJob = new CronJob('0 2 * * *', async () => {
  try {
    logger.info('Starting scheduled tariff sync job');
    await syncTariffs();
    logger.info('Tariff sync job completed successfully');
  } catch (error) {
    logger.error('Tariff sync job failed', error as Error);
  }
});

// Updates sync job - runs every 4 hours
export const updateSyncJob = new CronJob('0 */4 * * *', async () => {
  try {
    logger.info('Starting scheduled update sync job');
    await syncUpdates();
    logger.info('Update sync job completed successfully');
  } catch (error) {
    logger.error('Update sync job failed', error as Error);
  }
});

// Cleanup job - runs daily at 3:00 AM
export const cleanupCronJob = new CronJob('0 3 * * *', async () => {
  try {
    logger.info('Starting scheduled cleanup job');
    await cleanupJob();
    logger.info('Cleanup job completed successfully');
  } catch (error) {
    logger.error('Cleanup job failed', error as Error);
  }
});

export function startAllJobs() {
  productSyncJob.start();
  tariffSyncJob.start();
  updateSyncJob.start();
  cleanupCronJob.start();
  
  logger.info('All scheduled jobs started');
}

export function stopAllJobs() {
  productSyncJob.stop();
  tariffSyncJob.stop();
  updateSyncJob.stop();
  cleanupCronJob.stop();
  
  logger.info('All scheduled jobs stopped');
}