# Agoric Chat Bridge

A powerful multi-platform chat integration bridge that connects various messaging platforms (Telegram, Zalo, Line, WhatsApp, Viber) with AI agents through the Mastra framework.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D16-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)

## Features

- **Multi-Platform Support**: Telegram, Zalo (personal), Line, WhatsApp, Viber
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
# Telegram Bot (easiest to set up)
TELEGRAM_ENABLED=true
TELEGRAM_BOT_TOKEN=your_bot_token_here

# Zalo Personal (advanced)
ZALO_ENABLED=true
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

## Platform Setup

### Telegram
1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. Send `/newbot` command
3. Follow instructions to create your bot
4. Copy the token to `TELEGRAM_BOT_TOKEN` in `.env`

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

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Chat Platforms │────│  Agoric Bridge   │────│  Mastra Agent   │
│                 │    │                  │    │                 │
│ • Telegram      │    │ • Message Router │    │ • AI Processing │
│ • Zalo          │    │ • Health Monitor │    │ • Response Gen  │
│ • Line          │    │ • Error Handler  │    │ • Context Mgmt  │
│ • WhatsApp      │    │ • Fun Logging    │    │                 │
│ • Viber         │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
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
│   └── zalo/          # Zalo integration
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
# Run specific platform tests
pnpm test:telegram
pnpm test:zalo

# Test Mastra connection
pnpm test:mastra
```

## Troubleshooting

### Common Issues

**Connection Failures**
- Check your internet connection
- Verify credentials are correct
- Check if Mastra agent is running

**Zalo Connection Issues**
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
ZALO_LOGGING=true
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