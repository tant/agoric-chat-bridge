export interface ConnectionHealth {
  isConnected: boolean;
  lastHealthCheck: number;
  consecutiveFailures: number;
  lastError?: string;
  reconnectAttempts?: number;
}

export interface HealthMonitor {
  isHealthy(): boolean;
  getHealthStatus(): ConnectionHealth;
  performHealthCheck(): Promise<void>;
  startHealthMonitoring(): void;
  stopHealthMonitoring(): void;
}

export interface AdapterStatus {
  platform: string;
  running: boolean;
  health: ConnectionHealth;
  uptime: number;
  messagesProcessed: number;
  lastActivity: number;
}
