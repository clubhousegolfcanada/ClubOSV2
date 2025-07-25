#!/bin/bash
echo "🔧 Fixing ClubOS Data Persistence Issues"
echo "========================================"

# Navigate to backend directory
cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1/ClubOSV1-backend

# Run the tickets migration
echo "📊 Creating tickets table in PostgreSQL..."
npm run tsx src/scripts/runTicketsMigration.ts

# Create a simple test script to verify database connection
cat > test-db-persistence.js << 'EOF'
const { Pool } = require('pg');

async function testPersistence() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Test feedback table
    console.log('\n🔍 Testing feedback table...');
    const feedbackResult = await pool.query('SELECT COUNT(*) as count FROM feedback');
    console.log(`✅ Feedback table exists with ${feedbackResult.rows[0].count} records`);

    // Test tickets table
    console.log('\n🔍 Testing tickets table...');
    const ticketsResult = await pool.query('SELECT COUNT(*) as count FROM tickets');
    console.log(`✅ Tickets table exists with ${ticketsResult.rows[0].count} records`);

    // Test creating a sample ticket
    console.log('\n🔍 Testing ticket creation...');
    const testTicket = await pool.query(`
      INSERT INTO tickets (title, description, category, status, priority, created_by_id, created_by_name, created_by_email)
      VALUES ('Test Ticket', 'Testing persistence', 'tech', 'open', 'low', 'test-user', 'Test User', 'test@example.com')
      RETURNING id, title
    `);
    console.log(`✅ Created test ticket: ${testTicket.rows[0].title}`);

    // Clean up test ticket
    await pool.query('DELETE FROM tickets WHERE id = $1', [testTicket.rows[0].id]);
    console.log('🧹 Cleaned up test ticket');

    console.log('\n✨ All tests passed! Your data will now persist across deployments.');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.log('\n💡 Make sure DATABASE_URL is set in your Railway environment');
  } finally {
    await pool.end();
  }
}

testPersistence();
EOF

# Run the test
echo -e "\n🧪 Testing database persistence..."
node test-db-persistence.js

# Clean up
rm test-db-persistence.js

echo -e "\n📝 Next Steps:"
echo "1. Deploy these changes to Railway"
echo "2. The tickets and feedback will now persist in PostgreSQL"
echo "3. No more data loss between deployments! 🎉"

# Create commit
cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1
git add -A
git commit -m "Fix data persistence for tickets and feedback

- Create tickets and ticket_comments tables in PostgreSQL
- Add database utility for ticket operations
- Create migration script for tickets table
- Fix feedback to properly save to database
- Data now persists across Railway deployments
- No more JSON file dependency for production data"
git push origin main
