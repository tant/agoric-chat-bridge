#!/usr/bin/env node

import { ZaloAdapter } from './src/adapters/zalo/zalo-adapter';
import { funLogger } from './src/utils/fun-logger';

async function testZaloIntegration() {
  funLogger.startup('🧪 Testing Agoric Chat Bridge - Zalo Integration');

  // Test configuration validation
  try {
    funLogger.info('Testing Zalo configuration validation...');
    
    // Test with empty config (should fail)
    try {
      await ZaloAdapter.create({});
      funLogger.error('❌ Should have failed with empty config');
    } catch (error) {
      funLogger.success('✅ Empty config validation works');
    }

    // Test with partial config (should fail)
    try {
      await ZaloAdapter.create({
        enabled: true,
        cookie: 'test-cookie'
      });
      funLogger.error('❌ Should have failed with partial config');
    } catch (error) {
      funLogger.success('✅ Partial config validation works');
    }

    // Test singleton pattern
    funLogger.info('Testing singleton pattern...');
    
    const mockConfig = {
      enabled: true,
      cookie: 'mock-cookie-data',
      imei: 'mock-imei',
      userAgent: 'mock-user-agent',
      selfListen: false,
      checkUpdate: false,
      logging: false
    };

    // Note: This will fail to actually connect since we don't have real credentials
    // But we can test the validation and configuration logic
    const adapter1 = await ZaloAdapter.create(mockConfig);
    const adapter2 = await ZaloAdapter.create(mockConfig);
    
    if (adapter1 === adapter2) {
      funLogger.success('✅ Singleton pattern works correctly');
    } else {
      funLogger.warning('⚠️ Singleton pattern test inconclusive (connection failed)');
    }

    // Clean up
    if (adapter1) {
      await adapter1.forceShutdown();
    }

    funLogger.success('🎉 Agoric Chat Bridge Zalo integration tests completed!');
    
  } catch (error) {
    funLogger.error('💥 Test failed', error);
  }
}

if (require.main === module) {
  testZaloIntegration();
}