# Agoric Chat Bridge

A powerful multi-platform chat integration bridge that connects various messaging platforms (Telegram, Zalo Personal, Line, WhatsApp, Viber) with AI agents through the Mastra framework.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D16-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)

## Features

- **Multi-Platform Support**: Telegram, Zalo Personal, Line, WhatsApp, Viber
- **AI Integration**: Seamless connection with Mastra AI agents
- **Beautiful Logging**: Colorful, fun logs with emojis and animations
- **Robust**: Health monitoring, auto-reconnection, error handling
- **Configurable**: Easy setup through environment variables
- **Secure**: Proper credential management and validation

## Quick Start

### Prerequisites

- Node.js (v16 or higher)
- pnpm (recommended) or npm
- A running Mastra agent instance

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd agoric-chat-bridge

# Install dependencies
pnpm install

# Copy environment configuration
cp .env.example .env

# Configure your credentials in .env
nano .env
```

### Configuration

Edit your `.env` file with the required credentials:

```bash
# HTTP Server Configuration (Hybrid Architecture)
FASTIFY_ENABLED=false              # Set to 'true' for webhook mode
FASTIFY_HOST=0.0.0.0              # Host for HTTP server
FASTIFY_PORT=3000                 # Port for HTTP server
FASTIFY_LOG_LEVEL=info            # Logging level (error, warn, info, debug)

# Telegram Bot (easiest to set up)
TELEGRAM_ENABLED=true
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_POLLING=true             # Use polling (dev) or webhook (prod)

# Zalo Personal (advanced)
ZALO_PERSONAL_ENABLED=true
ZALO_COOKIE='your_browser_cookies_json'
ZALO_IMEI=your_device_imei
ZALO_USER_AGENT='your_browser_user_agent'

# Mastra Agent
MASTRA_ENDPOINT=http://localhost:4111/api
MASTRA_AGENT_ID=your_agent_id
```

### Running

```bash
# Development (with hot reload)
pnpm dev

