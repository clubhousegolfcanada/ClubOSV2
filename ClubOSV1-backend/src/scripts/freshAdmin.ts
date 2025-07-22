import bcryptjs from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';

async function createFreshAdmin() {
  console.log('Creating fresh admin user...');
  
  try {
    const password = 'admin123';  // Simple password for testing
    const hashedPassword = await bcryptjs.hash(password, 10);
    
    const adminUser = {
      id: 'admin-001',
      email: 'admin@clubhouse247golf.com',
      password: hashedPassword,
      name: 'Admin User',
      role: 'admin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const dataPath = path.join(__dirname, '../../src/data/users.json');
    const syncPath = path.join(__dirname, '../../src/data/sync/users.json');
    
    // Write to both locations
    fs.writeFileSync(dataPath, JSON.stringify([adminUser], null, 2));
    
    // Create sync directory if it doesn't exist
    const syncDir = path.dirname(syncPath);
    if (!fs.existsSync(syncDir)) {
      fs.mkdirSync(syncDir, { recursive: true });
    }
    fs.writeFileSync(syncPath, JSON.stringify([adminUser], null, 2));
    
    console.log('✅ Admin user created successfully!');
    console.log('\nLogin credentials:');
    console.log('Email: admin@clubhouse247golf.com');
    console.log('Password: admin123');
    console.log('\n⚠️  Change this password after first login!');
    
  } catch (error) {
    console.error('Error creating admin user:', error);
  }
}

// Run the function
createFreshAdmin();
