import { Zalo } from 'zca-js';
import { BaseAdapter } from '../base-adapter';
import { Message, ChatResponse, ChatUser, MessageType, ChatPlatform } from '../../types/message';
import { validateZaloConfig, type ZaloConfig } from './zalo-config';
import { funLogger } from '../../utils/fun-logger';

interface ConnectionHealth {
  isConnected: boolean;
  lastHealthCheck: number;
  consecutiveFailures: number;
  lastError?: string;
}

export class ZaloAdapter extends BaseAdapter {
  public platform = 'zalo-personal';
  private static globalInstance: ZaloAdapter | null = null;
  private zalo: any;
  private api: any;
  protected config: ZaloConfig;
  private _isShutdown: boolean = false;
  private healthCheck: NodeJS.Timeout | null = null;
  private connectionHealth: ConnectionHealth;
  private messageCallback: ((message: Message) => Promise<ChatResponse | void>) | null = null;

  // Connection settings
  private readonly MAX_CONSECUTIVE_FAILURES = 5;
  private readonly HEALTH_CHECK_INTERVAL = 60 * 1000; // 1 minute

  /**
   * Factory method - ensures singleton
   */
  static async create(config: Partial<ZaloConfig>): Promise<ZaloAdapter | null> {
    funLogger.info('🔍 Checking for existing Zalo instances...');
    
    // Return existing healthy instance
    if (ZaloAdapter.globalInstance) {
      const instance = ZaloAdapter.globalInstance;
      if (!instance._isShutdown && instance.isHealthy()) {
        funLogger.info('♻️ Returning existing healthy Zalo instance');
        return instance;
      } else {
        funLogger.info('🔄 Existing instance unhealthy, shutting down...');
        await instance.forceShutdown();
        ZaloAdapter.globalInstance = null;
      }
    }

    // Create new instance
    try {
      const instance = new ZaloAdapter(config);
      const success = await instance.initialize();
      
      if (success) {
        ZaloAdapter.globalInstance = instance;
        funLogger.success('✅ Zalo singleton instance created successfully');
        return instance;
      } else {
        await instance.forceShutdown();
        return null;
      }
    } catch (error) {
      funLogger.error('❌ Zalo singleton creation failed', error);
      return null;
    }
  }

  /**
   * Private constructor - use factory method
   */
  private constructor(config: Partial<ZaloConfig>) {
    super(config);
    
    funLogger.debug('🔧 Initializing Zalo adapter with config');
    
    this.config = validateZaloConfig(config);
    
    this.connectionHealth = {
      isConnected: false,
      lastHealthCheck: 0,
      consecutiveFailures: 0,
    };

    this.zalo = new Zalo({
      selfListen: this.config.selfListen,
      checkUpdate: this.config.checkUpdate,
      logging: this.config.logging,
    });
  }

  /**
   * Check if adapter is shutdown
   */
  isShutdown(): boolean {
    return this._isShutdown;
  }

  /**
   * Check if adapter is healthy
   */
  isHealthy(): boolean {
    return this.connectionHealth.isConnected && 
           this.connectionHealth.consecutiveFailures < this.MAX_CONSECUTIVE_FAILURES;
  }

  /**
   * Initialize adapter with connection
   */
  private async initialize(): Promise<boolean> {
    funLogger.startLoading('Connecting to Zalo');
    
    try {
      await this.connectToZalo();
      this.startHealthMonitoring();
      
      this.connectionHealth.isConnected = true;
      this.connectionHealth.lastHealthCheck = Date.now();
      this.connectionHealth.consecutiveFailures = 0;
      
      funLogger.stopLoading();
      funLogger.success('🎊 Zalo connection established successfully!');
      return true;
    } catch (error) {
      funLogger.stopLoading();
      funLogger.error('💥 Zalo initialization failed', error);
      this.connectionHealth.isConnected = false;
      this.connectionHealth.lastError = error instanceof Error ? error.message : String(error);
      return false;
    }
  }

  /**
   * Connect method required by BaseAdapter
   */
  async connect(config?: any): Promise<void> {
    if (this._isShutdown) {
      throw new Error('Cannot connect shutdown adapter');
    }
    const success = await this.initialize();
    if (!success) {
      throw new Error('Failed to initialize Zalo adapter');
    }
  }

  /**
   * Connect to Zalo service
   */
  private async connectToZalo(): Promise<void> {
    funLogger.info('🔐 Logging into Zalo with credentials...');

    this.api = await this.zalo.login({
      cookie: this.config.cookie,
      imei: this.config.imei,
      userAgent: this.config.userAgent,
    });

    funLogger.platform('zalo', 'Logged in successfully! 🎉');
    this.setupMessageHandlers();
    this.isConnected = true;
  }

