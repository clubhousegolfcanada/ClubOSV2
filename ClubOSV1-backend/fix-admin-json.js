const fs = require('fs').promises;
const bcrypt = require('bcryptjs');
const path = require('path');

async function fixJsonAdmin() {
  try {
    // Hash the password
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    // Create admin user
    const adminUser = {
      id: "admin-001",
      email: "admin@clubhouse247golf.com",
      password: hashedPassword,
      name: "Admin User",
      role: "admin",
      phone: "+1234567890",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Write to users.json
    const usersPath = path.join(__dirname, 'src/data/users.json');
    await fs.writeFile(usersPath, JSON.stringify([adminUser], null, 2));
    
    console.log('✅ Admin user restored to JSON file!');
    console.log('📧 Email: admin@clubhouse247golf.com');
    console.log('🔑 Password: admin123');
    console.log('\nYou can now log in!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

fixJsonAdmin();
