#!/usr/bin/env npx tsx
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import WebSocket from 'ws';

// Load environment variables
dotenv.config();

async function testWebSocketControl() {
  const apiKey = process.env.UNIFI_API_KEY;
  
  if (!apiKey) {
    console.error('❌ UNIFI_API_KEY not set in .env file');
    process.exit(1);
  }
  
  console.log('========================================');
  console.log('UniFi EA WebSocket Test');
  console.log('========================================\n');
  
  // Check for WebSocket endpoints
  console.log('🔍 Looking for WebSocket/SSE endpoints...\n');
  
  const headers = {
    'X-API-KEY': apiKey,
    'Content-Type': 'application/json'
  };
  
  // Test for event stream endpoints
  const streamEndpoints = [
    'https://api.ui.com/ea/events',
    'https://api.ui.com/ea/stream',
    'https://api.ui.com/ea/ws',
    'https://api.ui.com/ea/notifications'
  ];
  
  for (const endpoint of streamEndpoints) {
    try {
      const response = await fetch(endpoint, { 
        headers: {
          ...headers,
          'Accept': 'text/event-stream'
        }
      });
      console.log(`${endpoint}: ${response.status} ${response.statusText}`);
      
      if (response.ok || response.status === 426) { // 426 = Upgrade Required (for WebSocket)
        console.log('  Might be a streaming endpoint');
      }
    } catch (error: any) {
      console.log(`${endpoint}: ❌ ${error.message}`);
    }
  }
  
  // Try WebSocket connection
  console.log('\n🔌 Attempting WebSocket connections...\n');
  
  const wsEndpoints = [
    'wss://api.ui.com/ea/events',
    'wss://api.ui.com/ea/ws',
    'wss://api.ui.com/ea/notifications',
    'wss://api.ui.com/ws'
  ];
  
  for (const wsUrl of wsEndpoints) {
    console.log(`Trying: ${wsUrl}`);
    
    try {
      const ws = new WebSocket(wsUrl, {
        headers: {
          'X-API-KEY': apiKey
        }
      });
      
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error('Connection timeout'));
        }, 5000);
        
        ws.on('open', () => {
          clearTimeout(timeout);
          console.log('  ✅ WebSocket connected!');
          
          // Try sending a command
          const unlockCommand = {
            type: 'command',
            target: '28704E80C44F', // Bedford Front Door
            action: 'unlock',
            params: {
              duration: 5
            }
          };
          
          console.log('  Sending unlock command...');
          ws.send(JSON.stringify(unlockCommand));
          
          setTimeout(() => {
            ws.close();
            resolve();
          }, 2000);
        });
        
        ws.on('message', (data) => {
          console.log('  Message received:', data.toString());
        });
        
        ws.on('error', (error) => {
          clearTimeout(timeout);
          console.log(`  ❌ WebSocket error: ${error.message}`);
          reject(error);
        });
      });
    } catch (error: any) {
      if (error.message !== 'Connection timeout') {
        console.log(`  ❌ ${error.message}`);
      } else {
        console.log('  Timeout - no connection');
      }
    }
  }
  
  // Check if there's a command queue or action endpoint
  console.log('\n\n📮 Testing command/action endpoints...\n');
  
  const commandEndpoints = [
    {
      name: 'Commands endpoint',
      url: 'https://api.ui.com/ea/commands',
      body: {
        deviceId: '28704E80C44F',
        command: 'unlock',
        params: { duration: 5 }
      }
    },
    {
      name: 'Actions endpoint',
      url: 'https://api.ui.com/ea/actions',
      body: {
        deviceId: '28704E80C44F',
        action: 'unlock',
        duration: 5
      }
    },
    {
      name: 'Tasks endpoint',
      url: 'https://api.ui.com/ea/tasks',
      body: {
        type: 'device_command',
        target: '28704E80C44F',
        command: 'unlock'
      }
    }
  ];
  
  for (const endpoint of commandEndpoints) {
    console.log(`Testing: ${endpoint.name}`);
    
    try {
      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(endpoint.body)
      });
      
      console.log(`  Response: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('  ✅ Success!', JSON.stringify(data, null, 2));
      }
    } catch (error: any) {
      console.log(`  ❌ Error: ${error.message}`);
    }
  }
}

testWebSocketControl().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});