  /**
   * Set up Zalo message handlers
   */
  private setupMessageHandlers(): void {
    funLogger.info('⚙️ Setting up Zalo message handlers...');

    // Text messages
    this.api.listener.on('message', this.handleZaloMessage.bind(this));
    funLogger.info('📝 Message handler registered');

    // Error handling
    this.api.listener.on('error', (error: any) => {
      funLogger.error('💥 Zalo listener error', error);
      this.handleConnectionError(error);
    });

    // Start listening
    this.api.listener.start();
    funLogger.success('🎧 Zalo listener started and ready!');
  }

  /**
   * Normalize Zalo message to standard format
   */
  private normalizeMessage(zaloMessage: any): Message {
    // Handle new message structure (with data object)
    if (zaloMessage.data) {
      const messageData = zaloMessage.data;
      
      return {
        id: messageData.msgId?.toString() || Date.now().toString(),
        content: messageData.content || '[Empty message]',
        senderId: messageData.uidFrom?.toString() || 'unknown',
        senderName: messageData.dName || 'Unknown Sender',
        timestamp: new Date(parseInt(messageData.ts, 10) || Date.now()),
        platform: ChatPlatform.ZALO_PERSONAL,
        messageType: MessageType.TEXT,
        metadata: {
          threadId: messageData.uidFrom?.toString() || 'unknown',
          messageType: 'text'
        }
      };
    }

    // Handle old message structure (with sender object)
    let content = '';
    let messageType = MessageType.TEXT;

    if (zaloMessage.body || zaloMessage.text) {
      content = zaloMessage.body || zaloMessage.text;
      messageType = MessageType.TEXT;
    } else if (zaloMessage.photo) {
      content = '[Image message]';
      messageType = MessageType.IMAGE;
    } else if (zaloMessage.file) {
      content = '[File message]';
      messageType = MessageType.FILE;
    } else {
      content = '[Unsupported message type]';
      messageType = MessageType.TEXT;
    }

    return {
      id: zaloMessage.id?.toString() || Date.now().toString(),
      content,
      senderId: zaloMessage.sender?.id?.toString() || 'unknown',
      senderName: zaloMessage.sender?.name || 'Unknown Sender',
      timestamp: new Date(zaloMessage.timestamp || Date.now()),
      platform: ChatPlatform.ZALO_PERSONAL,
      messageType,
      metadata: {
        threadId: (zaloMessage.threadID || zaloMessage.sender?.id || 'unknown').toString(),
        messageType: messageType.toLowerCase()
      }
    };
  }

  /**
   * Handle Zalo message
   */
  private async handleZaloMessage(zaloMessage: any): Promise<void> {
    if (!zaloMessage || !this.messageCallback) {
      return;
    }

    // Validate message structure
    const hasValidSender = zaloMessage.data?.uidFrom || zaloMessage.sender?.id;
    if (!hasValidSender) {
      funLogger.warning('⚠️ Message missing valid sender information, skipping');
      return;
    }

    try {
      const normalizedMessage = this.normalizeMessage(zaloMessage);
      
      funLogger.chat('zalo', `📨 "${normalizedMessage.content.substring(0, 50)}${normalizedMessage.content.length > 50 ? '...' : ''}"`);

      // Validate the message
      if (!this.validateMessage(normalizedMessage)) {
        funLogger.warning('❌ Message validation failed');
        await this.sendErrorResponse('Xin lỗi, tôi không thể xử lý tin nhắn của bạn. Vui lòng thử lại.', normalizedMessage);
        return;
      }

      const response = await this.messageCallback(normalizedMessage);
      
      if (response && normalizedMessage.metadata?.threadId) {
        await this.sendMessage(normalizedMessage.metadata.threadId, response);
      }
    } catch (error) {
      funLogger.error('💥 Error processing Zalo message', error);
      // Send error response if possible
      try {
        const normalizedMessage = this.normalizeMessage(zaloMessage);
        await this.sendErrorResponse('Đã xảy ra lỗi khi xử lý tin nhắn. Vui lòng thử lại sau.', normalizedMessage);
      } catch (sendError) {
        funLogger.error('Failed to send error response', sendError);
      }
    }
  }

  /**
   * Send message through Zalo API
   */
  async sendMessage(userId: string, response: ChatResponse): Promise<void> {
    if (!this.api || !this.isConnected) {
      throw new Error('Zalo adapter is not connected');
    }

    try {
      const messageText = response.content || 'Xin lỗi, tôi không thể xử lý yêu cầu của bạn.';
      
      await this.api.sendMessage(messageText, userId);
      
      funLogger.response('zalo', `"${messageText.substring(0, 50)}${messageText.length > 50 ? '...' : ''}"`);
    } catch (error) {
      funLogger.error('💥 Failed to send Zalo message', error);
      throw error;
    }
  }

  /**
   * Send error response
   */
  private async sendErrorResponse(message: string, originalMessage: Message): Promise<void> {
    try {
      await this.api.sendMessage(message, originalMessage.metadata?.threadId || originalMessage.senderId);
    } catch (error) {
      funLogger.error('💥 Failed to send error response', error);
    }
  }

