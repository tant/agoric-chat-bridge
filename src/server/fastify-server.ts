import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { ChatIntegration } from '../chat-integration';
import { ChatPlatform } from '../types/message';
import { TelegramAdapter } from '../adapters/telegram/telegram-adapter';
import TelegramBot from 'node-telegram-bot-api';

export interface FastifyServerConfig {
  host: string;
  port: number;
  logLevel: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  enableCors: boolean;
}

export class FastifyServer {
  private app: FastifyInstance;
  private chatIntegration: ChatIntegration;

  constructor(chatIntegration: ChatIntegration, config: FastifyServerConfig) {
    this.chatIntegration = chatIntegration;
    
    this.app = Fastify({
      logger: {
        level: config.logLevel,
        transport: process.env.NODE_ENV !== 'production' ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname'
          }
        } : undefined
      }
    });

    this.setupMiddleware(config);
    this.setupRoutes();
  }

  private async setupMiddleware(config: FastifyServerConfig): Promise<void> {
    if (config.enableCors) {
      await this.app.register(cors, {
        origin: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE']
      });
    }
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', async (request, reply) => {
      const health = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        adapters: {} as Record<string, any>
      };

      // Get health status from all adapters
      for (const [platform, adapter] of this.chatIntegration.getAdapters()) {
        health.adapters[platform] = {
          connected: adapter.isConnected,
          platform: adapter.platform,
          // Additional health info if available (BaseAdapter has these)
          ...(('lastActivity' in adapter) && { lastActivity: (adapter as any).lastActivity }),
          ...(('connectionHealth' in adapter) && { health: (adapter as any).connectionHealth })
        };
      }

      reply.send(health);
    });

    // Telegram webhook endpoint
    this.app.post('/webhook/telegram', {
      schema: {
        headers: {
          type: 'object',
          properties: {
            'x-telegram-bot-api-secret-token': { type: 'string' }
          }
        }
      }
    }, async (request, reply) => {
      try {
        // Validate secret token if configured
        const secretToken = request.headers['x-telegram-bot-api-secret-token'] as string;
        const expectedToken = process.env.TELEGRAM_WEBHOOK_SECRET;
        
        if (expectedToken && secretToken !== expectedToken) {
          this.app.log.warn('Invalid Telegram webhook secret token');
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const update = request.body as TelegramBot.Update;
        this.app.log.debug({ update }, 'Received Telegram webhook update');

        if (update.message) {
          const telegramAdapter = this.chatIntegration.getAdapter(ChatPlatform.TELEGRAM);
          
          if (telegramAdapter instanceof TelegramAdapter) {
            await telegramAdapter.processWebhookMessage(update.message);
          } else {
            this.app.log.error('Telegram adapter not found or invalid type');
            return reply.code(500).send({ error: 'Telegram adapter not available' });
          }
        }

        reply.send({ ok: true });
      } catch (error) {
        this.app.log.error({ error }, 'Error processing Telegram webhook');
        reply.code(500).send({ error: 'Internal server error' });
      }
    });

    // Generic webhook endpoint for future platforms
    this.app.post('/webhook/:platform', async (request, reply) => {
      const platform = (request.params as any).platform;
      this.app.log.info({ platform }, 'Received webhook for platform');
      
      // TODO: Add support for other platforms (Zalo, Line, etc.)
      reply.code(501).send({ error: `Webhook for platform '${platform}' not implemented yet` });
    });
  }

  async start(host: string, port: number): Promise<void> {
    try {
      await this.app.listen({ host, port });
      this.app.log.info(`Fastify server started on http://${host}:${port}`);
    } catch (error) {
      this.app.log.error({ error }, 'Failed to start Fastify server');
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      await this.app.close();
      this.app.log.info('Fastify server stopped');
    } catch (error) {
      this.app.log.error({ error }, 'Error stopping Fastify server');
      throw error;
    }
  }

  get instance(): FastifyInstance {
    return this.app;
  }
}
