import PQueue from 'p-queue';
import pRetry from 'p-retry';
import { createLogger } from '../utils/logger';
import { getTradeAgreements } from '../api/ustr';
import { updateTariffRates } from '../services/data-aggregator';
import { supabase } from '../utils/database';
import { notifyProductWatchers } from '../services/notification-service';
import config from '../config';

const logger = createLogger('sync-tariffs');

/**
 * Sync tariff rates for countries and products
 */
export async function syncTariffs(): Promise<void> {
  const queue = new PQueue({ concurrency: config.sync.concurrency });
  
  try {
    logger.info('Starting tariff rates sync');
    
    // Create sync status record
    const { data: syncRecord, error: syncError } = await supabase
      .from('sync_status')
      .insert({
        type: 'tariffs',
        status: 'running',
        started_at: new Date().toISOString()
      })
      .select('id')
      .single();
      
    if (syncError) {
      logger.error('Failed to create sync status record', syncError);
    }
    
    const syncId = syncRecord?.id;
    
    // Get all countries
    const { data: countries, error: countriesError } = await supabase
      .from('countries')
      .select('id, code, name');
      
    if (countriesError) throw countriesError;
    
    if (!countries || countries.length === 0) {
      logger.warn('No countries found, skipping tariff sync');
      return;
    }
    
    // Get all trade agreements
    const agreements = await getTradeAgreements();
    
    // Create country-agreement mapping
    const countryAgreements = new Map<string, string[]>();
    for (const agreement of agreements) {
      for (const countryCode of agreement.countries) {
        if (!countryAgreements.has(countryCode)) {
          countryAgreements.set(countryCode, []);
        }
        countryAgreements.get(countryCode)?.push(agreement.code);
      }
    }
    
    // Get products to process
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, hts_code, name, base_rate, additional_rates')
      .order('last_updated', { ascending: true })
      .limit(config.sync.batchSize);
      
    if (productsError) throw productsError;
    
    if (!products || products.length === 0) {
      logger.warn('No products found, skipping tariff sync');
      return;
    }
    
    logger.info(`Processing tariff rates for ${products.length} products and ${countries.length} countries`);
    
    // Process tariff rates for each product-country combination
    for (const product of products) {
      for (const country of countries) {
        queue.add(() => 
          pRetry(
            async () => {
              try {
                // Get previous tariff rate if exists
                const { data: prevRate } = await supabase
                  .from('tariff_rates')
                  .select('total_rate')
                  .eq('product_id', product.id)
                  .eq('country_id', country.id)
                  .order('effective_date', { ascending: false })
                  .limit(1)
                  .single();
                
                const prevTotalRate = prevRate?.total_rate;
                
                // Filter additional rates for this country
                let additionalRates = [];
                if (Array.isArray(product.additional_rates)) {
                  additionalRates = product.additional_rates.filter(rate => 
                    !rate.countries || rate.countries.includes(country.code)
                  );
                }
                
                // Apply trade agreement adjustments if applicable
                const countryAgreementCodes = countryAgreements.get(country.code) || [];
                if (countryAgreementCodes.length > 0) {
                  // Adjust rates based on trade agreements
                  // Note: This is a simplification - real implementation would
                  // apply specific rules from each agreement
                  additionalRates = adjustRatesForTradeAgreements(
                    additionalRates,
                    countryAgreementCodes
                  );
                }
                
                // Update tariff rates
                await updateTariffRates(
                  product.id,
                  country.id,
                  product.base_rate,
                  additionalRates,
                  new Date().toISOString()
                );
                
                // Calculate new total rate
                let newTotalRate = product.base_rate;
                for (const rate of additionalRates) {
                  newTotalRate += parseFloat(String(rate.rate)) || 0;
                }
                
                // Notify if rate changed significantly
                if (prevTotalRate !== undefined && Math.abs(newTotalRate - prevTotalRate) >= 1) {
                  await notifyProductWatchers({
                    title: `Tariff Rate Change for ${country.name}`,
                    message: `The tariff rate for ${product.name} imported from ${country.name} has changed from ${prevTotalRate}% to ${newTotalRate}%`,
                    type: 'rate_change',
                    productId: product.id
                  });
                }
              } catch (error) {
                logger.error(`Error updating tariff rates for product ${product.id}, country ${country.id}`, error as Error);
                throw error;
              }
            },
            { 
              retries: config.sync.retries,
              onFailedAttempt: (error) => {
                logger.warn(`Attempt failed for product ${product.id}, country ${country.id}: ${error.message}, retrying...`);
              }
            }
          )
        );
      }
    }
    
    // Wait for all queue items to complete
    await queue.onIdle();
    
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
    
    logger.info('Tariff rates sync completed successfully');
  } catch (error) {
    logger.error('Error during tariff rates sync', error as Error);
    
    // Update sync status on error
    await supabase
      .from('sync_status')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        completed_at: new Date().toISOString()
      })
      .eq('type', 'tariffs')
      .is('completed_at', null);
      
    throw error;
  }
}

/**
 * Adjust rates based on trade agreements
 * This is a simplified implementation - real implementation would be more complex
 */
function adjustRatesForTradeAgreements(
  rates: any[],
  agreementCodes: string[]
): any[] {
  // This is a placeholder for real trade agreement logic
  // In a real implementation, this would apply specific rules from each agreement
  
  // Example: If there's an FTA, we might reduce or eliminate certain tariffs
  if (agreementCodes.includes('FTA')) {
    return rates.map(rate => {
      if (rate.type === 'standard') {
        return { ...rate, rate: 0 }; // Eliminate standard tariffs
      }
      return rate;
    });
  }
  
  // For now, just return the original rates
  return rates;
}