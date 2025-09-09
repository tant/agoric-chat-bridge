import TelegramBot from 'node-telegram-bot-api';
import {
  ChatPlatform,
  type ChatResponse,
  type ChatUser,
  type Message,
  MessageType,
} from '../../types/message';
import { BaseAdapter } from '../base-adapter';

export interface TelegramConfig {
  token: string;
  polling?: boolean;
  webhook?: {
    enabled: boolean;
    url: string;
    port?: number;
    secretToken?: string;
  };
}

export class TelegramAdapter extends BaseAdapter {
  public platform = 'telegram';
  private bot: TelegramBot | null = null;
  private messageCallback: ((message: Message) => Promise<ChatResponse | undefined>) | null = null;

  async connect(config?: TelegramConfig): Promise<void> {
    const telegramConfig = config || (this.config as TelegramConfig);

    if (!telegramConfig.token) {
      throw new Error('Telegram bot token is required');
    }

    try {
      // Initialize bot based on mode
      const useWebhook = telegramConfig.webhook?.enabled === true;
      
      this.bot = new TelegramBot(telegramConfig.token, {
        polling: !useWebhook, // Only poll if not using webhook
      });

      if (useWebhook) {
        // Setup webhook
        if (telegramConfig.webhook?.url) {
          await this.bot.setWebHook(telegramConfig.webhook.url, {
            secret_token: telegramConfig.webhook.secretToken,
          });
          this.log(`Webhook set to: ${telegramConfig.webhook.url}`);
        }
      } else {
        // Setup polling handlers
        this.bot.on('message', this.handleTelegramMessage.bind(this));
        this.bot.on('polling_error', (error) => {
          this.handleConnectionError(error);
        });
      }

      this.bot.on('error', (error) => {
        this.handleConnectionError(error);
      });

      this.bot.on('webhook_error', (error) => {
        this.handleConnectionError(error);
      });

      this.isConnected = true;
      this.updateHealthStatus(true);
      this.startHealthMonitoring();
      this.log('Connected to Telegram');
    } catch (error) {
      this.logError('Failed to connect to Telegram:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.stopHealthMonitoring();

    if (this.bot) {
      await this.bot.stopPolling();
      this.bot.removeAllListeners();
      this.bot = null;
    }

    this.isConnected = false;
    this.updateHealthStatus(false);
    this.log('Disconnected from Telegram');
  }

  async forceShutdown(): Promise<void> {
    this.log('Force shutdown initiated');
    this.stopHealthMonitoring();

    if (this.bot) {
      try {
        this.bot.stopPolling();
        this.bot.removeAllListeners();
      } catch (error) {
        this.logError('Error during force shutdown:', error);
      }
      this.bot = null;
    }

    this.isConnected = false;
    this.updateHealthStatus(false);
  }

  async sendMessage(userId: string, response: ChatResponse): Promise<void> {
    if (!this.bot || !this.isConnected) {
      throw new Error('Telegram adapter is not connected');
    }

    try {
      switch (response.messageType) {
        case MessageType.TEXT:
          await this.bot.sendMessage(userId, response.content);
          break;
        case MessageType.IMAGE:
          await this.bot.sendPhoto(userId, response.content);
          break;
        case MessageType.FILE:
          await this.bot.sendDocument(userId, response.content);
          break;
        case MessageType.AUDIO:
          await this.bot.sendAudio(userId, response.content);
          break;
        case MessageType.VIDEO:
          await this.bot.sendVideo(userId, response.content);
          break;
        case MessageType.STICKER:
          await this.bot.sendSticker(userId, response.content);
          break;
        default:
          await this.bot.sendMessage(userId, response.content);
      }

      this.updateActivity();
    } catch (error) {
      this.logError('Failed to send message to Telegram:', error);
      this.updateHealthStatus(false, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  onMessage(callback: (message: Message) => Promise<ChatResponse | undefined>): void {
    this.messageCallback = callback;
  }

  // Process webhook message (called from Fastify server)
  async processWebhookMessage(telegramMessage: TelegramBot.Message): Promise<void> {
    await this.handleTelegramMessage(telegramMessage);
  }

  async getUser(userId: string): Promise<ChatUser | null> {
    if (!this.bot || !this.isConnected) {
      return null;
    }

    try {
      const chatMember = await this.bot.getChatMember(userId, parseInt(userId, 10));
      const user = chatMember.user;

      return {
        id: user.id.toString(),
        name: user.first_name + (user.last_name ? ` ${user.last_name}` : ''),
        username: user.username,
        platform: ChatPlatform.TELEGRAM,
        metadata: {
          is_bot: user.is_bot,
          language_code: user.language_code,
        },
      };
    } catch (error) {
      this.logError('Failed to get user info from Telegram:', error);
      return null;
    }
  }

  private async handleTelegramMessage(telegramMessage: TelegramBot.Message): Promise<void> {
    if (!this.messageCallback) return;

    // Ignore bot messages
    if (telegramMessage.from?.is_bot) {
      return;
    }

    try {
      const message: Message = {
        id: telegramMessage.message_id.toString(),
        content: this.extractMessageContent(telegramMessage),
        senderId: telegramMessage.from?.id.toString() || 'unknown',
        senderName:
          (telegramMessage.from?.first_name || 'Unknown') +
          (telegramMessage.from?.last_name ? ` ${telegramMessage.from?.last_name}` : ''),
        timestamp: new Date(telegramMessage.date * 1000),
        platform: ChatPlatform.TELEGRAM,
        messageType: this.getMessageType(telegramMessage),
        metadata: {
          chat_id: telegramMessage.chat.id,
          chat_type: telegramMessage.chat.type,
          username: telegramMessage.from?.username,
        },
      };

      // Validate message
      if (!this.validateMessage(message)) {
        await this.sendErrorMessage(
          'Sorry, I cannot process your message. Please try again.',
          telegramMessage,
        );
        return;
      }

      const response = await this.messageCallback(message);

      if (response) {
        await this.sendMessage(telegramMessage.chat.id.toString(), response);
      }

      this.updateActivity();
    } catch (error) {
      this.logError('Error handling Telegram message:', error);
      this.updateHealthStatus(false, error instanceof Error ? error.message : String(error));
    }
  }

  private extractMessageContent(telegramMessage: TelegramBot.Message): string {
    if (telegramMessage.text) return telegramMessage.text;
    if (telegramMessage.caption) return telegramMessage.caption;
    if (telegramMessage.sticker) return telegramMessage.sticker.emoji || '[Sticker]';
    if (telegramMessage.photo) return '[Photo]';
    if (telegramMessage.document) return telegramMessage.document.file_name || '[Document]';
    if (telegramMessage.audio) return '[Audio]';
    if (telegramMessage.video) return '[Video]';
    if (telegramMessage.location)
      return `[Location: ${telegramMessage.location.latitude}, ${telegramMessage.location.longitude}]`;
    return '[Unknown message type]';
  }

  private getMessageType(telegramMessage: TelegramBot.Message): MessageType {
    if (telegramMessage.text) return MessageType.TEXT;
    if (telegramMessage.photo) return MessageType.IMAGE;
    if (telegramMessage.document) return MessageType.FILE;
    if (telegramMessage.audio) return MessageType.AUDIO;
    if (telegramMessage.video) return MessageType.VIDEO;
    if (telegramMessage.sticker) return MessageType.STICKER;
    if (telegramMessage.location) return MessageType.LOCATION;
    return MessageType.TEXT;
  }

  async performHealthCheck(): Promise<void> {
    try {
      if (!this.bot || !this.isConnected) {
        this.updateHealthStatus(false, 'Bot not connected');
        return;
      }

      // Test connection by calling getMe
      await this.bot.getMe();
      this.updateHealthStatus(true);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logError('Health check failed:', error);
      this.updateHealthStatus(false, errorMsg);

      // Trigger reconnection if too many failures
      if (this.connectionHealth.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
        this.logError('Too many consecutive failures, attempting reconnection');
        await this.attemptReconnection();
      }
    }
  }

  private handleConnectionError(error: any): void {
    const errorMsg = error instanceof Error ? error.message : String(error);
    this.logError('Connection error:', error);

    this.updateHealthStatus(false, errorMsg);

    // Critical errors that require immediate shutdown (exclude recoverable network errors)
    const isNetworkError = errorMsg.includes('socket hang up') || errorMsg.includes('ECONNRESET') || errorMsg.includes('ETIMEDOUT');
    const isCriticalError = (error?.code === 'EFATAL' && !isNetworkError) || errorMsg.includes('401') || errorMsg.includes('Unauthorized');
    
    if (isCriticalError) {
      this.logError('Critical error detected - forcing shutdown');
      this.forceShutdown().catch((err) => this.logError('Error during force shutdown:', err));
    } else if (isNetworkError) {
      this.logError('Network error detected - will attempt reconnection on next health check');
    }
  }

  private async attemptReconnection(): Promise<void> {
    if (!this.connectionHealth.reconnectAttempts) {
      this.connectionHealth.reconnectAttempts = 0;
    }

    this.connectionHealth.reconnectAttempts++;
    this.log(`Attempting reconnection (attempt ${this.connectionHealth.reconnectAttempts})`);

    try {
      // Wait before reconnection
      await new Promise((resolve) => setTimeout(resolve, 30000)); // 30 seconds

      // Shutdown current connection
      if (this.bot) {
        try {
          this.bot.stopPolling();
          this.bot.removeAllListeners();
        } catch (error) {
          this.logError('Error during reconnection cleanup:', error);
        }
      }

      // Recreate bot
      const telegramConfig = this.config as TelegramConfig;
      this.bot = new TelegramBot(telegramConfig.token, {
        polling: telegramConfig.polling !== false,
      });

      // Setup handlers again
      this.bot.on('message', this.handleTelegramMessage.bind(this));
      this.bot.on('error', (error) => {
        this.handleConnectionError(error);
      });

      this.isConnected = true;
      this.updateHealthStatus(true);
      this.log('Reconnection successful');
    } catch (error) {
      this.logError('Reconnection failed:', error);
      this.updateHealthStatus(false, error instanceof Error ? error.message : String(error));
    }
  }

  private validateMessage(message: Message): boolean {
    return (
      !!message.content &&
      message.content.trim().length > 0 &&
      message.senderId !== 'unknown' &&
      message.content.length <= 4096 && // Telegram message limit
      message.timestamp instanceof Date
    );
  }

  private async sendErrorMessage(
    errorMessage: string,
    originalMessage: TelegramBot.Message,
  ): Promise<void> {
    if (!this.bot) {
      return;
    }

    try {
      await this.bot.sendMessage(originalMessage.chat.id, errorMessage);
    } catch (error) {
      this.logError('Failed to send error message:', error);
    }
  }
}
