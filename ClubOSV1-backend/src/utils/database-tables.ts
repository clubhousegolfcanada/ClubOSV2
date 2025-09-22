// This file contains all table creation SQL
export const createTablesSQL = {
  // Existing tables (will skip if exists)
  users: `
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      name VARCHAR(255),
      role VARCHAR(50) NOT NULL DEFAULT 'customer',
      phone VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_login TIMESTAMP,
      is_active BOOLEAN DEFAULT true,
      status VARCHAR(50) DEFAULT 'active',
      signup_metadata JSONB,
      signup_date TIMESTAMP,
      CONSTRAINT valid_role CHECK (role IN ('admin', 'operator', 'support', 'kiosk', 'customer'))
    );
  `,
  
  feedback: `
    CREATE TABLE IF NOT EXISTS feedback (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      user_id UUID,
      user_email VARCHAR(255),
      request_description TEXT NOT NULL,
      location VARCHAR(255),
      route VARCHAR(50),
      response TEXT,
      confidence DECIMAL(3,2),
      is_useful BOOLEAN NOT NULL DEFAULT false,
      feedback_type VARCHAR(50),
      feedback_source VARCHAR(50) DEFAULT 'user',
      slack_thread_ts VARCHAR(255),
      slack_user_name VARCHAR(255),
      slack_user_id VARCHAR(255),
      slack_channel VARCHAR(255),
      original_request_id UUID,
      "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `,
  
  tickets: `
    CREATE TABLE IF NOT EXISTS tickets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      category VARCHAR(50) NOT NULL CHECK (category IN ('facilities', 'tech')),
      status VARCHAR(50) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in-progress', 'resolved', 'closed')),
      priority VARCHAR(50) NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
      location VARCHAR(255),
      created_by_id UUID NOT NULL,
      created_by_name VARCHAR(255) NOT NULL,
      created_by_email VARCHAR(255) NOT NULL,
      created_by_phone VARCHAR(50),
      assigned_to_id UUID,
      assigned_to_name VARCHAR(255),
      assigned_to_email VARCHAR(255),
      "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      resolved_at TIMESTAMP,
      metadata JSONB DEFAULT '{}'::jsonb,
      photo_urls TEXT[] DEFAULT '{}'
    );
  `,
  
  // New tables for full PostgreSQL
  bookings: `
    CREATE TABLE IF NOT EXISTS bookings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      simulator_id VARCHAR(255) NOT NULL,
      start_time TIMESTAMP NOT NULL,
      duration INTEGER NOT NULL CHECK (duration >= 30 AND duration <= 240),
      type VARCHAR(50) NOT NULL CHECK (type IN ('single', 'recurring')),
      recurring_days INTEGER[],
      status VARCHAR(50) NOT NULL DEFAULT 'confirmed',
      "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      cancelled_at TIMESTAMP,
      metadata JSONB DEFAULT '{}'::jsonb
    );
  `,
  
  access_logs: `
    CREATE TABLE IF NOT EXISTS access_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID,
      user_email VARCHAR(255),
      action VARCHAR(100) NOT NULL,
      resource VARCHAR(255),
      ip_address VARCHAR(45),
      user_agent TEXT,
      success BOOLEAN DEFAULT true,
      error_message TEXT,
      metadata JSONB DEFAULT '{}'::jsonb,
      "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `,
  
  auth_logs: `
    CREATE TABLE IF NOT EXISTS auth_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID,
      action VARCHAR(50) NOT NULL,
      ip_address VARCHAR(45),
      user_agent TEXT,
      success BOOLEAN DEFAULT true,
      error_message TEXT,
      "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `,
  
  request_logs: `
    CREATE TABLE IF NOT EXISTS request_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      method VARCHAR(10) NOT NULL,
      path VARCHAR(500) NOT NULL,
      status_code INTEGER,
      response_time INTEGER,
      user_id UUID,
      ip_address VARCHAR(45),
      user_agent TEXT,
      error TEXT,
      "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `,
  
  system_config: `
    CREATE TABLE IF NOT EXISTS system_config (
      key VARCHAR(255) PRIMARY KEY,
      value JSONB NOT NULL,
      description TEXT,
      "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `,
  
  customer_interactions: `
    CREATE TABLE IF NOT EXISTS customer_interactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID,
      user_email VARCHAR(255),
      request_text TEXT NOT NULL,
      response_text TEXT,
      route VARCHAR(50),
      confidence DECIMAL(3,2),
      metadata JSONB DEFAULT '{}'::jsonb,
      "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `
};

// Index creation SQL
export const createIndexesSQL = [
  // User indexes
  'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);',
  
  // Feedback indexes
  'CREATE INDEX IF NOT EXISTS idx_feedback_is_useful ON feedback(is_useful);',
  'CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback("createdAt");',
  
  // Ticket indexes
  'CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);',
  'CREATE INDEX IF NOT EXISTS idx_tickets_category ON tickets(category);',
  'CREATE INDEX IF NOT EXISTS idx_tickets_created_by_id ON tickets(created_by_id);',
  
  // Booking indexes
  'CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);',
  'CREATE INDEX IF NOT EXISTS idx_bookings_simulator_id ON bookings(simulator_id);',
  'CREATE INDEX IF NOT EXISTS idx_bookings_start_time ON bookings(start_time);',
  'CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);',
  
  // Access log indexes
  'CREATE INDEX IF NOT EXISTS idx_access_logs_user_id ON access_logs(user_id);',
  'CREATE INDEX IF NOT EXISTS idx_access_logs_created_at ON access_logs("createdAt");',
  
  // Auth log indexes
  'CREATE INDEX IF NOT EXISTS idx_auth_logs_user_id ON auth_logs(user_id);',
  'CREATE INDEX IF NOT EXISTS idx_auth_logs_action ON auth_logs(action);',
  'CREATE INDEX IF NOT EXISTS idx_auth_logs_created_at ON auth_logs("createdAt");',
  
  // Request log indexes
  'CREATE INDEX IF NOT EXISTS idx_request_logs_path ON request_logs(path);',
  'CREATE INDEX IF NOT EXISTS idx_request_logs_created_at ON request_logs("createdAt");',
  
  // Customer interaction indexes
  'CREATE INDEX IF NOT EXISTS idx_customer_interactions_user_id ON customer_interactions(user_id);',
  'CREATE INDEX IF NOT EXISTS idx_customer_interactions_created_at ON customer_interactions("createdAt");'
];

// Add routing optimizations table
export const routingOptimizationsTable = `
  CREATE TABLE IF NOT EXISTS routing_optimizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    optimization_data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    applied_at TIMESTAMP,
    applied_by UUID,
    status VARCHAR(50) DEFAULT 'pending',
    notes TEXT
  );
`;

// Additional indexes for routing optimizations
export const routingOptimizationIndexes = [
  'CREATE INDEX IF NOT EXISTS idx_routing_optimizations_created_at ON routing_optimizations(created_at);',
  'CREATE INDEX IF NOT EXISTS idx_routing_optimizations_status ON routing_optimizations(status);'
];
