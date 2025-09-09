import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';
import type TelegramBot from 'node-telegram-bot-api';
import { TelegramAdapter } from '../adapters/telegram/telegram-adapter';
import type { ChatIntegration } from '../chat-integration';
import { ChatPlatform } from '../types/message';

export interface FastifyServerConfig {
  host: string;
  port: number;
  logLevel: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  enableCors: boolean;
}

export class FastifyServer {
  private app: FastifyInstance;
  private chatIntegration: ChatIntegration;
  private adapterCache: Map<ChatPlatform, any> = new Map(); // Cache adapters

  constructor(chatIntegration: ChatIntegration, config: FastifyServerConfig) {
    this.chatIntegration = chatIntegration;

    this.app = Fastify({
      logger: {
        level: config.logLevel,
        transport:
          process.env.NODE_ENV !== 'production'
            ? {
                target: 'pino-pretty',
                options: {
                  colorize: true,
                  translateTime: 'HH:MM:ss',
                  ignore: 'pid,hostname',
                },
              }
            : undefined,
      },
      // Performance optimizations
      disableRequestLogging: process.env.NODE_ENV === 'production',
      keepAliveTimeout: 72000,
      maxParamLength: 1000,
    });

    this.setupMiddleware(config);
    this.setupRoutes();
  }

  private async setupMiddleware(config: FastifyServerConfig): Promise<void> {
    // Rate limiting
    await this.app.register(import('@fastify/rate-limit'), {
      max: 100,
      timeWindow: '1 minute',
      errorResponseBuilder: () => ({
        error: 'Rate limit exceeded',
        statusCode: 429,
      }),
    });

    // Security headers
    await this.app.register(import('@fastify/helmet'), {
      global: true,
    });

    // CORS
    if (config.enableCors) {
      await this.app.register(cors, {
        origin:
          process.env.NODE_ENV === 'production'
            ? process.env.ALLOWED_ORIGINS?.split(',') || false
            : true,
        methods: ['GET', 'POST'],
        credentials: false,
      });
    }
  }

  private setupRoutes(): void {
    // Health check endpoint with caching
    this.app.get(
      '/health',
      {
        schema: {
          response: {
            200: {
              type: 'object',
              properties: {
                status: { type: 'string' },
                timestamp: { type: 'string' },
                adapters: { type: 'object' },
              },
            },
          },
        },
      },
      async (request, reply) => {
        const health = {
          status: 'ok',
          timestamp: new Date().toISOString(),
          adapters: {} as Record<string, any>,
        };

        // Get health status from all adapters (optimized iteration)
        const adapters = this.chatIntegration.getAdapters();
        for (const [platform, adapter] of adapters) {
          health.adapters[platform] = {
            connected: adapter.isConnected,
            platform: adapter.platform,
            // Conditional spreading optimization (type-safe)
            ...('lastActivity' in adapter && { lastActivity: (adapter as any).lastActivity }),
            ...('connectionHealth' in adapter && { health: (adapter as any).connectionHealth }),
          };
        }

        // Set cache headers for health endpoint
        reply.header('Cache-Control', 'no-cache, max-age=5');
        reply.send(health);
      },
    );

    // Telegram webhook endpoint - optimized
    this.app.post(
      '/webhook/telegram',
      {
        schema: {
          headers: {
            type: 'object',
            properties: {
              'x-telegram-bot-api-secret-token': { type: 'string' },
            },
          },
          body: {
            type: 'object',
            properties: {
              update_id: { type: 'number' },
              message: { type: 'object' },
            },
            required: ['update_id'],
          },
          response: {
            200: {
              type: 'object',
              properties: {
                ok: { type: 'boolean' },
              },
            },
            401: {
              type: 'object',
              properties: {
                error: { type: 'string' },
              },
            },
            500: {
              type: 'object',
              properties: {
                error: { type: 'string' },
              },
            },
          },
        },
        preHandler: async (request, reply) => {
          // Fast auth check
          const secretToken = request.headers['x-telegram-bot-api-secret-token'] as string;
          const expectedToken = process.env.TELEGRAM_WEBHOOK_SECRET;

          if (expectedToken && secretToken !== expectedToken) {
            reply.code(401).send({ error: 'Unauthorized' });
            return;
          }
        },
      },
      async (request, reply) => {
        try {
          const update = request.body as TelegramBot.Update;

          if (update.message) {
            // Use cached adapter if available
            let telegramAdapter = this.adapterCache.get(ChatPlatform.TELEGRAM);
            if (!telegramAdapter) {
              telegramAdapter = this.chatIntegration.getAdapter(ChatPlatform.TELEGRAM);
              if (telegramAdapter instanceof TelegramAdapter) {
                this.adapterCache.set(ChatPlatform.TELEGRAM, telegramAdapter);
              }
            }

            if (telegramAdapter instanceof TelegramAdapter) {
              // Process message without awaiting (fire and forget for better performance)
              telegramAdapter.processWebhookMessage(update.message).catch((error) => {
                this.app.log.error(
                  { error, update_id: update.update_id },
                  'Error processing webhook message',
                );
              });
            } else {
              this.app.log.error('Telegram adapter not found or invalid type');
              return reply.code(500).send({ error: 'Telegram adapter not available' });
            }
          }

          // Quick response to Telegram
          reply.send({ ok: true });
        } catch (error) {
          this.app.log.error({ error }, 'Error processing Telegram webhook');
          reply.code(500).send({ error: 'Internal server error' });
        }
      },
    );

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
      // Clear caches before shutdown
      this.adapterCache.clear();

      await this.app.close();
      this.app.log.info('Fastify server stopped');
    } catch (error) {
      this.app.log.error({ error }, 'Error stopping Fastify server');
      throw error;
    }
  }

  // Cache invalidation method
  invalidateAdapterCache(platform?: ChatPlatform): void {
    if (platform) {
      this.adapterCache.delete(platform);
    } else {
      this.adapterCache.clear();
    }
  }

  get instance(): FastifyInstance {
    return this.app;
  }
}
