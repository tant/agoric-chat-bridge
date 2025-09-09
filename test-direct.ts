#!/usr/bin/env ts-node

import axios from 'axios';
import { loadConfig } from './src/config/config';

async function testDirectAPI() {
  console.log('🧪 Testing Direct Mastra API...\n');

  try {
    const config = loadConfig();
    const baseURL = config.mastra.endpoint;
    const agentId = config.mastra.agentId;

    console.log(`📡 Connecting to: ${baseURL}`);
    console.log(`🤖 Agent ID: ${agentId}\n`);

    // Test 1: Get agents
    console.log('🔍 Testing GET /agents...');
    const agentsResponse = await axios.get(`${baseURL}/agents`);
    console.log('✅ Agents response:', Object.keys(agentsResponse.data));
    console.log('Agent details:', JSON.stringify(agentsResponse.data[agentId!], null, 2));
    console.log('');

    // Test 2: Send message to agent
    console.log('📤 Testing POST to agent generate...');
    console.log(`Question: "bạn có cpu nào"`);
    console.log('⏳ Waiting for response...\n');

    const messagePayload = {
      messages: [
        {
          role: 'user',
          content: 'bạn có cpu nào',
        },
      ],
      threadId: `test_user_123`,
    };

    try {
      // Try different possible endpoints
      const possibleEndpoints = [
        `${baseURL}/agents/${agentId}/generate`,
        `${baseURL}/agent/${agentId}/generate`,
        `${baseURL}/generate/${agentId}`,
        `${baseURL}/chat/${agentId}`,
        `${baseURL}/${agentId}/generate`,
      ];

      for (const endpoint of possibleEndpoints) {
        try {
          console.log(`Trying endpoint: ${endpoint}`);
          const response = await axios.post(endpoint, messagePayload, {
            headers: {
              'Content-Type': 'application/json',
            },
          });

          console.log('📥 SUCCESS! Response received:');
          console.log('─'.repeat(50));
          console.log(`✅ Status: ${response.status}`);
          console.log(`✅ Response:`, JSON.stringify(response.data, null, 2));
          console.log('─'.repeat(50));
          console.log('\n🎉 Test completed successfully!');
          return;
        } catch (endpointError: any) {
          console.log(
            `❌ Failed: ${endpointError.response?.status} ${endpointError.response?.statusText}`,
          );
        }
      }

      console.log('❌ All endpoints failed');
    } catch (error: any) {
      console.error('❌ Error sending message:', error.response?.data || error.message);
    }
  } catch (error: any) {
    console.error('❌ Test failed with error:');
    console.error(error.response?.data || error.message);
  }
}

// Run the test
if (require.main === module) {
  testDirectAPI().catch(console.error);
}
