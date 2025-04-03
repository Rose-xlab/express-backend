"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeConnections = exports.healthCheck = exports.executeTransaction = exports.runQuery = exports.supabase = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const pg_1 = require("pg");
const config_1 = __importDefault(require("../config"));
const logger_1 = require("./logger");
const logger = (0, logger_1.createLogger)('database');
if (!config_1.default.database.url || !config_1.default.database.key) {
    logger.error('Missing Supabase credentials in environment variables');
    process.exit(1);
}
// Supabase client for most operations
exports.supabase = (0, supabase_js_1.createClient)(config_1.default.database.url, config_1.default.database.key);
// Direct Postgres connection for complex queries and transactions
let pgPool = null;
if (config_1.default.database.pgUrl) {
    pgPool = new pg_1.Pool({
        connectionString: config_1.default.database.pgUrl,
    });
}
async function runQuery(query, params = []) {
    if (!pgPool) {
        throw new Error('PostgreSQL connection not configured');
    }
    const client = await pgPool.connect();
    try {
        const result = await client.query(query, params);
        return result.rows;
    }
    finally {
        client.release();
    }
}
exports.runQuery = runQuery;
async function executeTransaction(callback) {
    if (!pgPool) {
        throw new Error('PostgreSQL connection not configured');
    }
    const client = await pgPool.connect();
    try {
        await client.query('BEGIN');
        await callback(client);
        await client.query('COMMIT');
    }
    catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
    finally {
        client.release();
    }
}
exports.executeTransaction = executeTransaction;
async function healthCheck() {
    try {
        const { data, error } = await exports.supabase.from('products').select('id').limit(1);
        if (error)
            throw error;
        if (pgPool) {
            const client = await pgPool.connect();
            await client.query('SELECT 1');
            client.release();
        }
        return true;
    }
    catch (error) {
        logger.error('Database health check failed', error);
        return false;
    }
}
exports.healthCheck = healthCheck;
async function closeConnections() {
    if (pgPool) {
        await pgPool.end();
    }
}
exports.closeConnections = closeConnections;
