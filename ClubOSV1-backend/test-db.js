const { Sequelize } = require('sequelize');

async function testConnection() {
  console.log('🔍 Testing Railway PostgreSQL connection...\n');
  
  // Check for DATABASE_URL
  if (!process.env.DATABASE_URL) {
    console.log('❌ No DATABASE_URL found!');
    console.log('\nThis means either:');
    console.log('1. You haven\'t added PostgreSQL to your Railway project yet');
    console.log('2. You\'re running this locally without setting DATABASE_URL\n');
    console.log('To fix:');
    console.log('1. Go to https://railway.app/dashboard');
    console.log('2. Click on your project');
    console.log('3. Click "+ New" → "Database" → "PostgreSQL"');
    console.log('4. Railway will automatically set up everything!\n');
    return;
  }

  try {
    // Connect to database
    const sequelize = new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      logging: false, // Set to console.log to see SQL queries
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      }
    });

    // Test connection
    await sequelize.authenticate();
    console.log('✅ Database connection successful!\n');
    
    // Check if users table exists
    const [results] = await sequelize.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);
    
    const tableExists = results[0].exists;
    
    if (tableExists) {
      console.log('✅ Users table already exists!');
      
      // Count users
      const [countResult] = await sequelize.query('SELECT COUNT(*) as count FROM users');
      console.log(`📊 Current user count: ${countResult[0].count}\n`);
      
      // Show users (without passwords)
      const [users] = await sequelize.query(`
        SELECT id, email, name, role, created_at 
        FROM users 
        ORDER BY created_at DESC 
        LIMIT 5
      `);
      
      if (users.length > 0) {
        console.log('👥 Recent users:');
        users.forEach(user => {
          console.log(`   - ${user.email} (${user.role}) - ${user.name || 'No name'}`);
        });
      }
    } else {
      console.log('ℹ️  No users table found yet');
      console.log('   Run the migration script to create it!\n');
    }
    
    await sequelize.close();
    console.log('\n✅ Everything looks good! PostgreSQL is ready to use.');
    
  } catch (error) {
    console.error('❌ Database connection failed!\n');
    console.error('Error:', error.message);
    console.error('\nPossible issues:');
    console.error('1. PostgreSQL not added to Railway project');
    console.error('2. DATABASE_URL is incorrect');
    console.error('3. Network/firewall issues\n');
  }
}

// Run the test
testConnection();
