import { query as db } from '../utils/db';
import { logger } from '../utils/logger';

interface FeatureItem {
  name: string;
  category: string;
  is_transferable: boolean;
  notes: string;
}

interface BrandingItem {
  element_type: string;
  current_value: string;
  is_customizable: boolean;
  notes: string;
}

interface SOPItem {
  name: string;
  category: string;
  is_industry_specific: boolean;
  notes: string;
}

interface IntegrationItem {
  name: string;
  type: string;
  is_required: boolean;
  notes: string;
}

async function populateFeatures() {
  const features: FeatureItem[] = [
    // Core Platform Features (Transferable)
    { name: 'User Authentication System', category: 'Core', is_transferable: true, notes: 'JWT-based auth with role management' },
    { name: 'Role-Based Access Control', category: 'Core', is_transferable: true, notes: 'Admin, Operator, Customer roles' },
    { name: 'Real-time Messaging System', category: 'Core', is_transferable: true, notes: 'WebSocket-based chat with OpenPhone integration' },
    { name: 'Dashboard Analytics', category: 'Core', is_transferable: true, notes: 'Customizable metrics and KPIs' },
    { name: 'Ticket Management System', category: 'Core', is_transferable: true, notes: 'Support ticket workflow' },
    { name: 'Checklist System', category: 'Operations', is_transferable: true, notes: 'Task management with photo attachments' },
    { name: 'AI Pattern Learning (V3-PLS)', category: 'AI', is_transferable: true, notes: 'GPT-4o powered message automation' },
    { name: 'Command Center', category: 'Operations', is_transferable: true, notes: 'Quick action command system' },
    { name: 'Push Notifications', category: 'Core', is_transferable: true, notes: 'Web push notification system' },
    { name: 'File Upload System', category: 'Core', is_transferable: true, notes: 'Image and document management' },
    
    // Golf-Specific Features (Not Transferable)
    { name: 'Bay Management', category: 'Golf-Specific', is_transferable: false, notes: 'Golf simulator bay tracking' },
    { name: 'Tee Time Booking', category: 'Golf-Specific', is_transferable: false, notes: 'Golf booking system' },
    { name: 'Golf Leaderboards', category: 'Golf-Specific', is_transferable: false, notes: 'Competition and scoring system' },
    { name: 'TrackMan Integration', category: 'Golf-Specific', is_transferable: false, notes: 'Golf simulator data integration' },
    { name: 'Golf Challenges System', category: 'Golf-Specific', is_transferable: false, notes: 'Player vs player challenges' },
    { name: 'Golf Achievements', category: 'Golf-Specific', is_transferable: false, notes: 'Golf-specific achievement badges' },
    { name: 'Handicap Tracking', category: 'Golf-Specific', is_transferable: false, notes: 'Golf handicap calculation' },
    { name: 'Course Database', category: 'Golf-Specific', is_transferable: false, notes: 'Virtual golf course library' },
    { name: 'Shot Analysis', category: 'Golf-Specific', is_transferable: false, notes: 'Golf swing analytics' },
    { name: 'Club Recommendations', category: 'Golf-Specific', is_transferable: false, notes: 'Golf equipment suggestions' },
    
    // Customer Features (Mostly Transferable)
    { name: 'Customer Portal', category: 'Customer', is_transferable: true, notes: 'Self-service customer dashboard' },
    { name: 'Profile Management', category: 'Customer', is_transferable: true, notes: 'User profile and preferences' },
    { name: 'Friend System', category: 'Customer', is_transferable: true, notes: 'Social connections and invites' },
    { name: 'Booking System', category: 'Customer', is_transferable: true, notes: 'Resource reservation system' },
    { name: 'Events Calendar', category: 'Customer', is_transferable: true, notes: 'Event management and registration' },
    { name: 'Loyalty Points', category: 'Customer', is_transferable: true, notes: 'Rewards and points system' },
    { name: 'Payment Processing', category: 'Customer', is_transferable: true, notes: 'Stripe integration for payments' },
    
    // Operations Features
    { name: 'Operations Dashboard', category: 'Operations', is_transferable: true, notes: 'Real-time operations monitoring' },
    { name: 'Remote Actions', category: 'Operations', is_transferable: true, notes: 'Remote control capabilities' },
    { name: 'Location Management', category: 'Operations', is_transferable: true, notes: 'Multi-location support' },
    { name: 'Staff Scheduling', category: 'Operations', is_transferable: true, notes: 'Employee schedule management' },
    { name: 'Inventory Tracking', category: 'Operations', is_transferable: true, notes: 'Equipment and supply tracking' },
    
    // Analytics Features
    { name: 'Revenue Analytics', category: 'Analytics', is_transferable: true, notes: 'Financial reporting and metrics' },
    { name: 'Customer Analytics', category: 'Analytics', is_transferable: true, notes: 'Customer behavior tracking' },
    { name: 'Usage Analytics', category: 'Analytics', is_transferable: true, notes: 'System usage statistics' },
    { name: 'Performance Metrics', category: 'Analytics', is_transferable: true, notes: 'KPI tracking and reporting' }
  ];

  for (const feature of features) {
    try {
      await db(
        `INSERT INTO feature_inventory (name, category, is_transferable, notes) 
         VALUES ($1, $2, $3, $4) 
         ON CONFLICT (name) DO UPDATE 
         SET category = $2, is_transferable = $3, notes = $4`,
        [feature.name, feature.category, feature.is_transferable, feature.notes]
      );
    } catch (error) {
      logger.error(`Error inserting feature ${feature.name}:`, error);
    }
  }
  logger.debug(`Populated ${features.length} features`);
}

