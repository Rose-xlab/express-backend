import PQueue from 'p-queue';
import pRetry from 'p-retry';
import { createLogger } from '../utils/logger';
import { getHtsChapter } from '../api/usitc';
import { aggregateProductData, findProductsToUpdate } from '../services/data-aggregator';
import { supabase } from '../utils/database';
import config from '../config';

const logger = createLogger('sync-products');

/**
 * Sync all products or update existing ones
 */
export async function syncProducts(fullSync: boolean = false): Promise<void> {
  const queue = new PQueue({ concurrency: config.sync.concurrency });
  
  try {
    logger.info(`Starting product sync (full sync: ${fullSync})`);
    
    // Create sync status record
    const { data: syncRecord, error: syncError } = await supabase
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
    } else {
      // Update only products that need updating
      await incrementalProductSync(queue);
    }
    
    // Update sync status
    if (syncId) {
      await supabase
        .from('sync_status')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', syncId);
    }
    
    logger.info('Product sync completed successfully');
  } catch (error) {
    logger.error('Error during product sync', error as Error);
    
    // Update sync status on error
    await supabase
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

/**
 * Perform full sync of all HTS chapters
 */
async function fullProductSync(queue: PQueue): Promise<void> {
  logger.info('Starting full product sync');
  
  // Process all HTS chapters (1-99)
  for (let chapter = 1; chapter <= 99; chapter++) {
    const chapterStr = chapter.toString().padStart(2, '0');
    
    queue.add(() => 
      pRetry(
        async () => {
          logger.info(`Processing HTS chapter ${chapterStr}`);
          
          try {
            const chapterData = await getHtsChapter(chapterStr);
            
            // Process each section and rate in the chapter
            for (const section of chapterData.sections) {
              for (const rate of section.rates) {
                await aggregateProductData(
                  rate.hts_code,
                  section.description
                );
              }
            }
            
            logger.info(`Completed processing HTS chapter ${chapterStr}`);
          } catch (error) {
            logger.error(`Error processing HTS chapter ${chapterStr}`, error as Error);
            throw error;
          }
        },
        { 
          retries: config.sync.retries,
          onFailedAttempt: (error) => {
            logger.warn(`Attempt failed for chapter ${chapterStr}: ${error.message}, retrying...`);
          }
        }
      )
    );
  }
  
  // Wait for all queue items to complete
  await queue.onIdle();
  logger.info('Full product sync completed');
}

/**
 * Update only products that need updating
 */
async function incrementalProductSync(queue: PQueue): Promise<void> {
  logger.info('Starting incremental product sync');
  
  // Find products that need updating
  const htsCodes = await findProductsToUpdate(config.sync.batchSize);
  
  if (htsCodes.length === 0) {
    logger.info('No products need updating');
    return;
  }
  
  logger.info(`Found ${htsCodes.length} products to update`);
  
  // Get product categories
  const { data: products, error } = await supabase
    .from('products')
    .select('hts_code, category')
    .in('hts_code', htsCodes);
    
  if (error) {
    throw error;
  }
  
  // Create a lookup map for categories
  const categoryMap = new Map<string, string>();
  for (const product of products) {
    categoryMap.set(product.hts_code, product.category);
  }
  
  // Update each product
  for (const htsCode of htsCodes) {
    const category = categoryMap.get(htsCode) || 'Uncategorized';
    
    queue.add(() => 
      pRetry(
        async () => {
          await aggregateProductData(htsCode, category);
        },
        { 
          retries: config.sync.retries,
          onFailedAttempt: (error) => {
            logger.warn(`Attempt failed for product ${htsCode}: ${error.message}, retrying...`);
          }
        }
      )
    );
  }
  
  // Wait for all queue items to complete
  await queue.onIdle();
  logger.info('Incremental product sync completed');
}