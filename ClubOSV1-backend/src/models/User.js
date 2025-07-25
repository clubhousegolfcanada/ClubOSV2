const { Sequelize, DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const fs = require('fs').promises;
const path = require('path');

// Database connection (use your Railway PostgreSQL URL)
const sequelize = new Sequelize(process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/clubos', {
  dialect: 'postgres',
  logging: console.log,
  dialectOptions: {
    ssl: process.env.NODE_ENV === 'production' ? {
      require: true,
      rejectUnauthorized: false
    } : false
  }
});

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
  timestamps: true,
  hooks: {
    beforeCreate: async (user) => {
      if (user.password && !user.password.startsWith('$2b$')) {
        user.password = await bcrypt.hash(user.password, 10);
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('password') && !user.password.startsWith('$2b$')) {
        user.password = await bcrypt.hash(user.password, 10);
      }
    }
  }
});

// Migration function
async function migrateUsersToDatabase() {
  try {
    console.log('🔄 Starting user migration to PostgreSQL...');
    
    // Connect to database
    await sequelize.authenticate();
    console.log('✅ Database connection established');
    
    // Create table if it doesn't exist
    await sequelize.sync({ alter: true });
    console.log('✅ User table ready');
    
    // Read existing JSON users
    const usersPath = path.join(__dirname, '../data/users.json');
    const usersData = await fs.readFile(usersPath, 'utf8');
    const jsonUsers = JSON.parse(usersData);
    console.log(`📊 Found ${jsonUsers.length} users in JSON file`);
    
    // Migrate each user
    for (const jsonUser of jsonUsers) {
      try {
        // Check if user already exists
        const existingUser = await User.findOne({ 
          where: { email: jsonUser.email } 
        });
        
        if (existingUser) {
          console.log(`⏭️  User ${jsonUser.email} already exists, skipping...`);
          continue;
        }
        
        // Create new user (password is already hashed in JSON)
        const newUser = await User.create({
          email: jsonUser.email,
          password: jsonUser.password, // Already hashed
          name: jsonUser.name,
          role: jsonUser.role,
          phone: jsonUser.phone,
          createdAt: jsonUser.createdAt,
          updatedAt: jsonUser.updatedAt
        });
        
        console.log(`✅ Migrated user: ${newUser.email}`);
      } catch (error) {
        console.error(`❌ Failed to migrate user ${jsonUser.email}:`, error.message);
      }
    }
    
    // Create default admin if no users exist
    const userCount = await User.count();
    if (userCount === 0) {
      console.log('📝 Creating default admin user...');
      const defaultAdmin = await User.create({
        email: 'admin@clubos.com',
        password: 'ChangeMe123!', // Will be hashed by beforeCreate hook
        name: 'Default Admin',
        role: 'admin'
      });
      console.log(`✅ Created default admin: ${defaultAdmin.email}`);
      console.log('⚠️  IMPORTANT: Change the default password immediately!');
    }
    
    // Show final count
    const finalCount = await User.count();
    console.log(`\n✅ Migration complete! Total users in database: ${finalCount}`);
    
    // List all users
    const allUsers = await User.findAll({
      attributes: ['email', 'name', 'role', 'createdAt']
    });
    console.log('\n👥 Current users:');
    allUsers.forEach(user => {
      console.log(`   - ${user.email} (${user.role}) - ${user.name}`);
    });
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Export for use in other files
module.exports = { User, sequelize };

// Run migration if this file is executed directly
if (require.main === module) {
  migrateUsersToDatabase();
}
