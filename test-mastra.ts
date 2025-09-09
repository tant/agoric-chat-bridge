#!/usr/bin/env ts-node

import { loadConfig } from './src/config/config';
import { ChatPlatform, type Message, MessageType } from './src/types/message';
import { MastraClient } from './src/utils/mastra-client';

async function testMastraAgent() {
  console.log('🧪 Testing Mastra Agent Connection...\n');

  try {
    // Load configuration
    const config = loadConfig();
    console.log(`📡 Connecting to: ${config.mastra.endpoint}`);
    console.log(`🤖 Agent ID: ${config.mastra.agentId}\n`);

    // Create Mastra client
    const mastraClient = new MastraClient(config.mastra);

    // Try to get available agents first (will also serve as health check)
    console.log('🔍 Checking connection and fetching available agents...');
    try {
      const agents = await mastraClient.getAgents();
      console.log(
        `✅ Connection successful! Found ${agents.length} agent(s):`,
        agents.map((a) => a.id || 'unknown').join(', '),
      );
      console.log('');
    } catch (agentError: any) {
      console.log('⚠️  Could not fetch agents list, but will try to send message anyway...');
      console.log('Agent fetch error:', agentError?.message || agentError);
      console.log('');
    }

    // Create test message
    const testMessage: Message = {
      id: 'test-001',
      content: 'bạn có cpu nào',
      senderId: 'test-user',
      senderName: 'Test User',
      timestamp: new Date(),
      platform: ChatPlatform.TELEGRAM,
      messageType: MessageType.TEXT,
      metadata: {
        test: true,
        source: 'test-script',
      },
    };

    // Send test message
    console.log('📤 Sending test message to salesAgent...');
    console.log(`Question: "${testMessage.content}"`);
    console.log('⏳ Waiting for response...\n');

    const response = await mastraClient.sendMessage(testMessage);

    // Display response
    console.log('📥 Response received:');
    console.log('─'.repeat(50));
    console.log(`✅ Content: ${response.content}`);
    console.log(`📝 Type: ${response.messageType}`);
    console.log(`🏷️  Metadata:`, JSON.stringify(response.metadata, null, 2));
    console.log('─'.repeat(50));
    console.log('\n🎉 Test completed successfully!');
  } catch (error) {
    console.error('❌ Test failed with error:');
    console.error(error);

    if (error instanceof Error) {
      if (error.message.includes('Agent ID is required')) {
        console.log('\n💡 Tip: Make sure MASTRA_AGENT_ID is set in your .env file');
      } else if (error.message.includes('ECONNREFUSED')) {
        console.log('\n💡 Tip: Make sure Mastra server is running at the specified endpoint');
      }
    }
  }
}

// Run the test
if (require.main === module) {
  testMastraAgent().catch(console.error);
}
