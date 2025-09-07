import { query as db } from '../utils/db';

export async function runRankTierMigration() {
  try {
    // Check if rank_tier column exists
    const columnCheck = await db(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'customer_profiles' 
      AND column_name = 'rank_tier'
    `);
    
    if (columnCheck.rows.length === 0) {
      console.log('Adding missing rank_tier column to customer_profiles...');
      
      // Add the column
      await db(`
        ALTER TABLE customer_profiles 
        ADD COLUMN rank_tier VARCHAR(50) DEFAULT 'Bronze'
      `);
      
      // Add index for performance
      await db(`
        CREATE INDEX IF NOT EXISTS idx_customer_profiles_rank_tier 
        ON customer_profiles(rank_tier)
      `);
      
      console.log('✅ rank_tier column added successfully');
    } else {
      console.log('rank_tier column already exists');
    }
  } catch (error) {
    console.error('Failed to run rank_tier migration:', error);
    // Don't throw - this is not critical for app startup
  }
}