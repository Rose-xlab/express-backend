import express from 'express';
import cors from 'cors';
import { json } from 'body-parser';
import { createLogger } from './utils/logger';
import { healthCheck, closeConnections } from './utils/database';
import { startAllJobs, stopAllJobs } from './jobs/scheduler';
import config from './config';
import apiRoutes from './routes/api';
import syncRoutes from './routes/sync';
import statusRoutes from './routes/status';

const logger = createLogger('server');
const app = express();
const port = config.server.port;

// Middleware
app.use(cors());
app.use(json());

// Logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const dbStatus = await healthCheck();
    
    res.status(dbStatus ? 200 : 500).json({
      status: dbStatus ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: config.server.env
    });
  } catch (error) {
    logger.error('Health check failed', error as Error);
    
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Routes
app.use('/api', apiRoutes);
app.use('/sync', syncRoutes);
app.use('/status', statusRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Not found'
  });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error', err);
  
  res.status(500).json({
    status: 'error',
    message: config.server.env === 'production' 
      ? 'Internal server error' 
      : err.message
  });
});

// Start server
const server = app.listen(port, () => {
  logger.info(`Tariffs data service running on port ${port}`);
  
  // Start scheduled jobs
  startAllJobs();
});

// Handle graceful shutdown
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

async function gracefulShutdown() {
  logger.info('Shutting down gracefully...');
  
  // Stop scheduled jobs
  stopAllJobs();
  
  // Close database connections
  await closeConnections();
  
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

export default app;