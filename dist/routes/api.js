"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../utils/database");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
const logger = (0, logger_1.createLogger)('api-routes');
/**
 * Get latest products
 */
router.get('/products', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const page = parseInt(req.query.page) || 0;
        const offset = page * limit;
        const query = database_1.supabase
            .from('products')
            .select('*')
            .order('last_updated', { ascending: false })
            .range(offset, offset + limit - 1);
        // Apply filters if provided
        if (req.query.category) {
            query.eq('category', req.query.category);
        }
        if (req.query.q) {
            query.or(`name.ilike.%${req.query.q}%,description.ilike.%${req.query.q}%,hts_code.ilike.%${req.query.q}%`);
        }
        const { data, error, count } = await query;
        if (error)
            throw error;
        res.json({
            data,
            meta: {
                total: count,
                page,
                limit
            }
        });
    }
    catch (error) {
        logger.error('Error fetching products', error);
        res.status(500).json({
            error: 'Failed to fetch products',
            details: error instanceof Error ? error.message : undefined
        });
    }
});
/**
 * Get product by ID
 */
router.get('/products/:id', async (req, res) => {
    try {
        const { data, error } = await database_1.supabase
            .from('products')
            .select(`
        *,
        compliance_requirements(*),
        tariff_rates(
          *,
          countries(*)
        )
      `)
            .eq('id', req.params.id)
            .single();
        if (error)
            throw error;
        if (!data) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.json({ data });
    }
    catch (error) {
        logger.error(`Error fetching product ${req.params.id}`, error);
        res.status(500).json({
            error: 'Failed to fetch product',
            details: error instanceof Error ? error.message : undefined
        });
    }
});
/**
 * Get latest trade updates
 */
router.get('/updates', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const { data, error } = await database_1.supabase
            .from('trade_updates')
            .select('*')
            .order('published_date', { ascending: false })
            .limit(limit);
        if (error)
            throw error;
        res.json({ data });
    }
    catch (error) {
        logger.error('Error fetching trade updates', error);
        res.status(500).json({
            error: 'Failed to fetch trade updates',
            details: error instanceof Error ? error.message : undefined
        });
    }
});
/**
 * Get countries
 */
router.get('/countries', async (req, res) => {
    try {
        const { data, error } = await database_1.supabase
            .from('countries')
            .select('*')
            .order('name');
        if (error)
            throw error;
        res.json({ data });
    }
    catch (error) {
        logger.error('Error fetching countries', error);
        res.status(500).json({
            error: 'Failed to fetch countries',
            details: error instanceof Error ? error.message : undefined
        });
    }
});
/**
 * Get tariff rates for a specific product and country
 */
router.get('/tariffs/:productId/:countryId', async (req, res) => {
    try {
        const { data, error } = await database_1.supabase
            .from('tariff_rates')
            .select('*')
            .eq('product_id', req.params.productId)
            .eq('country_id', req.params.countryId)
            .order('effective_date', { ascending: false })
            .limit(1)
            .single();
        if (error)
            throw error;
        if (!data) {
            return res.status(404).json({ error: 'Tariff data not found' });
        }
        res.json({ data });
    }
    catch (error) {
        logger.error(`Error fetching tariff data for product ${req.params.productId}, country ${req.params.countryId}`, error);
        res.status(500).json({
            error: 'Failed to fetch tariff data',
            details: error instanceof Error ? error.message : undefined
        });
    }
});
exports.default = router;
