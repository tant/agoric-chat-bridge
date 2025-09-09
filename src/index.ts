#!/usr/bin/env node

import { ChatIntegration } from './chat-integration';
import { FastifyServer } from './server/fastify-server';
import { loadConfig } from './config/config';
import { funLogger } from './utils/fun-logger';

async function main() {
  funLogger.startup('🚀 Welcome to Agoric Chat Bridge!');
  const config = loadConfig();
  const integration = await ChatIntegration.create();
  let fastifyServer: FastifyServer | null = null;

  // Handle graceful shutdown
  const shutdown = async () => {
    funLogger.shutdown('\n🛑 Shutting down gracefully...');
    
    if (fastifyServer) {
      await fastifyServer.stop();
    }
    
    await integration.shutdown();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

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
      funLogger.success(`🚀 Fastify server running on http://${config.fastify.host}:${config.fastify.port}`);
    }

    // Show final status
    const status = integration.getStatus();
    funLogger.showStatus(status);

    if (config.fastify?.enabled) {
      funLogger.info('🎮 Agoric Chat Bridge with HTTP API is GO! Press Ctrl+C to stop.');
      funLogger.info(`📡 Health check: http://${config.fastify.host}:${config.fastify.port}/health`);
      funLogger.info(`🔗 Telegram webhook: http://${config.fastify.host}:${config.fastify.port}/webhook/telegram`);
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
