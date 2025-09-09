#!/usr/bin/env node

import { ChatIntegration } from './chat-integration';
import { loadConfig } from './config/config';
import { FastifyServer } from './server/fastify-server';
import { funLogger } from './utils/fun-logger';

async function main() {
  funLogger.startup('🚀 Welcome to Agoric Chat Bridge!');
  const config = loadConfig();
  const integration = await ChatIntegration.create();
  let fastifyServer: FastifyServer | null = null;
  let isShuttingDown = false;

  // Handle graceful shutdown
  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    funLogger.shutdown(`\n🛑 Received ${signal}, shutting down gracefully...`);

    try {
      // Parallel shutdown for better performance
      const shutdownPromises = [];

      if (fastifyServer) {
        shutdownPromises.push(fastifyServer.stop());
      }

      shutdownPromises.push(integration.shutdown());

      await Promise.all(shutdownPromises);
      funLogger.success('✅ Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      funLogger.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  };

  // Enhanced signal handling
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGQUIT', () => shutdown('SIGQUIT'));

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    funLogger.error('💥 Uncaught Exception:', error);
    shutdown('UNCAUGHT_EXCEPTION');
  });

  process.on('unhandledRejection', (reason, promise) => {
    funLogger.error(`💥 Unhandled Rejection at: ${promise} reason: ${reason}`);
    shutdown('UNHANDLED_REJECTION');
  });

  try {
    // Show awesome banner
    await funLogger.showBanner();

    await integration.initialize();

    // Start Fastify server if enabled
    if (config.fastify?.enabled) {
      funLogger.info('🌐 Starting Fastify HTTP server...');
      fastifyServer = new FastifyServer(integration, {
        host: config.fastify.host,
        port: config.fastify.port,
        logLevel: config.fastify.logLevel as any,
        enableCors: config.fastify.allowedOrigins !== false,
      });

      await fastifyServer.start(config.fastify.host, config.fastify.port);
      funLogger.success(
        `🚀 Fastify server running on http://${config.fastify.host}:${config.fastify.port}`,
      );
    }

    // Show final status
    const status = integration.getStatus();
    funLogger.showStatus(status);

    if (config.fastify?.enabled) {
      funLogger.info('🎮 Agoric Chat Bridge with HTTP API is GO! Press Ctrl+C to stop.');
      funLogger.info(
        `📡 Health check: http://${config.fastify.host}:${config.fastify.port}/health`,
      );
      funLogger.info(
        `🔗 Telegram webhook: http://${config.fastify.host}:${config.fastify.port}/webhook/telegram`,
      );
    } else {
      funLogger.info('🎮 Agoric Chat Bridge (CLI mode) is GO! Press Ctrl+C to stop.');
    }

    // Keep the process running with fun health checks
    setInterval(() => {
      const status = integration.getStatus();
      if (!status.running) {
        funLogger.error('💀 Agoric Chat Bridge died unexpectedly! RIP...');
        process.exit(1);
      }
    }, 30000); // Check every 30 seconds
  } catch (error) {
    funLogger.error('💥 Failed to launch Agoric Chat Bridge!', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export * from './chat-integration';
export * from './config/config';
export * from './types/adapter';
export * from './types/message';