async function populateBranding() {
  const branding: BrandingItem[] = [
    { element_type: 'Logo', current_value: 'ClubOS Logo', is_customizable: true, notes: 'Main application logo' },
    { element_type: 'Primary Color', current_value: '#0B3D3A (Teal)', is_customizable: true, notes: 'Primary brand color' },
    { element_type: 'Secondary Color', current_value: '#10b981 (Green)', is_customizable: true, notes: 'Secondary accent color' },
    { element_type: 'App Name', current_value: 'ClubOS', is_customizable: true, notes: 'Application name throughout UI' },
    { element_type: 'Tagline', current_value: 'Golf Simulator Management', is_customizable: true, notes: 'App tagline/description' },
    { element_type: 'Favicon', current_value: 'ClubOS Icon', is_customizable: true, notes: 'Browser tab icon' },
    { element_type: 'Email Templates', current_value: 'ClubOS branded', is_customizable: true, notes: 'Email notification templates' },
    { element_type: 'Welcome Messages', current_value: 'Golf-specific greetings', is_customizable: true, notes: 'Onboarding messages' },
    { element_type: 'Error Messages', current_value: 'Generic', is_customizable: false, notes: 'System error messages' },
    { element_type: 'Font Family', current_value: 'System default', is_customizable: true, notes: 'Typography choices' },
    { element_type: 'Button Styles', current_value: 'Rounded corners', is_customizable: true, notes: 'UI component styling' },
    { element_type: 'Navigation Style', current_value: 'Top bar', is_customizable: false, notes: 'Navigation layout' },
    { element_type: 'Dashboard Layout', current_value: 'Card-based', is_customizable: true, notes: 'Dashboard component arrangement' },
    { element_type: 'Login Page', current_value: 'ClubOS branded', is_customizable: true, notes: 'Authentication page branding' },
    { element_type: 'Footer Text', current_value: '© ClubOS', is_customizable: true, notes: 'Copyright and footer info' }
  ];

  for (const item of branding) {
    try {
      await db(
        `INSERT INTO branding_inventory (element_type, current_value, is_customizable, notes) 
         VALUES ($1, $2, $3, $4) 
         ON CONFLICT (element_type) DO UPDATE 
         SET current_value = $2, is_customizable = $3, notes = $4`,
        [item.element_type, item.current_value, item.is_customizable, item.notes]
      );
    } catch (error) {
      logger.error(`Error inserting branding ${item.element_type}:`, error);
    }
  }
  logger.debug(`Populated ${branding.length} branding items`);
}

async function populateSOPs() {
  const sops: SOPItem[] = [
    // Golf-Specific SOPs
    { name: 'Bay Setup Procedure', category: 'Operations', is_industry_specific: true, notes: 'Golf simulator bay preparation' },
    { name: 'TrackMan Calibration', category: 'Technical', is_industry_specific: true, notes: 'Golf simulator calibration process' },
    { name: 'Golf Tournament Setup', category: 'Operations', is_industry_specific: true, notes: 'Competition organization procedures' },
    { name: 'Golf Club Cleaning', category: 'Operations', is_industry_specific: true, notes: 'Equipment maintenance procedures' },
    { name: 'Handicap Verification', category: 'Customer Service', is_industry_specific: true, notes: 'Player handicap validation' },
    
    // Generic SOPs (Transferable)
    { name: 'Opening Procedures', category: 'Operations', is_industry_specific: false, notes: 'Daily opening checklist' },
    { name: 'Closing Procedures', category: 'Operations', is_industry_specific: false, notes: 'End of day procedures' },
    { name: 'Customer Check-in', category: 'Customer Service', is_industry_specific: false, notes: 'Customer arrival process' },
    { name: 'Payment Processing', category: 'Customer Service', is_industry_specific: false, notes: 'Transaction handling procedures' },
    { name: 'Emergency Response', category: 'Safety', is_industry_specific: false, notes: 'Emergency situation protocols' },
    { name: 'Equipment Maintenance', category: 'Technical', is_industry_specific: false, notes: 'General equipment care' },
    { name: 'Customer Complaint Handling', category: 'Customer Service', is_industry_specific: false, notes: 'Issue resolution process' },
    { name: 'Staff Training', category: 'Operations', is_industry_specific: false, notes: 'Employee onboarding process' },
    { name: 'Inventory Management', category: 'Operations', is_industry_specific: false, notes: 'Stock control procedures' },
    { name: 'Data Backup', category: 'Technical', is_industry_specific: false, notes: 'System backup procedures' },
    { name: 'Security Protocols', category: 'Safety', is_industry_specific: false, notes: 'Security and access control' },
    { name: 'Health & Safety Checks', category: 'Safety', is_industry_specific: false, notes: 'Safety compliance procedures' },
    { name: 'Customer Data Protection', category: 'Technical', is_industry_specific: false, notes: 'GDPR/privacy compliance' },
    { name: 'Social Media Response', category: 'Customer Service', is_industry_specific: false, notes: 'Online engagement protocols' },
    { name: 'Refund Processing', category: 'Customer Service', is_industry_specific: false, notes: 'Refund and cancellation procedures' }
  ];

  for (const sop of sops) {
    try {
      await db(
        `INSERT INTO sop_inventory (name, category, is_industry_specific, notes) 
         VALUES ($1, $2, $3, $4) 
         ON CONFLICT (name) DO UPDATE 
         SET category = $2, is_industry_specific = $3, notes = $4`,
        [sop.name, sop.category, sop.is_industry_specific, sop.notes]
      );
    } catch (error) {
      logger.error(`Error inserting SOP ${sop.name}:`, error);
    }
  }
  logger.debug(`Populated ${sops.length} SOPs`);
}

