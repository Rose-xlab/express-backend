import { createLogger } from '../utils/logger';
import { getGeneralRates } from '../api/usitc';
import { getSection301Tariffs, getExclusions } from '../api/ustr';
import { getRulings } from '../api/cbp';
import { getEffectiveDates } from '../api/federal-register';
import { 
  processProductData, 
  processAdditionalRates, 
  processExclusions, 
  processRulings, 
  processEffectiveDates,
  updateTotalRate
} from './data-processor';
import { supabase } from '../utils/database';

const logger = createLogger('data-aggregator');

/**
 * Aggregate data for a single HTS code from all sources and store in database
 */
export async function aggregateProductData(
  htsCode: string, 
  category: string
): Promise<void> {
  try {
    logger.info(`Starting data aggregation for HTS code ${htsCode}`);
    
    // Step 1: Fetch data from all sources in parallel
    const [
      generalRates,
      section301Tariffs,
      exclusions,
      rulings,
      effectiveDates
    ] = await Promise.all([
      getGeneralRates(htsCode),
      getSection301Tariffs(),
      getExclusions(htsCode),
      getRulings(htsCode),
      getEffectiveDates(htsCode)
    ]);
    
    logger.debug(`Fetched data for ${htsCode} from all sources`);
    
    // Step 2: Filter section301 tariffs for this HTS code
    const relevantTariffs = section301Tariffs.filter(
      tariff => tariff.hts_code === htsCode
    );
    
    // Step 3: Process and store base product information
    const productId = await processProductData(generalRates, category);
    
    if (!productId) {
      throw new Error(`Failed to process product data for ${htsCode}`);
    }
    
    // Step 4: Process and store additional information
    await Promise.all([
      processAdditionalRates(productId, relevantTariffs),
      processExclusions(productId, exclusions),
      processRulings(productId, rulings),
      processEffectiveDates(productId, effectiveDates)
    ]);
    
    // Step 5: Update total rate
    await updateTotalRate(productId);
    
    logger.info(`Successfully aggregated data for HTS code ${htsCode}`);
  } catch (error) {
    logger.error(`Error aggregating data for HTS code ${htsCode}`, error as Error);
    throw error;
  }
}

/**
 * Find products in database that need to be updated
 */
export async function findProductsToUpdate(limit: number = 100): Promise<string[]> {
  try {
    // Get products that haven't been updated in the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const { data, error } = await supabase
      .from('products')
      .select('hts_code')
      .lt('last_updated', sevenDaysAgo.toISOString())
      .order('last_updated', { ascending: true })
      .limit(limit);
      
    if (error) throw error;
    
    return data.map(product => product.hts_code);
  } catch (error) {
    logger.error('Error finding products to update', error as Error);
    throw error;
  }
}

/**
 * Update tariff rates for countries and products
 */
export async function updateTariffRates(
  productId: string,
  countryId: string,
  baseRate: number,
  additionalRates: any[],
  effectiveDate: string
): Promise<void> {
  try {
    logger.info(`Updating tariff rates for product ${productId}, country ${countryId}`);
    
    // Calculate total rate
    let totalRate = baseRate;
    for (const rate of additionalRates) {
      totalRate += parseFloat(String(rate.rate)) || 0;
    }
    
    // Create or update tariff rate entry
    const { error } = await supabase
      .from('tariff_rates')
      .upsert({
        product_id: productId,
        country_id: countryId,
        base_rate: baseRate,
        additional_rates: additionalRates,
        total_rate: totalRate,
        effective_date: effectiveDate,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'product_id,country_id,effective_date'
      });
      
    if (error) throw error;
    
    logger.info(`Successfully updated tariff rates for product ${productId}, country ${countryId}`);
  } catch (error) {
    logger.error(`Error updating tariff rates for product ${productId}, country ${countryId}`, error as Error);
    throw error;
  }
}

/**
 * Process trade updates from Federal Register notices
 */
export async function processTradeUpdates(): Promise<void> {
  try {
    logger.info('Processing trade updates');
    
    const notices = await getEffectiveDates('tariff');
    
    // Process each notice
    for (const notice of notices) {
      // Check if notice already exists
      const { data: existingNotice, error: checkError } = await supabase
        .from('trade_updates')
        .select('id')
        .eq('source_reference', notice.document_number)
        .single();
        
      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }
      
      // Skip if already processed
      if (existingNotice) {
        logger.debug(`Notice ${notice.document_number} already processed`);
        continue;
      }
      
      // Determine impact level
      const impact = determineImpactLevel(notice);
      
      // Store notice
      const { error } = await supabase
        .from('trade_updates')
        .insert({
          title: notice.title,
          description: notice.abstract,
          impact,
          source_url: notice.html_url,
          source_reference: notice.document_number,
          published_date: notice.publication_date
        });
        
      if (error) throw error;
      
      logger.info(`Processed trade update: ${notice.document_number}`);
    }
    
    logger.info('Successfully processed all trade updates');
  } catch (error) {
    logger.error('Error processing trade updates', error as Error);
    throw error;
  }
}

/**
 * Determine impact level of a notice
 */
function determineImpactLevel(notice: any): 'low' | 'medium' | 'high' {
  const content = (notice.title + ' ' + notice.abstract).toLowerCase();
  
  // Check for high impact keywords
  if (
    content.includes('immediate effect') || 
    content.includes('significant change') ||
    content.includes('major revision') ||
    content.includes('substantial increase')
  ) {
    return 'high';
  }
  
  // Check for medium impact keywords
  if (
    content.includes('modification') || 
    content.includes('amendment') ||
    content.includes('updated rates') ||
    content.includes('changes to')
  ) {
    return 'medium';
  }
  
  // Default to low impact
  return 'low';
}