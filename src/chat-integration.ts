import { TelegramAdapter } from './adapters/telegram/telegram-adapter';
import { ZaloAdapter } from './adapters/zalo/zalo-adapter';
import { type AppConfig, loadConfig, type ZaloPersonalPlatformConfig } from './config/config';
import type { ChatAdapter } from './types/adapter';
import { ChatPlatform, type ChatResponse, type Message } from './types/message';
import { funLogger } from './utils/fun-logger';
import { MastraClient } from './utils/mastra-client';

export class ChatIntegration {
  private static globalInstance: ChatIntegration | null = null;
  private config: AppConfig;
  private mastraClient: MastraClient;
  private adapters: Map<ChatPlatform, ChatAdapter> = new Map();
  private isRunning: boolean = false;

  constructor(config?: AppConfig) {
    this.config = config || loadConfig();
    this.mastraClient = new MastraClient(this.config.mastra);
  }

  static async create(config?: AppConfig): Promise<ChatIntegration> {
    funLogger.info('🔍 Checking for existing ChatIntegration instances...');

    // Shutdown existing instance if running
    if (ChatIntegration.globalInstance) {
      funLogger.info('🔄 Shutting down existing ChatIntegration instance...');
      await ChatIntegration.globalInstance.shutdown();
      ChatIntegration.globalInstance = null;
    }

    // Create new instance
    const instance = new ChatIntegration(config);
    ChatIntegration.globalInstance = instance;
    
    funLogger.success('✅ New ChatIntegration instance created');
    return instance;
  }

  async initialize(): Promise<void> {
    funLogger.startLoading('Initializing Agoric Chat Bridge');
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Dramatic pause
    funLogger.stopLoading();
    funLogger.startup('🎯 Agoric Chat Bridge Starting Up!');

    // Check Mastra agent connection
    funLogger.startLoading('Connecting to Mastra AI Brain');
    const isHealthy = await this.mastraClient.healthCheck();
    funLogger.stopLoading();

    if (!isHealthy) {
      funLogger.warning('🤖 Mastra agent seems sleepy... Continuing anyway!');
    } else {
      funLogger.health('🤖 Mastra AI Brain is ALIVE and ready!');
    }

    // Initialize enabled platforms
    await this.initializePlatforms();

    this.isRunning = true;
    await funLogger.rocketLaunch();
    funLogger.success('🎉 Agoric Chat Bridge is LIVE and ready to rock!');
    funLogger.info(`🌟 Active platforms: ${Array.from(this.adapters.keys()).join(', ')}`);
  }

  private async initializePlatforms(): Promise<void> {
    const platforms = this.config.platforms;

    // Initialize Telegram
    if (platforms[ChatPlatform.TELEGRAM]?.enabled) {
      const telegramAdapter = new TelegramAdapter(platforms[ChatPlatform.TELEGRAM]);
      telegramAdapter.onMessage(this.handleMessage.bind(this));
      await telegramAdapter.connect();
      this.adapters.set(ChatPlatform.TELEGRAM, telegramAdapter);
      funLogger.platform('telegram', 'Connected and ready for messages! 📱✨');
    }

    // Initialize Zalo Personal
    if (platforms[ChatPlatform.ZALO_PERSONAL]?.enabled) {
      const zaloPersonalConfig = platforms[
        ChatPlatform.ZALO_PERSONAL
      ] as ZaloPersonalPlatformConfig;

      // Check if we should use personal configuration (zca-js)
      if (zaloPersonalConfig.cookie && zaloPersonalConfig.imei && zaloPersonalConfig.userAgent) {
        try {
          const zaloPersonalAdapter = await ZaloAdapter.create({
            enabled: true,
            cookie: zaloPersonalConfig.cookie,
            imei: zaloPersonalConfig.imei,
            userAgent: zaloPersonalConfig.userAgent,
            selfListen: zaloPersonalConfig.selfListen || false,
            checkUpdate: zaloPersonalConfig.checkUpdate || false,
            logging: zaloPersonalConfig.logging !== false,
          });

          if (zaloPersonalAdapter) {
            zaloPersonalAdapter.onMessage(this.handleMessage.bind(this));
            this.adapters.set(ChatPlatform.ZALO_PERSONAL, zaloPersonalAdapter);
            funLogger.platform('zalo-personal', 'Personal account connected and ready! 💙✨');
          } else {
            funLogger.error('❌ Failed to create Zalo Personal adapter instance');
          }
        } catch (error) {
          funLogger.error('💥 Failed to initialize Zalo Personal adapter', error);
        }
      } else {
        funLogger.warning('💙 Zalo Personal requires cookie, IMEI, and userAgent configuration.');
      }
    }

    // TODO: Initialize other platforms (Zalo OA, Line, WhatsApp, Viber)
    // These would be implemented similarly to the Telegram adapter

    // Zalo Personal initialization is now handled above

    if (platforms[ChatPlatform.LINE]?.enabled) {
      funLogger.warning('💚 Line adapter coming soon! Stay tuned! 📺');
    }

    if (platforms[ChatPlatform.WHATSAPP]?.enabled) {
      funLogger.warning('💬 WhatsApp adapter under construction! 🚧');
    }

    if (platforms[ChatPlatform.VIBER]?.enabled) {
      funLogger.warning('💜 Viber adapter in development mode! 👨‍💻');
    }
  }

