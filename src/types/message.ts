export interface Message {
  id: string;
  content: string;
  senderId: string;
  senderName?: string;
  timestamp: Date;
  platform: ChatPlatform;
  messageType: MessageType;
  metadata?: Record<string, any>;
}

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  FILE = 'file',
  AUDIO = 'audio',
  VIDEO = 'video',
  STICKER = 'sticker',
  LOCATION = 'location',
}

export enum ChatPlatform {
  TELEGRAM = 'telegram',
  ZALO_PERSONAL = 'zalo-personal',
  LINE = 'line',
  WHATSAPP = 'whatsapp',
  VIBER = 'viber',
}

export interface ChatUser {
  id: string;
  name?: string;
  username?: string;
  platform: ChatPlatform;
  metadata?: Record<string, any>;
}

export interface ChatResponse {
  content: string;
  messageType: MessageType;
  metadata?: Record<string, any>;
}
