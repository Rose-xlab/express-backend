"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const body_parser_1 = require("body-parser");
const logger_1 = require("./utils/logger");
const database_1 = require("./utils/database");
const scheduler_1 = require("./jobs/scheduler");
const config_1 = __importDefault(require("./config"));
const api_1 = __importDefault(require("./routes/api"));
const sync_1 = __importDefault(require("./routes/sync"));
const status_1 = __importDefault(require("./routes/status"));
const logger = (0, logger_1.createLogger)('server');
const app = (0, express_1.default)();
const port = config_1.default.server.port;
// Middleware
app.use((0, cors_1.default)());
app.use((0, body_parser_1.json)());
// Logging middleware
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path}`);
    next();
});
// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        const dbStatus = await (0, database_1.healthCheck)();
        res.status(dbStatus ? 200 : 500).json({
            status: dbStatus ? 'ok' : 'error',
            timestamp: new Date().toISOString(),
            version: process.env.npm_package_version || '1.0.0',
            environment: config_1.default.server.env
        });
    }
    catch (error) {
        logger.error('Health check failed', error);
        res.status(500).json({
            status: 'error',
            message: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
        });
    }
});
// Routes
app.use('/api', api_1.default);
app.use('/sync', sync_1.default);
app.use('/status', status_1.default);
// 404 handler
app.use((req, res) => {
    res.status(404).json({
        status: 'error',
        message: 'Not found'
    });
});
// Error handler
app.use((err, req, res, next) => {
    logger.error('Unhandled error', err);
    res.status(500).json({
        status: 'error',
        message: config_1.default.server.env === 'production'
            ? 'Internal server error'
            : err.message
    });
});
// Start server
const server = app.listen(port, () => {
    logger.info(`Tariffs data service running on port ${port}`);
    // Start scheduled jobs
    (0, scheduler_1.startAllJobs)();
});
// Handle graceful shutdown
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
async function gracefulShutdown() {
    logger.info('Shutting down gracefully...');
    // Stop scheduled jobs
    (0, scheduler_1.stopAllJobs)();
    // Close database connections
    await (0, database_1.closeConnections)();
    // Close server
    server.close(() => {
        logger.info('Server shutdown complete');
        process.exit(0);
    });
    // Force exit after 10 seconds if still hanging
    setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
    }, 10000);
}
exports.default = app;
