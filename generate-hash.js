const bcrypt = require('bcryptjs');

// Generate hash for admin123
bcrypt.hash('admin123', 10, (err, hash) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('Hash for admin123:', hash);
  }
});
