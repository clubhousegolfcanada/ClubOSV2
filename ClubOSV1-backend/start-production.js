#!/usr/bin/env node

// Simple production start script for Railway
const path = require('path');

// Set production environment
process.env.NODE_ENV = 'production';

// Start the server
require(path.join(__dirname, 'dist', 'index.js'));