# Production build
pnpm build
pnpm start
```

## Deployment Scenarios

### 🏠 **Local Development**
```bash
# Simple polling mode - no HTTP server needed
FASTIFY_ENABLED=false
TELEGRAM_ENABLED=true
TELEGRAM_POLLING=true
pnpm dev
```

### 🌐 **Production with Webhooks**
```bash
# Full HTTP server with webhook support
FASTIFY_ENABLED=true
FASTIFY_HOST=0.0.0.0
FASTIFY_PORT=3000
TELEGRAM_POLLING=false
TELEGRAM_WEBHOOK_URL=https://yourdomain.com/webhook/telegram
pnpm start
```

### 🐳 **Docker Deployment**
```dockerfile
# Dockerfile example
ENV FASTIFY_ENABLED=true
ENV FASTIFY_HOST=0.0.0.0
ENV FASTIFY_PORT=3000
EXPOSE 3000
```

### ☁️ **Cloud Platforms**
Perfect for:
- **Vercel/Netlify**: Serverless functions
- **Railway/Render**: Container deployment
- **AWS/GCP/Azure**: Full control with load balancing

### 🔧 **Development vs Production**

| Feature | Development Mode | Production Mode |
|---------|-----------------|-----------------|
| HTTP Server | ❌ Disabled | ✅ Enabled |
| Connection Method | 🔄 Polling | 📡 Webhooks |
| Resource Usage | 💚 Low | 🔥 Optimized |
| Scalability | 👤 Single user | 👥 Multi-user |
| Setup Complexity | 🟢 Simple | 🟡 Moderate |
| HTTPS Required | ❌ No | ✅ Yes |

## Platform Setup

### Telegram

#### Basic Setup
1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. Send `/newbot` command
3. Follow instructions to create your bot
4. Copy the token to `TELEGRAM_BOT_TOKEN` in `.env`

#### Webhook Configuration (Production)
```bash
# Enable HTTP server and webhook mode
FASTIFY_ENABLED=true
TELEGRAM_POLLING=false
TELEGRAM_WEBHOOK_URL=https://yourdomain.com/webhook/telegram
TELEGRAM_WEBHOOK_SECRET=your_secret_token_here
```

**Requirements for webhooks:**
- ✅ HTTPS URL (required by Telegram)
- ✅ Valid SSL certificate
- ✅ Port 443, 80, 88, or 8443
- 🔧 Use ngrok for local testing: `ngrok http 3000`

### Zalo (Personal)
⚠️ **Warning**: Use with caution as this may violate Zalo's Terms of Service

1. **Get IMEI**: Generate a random UUID or use your device IMEI
2. **Get Cookies**: 
   - Open Zalo Web in your browser
   - Open Developer Tools (F12)
   - Go to Application > Cookies
   - Export all cookies as JSON
3. **Get User Agent**: Copy from Network tab > Request headers

### Line
1. Go to [Line Developers Console](https://developers.line.biz/console/)
2. Create a new provider and channel
3. Get Channel Access Token and Channel Secret
4. Configure webhook URL

### WhatsApp Business
1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Create a new app and add WhatsApp product
3. Get Access Token and Phone Number ID
4. Set up webhook with verify token

### Viber
1. Go to [Viber Partners](https://partners.viber.com/)
2. Create a new bot account
3. Get Auth Token from your bot settings
4. Configure bot name and avatar URL

## Architecture

### Hybrid Architecture 🔄

The bridge supports **dual operation modes** for maximum flexibility:

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Chat Platforms │────│  Agoric Bridge   │────│  Mastra Agent   │
│                 │    │                  │    │                 │
│ • Telegram      │    │ • Message Router │    │ • AI Processing │
│ • Zalo Personal │    │ • Health Monitor │    │ • Response Gen  │
│ • Line          │    │ • Error Handler  │    │ • Context Mgmt  │
│ • WhatsApp      │    │ • Fun Logging    │    │                 │
│ • Viber         │    │ • HTTP Server*   │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       * Optional Fastify
                         HTTP Server
```

### Operation Modes

#### 🔧 **Development Mode** (`FASTIFY_ENABLED=false`)
- **Polling-based**: Uses long polling for all platforms
- **Lightweight**: No HTTP server overhead
- **Easy debugging**: Direct connection, simple logs
- **Local testing**: Perfect for development environment

```bash
# Development configuration
FASTIFY_ENABLED=false
TELEGRAM_POLLING=true
```

#### 🚀 **Production Mode** (`FASTIFY_ENABLED=true`)
- **Webhook-based**: HTTP server handles incoming webhooks
- **Scalable**: Better performance for high-traffic scenarios
- **Multi-platform**: Handles multiple platforms simultaneously
- **Production-ready**: CORS, rate limiting, proper logging

```bash
# Production configuration
FASTIFY_ENABLED=true
FASTIFY_HOST=0.0.0.0
FASTIFY_PORT=3000
TELEGRAM_POLLING=false
TELEGRAM_WEBHOOK_URL=https://yourdomain.com/webhook/telegram
```

#### 🛠️ **Microservice Mode** (HTTP API only)
- **API-first**: Run only HTTP endpoints
- **Selective platforms**: Enable/disable specific platforms
- **Integration-ready**: Perfect for larger systems

```bash
# Microservice configuration
FASTIFY_ENABLED=true
TELEGRAM_ENABLED=false    # Disable direct bot connection
ZALO_PERSONAL_ENABLED=false
# Only HTTP endpoints active
```

## API Reference

### Chat Integration Class

```typescript
import { ChatIntegration } from 'agoric-chat-bridge';

const integration = new ChatIntegration();
await integration.initialize();

// Get status
const status = integration.getStatus();
console.log(status.running, status.platforms);

// Get specific adapter
const telegramAdapter = integration.getAdapter('telegram');
```

