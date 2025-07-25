// Environment variable to control auth mode
const USE_DATABASE = process.env.USE_DATABASE === 'true';

// Export the flag so auth routes can check it
module.exports = {
  USE_DATABASE,
  
  // Helper to log which mode we're using
  logAuthMode: () => {
    console.log(`🔐 Auth Mode: ${USE_DATABASE ? 'PostgreSQL Database' : 'JSON Files'}`);
  }
};
