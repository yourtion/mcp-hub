import { serve } from '@hono/node-server';
import { shutdownHubApi } from './api/hub';
import { app } from './app';
import { shutdownMcpService } from './mcp';
import { initConfig } from './services/config';
import { logger } from './utils/logger';

async function startServer() {
  try {
    logger.info('Starting server initialization...');

    logger.info('Calling initConfig...');
    await initConfig();
    logger.info('initConfig completed');

    logger.info('Creating server...');
    const server = serve(
      {
        fetch: app.fetch,
        port: 3000,
      },
      (info) => {
        logger.info(`Server started on port ${info.port}`);
      },
    );

    logger.info('Server creation completed');
    return server;
  } catch (error) {
    logger.error('Failed to start server', error as Error);
    process.exit(1);
  }
}

const serverPromise = startServer();

// Graceful shutdown handling
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}, starting graceful shutdown`);

  try {
    // Shutdown services in parallel
    await Promise.all([shutdownMcpService(), shutdownHubApi()]);

    logger.info('Services shut down successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown', error as Error);
    process.exit(1);
  }
};

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
