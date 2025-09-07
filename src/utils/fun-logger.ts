import chalk from 'chalk';
import figlet from 'figlet';
import gradient from 'gradient-string';
import winston from 'winston';

// Fun emojis for different log levels
const EMOJIS = {
  info: '🚀',
  success: '✨',
  warning: '⚠️ ',
  error: '💥',
  debug: '🔍',
  chat: '💬',
  platform: '📱',
  mastra: '🤖',
  shutdown: '🛑',
  health: '💚',
  repeat: '🔁',
  startup: '🎉',
  connection: '🔗',
  message: '📨',
  response: '📤',
};

// Creative loading animations
const LOADING_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const ROCKET_FRAMES = ['🚀', '🌟', '✨', '⭐', '💫'];

class FunLogger {
  private logger: winston.Logger;
  private loadingInterval: NodeJS.Timeout | null = null;
  private loadingFrameIndex = 0;

  constructor() {
    const customFormat = winston.format.combine(
      winston.format.timestamp({ format: 'HH:mm:ss' }),
      winston.format.printf((info: any) => {
        const { timestamp, level, message, emoji } = info;
        const coloredTime = chalk.gray(`[${timestamp}]`);
        const emojiStr = emoji || EMOJIS[level as keyof typeof EMOJIS] || '📝';

        return `${coloredTime} ${emojiStr} ${message}`;
      }),
    );

    this.logger = winston.createLogger({
      level: 'debug',
      format: customFormat,
      transports: [new winston.transports.Console()],
    });
  }

  // ASCII Art banner
  async showBanner(text: string = 'AGORIC BRIDGE'): Promise<void> {
    return new Promise((resolve) => {
      figlet(text, { font: 'ANSI Shadow' }, (err, data) => {
        if (err) {
          this.logger.info('🎨 Welcome to Agoric Chat Bridge!', { emoji: '🎨' });
          resolve();
          return;
        }

        const gradientText = gradient.rainbow.multiline(data || '');
        console.log(`\n${gradientText}\n`);
        resolve();
      });
    });
  }

  // Animated startup
  startLoading(message: string): void {
    this.loadingFrameIndex = 0;
    process.stdout.write('\n');

    this.loadingInterval = setInterval(() => {
      const frame = LOADING_FRAMES[this.loadingFrameIndex % LOADING_FRAMES.length];
      const coloredFrame = chalk.cyan(frame);
      const coloredMessage = chalk.magenta(message);

      process.stdout.write(`\r${coloredFrame} ${coloredMessage}`);
      this.loadingFrameIndex++;
    }, 100);
  }

  stopLoading(): void {
    if (this.loadingInterval) {
      clearInterval(this.loadingInterval);
      this.loadingInterval = null;
      process.stdout.write('\n');
    }
  }

  // Fun logging methods
  startup(message: string): void {
    const rainbowText = gradient.rainbow(message);
    this.logger.info(rainbowText, { emoji: EMOJIS.startup });
  }

  success(message: string): void {
    this.logger.info(chalk.green(message), { emoji: EMOJIS.success });
  }

  info(message: string): void {
    this.logger.info(chalk.cyan(message), { emoji: EMOJIS.info });
  }

  warning(message: string): void {
    this.logger.warn(chalk.yellow(message), { emoji: EMOJIS.warning });
  }

  error(message: string, error?: any): void {
    const errorMsg = error ? `${message} ${error.message || error}` : message;
    this.logger.error(chalk.red(errorMsg), { emoji: EMOJIS.error });
  }

  debug(message: string): void {
    this.logger.debug(chalk.gray(message), { emoji: EMOJIS.debug });
  }

  platform(platform: string, message: string): void {
    const platformEmoji = this.getPlatformEmoji(platform);
    this.logger.info(chalk.cyan(`[${platform.toUpperCase()}] ${message}`), {
      emoji: platformEmoji,
    });
  }

  mastra(message: string): void {
    this.logger.info(chalk.magenta(message), { emoji: EMOJIS.mastra });
  }

  chat(platform: string, message: string): void {
    this.logger.info(chalk.green(`💬 ${platform}: ${message}`), { emoji: EMOJIS.chat });
  }

  response(platform: string, message: string): void {
    this.logger.info(chalk.blueBright(`📤 → ${platform}: ${message}`), { emoji: EMOJIS.response });
  }

  health(message: string): void {
    this.logger.info(chalk.green(message), { emoji: EMOJIS.health });
  }

  repeat(message: string): void {
    this.logger.info(chalk.yellow(message), { emoji: EMOJIS.repeat });
  }

  shutdown(message: string): void {
    this.logger.info(chalk.red(message), { emoji: EMOJIS.shutdown });
  }

  connection(message: string): void {
    this.logger.info(chalk.cyan(message), { emoji: EMOJIS.connection });
  }

  // Platform-specific emojis
  private getPlatformEmoji(platform: string): string {
    const platformEmojis: { [key: string]: string } = {
      telegram: '📱',
      'zalo-personal': '💙',
      line: '💚',
      whatsapp: '💬',
      viber: '💜',
    };
    return platformEmojis[platform.toLowerCase()] || EMOJIS.platform;
  }

  // Fun status display
  showStatus(status: { running: boolean; platforms: string[]; mastraEndpoint: string }): void {
    console.log(`\n${chalk.cyan('━'.repeat(60))}`);
    console.log(gradient.rainbow('🎯 SYSTEM STATUS'));
    console.log(chalk.cyan('━'.repeat(60)));

    const statusIcon = status.running ? '🟢' : '🔴';
    const statusText = status.running ? chalk.green('RUNNING') : chalk.red('STOPPED');
    console.log(`${statusIcon} Status: ${statusText}`);

    console.log(`🚀 Mastra: ${chalk.cyanBright(status.mastraEndpoint)}`);
    console.log(`📱 Platforms: ${chalk.magenta(status.platforms.join(', ') || 'None')}`);

    console.log(`${chalk.cyan('━'.repeat(60))}\n`);
  }

  // Rocket launch animation
  async rocketLaunch(): Promise<void> {
    for (let i = 0; i < ROCKET_FRAMES.length; i++) {
      process.stdout.write(`\r${ROCKET_FRAMES[i]} Launching... `);
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    process.stdout.write('\n');
  }
}

// Export singleton instance
export const funLogger = new FunLogger();
