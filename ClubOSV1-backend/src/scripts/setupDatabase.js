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
      console.log('❌ DATABASE_URL not found, skipping database setup');
      return;
    }
    
    console.log('📊 Connecting to database...');
    
    // Parse the DATABASE_URL manually to avoid issues
    let sequelize;
    try {
      // Try direct connection first
      sequelize = new Sequelize(databaseUrl, {
        dialect: 'postgres',
        logging: false,
        dialectOptions: {
          ssl: {
            require: true,
            rejectUnauthorized: false
          }
        }
      });
    } catch (parseError) {
      console.log('⚠️  Direct connection failed, trying manual parsing...');
      
      // Manual parsing as fallback
      const url = new URL(databaseUrl);
      const [username, password] = url.username ? [url.username, url.password] : ['postgres', ''];
      const database = url.pathname.slice(1);
      const host = url.hostname;
      const port = url.port || 5432;
      
      sequelize = new Sequelize(database, username, password, {
        host,
        port,
        dialect: 'postgres',
        logging: false,
        dialectOptions: {
          ssl: {
            require: true,
            rejectUnauthorized: false
          }
        }
      });
    }

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
        type: DataTypes.ENUM('admin', 'operator', 'support', 'kiosk'),
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
    console.log('✅ User table created successfully!\n');

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
    console.log(`\n📊 User setup complete!`);
    console.log(`   Total users in database: ${userCount}`);
    
    // List all users
    const allUsers = await User.findAll({
      attributes: ['email', 'name', 'role', 'createdAt'],
      order: [['createdAt', 'DESC']]
    });
    
    console.log('\n👥 Current users in database:');
    allUsers.forEach(user => {
      console.log(`   - ${user.email} (${user.role}) - ${user.name || 'No name'}`);
    });
    
    // Run additional migrations for feedback and tickets tables
    console.log('\n📊 Setting up additional tables...');
    
    try {
      // Create feedback table
      await sequelize.query(`
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
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('✅ Feedback table created/verified');
      
      // Create tickets table
      await sequelize.query(`
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
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          resolved_at TIMESTAMP,
          metadata JSONB DEFAULT '{}'::jsonb
        );
      `);
      console.log('✅ Tickets table created/verified');
      
      // Create ticket_comments table
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS ticket_comments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
          text TEXT NOT NULL,
          created_by_id UUID NOT NULL,
          created_by_name VARCHAR(255) NOT NULL,
          created_by_email VARCHAR(255) NOT NULL,
          created_by_phone VARCHAR(50),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('✅ Ticket comments table created/verified');
      
      // Create indexes
      await sequelize.query('CREATE INDEX IF NOT EXISTS idx_feedback_is_useful ON feedback(is_useful);');
      await sequelize.query('CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);');
      await sequelize.query('CREATE INDEX IF NOT EXISTS idx_tickets_category ON tickets(category);');
      await sequelize.query('CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket_id ON ticket_comments(ticket_id);');
      console.log('✅ Indexes created/verified');
      
      // Check table counts
      const feedbackCount = await sequelize.query('SELECT COUNT(*) as count FROM feedback', { type: sequelize.QueryTypes.SELECT });
      const ticketsCount = await sequelize.query('SELECT COUNT(*) as count FROM tickets', { type: sequelize.QueryTypes.SELECT });
      
      console.log(`\n📊 Table statistics:`);
      console.log(`   Feedback records: ${feedbackCount[0].count}`);
      console.log(`   Ticket records: ${ticketsCount[0].count}`);
      
    } catch (tableError) {
      console.error('⚠️  Error creating additional tables:', tableError.message);
      // Don't fail the whole setup if these tables fail
    }
    
    // Run SQL migrations
    console.log('\n📊 Running SQL migrations...');
    try {
      const migrationFiles = [
        '../database/migrations/001_add_slack_reply_tracking.sql',
        '../database/migrations/002_create_tickets_table.sql'
      ];
      
      for (const file of migrationFiles) {
        try {
          const sql = await fs.readFile(path.join(__dirname, file), 'utf8');
          await sequelize.query(sql);
          console.log(`✅ Migration ${path.basename(file)} completed`);
        } catch (e) {
          console.log(`⚠️  Migration ${path.basename(file)} failed:`, e.message);
        }
      }
    } catch (e) {
      console.log('⚠️  Migrations failed:', e.message);
    }
    
    await sequelize.close();
    console.log('\n✅ Database setup completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Database setup failed:', error.message);
    console.error('Error details:', error);
    // Don't throw, just log
  }
}

// Export for use in other files
module.exports = { setupDatabase };

// Run if called directly
if (require.main === module) {
  setupDatabase();
}
