#!/usr/bin/env tsx

/**
 * Enable Pattern Learning System and Create Initial Patterns
 * This script:
 * 1. Enables the pattern learning system
 * 2. Creates initial patterns based on common customer messages
 * 3. Sets up the system to start learning from new messages
 */

import { db } from '../ClubOSV1-backend/src/utils/database';
import { logger } from '../ClubOSV1-backend/src/utils/logger';

async function main() {
  try {
    console.log('🔧 Enabling Pattern Learning System...\n');

    // 1. Enable pattern learning in config
    console.log('1️⃣ Updating pattern learning configuration...');
    
    // Check if config exists, if not create it
    const configCheck = await db.query(
      `SELECT COUNT(*) FROM pattern_learning_config`
    );
    
    if (configCheck.rows[0].count === '0') {
      // Insert default configuration
      await db.query(`
        INSERT INTO pattern_learning_config (config_key, config_value, description) VALUES
        ('enabled', 'true', 'Enable pattern learning system'),
        ('shadow_mode', 'false', 'Run in shadow mode (no actions taken)'),
        ('min_confidence_to_act', '0.85', 'Minimum confidence to auto-execute'),
        ('min_confidence_to_suggest', '0.60', 'Minimum confidence to suggest'),
        ('min_occurrences_to_learn', '2', 'Minimum times pattern must occur to learn'),
        ('confidence_increase_success', '0.05', 'Confidence increase on success'),
        ('confidence_decrease_failure', '0.10', 'Confidence decrease on failure'),
        ('suggestion_timeout_seconds', '30', 'Time before suggestion expires')
      `);
      console.log('✅ Created default configuration');
    } else {
      // Update existing configuration
      await db.query(`
        UPDATE pattern_learning_config 
        SET config_value = 'true'
        WHERE config_key = 'enabled'
      `);
      
      await db.query(`
        UPDATE pattern_learning_config 
        SET config_value = 'false'
        WHERE config_key = 'shadow_mode'
      `);
      console.log('✅ Updated configuration - Pattern Learning is now ENABLED');
    }

    // 2. Create initial patterns based on common messages
    console.log('\n2️⃣ Creating initial patterns...');
    
    const initialPatterns = [
      {
        type: 'booking',
        trigger: 'How do I book a bay?',
        keywords: ['book', 'booking', 'reserve', 'reservation', 'bay'],
        response: 'You can book a bay at https://skedda.com/clubhouse247golf. Select your preferred location, date, and time. If you need help, I can guide you through the process!',
        confidence: 0.90
      },
      {
        type: 'hours',
        trigger: 'What are your hours?',
        keywords: ['hours', 'open', 'close', 'time', 'schedule'],
        response: 'We\'re open 24/7! You can book a bay anytime at https://skedda.com/clubhouse247golf. Our facilities are unstaffed but fully automated for your convenience.',
        confidence: 0.95
      },
      {
        type: 'tech_issue',
        trigger: 'The trackman is not working',
        keywords: ['trackman', 'broken', 'not working', 'issue', 'problem', 'frozen', 'stuck'],
        response: 'I\'m sorry you\'re having issues with the TrackMan. I can help reset it remotely. Which bay are you in? This usually takes about 30 seconds.',
        confidence: 0.85
      },
      {
        type: 'gift_cards',
        trigger: 'Do you sell gift cards?',
        keywords: ['gift', 'card', 'certificate', 'present', 'buy'],
        response: 'Yes! We offer gift cards in any amount. You can purchase them at https://clubhouse247golf.com/gift-cards. They make perfect gifts for golf enthusiasts!',
        confidence: 0.95
      },
      {
        type: 'membership',
        trigger: 'How much is a membership?',
        keywords: ['membership', 'member', 'price', 'cost', 'monthly', 'annual'],
        response: 'We offer several membership options starting at $99/month. Visit https://clubhouse247golf.com/membership for details on all membership tiers and benefits.',
        confidence: 0.90
      },
      {
        type: 'access',
        trigger: 'How do I get in?',
        keywords: ['access', 'door', 'code', 'entry', 'get in', 'locked'],
        response: 'You\'ll receive a door access code via text 30 minutes before your booking. If you haven\'t received it or need help getting in, please let me know your booking details.',
        confidence: 0.85
      },
      {
        type: 'faq',
        trigger: 'Can I bring food and drinks?',
        keywords: ['food', 'drinks', 'bring', 'alcohol', 'beer', 'snacks'],
        response: 'Yes! You\'re welcome to bring your own food and drinks, including alcohol (if you\'re 21+). We just ask that you clean up after yourself and dispose of trash properly.',
        confidence: 0.95
      },
      {
        type: 'tech_issue',
        trigger: 'The TV is not working',
        keywords: ['tv', 'television', 'screen', 'monitor', 'display', 'not working'],
        response: 'I can help with the TV issue. Which bay are you in? I\'ll reset the display system remotely. This usually resolves most TV problems.',
        confidence: 0.80
      }
    ];

    let patternsCreated = 0;
    for (const pattern of initialPatterns) {
      try {
        // Generate pattern signature
        const crypto = require('crypto');
        const signature = crypto.createHash('md5')
          .update(pattern.trigger.toLowerCase())
          .digest('hex');

        // Check if pattern already exists
        const existing = await db.query(
          'SELECT id FROM decision_patterns WHERE pattern_signature = $1',
          [signature]
        );

        if (existing.rows.length === 0) {
          await db.query(`
            INSERT INTO decision_patterns (
              pattern_type, 
              pattern_signature,
              trigger_text,
              trigger_keywords,
              response_template,
              confidence_score,
              auto_executable,
              created_from,
              is_active
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `, [
            pattern.type,
            signature,
            pattern.trigger,
            pattern.keywords,
            pattern.response,
            pattern.confidence,
            pattern.confidence >= 0.85, // Auto-execute if confidence >= 85%
            'manual',
            true
          ]);
          patternsCreated++;
          console.log(`✅ Created pattern: "${pattern.trigger.substring(0, 30)}..."`);
        } else {
          console.log(`⏭️  Pattern already exists: "${pattern.trigger.substring(0, 30)}..."`);
        }
      } catch (err) {
        console.error(`❌ Failed to create pattern: ${pattern.trigger}`, err);
      }
    }

    console.log(`\n✅ Created ${patternsCreated} new patterns`);

    // 3. Show current status
    console.log('\n3️⃣ Pattern Learning System Status:');
    
    const patternCount = await db.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE auto_executable = true) as auto_executable,
        COUNT(*) FILTER (WHERE confidence_score >= 0.85) as high_confidence
      FROM decision_patterns 
      WHERE is_active = true
    `);

    const stats = patternCount.rows[0];
    console.log(`   📊 Total Active Patterns: ${stats.total}`);
    console.log(`   🤖 Auto-Executable: ${stats.auto_executable}`);
    console.log(`   ⭐ High Confidence (85%+): ${stats.high_confidence}`);

    const recentActivity = await db.query(`
      SELECT COUNT(*) as count
      FROM pattern_execution_history
      WHERE created_at > NOW() - INTERVAL '7 days'
    `);

    console.log(`   📈 Pattern Matches (Last 7 Days): ${recentActivity.rows[0].count}`);

    console.log('\n✨ Pattern Learning System is now ACTIVE!');
    console.log('   - New messages will be analyzed for patterns');
    console.log('   - High-confidence patterns will suggest responses');
    console.log('   - System will learn from operator actions');
    console.log('\n📱 View the Pattern Learning dashboard at: /operations → V3-PLS tab');

  } catch (error) {
    console.error('❌ Error enabling pattern learning:', error);
    process.exit(1);
  } finally {
    await db.end();
  }
}

main();