const { Sequelize, DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');

async function createAdminUser() {
  try {
    // Connect to database
    const sequelize = new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      logging: console.log,
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
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
        allowNull: false
      },
      password: {
        type: DataTypes.STRING,
        allowNull: false
      },
      name: {
        type: DataTypes.STRING
      },
      role: {
        type: DataTypes.ENUM('admin', 'operator', 'support'),
        defaultValue: 'support'
      }
    });

    // Create table
    await sequelize.sync({ alter: true });
    console.log('✅ Users table ready');

    // Create admin user
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
      console.log('✅ Admin user created!');
      console.log('📧 Email: admin@clubhouse247golf.com');
      console.log('🔑 Password: admin123');
      console.log('⚠️  CHANGE THIS PASSWORD IMMEDIATELY!');
    } else {
      console.log('✅ Admin user already exists!');
      // Update password just in case
      await admin.update({ password: hashedPassword });
      console.log('🔑 Password reset to: admin123');
    }

    await sequelize.close();
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

createAdminUser();
