#!/usr/bin/env npx tsx
import fetch from 'node-fetch';
import https from 'https';
import dotenv from 'dotenv';
import path from 'path';
import readline from 'readline';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query: string): Promise<string> {
  return new Promise(resolve => rl.question(query, resolve));
}

// Ignore self-signed certificates
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

async function unlockDartmouthDoor() {
  console.log('🔓 Dartmouth Office Door Unlock Test\n');
  console.log('=' .repeat(50));

  const token = process.env.UNIFI_ACCESS_TOKEN || process.env.UNIFI_DEVELOPER_TOKEN;
  const controllerIP = process.env.UNIFI_CONTROLLER_IP || '192.168.1.1';
  const apiPort = process.env.UNIFI_API_PORT || '12445';
  const doorId = '4cea8c1f-b02a-4331-b8ab-4323ec537058'; // Dartmouth Office

  if (!token) {
    console.log('❌ Token not found!');
    process.exit(1);
  }

  console.log('📍 Door: Dartmouth Office');
  console.log(`🔑 Token: ${token.substring(0, 10)}...`);
  console.log(`🖥️  Controller: ${controllerIP}:${apiPort}`);
  console.log('');

  // Get unlock duration
  const durationStr = await question('Enter unlock duration in seconds (default: 30): ');
  const duration = durationStr ? parseInt(durationStr) : 30;
  
  if (isNaN(duration) || duration < 1 || duration > 300) {
    console.log('❌ Invalid duration (must be 1-300 seconds)');
    process.exit(1);
  }

  // Confirm
  console.log(`\n⚠️  About to unlock: Dartmouth Office`);
  console.log(`⏱️  Duration: ${duration} seconds`);
  const confirm = await question('Are you sure? (yes/no): ');
  
  if (confirm.toLowerCase() !== 'yes' && confirm.toLowerCase() !== 'y') {
    console.log('Cancelled.');
    rl.close();
    return;
  }

  try {
    // Unlock the door
    console.log('\n🔓 Unlocking door...');
    
    const unlockUrl = `https://${controllerIP}:${apiPort}/api/v1/developer/doors/${doorId}/remote_unlock`;
    
    const response = await fetch(unlockUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        actor_id: 'clubos-test',
        actor_name: 'ClubOS Test Script',
        extra: {
          source: 'test-script',
          duration_seconds: duration,
          timestamp: new Date().toISOString()
        }
      }),
      agent: httpsAgent
    });

    if (response.ok) {
      const result = await response.json();
      
      if (result.code === 'SUCCESS') {
        console.log('✅ Door unlocked successfully!');
        console.log(`\nThe door will automatically lock after ${duration} seconds.`);
        
        // If duration > 60 seconds, also set a custom lock rule
        if (duration > 60) {
          const minutes = Math.ceil(duration / 60);
          console.log(`\nSetting lock rule for ${minutes} minutes...`);
          
          const ruleResponse = await fetch(
            `https://${controllerIP}:${apiPort}/api/v1/developer/doors/${doorId}/lock_rule`,
            {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                type: 'custom',
                interval: minutes
              }),
              agent: httpsAgent
            }
          );
          
          if (ruleResponse.ok) {
            console.log('✅ Lock rule set successfully');
          }
        }
      } else {
        console.log('❌ Unlock failed:', result.msg);
      }
    } else {
      const errorText = await response.text();
      console.log('❌ Unlock failed:', response.status, errorText);
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    rl.close();
  }
}

// Run the unlock test
unlockDartmouthDoor().catch(console.error);