#!/usr/bin/env node

import { ChatIntegration } from './chat-integration';
import { funLogger } from './utils/fun-logger';

async function main() {
  funLogger.startup('🚀 Welcome to Agoric Chat Bridge!');
  const integration = await ChatIntegration.create();

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    funLogger.shutdown('\n🛑 Received interrupt signal! Shutting down gracefully...');
    await integration.shutdown();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    funLogger.shutdown('\n☠️  Received termination signal! Shutting down gracefully...');
    await integration.shutdown();
    process.exit(0);
  });

  try {
    // Show awesome banner
    await funLogger.showBanner();

    await integration.initialize();

    // Show final status
    const status = integration.getStatus();
    funLogger.showStatus(status);

    funLogger.info('🎮 Agoric Chat Bridge is GO! Press Ctrl+C to stop the magic.');

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