async function populateIntegrations() {
  const integrations: IntegrationItem[] = [
    // Required Core Integrations
    { name: 'OpenPhone', type: 'Communication', is_required: true, notes: 'Primary SMS/calling platform' },
    { name: 'Stripe', type: 'Payment', is_required: true, notes: 'Payment processing system' },
    { name: 'OpenAI GPT-4o', type: 'AI', is_required: true, notes: 'AI pattern learning and automation' },
    { name: 'PostgreSQL', type: 'Database', is_required: true, notes: 'Primary database system' },
    { name: 'Railway', type: 'Infrastructure', is_required: true, notes: 'Deployment and hosting platform' },
    
    // Optional/Replaceable Integrations
    { name: 'Slack', type: 'Communication', is_required: false, notes: 'Team communication (replaceable)' },
    { name: 'Sentry', type: 'Analytics', is_required: false, notes: 'Error tracking (optional)' },
    { name: 'TripleseatDirect', type: 'Analytics', is_required: false, notes: 'Event management (optional)' },
    { name: 'NinjaOne', type: 'Analytics', is_required: false, notes: 'Remote monitoring (optional)' },
    { name: 'SendGrid', type: 'Communication', is_required: false, notes: 'Email service (replaceable)' },
    { name: 'Twilio', type: 'Communication', is_required: false, notes: 'SMS backup service (optional)' },
    
    // Golf-Specific Integrations
    { name: 'TrackMan', type: 'Golf-Specific', is_required: false, notes: 'Golf simulator integration' },
    { name: 'TopTracer', type: 'Golf-Specific', is_required: false, notes: 'Ball tracking system' },
    { name: 'Golf Genius', type: 'Golf-Specific', is_required: false, notes: 'Tournament management' },
    { name: 'GHIN', type: 'Golf-Specific', is_required: false, notes: 'Handicap system integration' }
  ];

  for (const integration of integrations) {
    try {
      await db(
        `INSERT INTO integration_inventory (name, type, is_required, notes) 
         VALUES ($1, $2, $3, $4) 
         ON CONFLICT (name) DO UPDATE 
         SET type = $2, is_required = $3, notes = $4`,
        [integration.name, integration.type, integration.is_required, integration.notes]
      );
    } catch (error) {
      logger.error(`Error inserting integration ${integration.name}:`, error);
    }
  }
  logger.debug(`Populated ${integrations.length} integrations`);
}

async function populateInventory() {
  logger.debug('Starting White Label inventory population...');
  
  try {
    await populateFeatures();
    await populateBranding();
    await populateSOPs();
    await populateIntegrations();
    
    logger.debug('White Label inventory population completed successfully!');
    
    // Show summary
    const [features, branding, sops, integrations] = await Promise.all([
      db('SELECT COUNT(*) as count, SUM(CASE WHEN is_transferable THEN 1 ELSE 0 END) as transferable FROM feature_inventory'),
      db('SELECT COUNT(*) as count, SUM(CASE WHEN is_customizable THEN 1 ELSE 0 END) as customizable FROM branding_inventory'),
      db('SELECT COUNT(*) as count, SUM(CASE WHEN is_industry_specific THEN 1 ELSE 0 END) as specific FROM sop_inventory'),
      db('SELECT COUNT(*) as count, SUM(CASE WHEN is_required THEN 1 ELSE 0 END) as required FROM integration_inventory')
    ]);
    
    logger.debug('\n=== White Label Inventory Summary ===');
    logger.debug(`Features: ${features.rows[0].count} total (${features.rows[0].transferable} transferable)`);
    logger.debug(`Branding: ${branding.rows[0].count} total (${branding.rows[0].customizable} customizable)`);
    logger.debug(`SOPs: ${sops.rows[0].count} total (${sops.rows[0].specific} golf-specific)`);
    logger.debug(`Integrations: ${integrations.rows[0].count} total (${integrations.rows[0].required} required)`);
    
  } catch (error) {
    logger.error('Error populating inventory:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  populateInventory().then(() => {
    process.exit(0);
  });
}

export { populateInventory };