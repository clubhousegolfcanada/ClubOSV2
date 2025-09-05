import { db } from '../utils/database';

async function runAuthMigrationSafe() {
  try {
    console.log('🔄 Running safe auth refactor migration...');
    
    // Check which tables exist
    const tableCheck = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('refresh_tokens', 'blacklisted_tokens', 'auth_logs')
    `);
    
    const existingTables = tableCheck.rows.map((r: any) => r.table_name);
    console.log('Existing tables:', existingTables);
    
    // 1. Create refresh_tokens table if it doesn't exist
    if (!existingTables.includes('refresh_tokens')) {
      console.log('Creating refresh_tokens table...');
      await db.query(`
        CREATE TABLE refresh_tokens (
          id SERIAL PRIMARY KEY,
          user_id UUID NOT NULL,
          token_hash VARCHAR(255) NOT NULL UNIQUE,
          expires_at TIMESTAMP NOT NULL,
          created_at TIMESTAMP DEFAULT NOW(),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      
      await db.query('CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id)');
      await db.query('CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at)');
      console.log('✅ refresh_tokens table created');
    } else {
      console.log('⏭️ refresh_tokens table already exists');
    }
    
    // 2. Create blacklisted_tokens table if it doesn't exist
    if (!existingTables.includes('blacklisted_tokens')) {
      console.log('Creating blacklisted_tokens table...');
      await db.query(`
        CREATE TABLE blacklisted_tokens (
          id SERIAL PRIMARY KEY,
          token_hash VARCHAR(255) NOT NULL UNIQUE,
          user_id UUID NOT NULL,
          blacklisted_at TIMESTAMP DEFAULT NOW(),
          expires_at TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      
      await db.query('CREATE INDEX idx_blacklisted_tokens_hash ON blacklisted_tokens(token_hash)');
      await db.query('CREATE INDEX idx_blacklisted_tokens_expires_at ON blacklisted_tokens(expires_at)');
      console.log('✅ blacklisted_tokens table created');
    } else {
      console.log('⏭️ blacklisted_tokens table already exists');
    }
    
    // 3. Check auth_logs table structure
    if (existingTables.includes('auth_logs')) {
      console.log('⏭️ auth_logs table already exists, checking columns...');
      const columnCheck = await db.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'auth_logs'
      `);
      console.log('auth_logs columns:', columnCheck.rows.map((r: any) => r.column_name));
    } else {
      console.log('Creating auth_logs table...');
      await db.query(`
        CREATE TABLE auth_logs (
          id SERIAL PRIMARY KEY,
          user_id UUID NOT NULL,
          event VARCHAR(100) NOT NULL,
          success BOOLEAN DEFAULT true,
          timestamp TIMESTAMP DEFAULT NOW(),
          metadata JSONB,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      
      await db.query('CREATE INDEX idx_auth_logs_user_id ON auth_logs(user_id)');
      await db.query('CREATE INDEX idx_auth_logs_event ON auth_logs(event)');
      await db.query('CREATE INDEX idx_auth_logs_timestamp ON auth_logs(timestamp DESC)');
      console.log('✅ auth_logs table created');
    }
    
    console.log('✅ Auth migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runAuthMigrationSafe();