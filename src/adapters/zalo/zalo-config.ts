export interface ZaloConfig {
  enabled: boolean;
  cookie: string;
  imei: string;
  userAgent: string;
  selfListen?: boolean;
  checkUpdate?: boolean;
  logging?: boolean;
}

export function validateZaloConfig(config: Partial<ZaloConfig>): ZaloConfig {
  if (!config.cookie) {
    throw new Error('Zalo cookie is required');
  }

  if (!config.imei) {
    throw new Error('Zalo IMEI is required');
  }

  if (!config.userAgent) {
    throw new Error('Zalo User Agent is required');
  }

  return {
    enabled: config.enabled ?? true,
    cookie: config.cookie,
    imei: config.imei,
    userAgent: config.userAgent,
    selfListen: config.selfListen ?? false,
    checkUpdate: config.checkUpdate ?? false,
    logging: config.logging ?? true,
  };
}
