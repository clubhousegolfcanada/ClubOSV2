const fs = require('fs').promises;
const bcryptjs = require('bcryptjs');
const path = require('path');

async function resetAdminPassword() {
  try {
    // Read current users
    const usersPath = path.join(__dirname, 'src/data/users.json');
    const usersData = await fs.readFile(usersPath, 'utf8');
    const users = JSON.parse(usersData);
    
    console.log('Found users:', users.map(u => u.email));
    
    // Find admin
    const adminIndex = users.findIndex(u => u.email === 'admin@clubhouse247golf.com');
    
    if (adminIndex === -1) {
      console.log('❌ Admin user not found!');
      return;
    }
    
    // Create new password hash using bcryptjs
    const newPassword = 'admin123';
    const hashedPassword = await bcryptjs.hash(newPassword, 10);
    
    console.log('Old hash:', users[adminIndex].password);
    console.log('New hash:', hashedPassword);
    
    // Update password
    users[adminIndex].password = hashedPassword;
    users[adminIndex].updatedAt = new Date().toISOString();
    
    // Write back
    await fs.writeFile(usersPath, JSON.stringify(users, null, 2));
    
    console.log('\n✅ Password reset successful!');
    console.log('📧 Email: admin@clubhouse247golf.com');
    console.log('🔑 Password: admin123');
    console.log('\nTry logging in now!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

resetAdminPassword();
