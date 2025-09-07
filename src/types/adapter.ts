import type { ChatResponse, ChatUser, Message } from './message';

export interface ChatAdapter {
  platform: string;
  isConnected: boolean;

  connect(config: any): Promise<void>;
  disconnect(): Promise<void>;

  sendMessage(userId: string, response: ChatResponse): Promise<void>;

  onMessage(callback: (message: Message) => Promise<ChatResponse | undefined>): void;
  onUserJoin?(callback: (user: ChatUser) => Promise<void>): void;
  onUserLeave?(callback: (user: ChatUser) => Promise<void>): void;

  getUser?(userId: string): Promise<ChatUser | null>;
}

export interface AdapterConfig {
  [key: string]: any;
}

export interface MastraAgentConfig {
  endpoint: string;
  apiKey?: string;
  headers?: Record<string, string>;
}
