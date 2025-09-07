import type { AdapterConfig, ChatAdapter } from '../types/adapter';
import type { ConnectionHealth, HealthMonitor } from '../types/health';
import type { ChatResponse, ChatUser, Message } from '../types/message';
import { funLogger } from '../utils/fun-logger';

export abstract class BaseAdapter implements ChatAdapter, HealthMonitor {
  public abstract platform: string;
  public isConnected: boolean = false;
  protected config: AdapterConfig;
  protected connectionHealth: ConnectionHealth;
  protected healthCheckInterval: NodeJS.Timeout | null = null;
  protected startTime: number = Date.now();
  protected messagesProcessed: number = 0;
  protected lastActivity: number = Date.now();

  // Health monitoring settings
  protected readonly MAX_CONSECUTIVE_FAILURES = 5;
  protected readonly HEALTH_CHECK_INTERVAL = 60 * 1000; // 1 minute

  constructor(config: AdapterConfig) {
    this.config = config;
    this.connectionHealth = {
      isConnected: false,
      lastHealthCheck: 0,
      consecutiveFailures: 0,
      reconnectAttempts: 0,
    };
  }

  abstract connect(config?: any): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract forceShutdown(): Promise<void>;
  abstract sendMessage(userId: string, response: ChatResponse): Promise<void>;
  abstract onMessage(callback: (message: Message) => Promise<ChatResponse | undefined>): void;

  onUserJoin?(_callback: (user: ChatUser) => Promise<void>): void {
    // Optional implementation
  }

  onUserLeave?(_callback: (user: ChatUser) => Promise<void>): void {
    // Optional implementation
  }

  async getUser?(_userId: string): Promise<ChatUser | null> {
    // Optional implementation
    return null;
  }

  protected log(message: string, data?: any): void {
    funLogger.platform(this.platform, `${message}${data ? ` ${JSON.stringify(data)}` : ''}`);
  }

  protected logError(message: string, error?: any): void {
    funLogger.error(`[${this.platform.toUpperCase()}] ${message}`, error);
  }

  // Health monitoring methods
  isHealthy(): boolean {
    return (
      this.connectionHealth.isConnected &&
      this.connectionHealth.consecutiveFailures < this.MAX_CONSECUTIVE_FAILURES
    );
  }

  getHealthStatus(): ConnectionHealth {
    return { ...this.connectionHealth };
  }

  abstract performHealthCheck(): Promise<void>;

  startHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, this.HEALTH_CHECK_INTERVAL);

    this.log('Health monitoring started');
  }

  stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  protected updateHealthStatus(success: boolean, error?: string): void {
    this.connectionHealth.lastHealthCheck = Date.now();

    if (success) {
      this.connectionHealth.isConnected = true;
      this.connectionHealth.consecutiveFailures = 0;
      delete this.connectionHealth.lastError;
    } else {
      this.connectionHealth.isConnected = false;
      this.connectionHealth.consecutiveFailures++;
      if (error) {
        this.connectionHealth.lastError = error;
      }
    }
  }

  protected updateActivity(): void {
    this.lastActivity = Date.now();
    this.messagesProcessed++;
  }

  getAdapterStatus() {
    return {
      platform: this.platform,
      running: this.isConnected,
      health: this.getHealthStatus(),
      uptime: Date.now() - this.startTime,
      messagesProcessed: this.messagesProcessed,
      lastActivity: this.lastActivity,
    };
  }
}
