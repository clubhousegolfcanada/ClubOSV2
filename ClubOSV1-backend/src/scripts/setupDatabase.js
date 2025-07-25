const { Sequelize, DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const fs = require('fs').promises;
const path = require('path');

// Main migration function
async function setupDatabase() {
  console.log('🚀 Starting ClubOS Database Setup...\n');
  
  try {
    // Get DATABASE_URL
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    
    console.log('📊 Connecting to database...');
    
    // Connect to database with proper config
    const sequelize = new Sequelize(databaseUrl, {
      dialect: 'postgres',
      logging: false, // Set to console.log for debugging
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      },
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
      }
    });

    // Test connection
    await sequelize.authenticate();
    console.log('✅ Database connection established!\n');

    // Define User model
    const User = sequelize.define('User', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      email: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: false,
        validate: {
          isEmail: true
        }
      },
      password: {
        type: DataTypes.STRING,
        allowNull: false
      },
      name: {
        type: DataTypes.STRING,
        allowNull: true
      },
      role: {
        type: DataTypes.ENUM('admin', 'operator', 'support'),
        defaultValue: 'support',
        allowNull: false
      },
      phone: {
        type: DataTypes.STRING,
        allowNull: true
      },
      lastLogin: {
        type: DataTypes.DATE,
        allowNull: true
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
      }
    }, {
      timestamps: true
    });

    // Create tables
    console.log('📊 Creating database tables...');
    await sequelize.sync({ alter: true });
    console.log('✅ Tables created successfully!\n');

    // Check if we have JSON users to migrate
    try {
      const usersPath = path.join(__dirname, '../data/users.json');
      const usersData = await fs.readFile(usersPath, 'utf8');
      const jsonUsers = JSON.parse(usersData);
      
      console.log(`📁 Found ${jsonUsers.length} users in JSON file`);
      
      // Migrate each user
      for (const jsonUser of jsonUsers) {
        try {
          const [user, created] = await User.findOrCreate({
            where: { email: jsonUser.email },
            defaults: {
              email: jsonUser.email,
              password: jsonUser.password, // Already hashed
              name: jsonUser.name,
              role: jsonUser.role,
              phone: jsonUser.phone
            }
          });
          
          if (created) {
            console.log(`✅ Migrated user: ${user.email}`);
          } else {
            console.log(`⏭️  User ${user.email} already exists in database`);
          }
        } catch (error) {
          console.error(`❌ Failed to migrate user ${jsonUser.email}:`, error.message);
        }
      }
    } catch (error) {
      console.log('⚠️  No JSON users file found or error reading it');
      console.log('   Creating default admin user...');
      
      // Create default admin
      const hashedPassword = await bcrypt.hash('admin123', 10);
      const [admin, created] = await User.findOrCreate({
        where: { email: 'admin@clubhouse247golf.com' },
        defaults: {
          email: 'admin@clubhouse247golf.com',
          password: hashedPassword,
          name: 'Admin User',
          role: 'admin'
        }
      });
      
      if (created) {
        console.log('✅ Default admin created!');
      } else {
        console.log('✅ Admin user already exists');
      }
    }

    // Show final stats
    const userCount = await User.count();
    console.log(`\n📊 Database setup complete!`);
    console.log(`   Total users in database: ${userCount}`);
    
    // List all users
    const allUsers = await User.findAll({
      attributes: ['email', 'name', 'role', 'createdAt']
    });
    
    console.log('\n👥 Current users in database:');
    allUsers.forEach(user => {
      console.log(`   - ${user.email} (${user.role}) - ${user.name || 'No name'}`);
    });
    
    await sequelize.close();
    console.log('\n✅ Database setup completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Database setup failed:', error);
    process.exit(1);
  }
}

// Export for use in other files
module.exports = { setupDatabase };

// Run if called directly
if (require.main === module) {
  setupDatabase();
}