  private async handleMessage(message: Message): Promise<ChatResponse | undefined> {
    try {
      funLogger.chat(message.platform, `📨 "${message.content}"`);

      // Check if repeat mode is enabled
      const isRepeatMode = process.env.REPEAT_MODE === 'true';

      if (isRepeatMode) {
        funLogger.repeat('🎵 ECHO MODE ACTIVATED! Bouncing message back!');
        return {
          content: `Echo: ${message.content}`,
          messageType: message.messageType,
          metadata: {
            mode: 'repeat',
            originalMessage: message.content,
          },
        };
      }

      // Send message to Mastra agent and get response
      const response = await this.mastraClient.sendMessage(message);

      funLogger.response(message.platform, `"${response.content}"`);

      return response;
    } catch (error) {
      funLogger.error('💥 Oops! Message processing went boom!', error);
      return {
        content: 'Sorry, I encountered an error processing your message. Please try again.',
        messageType: message.messageType,
        metadata: {},
      };
    }
  }

  async shutdown(): Promise<void> {
    funLogger.shutdown('🛑 Agoric Chat Bridge shutting down gracefully...');

    // Disconnect all adapters
    for (const [platform, adapter] of this.adapters) {
      try {
        if ('forceShutdown' in adapter && typeof adapter.forceShutdown === 'function') {
          await adapter.forceShutdown();
        } else {
          await adapter.disconnect();
        }
        funLogger.success(`🔌 ${platform} disconnected gracefully`);
      } catch (error) {
        funLogger.error(`💥 Trouble disconnecting ${platform}`, error);
      }
    }

    this.adapters.clear();
    this.isRunning = false;
    
    // Clear global instance reference
    if (ChatIntegration.globalInstance === this) {
      ChatIntegration.globalInstance = null;
    }
    
    funLogger.shutdown('😴 Agoric Chat Bridge is now sleeping. Good night!');
  }

  getStatus(): {
    running: boolean;
    platforms: string[];
    mastraEndpoint: string;
  } {
    return {
      running: this.isRunning,
      platforms: Array.from(this.adapters.keys()),
      mastraEndpoint: this.config.mastra.endpoint,
    };
  }

  getAdapter(platform: ChatPlatform): ChatAdapter | undefined {
    return this.adapters.get(platform);
  }

  getAdapters(): Map<ChatPlatform, ChatAdapter> {
    return this.adapters;
  }

  getAdapterHealthStatus() {
    const healthStatus: Record<string, any> = {};

    for (const [platform, adapter] of this.adapters) {
      if ('getAdapterStatus' in adapter && typeof adapter.getAdapterStatus === 'function') {
        healthStatus[platform] = adapter.getAdapterStatus();
      } else {
        healthStatus[platform] = {
          platform: adapter.platform,
          running: adapter.isConnected,
          basic: true,
        };
      }
    }

    return healthStatus;
  }
}
