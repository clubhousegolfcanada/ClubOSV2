import bcryptjs from 'bcryptjs';
import { writeJsonFile } from '../utils/fileUtils';
import { User } from '../types';

async function createAdminUser() {
  // Default admin credentials
  const email = 'admin@clubhouse247golf.com';
  const password = 'ClubhouseAdmin123!'; // Change this immediately after first login!
  const name = 'Admin User';
  
  console.log('Creating admin user...');
  console.log('Email:', email);
  console.log('Default Password:', password);
  console.log('\n⚠️  IMPORTANT: Change this password after first login!\n');
  
  // Hash the password
  const hashedPassword = await bcryptjs.hash(password, 10);
  
  // Create admin user
  const adminUser: User = {
    id: 'admin-001',
    email,
    password: hashedPassword,
    name,
    role: 'admin',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  // Save to users.json
  await writeJsonFile('users.json', [adminUser]);
  
  console.log('✅ Admin user created successfully!');
  console.log('You can now login with the credentials above.');
}

// Run if called directly
if (require.main === module) {
  createAdminUser().catch(console.error);
}

export { createAdminUser };
