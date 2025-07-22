const bcrypt = require('bcryptjs');

const storedHash = '$2b$10$YVn3nQ8Q2vM5FPqg3SZQT.GjGK9AVkGH8J8mUqaJHUEiDCVxDkwKe';
const password = 'admin123';

// Test if password matches
bcrypt.compare(password, storedHash, (err, result) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('Password matches:', result);
  }
});

// Generate a new hash to be sure
bcrypt.hash(password, 10, (err, newHash) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('New hash for admin123:', newHash);
  }
});
