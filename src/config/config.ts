import dotenv from 'dotenv';
import { ChatPlatform } from '../types/message';

dotenv.config();

export interface PlatformConfig {
  enabled: boolean;
  [key: string]: any;
}

export interface TelegramPlatformConfig extends PlatformConfig {
  token: string;
  polling?: boolean;
  webhook?: {
    url: string;
    port?: number;
  };
}

export interface ZaloPersonalPlatformConfig extends PlatformConfig {
  // Official Account configuration
  oaAccessToken?: string;
  appId?: string;
  appSecret?: string;
  callbackUrl?: string;

  // Personal configuration (for zca-js)
  cookie?: string;
  imei?: string;
  userAgent?: string;
  selfListen?: boolean;
  checkUpdate?: boolean;
  logging?: boolean;
}

export interface LinePlatformConfig extends PlatformConfig {
  channelAccessToken: string;
  channelSecret: string;
  callbackUrl?: string;
}

export interface WhatsAppPlatformConfig extends PlatformConfig {
  accessToken: string;
  phoneNumberId: string;
  verifyToken?: string;
  callbackUrl?: string;
}

export interface ViberPlatformConfig extends PlatformConfig {
  authToken: string;
  name: string;
  avatar?: string;
  callbackUrl?: string;
}

export interface MastraConfig {
  endpoint: string;
  agentId?: string;
  apiKey?: string;
  headers?: Record<string, string>;
  timeout?: number;
}

export interface AppConfig {
  port: number;
  mastra: MastraConfig;
  platforms: {
    [ChatPlatform.TELEGRAM]?: TelegramPlatformConfig;
    [ChatPlatform.ZALO_PERSONAL]?: ZaloPersonalPlatformConfig;
    [ChatPlatform.LINE]?: LinePlatformConfig;
    [ChatPlatform.WHATSAPP]?: WhatsAppPlatformConfig;
    [ChatPlatform.VIBER]?: ViberPlatformConfig;
  };
}

function validateConfig(config: AppConfig): void {
  if (!config.mastra.endpoint) {
    throw new Error('MASTRA_ENDPOINT is required');
  }

  const enabledPlatforms = Object.entries(config.platforms).filter(
    ([_, platformConfig]) => platformConfig?.enabled,
  );

  if (enabledPlatforms.length === 0) {
    throw new Error('At least one platform must be enabled');
  }

  enabledPlatforms.forEach(([platform, platformConfig]) => {
    switch (platform) {
      case ChatPlatform.TELEGRAM: {
        const telegramConfig = platformConfig as TelegramPlatformConfig;
        if (!telegramConfig.token) {
          throw new Error('TELEGRAM_BOT_TOKEN is required when Telegram is enabled');
        }
        break;
      }
      case ChatPlatform.ZALO_PERSONAL: {
        const zaloPersonalConfig = platformConfig as ZaloPersonalPlatformConfig;
        // Check for either OA config or personal config
        const hasOAConfig =
          zaloPersonalConfig.oaAccessToken ||
          (zaloPersonalConfig.appId && zaloPersonalConfig.appSecret);
        const hasPersonalConfig =
          zaloPersonalConfig.cookie && zaloPersonalConfig.imei && zaloPersonalConfig.userAgent;

        if (!hasOAConfig && !hasPersonalConfig) {
          throw new Error(
            'Zalo Personal requires either Official Account config (ZALO_OA_ACCESS_TOKEN or ZALO_APP_ID+ZALO_APP_SECRET) or Personal config (ZALO_COOKIE+ZALO_IMEI+ZALO_USER_AGENT)',
          );
        }
        break;
      }
      case ChatPlatform.LINE: {
        const lineConfig = platformConfig as LinePlatformConfig;
        if (!lineConfig.channelAccessToken || !lineConfig.channelSecret) {
          throw new Error(
            'LINE_CHANNEL_ACCESS_TOKEN and LINE_CHANNEL_SECRET are required when Line is enabled',
          );
        }
        break;
      }
      case ChatPlatform.WHATSAPP: {
        const whatsappConfig = platformConfig as WhatsAppPlatformConfig;
        if (!whatsappConfig.accessToken || !whatsappConfig.phoneNumberId) {
          throw new Error(
            'WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID are required when WhatsApp is enabled',
          );
        }
        break;
      }
      case ChatPlatform.VIBER: {
        const viberConfig = platformConfig as ViberPlatformConfig;
        if (!viberConfig.authToken || !viberConfig.name) {
          throw new Error('VIBER_AUTH_TOKEN and VIBER_BOT_NAME are required when Viber is enabled');
        }
        break;
      }
    }
  });
}

