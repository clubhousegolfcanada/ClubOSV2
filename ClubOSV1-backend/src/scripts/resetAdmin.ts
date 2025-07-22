import bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';

async function resetAdminPassword() {
  const password = 'ClubhouseAdmin123!';
  
  console.log('Resetting admin password...');
  console.log('New password will be:', password);
  
  try {
    // Generate new hash
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log('Generated hash:', hashedPassword);
    
    // Test the hash immediately
    const testValid = await bcrypt.compare(password, hashedPassword);
    console.log('Hash validation test:', testValid);
    
    // Create admin user
    const adminUser = {
      id: 'admin-001',
      email: 'admin@clubhouse247golf.com',
      password: hashedPassword,
      name: 'Admin User',
      role: 'admin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Write to file
    const dataPath = path.join(__dirname, '../../src/data/users.json');
    fs.writeFileSync(dataPath, JSON.stringify([adminUser], null, 2));
    
    console.log('✅ Admin password reset successfully!');
    console.log('You can now login with:');
    console.log('Email: admin@clubhouse247golf.com');
    console.log('Password: ClubhouseAdmin123!');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

resetAdminPassword();
