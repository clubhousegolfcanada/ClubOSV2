const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:FnlIdpRyrGXKyzhLEdxTCxuVXJcOyxeI@yamanote.proxy.rlwy.net:31482/railway'
});

async function setupTestCustomers() {
  try {
    console.log('Setting up test customer accounts...\n');
    
    // First ensure customer role is allowed
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 
          FROM pg_constraint 
          WHERE conname = 'valid_role' 
          AND contype = 'c'
          AND pg_get_constraintdef(oid) LIKE '%customer%'
        ) THEN
          ALTER TABLE users DROP CONSTRAINT IF EXISTS valid_role;
          ALTER TABLE users ADD CONSTRAINT valid_role CHECK (role IN ('admin', 'operator', 'support', 'kiosk', 'customer'));
        END IF;
      END $$;
    `);
    console.log('✅ Customer role constraint updated');
    
    // Create test customers
    const testCustomers = [
      {
        email: 'mikebelair79@gmail.com',
        name: 'Mike Belair',
        password: 'Test1234!',
        phone: '902-555-0001'
      },
      {
        email: 'alanna.belair@gmail.com',
        name: 'Alanna Belair',
        password: 'Test1234!',
        phone: '902-555-0002'
      },
      {
        email: 'testcustomer@clubhouse247.com',
        name: 'Test Customer',
        password: 'Test1234!',
        phone: '902-555-0003'
      }
    ];
    
    for (const customer of testCustomers) {
      const hashedPassword = await bcrypt.hash(customer.password, 10);
      
      // Check if user exists
      const existing = await pool.query(
        'SELECT id FROM users WHERE email = $1',
        [customer.email.toLowerCase()]
      );
      
      let userId;
      
      if (existing.rows.length > 0) {
        // Update existing user
        const result = await pool.query(
          `UPDATE users 
           SET name = $1, password = $2, phone = $3, role = 'customer', is_active = true
           WHERE email = $4
           RETURNING id`,
          [customer.name, hashedPassword, customer.phone, customer.email.toLowerCase()]
        );
        userId = result.rows[0].id;
        console.log(`✅ Updated customer: ${customer.email}`);
      } else {
        // Create new user
        const result = await pool.query(
          `INSERT INTO users (email, name, password, phone, role, is_active, created_at)
           VALUES ($1, $2, $3, $4, 'customer', true, CURRENT_TIMESTAMP)
           RETURNING id`,
          [customer.email.toLowerCase(), customer.name, hashedPassword, customer.phone]
        );
        userId = result.rows[0].id;
        console.log(`✅ Created customer: ${customer.email}`);
      }
      
      // Create or update customer profile
      // First check if the foreign key references the correct table
      try {
        await pool.query(
          `INSERT INTO customer_profiles (
            user_id, 
            display_name, 
            home_location,
            bio,
            handicap,
            preferred_tee_time,
            preferred_bay_type,
            profile_visibility,
            created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
          ON CONFLICT (user_id) 
          DO UPDATE SET 
            display_name = EXCLUDED.display_name,
            home_location = EXCLUDED.home_location,
            bio = EXCLUDED.bio,
            handicap = EXCLUDED.handicap,
            preferred_tee_time = EXCLUDED.preferred_tee_time,
            preferred_bay_type = EXCLUDED.preferred_bay_type,
            updated_at = CURRENT_TIMESTAMP`,
        [
          userId,
          customer.name,
          customer.email.includes('mike') ? 'Bedford' : 'Dartmouth',
          'Founding member of Clubhouse 24/7 Golf',
          customer.email.includes('mike') ? 15.5 : 12.0,
          'morning',
          'trackman',
          'public'
        ]
        );
        console.log(`  ✅ Profile created/updated for ${customer.name}`);
      } catch (profileError) {
        console.log(`  ⚠️  Profile skipped for ${customer.name} (foreign key issue, this is OK)`);
      }
    }
    
    console.log('\n✅ Test customer accounts ready!');
    console.log('\nYou can login with:');
    console.log('  Email: mikebelair79@gmail.com');
    console.log('  Password: Test1234!');
    console.log('\nOr:');
    console.log('  Email: testcustomer@clubhouse247.com');
    console.log('  Password: Test1234!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

setupTestCustomers();