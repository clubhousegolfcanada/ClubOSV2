#!/usr/bin/env npx tsx
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query: string): Promise<string> {
  return new Promise(resolve => rl.question(query, resolve));
}

async function configureDeveloperToken() {
  console.log('🔑 UniFi Access Developer Token Configuration\n');
  console.log('=' .repeat(50));
  
  console.log('You have API tokens configured in UniFi Access!');
  console.log('We need to get the actual token value.\n');
  
  console.log('📋 Steps to get your token:\n');
  console.log('1. In the UniFi Access Settings → API page');
  console.log('2. Click on "Token ClubOSV1" or "Door API Token"');
  console.log('3. You should see a "View Token" or "Copy Token" option');
  console.log('4. Copy the token value (it will be a long string)\n');
  
  const token = await question('Paste your Developer API Token here: ');
  
  if (!token || token.length < 20) {
    console.log('❌ Invalid token');
    process.exit(1);
  }
  
  console.log('\n✅ Token received (length: ' + token.length + ' chars)\n');
  
  // Get controller IP
  console.log('Now we need the UniFi Access controller IP address.');
  console.log('This should be the local IP of your controller.\n');
  
  const currentIP = process.env.UNIFI_CONTROLLER_IP || process.env.BEDFORD_CONTROLLER_IP || '192.168.1.1';
  const ipPrompt = `Controller IP [${currentIP}]: `;
  const controllerIP = await question(ipPrompt) || currentIP;
  
  // Get controller port
  const currentPort = process.env.UNIFI_API_PORT || '12445';
  const portPrompt = `API Port [${currentPort}]: `;
  const apiPort = await question(portPrompt) || currentPort;
  
  console.log('\n📝 Configuration Summary:');
  console.log('=' .repeat(50));
  console.log(`Token: ${token.substring(0, 20)}...`);
  console.log(`Controller IP: ${controllerIP}`);
  console.log(`API Port: ${apiPort}`);
  console.log('');
  
  const confirm = await question('Save this configuration? (yes/no): ');
  
  if (confirm.toLowerCase() !== 'yes' && confirm.toLowerCase() !== 'y') {
    console.log('Cancelled.');
    process.exit(0);
  }
  
  // Update .env file
  const envPath = path.join(__dirname, '..', '.env');
  let envContent = fs.readFileSync(envPath, 'utf-8');
  
  const updates = {
    UNIFI_ACCESS_TOKEN: token,
    UNIFI_DEVELOPER_TOKEN: token,
    UNIFI_CONTROLLER_IP: controllerIP,
    UNIFI_API_PORT: apiPort,
    BEDFORD_CONTROLLER_IP: controllerIP // Also update this
  };
  
  console.log('\n🔧 Updating .env file...');
  
  Object.entries(updates).forEach(([key, value]) => {
    const regex = new RegExp(`^${key}=.*$`, 'gm');
    
    if (envContent.match(regex)) {
      envContent = envContent.replace(regex, `${key}=${value}`);
      console.log(`✅ Updated: ${key}`);
    } else {
      envContent += `\n${key}=${value}`;
      console.log(`➕ Added: ${key}`);
    }
  });
  
  fs.writeFileSync(envPath, envContent);
  
  console.log('\n✅ Configuration saved successfully!');
  console.log('\n🚀 Next Steps:');
  console.log('1. Run: npm run test:session');
  console.log('2. You should see your doors listed');
  console.log('3. Test unlocking a door');
  
  rl.close();
}

// Load current environment
dotenv.config({ path: path.join(__dirname, '..', '.env') });

console.log('=' .repeat(50));
console.log('UniFi Access Developer Token Setup');
console.log('=' .repeat(50));
console.log('');

configureDeveloperToken().catch(console.error);