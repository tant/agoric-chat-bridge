import { ChatAdapter, AdapterConfig } from '../types/adapter';
import { Message, ChatResponse, ChatUser } from '../types/message';
import { funLogger } from '../utils/fun-logger';

export abstract class BaseAdapter implements ChatAdapter {
  public abstract platform: string;
  public isConnected: boolean = false;
  protected config: AdapterConfig;
  
  constructor(config: AdapterConfig) {
    this.config = config;
  }

  abstract connect(config?: any): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract sendMessage(userId: string, response: ChatResponse): Promise<void>;
  abstract onMessage(callback: (message: Message) => Promise<ChatResponse | void>): void;

  onUserJoin?(callback: (user: ChatUser) => Promise<void>): void {
    // Optional implementation
  }

  onUserLeave?(callback: (user: ChatUser) => Promise<void>): void {
    // Optional implementation
  }

  async getUser?(userId: string): Promise<ChatUser | null> {
    // Optional implementation
    return null;
  }

  protected log(message: string, data?: any): void {
    funLogger.platform(this.platform, `${message}${data ? ' ' + JSON.stringify(data) : ''}`);
  }

  protected logError(message: string, error?: any): void {
    funLogger.error(`[${this.platform.toUpperCase()}] ${message}`, error);
  }
}