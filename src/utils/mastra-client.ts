import axios, { AxiosInstance } from 'axios';
import { MastraConfig } from '../config/config';
import { Message, ChatResponse, MessageType } from '../types/message';

export class MastraClient {
  private client: AxiosInstance;
  private config: MastraConfig;
  private agentId?: string;

  constructor(config: MastraConfig) {
    this.config = config;
    this.agentId = config.agentId;
    
    this.client = axios.create({
      baseURL: config.endpoint,
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        ...config.headers
      }
    });
  }

  async sendMessage(message: Message): Promise<ChatResponse> {
    try {
      if (!this.agentId) {
        throw new Error('Agent ID is required to send messages');
      }

      const response = await this.client.post(`/agents/${this.agentId}/generate`, {
        messages: [{
          role: 'user',
          content: message.content
        }],
        threadId: `${message.platform}_${message.senderId}`,
        resourceId: message.senderId
      });

      return {
        content: response.data.text || 'No response from agent',
        messageType: MessageType.TEXT,
        metadata: {
          senderId: message.senderId,
          senderName: message.senderName,
          platform: message.platform,
          messageType: message.messageType,
          timestamp: message.timestamp.toISOString(),
          usage: response.data.usage,
          ...message.metadata
        }
      };
    } catch (error: any) {
      console.error('Error communicating with Mastra agent:', error.response?.data || error.message);
      
      // Return a default error response
      return {
        content: 'Sorry, I encountered an error processing your request. Please try again later.',
        messageType: MessageType.TEXT
      };
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/agents');
      return response.status === 200 && response.data;
    } catch (error) {
      console.error('Mastra agent health check failed:', error);
      return false;
    }
  }

  async getAgents(): Promise<any[]> {
    try {
      const response = await this.client.get('/agents');
      const agents = response.data;
      return Object.entries(agents).map(([id, data]: [string, any]) => ({
        id,
        ...data
      }));
    } catch (error) {
      console.error('Error fetching agents:', error);
      return [];
    }
  }

  async getThreads(userId: string): Promise<any[]> {
    try {
      const threadId = `${userId}_threads`;
      // Note: This depends on the actual Mastra SDK API for threads
      // You may need to adjust based on actual SDK methods
      return [];
    } catch (error) {
      console.error('Error fetching threads:', error);
      return [];
    }
  }

  async createMemory(threadId: string, content: string, metadata?: any): Promise<boolean> {
    try {
      // Note: This depends on the actual Mastra SDK API for memory
      // You may need to adjust based on actual SDK methods
      return true;
    } catch (error) {
      console.error('Error creating memory:', error);
      return false;
    }
  }
}