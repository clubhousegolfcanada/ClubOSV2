#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

async function updateUsersWithPhoneNumbers() {
  try {
    const usersPath = path.join(__dirname, 'ClubOSV1-backend', 'data', 'users.json');
    
    // Read current users
    const usersData = await fs.readFile(usersPath, 'utf8');
    const users = JSON.parse(usersData);
    
    console.log(`Found ${users.length} users`);
    
    // Example phone numbers for testing
    const phoneNumbers = [
      '+1 (902) 555-0101',
      '+1 (902) 555-0102',
      '+1 (902) 555-0103',
      '+1 (902) 555-0104',
      '+1 (902) 555-0105'
    ];
    
    // Update users with phone numbers
    const updatedUsers = users.map((user, index) => {
      if (!user.phone) {
        return {
          ...user,
          phone: phoneNumbers[index % phoneNumbers.length],
          updatedAt: new Date().toISOString()
        };
      }
      return user;
    });
    
    // Write back to file
    await fs.writeFile(usersPath, JSON.stringify(updatedUsers, null, 2));
    
    console.log('Successfully updated users with phone numbers:');
    updatedUsers.forEach(user => {
      console.log(`- ${user.name} (${user.email}): ${user.phone || 'No phone'}`);
    });
    
  } catch (error) {
    console.error('Error updating users:', error);
    process.exit(1);
  }
}

// Run the update
updateUsersWithPhoneNumbers();
