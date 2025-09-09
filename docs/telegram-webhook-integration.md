# Telegram Webhook Integration với node-telegram-bot-api

## Câu trả lời: VẪN CẦN thư viện `node-telegram-bot-api`

### 1. **Tại sao vẫn cần:**

#### A. API Methods vẫn cần thiết
```typescript
// Các methods này vẫn cần dù dùng webhook
await this.bot.sendMessage(userId, response.content);
await this.bot.sendPhoto(userId, response.content);
await this.bot.sendDocument(userId, response.content);
await this.bot.getMe(); // Health check
await this.bot.getChatMember(userId, parseInt(userId, 10));
```

#### B. Type Definitions
```typescript
import TelegramBot from 'node-telegram-bot-api';

// Types này vẫn cần cho webhook
private handleWebhookMessage(telegramMessage: TelegramBot.Message): Promise<void>
```

### 2. **Thay đổi Implementation:**

#### TRƯỚC (Polling Mode)
```typescript
export class TelegramAdapter extends BaseAdapter {
  async connect(config?: TelegramConfig): Promise<void> {
    // Tự động nhận message qua polling
    this.bot = new TelegramBot(telegramConfig.token, {
      polling: true, // AUTO POLLING
    });

    // Bot tự động trigger event
    this.bot.on('message', this.handleTelegramMessage.bind(this));
  }
}
```

#### SAU (Webhook Mode)
```typescript
export class TelegramAdapter extends BaseAdapter {
  async connect(config?: TelegramConfig): Promise<void> {
    // Chỉ khởi tạo bot cho sending, KHÔNG polling
    this.bot = new TelegramBot(telegramConfig.token, {
      polling: false, // NO POLLING
    });

    if (telegramConfig.webhook) {
      // Setup webhook URL
      await this.bot.setWebHook(telegramConfig.webhook.url, {
        secret_token: telegramConfig.webhook.secretToken,
      });
    }
  }

  // NEW METHOD: Process webhook messages
  async processWebhookMessage(telegramMessage: TelegramBot.Message): Promise<void> {
    // Reuse existing logic
    await this.handleTelegramMessage(telegramMessage);
  }
}
```

### 3. **Fastify Webhook Handler:**

```typescript
// src/routes/webhooks.ts
import { FastifyPluginAsync } from 'fastify';
import TelegramBot from 'node-telegram-bot-api'; // STILL NEEDED!

const webhooks: FastifyPluginAsync = async (fastify) => {
  // Telegram webhook - VẪN SỬ DỤNG node-telegram-bot-api types!
  fastify.post('/webhook/telegram', {
    schema: {
      headers: {
        type: 'object',
        properties: {
          'x-telegram-bot-api-secret-token': { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    // Validate secret token
    const secretToken = request.headers['x-telegram-bot-api-secret-token'];
    if (secretToken !== process.env.TELEGRAM_WEBHOOK_SECRET) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const update = request.body as TelegramBot.Update;
    
    if (update.message) {
      const telegramAdapter = fastify.chatIntegration.adapters.get('telegram');
      if (telegramAdapter instanceof TelegramAdapter) {
        // Use NEW method
        await telegramAdapter.processWebhookMessage(update.message);
      }
    }
    
    reply.send({ ok: true });
  });
};

export default webhooks;
```

### 4. **Configuration Changes:**

```typescript
// src/config/config.ts
export interface TelegramConfig {
  token: string;
  polling?: boolean;
  webhook?: {
    url: string;
    port?: number;
    secretToken: string;
  };
}

// Environment variables
const telegramConfig: TelegramConfig = {
  token: process.env.TELEGRAM_BOT_TOKEN!,
  polling: process.env.TELEGRAM_WEBHOOK_ENABLED !== 'true', // Inverse logic
  webhook: process.env.TELEGRAM_WEBHOOK_ENABLED === 'true' ? {
    url: process.env.TELEGRAM_WEBHOOK_URL!,
    secretToken: process.env.TELEGRAM_WEBHOOK_SECRET!,
  } : undefined,
};
```

### 5. **Lợi ích của việc giữ thư viện:**

#### A. **Không cần reinvent wheel**
```typescript
// Thay vì tự implement:
const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    chat_id: userId,
    text: message,
    parse_mode: 'HTML'
  })
});

// Chỉ cần:
await this.bot.sendMessage(userId, message, { parse_mode: 'HTML' });
```

#### B. **Type Safety**
```typescript
// Full TypeScript support
const update: TelegramBot.Update = request.body;
const message: TelegramBot.Message = update.message!;
const user: TelegramBot.User = message.from!;
```

#### C. **Error Handling & Retry Logic**
- Thư viện đã handle rate limiting
- Automatic retry cho failed requests
- Built-in error types

### 6. **Hybrid Approach (Recommended):**

```typescript
export class TelegramAdapter extends BaseAdapter {
  private mode: 'polling' | 'webhook' = 'polling';

  async connect(config?: TelegramConfig): Promise<void> {
    this.mode = config?.webhook ? 'webhook' : 'polling';

    this.bot = new TelegramBot(telegramConfig.token, {
      polling: this.mode === 'polling',
    });

    switch (this.mode) {
      case 'polling':
        this.bot.on('message', this.handleTelegramMessage.bind(this));
        break;
      
      case 'webhook':
        await this.bot.setWebHook(config.webhook!.url, {
          secret_token: config.webhook!.secretToken,
        });
        break;
    }
  }

  // Unified message processing
  async processMessage(telegramMessage: TelegramBot.Message): Promise<void> {
    await this.handleTelegramMessage(telegramMessage);
  }
}
```

### 7. **Migration Strategy:**

1. **Phase 1**: Keep polling + Add webhook handler
2. **Phase 2**: Test webhook in parallel
3. **Phase 3**: Switch to webhook-only
4. **Phase 4**: Remove polling code (optional)

### **Kết Luận:**

**node-telegram-bot-api VẪN CẦN THIẾT** khi chuyển sang webhook vì:

✅ **API Methods**: sendMessage, sendPhoto, etc.  
✅ **Type Definitions**: TelegramBot.Update, TelegramBot.Message  
✅ **Utility Functions**: Error handling, rate limiting  
✅ **Maintenance**: Không cần maintain HTTP client rieng  

**Chỉ thay đổi cách nhận message**: từ `bot.on('message')` sang Fastify webhook handler.