### Custom Configuration

```typescript
import { ChatIntegration, loadConfig } from 'agoric-chat-bridge';

const customConfig = {
  ...loadConfig(),
  platforms: {
    telegram: {
      enabled: true,
      token: 'your-token',
      polling: true
    }
  }
};

const integration = new ChatIntegration(customConfig);
```

## Development

### Project Structure

```
src/
├── adapters/           # Platform-specific adapters
│   ├── telegram/       # Telegram integration
│   └── zalo/          # Zalo Personal integration
├── config/            # Configuration management
├── types/             # TypeScript type definitions
├── utils/             # Utilities (logging, clients)
└── chat-integration.ts # Main integration class
```

### Adding New Platforms

1. Create adapter class extending `BaseAdapter`
2. Implement required methods (`connect`, `disconnect`, `sendMessage`, `onMessage`)
3. Add configuration interface
4. Update `ChatIntegration` class
5. Add environment variables

### Testing

```bash
# Run tests
pnpm test:mastra
pnpm test:direct
```

## Troubleshooting

### Common Issues

**Connection Failures**
- Check your internet connection
- Verify credentials are correct
- Check if Mastra agent is running

**Fastify Server Issues**
- `EADDRINUSE` error: Port already in use
  ```bash
  # Check what's using the port
  lsof -i :3000
  # Kill the process or use different port
  FASTIFY_PORT=3001 npm start
  ```
- Webhook not receiving messages: 
  - Verify HTTPS is working: `curl -I https://yourdomain.com/health`
  - Check Telegram webhook status: Use BotFather `/mybots` → Bot Settings → Webhooks
  - Validate webhook URL format and SSL certificate

**Mode Configuration**
- Mixing polling and webhook modes can cause conflicts
- Always set `TELEGRAM_POLLING=false` when using webhooks
- Set `FASTIFY_ENABLED=true` for any webhook-based platform

**Zalo Personal Connection Issues**
- Cookies may have expired - re-export from browser
- IMEI format might be incorrect - use UUID format
- User agent might be blocked - try different browser

**Memory Issues**
- The bridge uses singleton patterns to prevent multiple connections
- Health monitoring automatically handles reconnections
- Check logs for specific error messages

### Debug Mode

Enable debug logging by setting:
```bash
ZALO_PERSONAL_LOGGING=true
NODE_ENV=development
```

## Security

- Never commit `.env` file to version control
- Use strong, unique tokens for each service
- Rotate credentials regularly
- Use HTTPS for all webhook URLs in production
- Monitor logs for suspicious activity

## License

MIT License - see [LICENSE](LICENSE) for details

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Support

For issues and questions:
- Create an issue on GitHub
- Check the troubleshooting section
- Review the logs for error details

## Acknowledgments

Special thanks to the creators and maintainers of the open source libraries that make this project possible:

- **[Mastra](https://github.com/mastra-ai/mastra)** - AI agent framework
- **[node-telegram-bot-api](https://github.com/yagop/node-telegram-bot-api)** - Telegram Bot API wrapper
- **[zca-js](https://github.com/phoneticlight/zca-js)** - Zalo Chat API client
- **[axios](https://github.com/axios/axios)** - HTTP client
- **[winston](https://github.com/winstonjs/winston)** - Logging library
- **[chalk](https://github.com/chalk/chalk)** - Terminal styling
- **[gradient-string](https://github.com/bokub/gradient-string)** - Beautiful gradient strings
- **[figlet](https://github.com/patorjk/figlet.js)** - ASCII art text
- **[express](https://github.com/expressjs/express)** - Web framework
- **[dotenv](https://github.com/motdotla/dotenv)** - Environment variable loader
- **[zod](https://github.com/colinhacks/zod)** - Schema validation
- **[TypeScript](https://github.com/microsoft/TypeScript)** - Type-safe JavaScript

---

Built by Tan Tran