  /**
   * Set message callback
   */
  onMessage(callback: (message: Message) => Promise<ChatResponse | void>): void {
    this.messageCallback = callback;
  }

  /**
   * Get user info (placeholder implementation)
   */
  async getUser(userId: string): Promise<ChatUser | null> {
    // Zalo personal API doesn't have a direct user info endpoint
    return {
      id: userId,
      name: 'Zalo Personal User',
      platform: ChatPlatform.ZALO_PERSONAL,
      metadata: {}
    };
  }

  /**
   * Validate message before processing
   */
  private validateMessage(message: Message): boolean {
    if (!message.content || message.content.trim().length === 0) {
      return false;
    }

    if (!message.senderId || message.senderId === 'unknown') {
      return false;
    }

    if (message.content.length > 4096) {
      return false;
    }

    return true;
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    if (this.healthCheck) {
      clearInterval(this.healthCheck);
    }

    this.healthCheck = setInterval(async () => {
      await this.performHealthCheck();
    }, this.HEALTH_CHECK_INTERVAL);

    funLogger.info('💓 Zalo health monitoring started');
  }

  /**
   * Perform health check
   */
  private async performHealthCheck(): Promise<void> {
    try {
      if (!this.api || this._isShutdown) {
        return;
      }

      if (this.api?.listener) {
        this.updateHealthStatus(true);
        funLogger.debug('💓 Zalo health check passed');
      } else {
        throw new Error('API or listener unavailable');
      }
    } catch (error) {
      funLogger.error('❌ Zalo health check failed', error);
      this.updateHealthStatus(false);
      
      if (this.connectionHealth.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
        funLogger.error('🚨 Too many failures, attempting reconnection');
        await this.attemptReconnection();
      }
    }
  }

  /**
   * Update health status
   */
  private updateHealthStatus(success: boolean): void {
    this.connectionHealth.lastHealthCheck = Date.now();
    
    if (success) {
      this.connectionHealth.isConnected = true;
      this.connectionHealth.consecutiveFailures = 0;
      delete this.connectionHealth.lastError;
    } else {
      this.connectionHealth.isConnected = false;
      this.connectionHealth.consecutiveFailures++;
    }
  }

  /**
   * Handle connection errors
   */
  private handleConnectionError(error: any): void {
    funLogger.error('🚨 Zalo connection error', error);
    
    this.connectionHealth.lastError = error instanceof Error ? error.message : String(error);
    this.updateHealthStatus(false);
  }

  /**
   * Attempt reconnection
   */
  private async attemptReconnection(): Promise<void> {
    funLogger.info('🔄 Attempting Zalo reconnection...');

    try {
      // Wait before reconnection
      await new Promise(resolve => setTimeout(resolve, 30000)); // 30 seconds

      // Stop current listener
      if (this.api?.listener) {
        try {
          this.api.listener.stop();
        } catch (error) {
          funLogger.warning('⚠️ Error stopping Zalo listener: ' + (error instanceof Error ? error.message : String(error)));
        }
      }

      // Reconnect to Zalo
      await this.connectToZalo();
      
      this.updateHealthStatus(true);
      funLogger.success('✅ Zalo reconnection successful');
    } catch (error) {
      funLogger.error('❌ Zalo reconnection failed', error);
      this.updateHealthStatus(false);
    }
  }

  /**
   * Force shutdown (immediate cleanup)
   */
  async forceShutdown(): Promise<void> {
    funLogger.shutdown('💥 Zalo force shutdown initiated');
    this._isShutdown = true;
    
    if (this.healthCheck) {
      clearInterval(this.healthCheck);
      this.healthCheck = null;
    }
    
    if (this.api?.listener) {
      try {
        this.api.listener.stop();
      } catch (error) {
        funLogger.warning('⚠️ Zalo force stop error: ' + (error instanceof Error ? error.message : String(error)));
      }
    }
    
    if (ZaloAdapter.globalInstance === this) {
      ZaloAdapter.globalInstance = null;
    }
    
    this.api = null;
    this.zalo = null;
    this.isConnected = false;
    this.connectionHealth.isConnected = false;
  }

  /**
   * Graceful disconnect
   */
  async disconnect(): Promise<void> {
    if (this._isShutdown) {
      return;
    }

    funLogger.shutdown('🛑 Zalo graceful shutdown');
    this._isShutdown = true;

    if (this.healthCheck) {
      clearInterval(this.healthCheck);
      this.healthCheck = null;
    }

    if (this.api?.listener) {
      try {
        this.api.listener.stop();
      } catch (error) {
        funLogger.warning('⚠️ Zalo shutdown cleanup error: ' + (error instanceof Error ? error.message : String(error)));
      }
    }

    if (ZaloAdapter.globalInstance === this) {
      ZaloAdapter.globalInstance = null;
    }

    this.api = null;
    this.zalo = null;
    this.isConnected = false;
    this.connectionHealth.isConnected = false;
    
    funLogger.success('✅ Zalo shutdown completed');
  }
}