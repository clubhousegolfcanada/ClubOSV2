import { Sequelize } from 'sequelize';
import * as readline from 'readline';

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Function to prompt for input
function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function setupUserSettings() {
  console.log('🚀 Railway PostgreSQL User Settings Setup');
  console.log('========================================\n');
  
  console.log('📋 To find your DATABASE_URL:');
  console.log('   1. Go to railway.app and login');
  console.log('   2. Click on your project');
  console.log('   3. Click on the PostgreSQL database');
  console.log('   4. Go to the "Connect" tab (NOT Variables)');
  console.log('   5. Copy the PUBLIC DATABASE_URL (not the private one)');
  console.log('   ⚠️  Make sure it contains "railway.app" NOT "railway.internal"\n');
  console.log('   Example format:');
  console.log('   postgresql://postgres:password@containers-us-west-123.railway.app:5432/railway\n');
  
  // Prompt for DATABASE_URL
  const DATABASE_URL = await prompt('📌 Paste your DATABASE_URL here: ');
  
  if (!DATABASE_URL || !DATABASE_URL.startsWith('postgresql://')) {
    console.error('\n❌ Invalid DATABASE_URL. It should start with postgresql://');
    rl.close();
    process.exit(1);
  }
  
  // Check for internal URL
  if (DATABASE_URL.includes('railway.internal')) {
    console.error('\n❌ You provided the INTERNAL Railway URL.');
    console.error('   This only works from within Railway\'s network.');
    console.error('\n📌 Please use the PUBLIC URL instead:');
    console.error('   1. Go back to Railway');
    console.error('   2. Click on your PostgreSQL database');
    console.error('   3. Go to the "Connect" tab');
    console.error('   4. Look for "Public Network"');
    console.error('   5. Copy the DATABASE_PUBLIC_URL');
    console.error('\n   It should contain "railway.app" not "railway.internal"');
    rl.close();
    process.exit(1);
  }

  console.log('\n🔄 Connecting to Railway PostgreSQL...');
  
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

    // Ask for confirmation before creating tables
    const confirm = await prompt('\n⚠️  This will create the user_settings table. Continue? (yes/no): ');
    
    if (confirm.toLowerCase() !== 'yes' && confirm.toLowerCase() !== 'y') {
      console.log('\n❌ Setup cancelled.');
      rl.close();
      process.exit(0);
    }

    // Create user_settings table
    console.log('\n📦 Creating user_settings table...');
    
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

    console.log('\n✅ Successfully created user_settings table!');

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

    // Ask if they want to save the URL to .env
    const saveToEnv = await prompt('\n💾 Would you like to save this DATABASE_URL to your .env file? (yes/no): ');
    
    if (saveToEnv.toLowerCase() === 'yes' || saveToEnv.toLowerCase() === 'y') {
      const fs = require('fs').promises;
      const path = require('path');
      const envPath = path.join(process.cwd(), '.env');
      
      try {
        let envContent = await fs.readFile(envPath, 'utf-8');
        
        // Check if DATABASE_URL already exists
        if (envContent.includes('DATABASE_URL=')) {
          // Replace existing
          envContent = envContent.replace(/DATABASE_URL=.*/g, `DATABASE_URL=${DATABASE_URL}`);
        } else {
          // Add new
          envContent += `\n# Railway PostgreSQL Database\nDATABASE_URL=${DATABASE_URL}\n`;
        }
        
        await fs.writeFile(envPath, envContent);
        console.log('✅ DATABASE_URL saved to .env file');
      } catch (error) {
        console.log('⚠️  Could not save to .env file:', error.message);
      }
    }

    console.log('\n🎉 Setup complete! The user_settings table is ready to use.');
    console.log('\n📝 Next steps:');
    console.log('   1. Deploy your backend with the new user settings routes');
    console.log('   2. Deploy your frontend with the DatabaseExternalTools component');
    console.log('   3. Users can now customize their external links!\n');
    
  } catch (error) {
    console.error('\n❌ Error setting up database:', error);
    if (error.message.includes('permission denied')) {
      console.error('\n⚠️  This might be a permissions issue. Make sure your database user has CREATE TABLE privileges.');
    }
    rl.close();
    process.exit(1);
  } finally {
    await sequelize.close();
    rl.close();
  }
}

// Run the setup
setupUserSettings().catch(console.error);
