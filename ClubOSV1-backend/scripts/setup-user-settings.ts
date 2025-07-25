import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function setupUserSettings() {
  const DATABASE_URL = process.env.DATABASE_URL;
  
  if (!DATABASE_URL) {
    console.error('❌ Error: DATABASE_URL not found in environment variables.');
    console.error('Please ensure your .env file contains the DATABASE_URL from Railway.');
    process.exit(1);
  }

  console.log('🚀 Connecting to Railway PostgreSQL...');
  
  const sequelize = new Sequelize(DATABASE_URL, {
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    }
  });

  try {
    // Test connection
    await sequelize.authenticate();
    console.log('✅ Connection established successfully.');

    // Create user_settings table
    console.log('📦 Creating user_settings table...');
    
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS user_settings (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID NOT NULL,
        setting_key VARCHAR(255) NOT NULL,
        setting_value TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, setting_key)
      )
    `);

    // Create index
    console.log('🔍 Creating index...');
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id)
    `);

    // Create updated_at trigger function
    console.log('⚡ Creating update trigger...');
    await sequelize.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
      END;
      $$ language 'plpgsql'
    `);

    // Apply trigger to user_settings
    await sequelize.query(`
      DROP TRIGGER IF EXISTS update_user_settings_updated_at ON user_settings
    `);
    
    await sequelize.query(`
      CREATE TRIGGER update_user_settings_updated_at 
        BEFORE UPDATE ON user_settings 
        FOR EACH ROW 
        EXECUTE FUNCTION update_updated_at_column()
    `);

    console.log('✅ Successfully created user_settings table!');

    // Verify the table
    console.log('\n📊 Table structure:');
    const [tableInfo] = await sequelize.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'user_settings'
      ORDER BY ordinal_position
    `);
    
    console.table(tableInfo);

    // Check if any settings exist
    const [countResult] = await sequelize.query(`
      SELECT COUNT(*) as count FROM user_settings
    `);
    console.log(`\n📈 Current records in user_settings: ${countResult[0].count}`);

    console.log('\n🎉 Setup complete! The user_settings table is ready to use.');
    
  } catch (error) {
    console.error('❌ Error setting up database:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Run the setup
setupUserSettings();
