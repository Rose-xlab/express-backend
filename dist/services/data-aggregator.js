"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processTradeUpdates = exports.updateTariffRates = exports.findProductsToUpdate = exports.aggregateProductData = void 0;
const logger_1 = require("../utils/logger");
const usitc_1 = require("../api/usitc");
const ustr_1 = require("../api/ustr");
const cbp_1 = require("../api/cbp");
const federal_register_1 = require("../api/federal-register");
const data_processor_1 = require("./data-processor");
const database_1 = require("../utils/database");
const logger = (0, logger_1.createLogger)('data-aggregator');
/**
 * Aggregate data for a single HTS code from all sources and store in database
 */
async function aggregateProductData(htsCode, category) {
    try {
        logger.info(`Starting data aggregation for HTS code ${htsCode}`);
        // Step 1: Fetch data from all sources in parallel
        const [generalRates, section301Tariffs, exclusions, rulings, effectiveDates] = await Promise.all([
            (0, usitc_1.getGeneralRates)(htsCode),
            (0, ustr_1.getSection301Tariffs)(),
            (0, ustr_1.getExclusions)(htsCode),
            (0, cbp_1.getRulings)(htsCode),
            (0, federal_register_1.getEffectiveDates)(htsCode)
        ]);
        logger.debug(`Fetched data for ${htsCode} from all sources`);
        // Step 2: Filter section301 tariffs for this HTS code
        const relevantTariffs = section301Tariffs.filter(tariff => tariff.hts_code === htsCode);
        // Step 3: Process and store base product information
        const productId = await (0, data_processor_1.processProductData)(generalRates, category);
        if (!productId) {
            throw new Error(`Failed to process product data for ${htsCode}`);
        }
        // Step 4: Process and store additional information
        await Promise.all([
            (0, data_processor_1.processAdditionalRates)(productId, relevantTariffs),
            (0, data_processor_1.processExclusions)(productId, exclusions),
            (0, data_processor_1.processRulings)(productId, rulings),
            (0, data_processor_1.processEffectiveDates)(productId, effectiveDates)
        ]);
        // Step 5: Update total rate
        await (0, data_processor_1.updateTotalRate)(productId);
        logger.info(`Successfully aggregated data for HTS code ${htsCode}`);
    }
    catch (error) {
        logger.error(`Error aggregating data for HTS code ${htsCode}`, error);
        throw error;
    }
}
exports.aggregateProductData = aggregateProductData;
/**
 * Find products in database that need to be updated
 */
async function findProductsToUpdate(limit = 100) {
    try {
        // Get products that haven't been updated in the last 7 days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const { data, error } = await database_1.supabase
            .from('products')
            .select('hts_code')
            .lt('last_updated', sevenDaysAgo.toISOString())
            .order('last_updated', { ascending: true })
            .limit(limit);
        if (error)
            throw error;
        return data.map(product => product.hts_code);
    }
    catch (error) {
        logger.error('Error finding products to update', error);
        throw error;
    }
}
exports.findProductsToUpdate = findProductsToUpdate;
/**
 * Update tariff rates for countries and products
 */
async function updateTariffRates(productId, countryId, baseRate, additionalRates, effectiveDate) {
    try {
        logger.info(`Updating tariff rates for product ${productId}, country ${countryId}`);
        // Calculate total rate
        let totalRate = baseRate;
        for (const rate of additionalRates) {
            totalRate += parseFloat(String(rate.rate)) || 0;
        }
        // Create or update tariff rate entry
        const { error } = await database_1.supabase
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
        if (error)
            throw error;
        logger.info(`Successfully updated tariff rates for product ${productId}, country ${countryId}`);
    }
    catch (error) {
        logger.error(`Error updating tariff rates for product ${productId}, country ${countryId}`, error);
        throw error;
    }
}
exports.updateTariffRates = updateTariffRates;
/**
 * Process trade updates from Federal Register notices
 */
async function processTradeUpdates() {
    try {
        logger.info('Processing trade updates');
        const notices = await (0, federal_register_1.getEffectiveDates)('tariff');
        // Process each notice
        for (const notice of notices) {
            // Check if notice already exists
            const { data: existingNotice, error: checkError } = await database_1.supabase
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
            const { error } = await database_1.supabase
                .from('trade_updates')
                .insert({
                title: notice.title,
                description: notice.abstract,
                impact,
                source_url: notice.html_url,
                source_reference: notice.document_number,
                published_date: notice.publication_date
            });
            if (error)
                throw error;
            logger.info(`Processed trade update: ${notice.document_number}`);
        }
        logger.info('Successfully processed all trade updates');
    }
    catch (error) {
        logger.error('Error processing trade updates', error);
        throw error;
    }
}
exports.processTradeUpdates = processTradeUpdates;
/**
 * Determine impact level of a notice
 */
function determineImpactLevel(notice) {
    const content = (notice.title + ' ' + notice.abstract).toLowerCase();
    // Check for high impact keywords
    if (content.includes('immediate effect') ||
        content.includes('significant change') ||
        content.includes('major revision') ||
        content.includes('substantial increase')) {
        return 'high';
    }
    // Check for medium impact keywords
    if (content.includes('modification') ||
        content.includes('amendment') ||
        content.includes('updated rates') ||
        content.includes('changes to')) {
        return 'medium';
    }
    // Default to low impact
    return 'low';
}
