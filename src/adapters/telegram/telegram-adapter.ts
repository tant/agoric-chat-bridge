import TelegramBot from 'node-telegram-bot-api';
import { BaseAdapter } from '../base-adapter';
import { Message, ChatResponse, ChatUser, MessageType, ChatPlatform } from '../../types/message';

export interface TelegramConfig {
  token: string;
  polling?: boolean;
  webhook?: {
    url: string;
    port?: number;
  };
}

export class TelegramAdapter extends BaseAdapter {
  public platform = 'telegram';
  private bot: TelegramBot | null = null;
  private messageCallback: ((message: Message) => Promise<ChatResponse | void>) | null = null;

  constructor(config: TelegramConfig) {
    super(config);
  }

  async connect(config?: TelegramConfig): Promise<void> {
    const telegramConfig = config || this.config as TelegramConfig;
    
    if (!telegramConfig.token) {
      throw new Error('Telegram bot token is required');
    }

    try {
      this.bot = new TelegramBot(telegramConfig.token, {
        polling: telegramConfig.polling !== false
      });

      this.bot.on('message', this.handleTelegramMessage.bind(this));
      this.bot.on('error', (error) => {
        this.logError('Telegram bot error:', error);
      });

      this.isConnected = true;
      this.log('Connected to Telegram');
    } catch (error) {
      this.logError('Failed to connect to Telegram:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.bot) {
      await this.bot.stopPolling();
      this.bot.removeAllListeners();
      this.bot = null;
    }
    this.isConnected = false;
    this.log('Disconnected from Telegram');
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
    } catch (error) {
      this.logError('Failed to send message to Telegram:', error);
      throw error;
    }
  }

  onMessage(callback: (message: Message) => Promise<ChatResponse | void>): void {
    this.messageCallback = callback;
  }

  async getUser(userId: string): Promise<ChatUser | null> {
    if (!this.bot || !this.isConnected) {
      return null;
    }

    try {
      const chatMember = await this.bot.getChatMember(userId, parseInt(userId));
      const user = chatMember.user;
      
      return {
        id: user.id.toString(),
        name: user.first_name + (user.last_name ? ` ${user.last_name}` : ''),
        username: user.username,
        platform: ChatPlatform.TELEGRAM,
        metadata: {
          is_bot: user.is_bot,
          language_code: user.language_code
        }
      };
    } catch (error) {
      this.logError('Failed to get user info from Telegram:', error);
      return null;
    }
  }

  private async handleTelegramMessage(telegramMessage: TelegramBot.Message): Promise<void> {
    if (!this.messageCallback) return;

    try {
      const message: Message = {
        id: telegramMessage.message_id.toString(),
        content: this.extractMessageContent(telegramMessage),
        senderId: telegramMessage.from!.id.toString(),
        senderName: telegramMessage.from!.first_name + (telegramMessage.from!.last_name ? ` ${telegramMessage.from!.last_name}` : ''),
        timestamp: new Date(telegramMessage.date * 1000),
        platform: ChatPlatform.TELEGRAM,
        messageType: this.getMessageType(telegramMessage),
        metadata: {
          chat_id: telegramMessage.chat.id,
          chat_type: telegramMessage.chat.type,
          username: telegramMessage.from!.username
        }
      };

      const response = await this.messageCallback(message);
      
      if (response) {
        await this.sendMessage(telegramMessage.chat.id.toString(), response);
      }
    } catch (error) {
      this.logError('Error handling Telegram message:', error);
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
    if (telegramMessage.location) return `[Location: ${telegramMessage.location.latitude}, ${telegramMessage.location.longitude}]`;
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
}