export function loadConfig(): AppConfig {
  const config: AppConfig = {
    port: parseInt(process.env.PORT || '3000', 10),
    mastra: {
      endpoint: process.env.MASTRA_ENDPOINT || 'http://localhost:4111/api',
      agentId: process.env.MASTRA_AGENT_ID,
      apiKey: process.env.MASTRA_API_KEY,
      headers: process.env.MASTRA_HEADERS ? JSON.parse(process.env.MASTRA_HEADERS) : {},
      timeout: parseInt(process.env.MASTRA_TIMEOUT || '30000', 10),
    },
    platforms: {},
  };

  // Telegram configuration
  if (process.env.TELEGRAM_ENABLED === 'true') {
    config.platforms[ChatPlatform.TELEGRAM] = {
      enabled: true,
      token: process.env.TELEGRAM_BOT_TOKEN || '',
      polling: process.env.TELEGRAM_POLLING !== 'false',
      webhook: process.env.TELEGRAM_WEBHOOK_URL
        ? {
            url: process.env.TELEGRAM_WEBHOOK_URL,
            port: parseInt(process.env.TELEGRAM_WEBHOOK_PORT || '8443', 10),
          }
        : undefined,
    };
  }

  // Zalo Personal configuration
  if (process.env.ZALO_PERSONAL_ENABLED === 'true') {
    config.platforms[ChatPlatform.ZALO_PERSONAL] = {
      enabled: true,
      // Official Account config
      oaAccessToken: process.env.ZALO_OA_ACCESS_TOKEN,
      appId: process.env.ZALO_APP_ID,
      appSecret: process.env.ZALO_APP_SECRET,
      callbackUrl: process.env.ZALO_CALLBACK_URL,

      // Personal config (for zca-js)
      cookie: process.env.ZALO_COOKIE,
      imei: process.env.ZALO_IMEI,
      userAgent: process.env.ZALO_USER_AGENT,
      selfListen: process.env.ZALO_SELF_LISTEN === 'true',
      checkUpdate: process.env.ZALO_CHECK_UPDATE === 'true',
      logging: process.env.ZALO_LOGGING !== 'false',
    };
  }

  // Line configuration
  if (process.env.LINE_ENABLED === 'true') {
    config.platforms[ChatPlatform.LINE] = {
      enabled: true,
      channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
      channelSecret: process.env.LINE_CHANNEL_SECRET || '',
      callbackUrl: process.env.LINE_CALLBACK_URL,
    };
  }

  // WhatsApp configuration
  if (process.env.WHATSAPP_ENABLED === 'true') {
    config.platforms[ChatPlatform.WHATSAPP] = {
      enabled: true,
      accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
      verifyToken: process.env.WHATSAPP_VERIFY_TOKEN,
      callbackUrl: process.env.WHATSAPP_CALLBACK_URL,
    };
  }

  // Viber configuration
  if (process.env.VIBER_ENABLED === 'true') {
    config.platforms[ChatPlatform.VIBER] = {
      enabled: true,
      authToken: process.env.VIBER_AUTH_TOKEN || '',
      name: process.env.VIBER_BOT_NAME || '',
      avatar: process.env.VIBER_BOT_AVATAR,
      callbackUrl: process.env.VIBER_CALLBACK_URL,
    };
  }

  validateConfig(config);
  return config;
}
