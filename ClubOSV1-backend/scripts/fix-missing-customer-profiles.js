const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function fixMissingCustomerProfiles() {
  try {
    console.log('Checking for customers without profiles...');
    
    // Find all customers without a customer_profiles entry
    const missingProfiles = await pool.query(`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.role
      FROM users u
      LEFT JOIN customer_profiles cp ON cp.user_id = u.id
      WHERE u.role = 'customer' 
      AND cp.user_id IS NULL
    `);
    
    console.log(`Found ${missingProfiles.rows.length} customers without profiles`);
    
    for (const user of missingProfiles.rows) {
      console.log(`Creating profile for: ${user.name} (${user.email})`);
      
      // Create the missing customer_profiles entry
      await pool.query(`
        INSERT INTO customer_profiles (
          user_id,
          display_name,
          cc_balance,
          total_cc_earned,
          total_cc_spent,
          profile_visibility,
          current_rank,
          total_rounds,
          total_challenges_won,
          total_challenges_played,
          challenge_win_rate,
          achievement_count,
          achievement_points,
          created_at,
          updated_at
        ) VALUES (
          $1,
          $2,
          0,
          0,
          0,
          'public',
          'House',
          0,
          0,
          0,
          0,
          0,
          0,
          NOW(),
          NOW()
        )
      `, [user.id, user.name]);
      
      console.log(`✅ Created profile for ${user.name}`);
    }
    
    // Verify all customers now have profiles
    const checkResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM users u
      LEFT JOIN customer_profiles cp ON cp.user_id = u.id
      WHERE u.role = 'customer' 
      AND cp.user_id IS NULL
    `);
    
    if (checkResult.rows[0].count === '0') {
      console.log('✅ All customers now have profiles!');
    } else {
      console.log(`⚠️  Still ${checkResult.rows[0].count} customers without profiles`);
    }
    
    // List all customers with their profile status
    const allCustomers = await pool.query(`
      SELECT 
        u.name,
        u.email,
        cp.cc_balance,
        cp.total_cc_earned,
        cp.current_rank
      FROM users u
      LEFT JOIN customer_profiles cp ON cp.user_id = u.id
      WHERE u.role = 'customer'
      ORDER BY u.name
    `);
    
    console.log('\nAll customers:');
    console.table(allCustomers.rows);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

fixMissingCustomerProfiles();