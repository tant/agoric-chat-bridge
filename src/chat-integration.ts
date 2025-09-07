import { ChatAdapter } from './types/adapter';
import { Message, ChatResponse, ChatPlatform } from './types/message';
import { AppConfig, loadConfig, ZaloPersonalPlatformConfig } from './config/config';
import { MastraClient } from './utils/mastra-client';
import { TelegramAdapter } from './adapters/telegram/telegram-adapter';
import { ZaloAdapter } from './adapters/zalo/zalo-adapter';
import { funLogger } from './utils/fun-logger';

export class ChatIntegration {
  private config: AppConfig;
  private mastraClient: MastraClient;
  private adapters: Map<ChatPlatform, ChatAdapter> = new Map();
  private isRunning: boolean = false;

  constructor(config?: AppConfig) {
    this.config = config || loadConfig();
    this.mastraClient = new MastraClient(this.config.mastra);
  }

  async initialize(): Promise<void> {
    funLogger.startLoading('Initializing Agoric Chat Bridge');
    await new Promise(resolve => setTimeout(resolve, 1000)); // Dramatic pause
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
      const zaloPersonalConfig = platforms[ChatPlatform.ZALO_PERSONAL] as ZaloPersonalPlatformConfig;
      
      // Check if we should use personal configuration (zca-js)
      if (zaloPersonalConfig.cookie && zaloPersonalConfig.imei && zaloPersonalConfig.userAgent) {
        try {
          funLogger.startLoading('Initializing Zalo Personal connection');
          
          const zaloPersonalAdapter = await ZaloAdapter.create({
            enabled: true,
            cookie: zaloPersonalConfig.cookie,
            imei: zaloPersonalConfig.imei,
            userAgent: zaloPersonalConfig.userAgent,
            selfListen: zaloPersonalConfig.selfListen || false,
            checkUpdate: zaloPersonalConfig.checkUpdate || false,
            logging: zaloPersonalConfig.logging !== false
          });
          
          funLogger.stopLoading();
          
          if (zaloPersonalAdapter) {
            zaloPersonalAdapter.onMessage(this.handleMessage.bind(this));
            this.adapters.set(ChatPlatform.ZALO_PERSONAL, zaloPersonalAdapter);
            funLogger.platform('zalo-personal', 'Personal account connected and ready! 💙✨');
          } else {
            funLogger.error('❌ Failed to create Zalo Personal adapter instance');
          }
        } catch (error) {
          funLogger.stopLoading();
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

  private async handleMessage(message: Message): Promise<ChatResponse | void> {
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
            originalMessage: message.content
          }
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
        metadata: {}
      };
    }
  }

  async shutdown(): Promise<void> {
    funLogger.shutdown('🛑 Agoric Chat Bridge shutting down gracefully...');
    
    // Disconnect all adapters
    for (const [platform, adapter] of this.adapters) {
      try {
        await adapter.disconnect();
        funLogger.success(`🔌 ${platform} disconnected gracefully`);
      } catch (error) {
        funLogger.error(`💥 Trouble disconnecting ${platform}`, error);
      }
    }

    this.adapters.clear();
    this.isRunning = false;
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
      mastraEndpoint: this.config.mastra.endpoint
    };
  }

  getAdapter(platform: ChatPlatform): ChatAdapter | undefined {
    return this.adapters.get(platform);
  }
}