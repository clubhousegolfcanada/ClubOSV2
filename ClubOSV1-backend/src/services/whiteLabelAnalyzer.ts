import { db } from '../database/db';
import * as fs from 'fs/promises';
import * as path from 'path';

interface FeatureInventory {
  category: string;
  feature_name: string;
  description: string;
  is_clubos_specific: boolean;
  is_transferable: boolean;
  dependencies: string[];
  file_locations: string[];
  database_tables: string[];
  api_endpoints: string[];
}

interface BrandingItem {
  type: string;
  location: string;
  current_value: string;
  is_hardcoded: boolean;
  file_path?: string;
  line_number?: number;
}

interface SOPItem {
  name: string;
  type: string;
  description: string;
  location: any;
  is_replaceable: boolean;
  dependencies: string[];
}

interface Integration {
  service_name: string;
  type: string;
  is_required: boolean;
  is_client_specific: boolean;
  configuration: any;
  api_keys_required: string[];
}

export class WhiteLabelAnalyzer {
  private frontendPath: string;
  private backendPath: string;

  constructor() {
    this.frontendPath = path.join(__dirname, '../../../ClubOSV1-frontend');
    this.backendPath = path.join(__dirname, '../..');
  }

  async analyzeSystem() {
    console.log('Starting white label system analysis...');
    
    // Clear existing inventory
    await this.clearInventory();
    
    // Run all analysis functions
    const [features, branding, sops, integrations] = await Promise.all([
      this.analyzeFeatures(),
      this.analyzeBranding(),
      this.analyzeSOPs(),
      this.analyzeIntegrations()
    ]);

    return {
      features,
      branding,
      sops,
      integrations,
      summary: {
        total_features: features.length,
        clubos_specific_features: features.filter(f => f.is_clubos_specific).length,
        transferable_features: features.filter(f => f.is_transferable).length,
        branding_items: branding.length,
        hardcoded_branding: branding.filter(b => b.is_hardcoded).length,
        sops_count: sops.length,
        integrations_count: integrations.length,
        required_integrations: integrations.filter(i => i.is_required).length
      }
    };
  }

  private async clearInventory() {
    await db.query('DELETE FROM feature_inventory');
    await db.query('DELETE FROM branding_inventory');
    await db.query('DELETE FROM sop_inventory');
    await db.query('DELETE FROM integration_inventory');
  }

  private async analyzeFeatures(): Promise<FeatureInventory[]> {
    const features: FeatureInventory[] = [];

    // Core Features
    features.push({
      category: 'Authentication',
      feature_name: 'User Management',
      description: 'User registration, login, roles (admin, operator, support, customer)',
      is_clubos_specific: false,
      is_transferable: true,
      dependencies: [],
      file_locations: ['/src/routes/auth.ts', '/src/pages/login.tsx'],
      database_tables: ['users', 'user_roles'],
      api_endpoints: ['/api/auth/login', '/api/auth/register', '/api/auth/logout']
    });

    features.push({
      category: 'Operations',
      feature_name: 'Ticket System',
      description: 'Tech and facilities ticket management with priorities',
      is_clubos_specific: false,
      is_transferable: true,
      dependencies: [],
      file_locations: ['/src/routes/tickets.ts', '/src/pages/operations/tickets.tsx'],
      database_tables: ['tickets'],
      api_endpoints: ['/api/tickets', '/api/tickets/:id']
    });

    features.push({
      category: 'Operations',
      feature_name: 'Checklists',
      description: 'Daily maintenance checklists with auto-ticket creation',
      is_clubos_specific: true, // Our specific checklists
      is_transferable: false,
      dependencies: ['Ticket System'],
      file_locations: ['/src/routes/checklists.ts', '/src/pages/operations/checklists.tsx'],
      database_tables: ['checklists', 'checklist_submissions'],
      api_endpoints: ['/api/checklists', '/api/checklists/submit']
    });

    features.push({
      category: 'AI',
      feature_name: 'ClubOS Boy',
      description: 'AI-powered customer support with GPT-4',
      is_clubos_specific: true, // Our assistants and prompts
      is_transferable: false,
      dependencies: ['OpenAI API'],
      file_locations: ['/src/services/openai.ts', '/src/pages/clubosboy.tsx'],
      database_tables: ['knowledge_base', 'feedback'],
      api_endpoints: ['/api/clubosboy/chat', '/api/knowledge']
    });

    features.push({
      category: 'AI',
      feature_name: 'V3-PLS Pattern Learning',
      description: 'Automated response patterns with operator learning',
      is_clubos_specific: true, // Our patterns
      is_transferable: false,
      dependencies: ['OpenAI API', 'Messages System'],
      file_locations: ['/src/services/patternLearning.ts', '/src/pages/operations/v3-pls.tsx'],
      database_tables: ['patterns', 'pattern_executions'],
      api_endpoints: ['/api/patterns', '/api/ai-automations']
    });

    features.push({
      category: 'Communications',
      feature_name: 'OpenPhone Integration',
      description: 'Two-way SMS messaging with conversation history',
      is_clubos_specific: true, // Our phone numbers
      is_transferable: false,
      dependencies: ['OpenPhone API'],
      file_locations: ['/src/routes/messages.ts', '/src/pages/operations/messages.tsx'],
      database_tables: ['openphone_conversations', 'customers'],
      api_endpoints: ['/api/messages', '/api/messages/send']
    });

    features.push({
      category: 'Gamification',
      feature_name: 'Clubhouse Challenges',
      description: 'ClubCoin economy and head-to-head challenges',
      is_clubos_specific: true, // Our specific implementation
      is_transferable: false,
      dependencies: ['TrackMan Integration'],
      file_locations: ['/src/routes/challenges.ts', '/src/pages/compete.tsx'],
      database_tables: ['challenges', 'club_coins', 'achievements'],
      api_endpoints: ['/api/challenges', '/api/leaderboard']
    });

    features.push({
      category: 'Facility Control',
      feature_name: 'NinjaOne Remote Control',
      description: 'Remote control of simulators, TVs, and music',
      is_clubos_specific: true, // Our devices
      is_transferable: false,
      dependencies: ['NinjaOne API'],
      file_locations: ['/src/services/ninjaone.ts', '/src/pages/operations/commands.tsx'],
      database_tables: ['ninjaone_scripts', 'ninjaone_devices'],
      api_endpoints: ['/api/ninjaone/execute']
    });

    features.push({
      category: 'Analytics',
      feature_name: 'Dashboard',
      description: 'Real-time facility status and metrics',
      is_clubos_specific: false,
      is_transferable: true,
      dependencies: [],
      file_locations: ['/src/pages/dashboard.tsx'],
      database_tables: [],
      api_endpoints: ['/api/dashboard/stats']
    });

    // Save to database
    for (const feature of features) {
      await db.query(
        `INSERT INTO feature_inventory 
         (category, feature_name, description, is_clubos_specific, is_transferable, 
          dependencies, file_locations, database_tables, api_endpoints)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          feature.category,
          feature.feature_name,
          feature.description,
          feature.is_clubos_specific,
          feature.is_transferable,
          JSON.stringify(feature.dependencies),
          JSON.stringify(feature.file_locations),
          JSON.stringify(feature.database_tables),
          JSON.stringify(feature.api_endpoints)
        ]
      );
    }

    return features;
  }

  private async analyzeBranding(): Promise<BrandingItem[]> {
    const brandingItems: BrandingItem[] = [];

    // Search for ClubOS-specific branding
    const brandingPatterns = [
      { type: 'name', pattern: /ClubOS|Clubhouse 24\/7/gi, value: 'ClubOS' },
      { type: 'logo', pattern: /logo.*\.(png|svg|jpg)/gi, value: 'logo files' },
      { type: 'color', pattern: /#0B3D3A|#10B981/gi, value: 'brand colors' },
      { type: 'domain', pattern: /clubos.*\.com|clubhouse247/gi, value: 'domain references' },
      { type: 'company', pattern: /Clubhouse 24\/7 Golf/gi, value: 'company name' }
    ];

    // Scan frontend files
    const frontendFiles = [
      '/src/components/Navigation.tsx',
      '/src/pages/_app.tsx',
      '/src/pages/index.tsx',
      '/src/styles/globals.css',
      '/public/manifest.json'
    ];

    for (const file of frontendFiles) {
      try {
        const filePath = path.join(this.frontendPath, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.split('\n');

        for (const pattern of brandingPatterns) {
          lines.forEach((line, index) => {
            if (pattern.pattern.test(line)) {
              brandingItems.push({
                type: pattern.type,
                location: file,
                current_value: pattern.value,
                is_hardcoded: true,
                file_path: file,
                line_number: index + 1
              });
            }
          });
        }
      } catch (error) {
        // File might not exist
      }
    }

    // Save to database
    for (const item of brandingItems) {
      await db.query(
        `INSERT INTO branding_inventory 
         (type, location, current_value, is_hardcoded, file_path, line_number)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [item.type, item.location, item.current_value, item.is_hardcoded, item.file_path, item.line_number]
      );
    }

    return brandingItems;
  }

  private async analyzeSOPs(): Promise<SOPItem[]> {
    const sops: SOPItem[] = [];

    // Check database for SOPs
    const checklistsResult = await db.query('SELECT * FROM checklists');
    for (const checklist of checklistsResult.rows) {
      sops.push({
        name: checklist.name,
        type: 'checklist',
        description: `${checklist.location} - ${checklist.time_of_day}`,
        location: { table: 'checklists', id: checklist.id },
        is_replaceable: true,
        dependencies: []
      });
    }

    // Check knowledge base
    const knowledgeResult = await db.query('SELECT * FROM knowledge_base WHERE is_active = true');
    for (const knowledge of knowledgeResult.rows) {
      if (knowledge.category === 'operations' || knowledge.category === 'policies') {
        sops.push({
          name: knowledge.question,
          type: 'knowledge_base',
          description: knowledge.answer.substring(0, 100),
          location: { table: 'knowledge_base', id: knowledge.id },
          is_replaceable: true,
          dependencies: []
        });
      }
    }

    // Check patterns
    const patternsResult = await db.query('SELECT * FROM patterns');
    for (const pattern of patternsResult.rows) {
      sops.push({
        name: pattern.pattern_name,
        type: 'automation',
        description: pattern.response_template.substring(0, 100),
        location: { table: 'patterns', id: pattern.id },
        is_replaceable: true,
        dependencies: ['V3-PLS']
      });
    }

    // Save to database
    for (const sop of sops) {
      await db.query(
        `INSERT INTO sop_inventory 
         (name, type, description, location, is_replaceable, dependencies)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          sop.name,
          sop.type,
          sop.description,
          JSON.stringify(sop.location),
          sop.is_replaceable,
          JSON.stringify(sop.dependencies)
        ]
      );
    }

    return sops;
  }

  private async analyzeIntegrations(): Promise<Integration[]> {
    const integrations: Integration[] = [
      {
        service_name: 'OpenAI',
        type: 'ai',
        is_required: false,
        is_client_specific: false,
        configuration: { model: 'gpt-4', assistants: ['emergency', 'booking', 'tech', 'tone'] },
        api_keys_required: ['OPENAI_API_KEY']
      },
      {
        service_name: 'OpenPhone',
        type: 'communication',
        is_required: false,
        is_client_specific: true,
        configuration: { phone_numbers: [], webhook_url: '' },
        api_keys_required: ['OPENPHONE_API_KEY', 'OPENPHONE_WEBHOOK_SECRET']
      },
      {
        service_name: 'NinjaOne',
        type: 'facility',
        is_required: false,
        is_client_specific: true,
        configuration: { devices: [], scripts: [] },
        api_keys_required: ['NINJAONE_API_KEY']
      },
      {
        service_name: 'Slack',
        type: 'communication',
        is_required: false,
        is_client_specific: true,
        configuration: { webhook_url: '' },
        api_keys_required: ['SLACK_WEBHOOK_URL']
      },
      {
        service_name: 'HubSpot',
        type: 'crm',
        is_required: false,
        is_client_specific: true,
        configuration: { portal_id: '', form_id: '' },
        api_keys_required: ['HUBSPOT_API_KEY']
      },
      {
        service_name: 'TrackMan',
        type: 'facility',
        is_required: false,
        is_client_specific: true,
        configuration: { locations: [], embed_urls: [] },
        api_keys_required: []
      },
      {
        service_name: 'UniFi Access',
        type: 'facility',
        is_required: false,
        is_client_specific: true,
        configuration: { controllers: [], doors: [] },
        api_keys_required: ['UNIFI_API_KEY']
      },
      {
        service_name: 'Skedda',
        type: 'booking',
        is_required: false,
        is_client_specific: true,
        configuration: { booking_urls: [] },
        api_keys_required: []
      },
      {
        service_name: 'Vercel',
        type: 'hosting',
        is_required: true,
        is_client_specific: false,
        configuration: { deployment: 'frontend' },
        api_keys_required: []
      },
      {
        service_name: 'Railway',
        type: 'hosting',
        is_required: true,
        is_client_specific: false,
        configuration: { deployment: 'backend', database: 'postgresql' },
        api_keys_required: []
      }
    ];

    // Save to database
    for (const integration of integrations) {
      await db.query(
        `INSERT INTO integration_inventory 
         (service_name, type, is_required, is_client_specific, configuration, api_keys_required)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          integration.service_name,
          integration.type,
          integration.is_required,
          integration.is_client_specific,
          JSON.stringify(integration.configuration),
          JSON.stringify(integration.api_keys_required)
        ]
      );
    }

    return integrations;
  }

  async generateBlueprint(configId: string) {
    const config = await db.query(
      'SELECT * FROM white_label_configurations WHERE id = $1',
      [configId]
    );

    if (!config.rows[0]) {
      throw new Error('Configuration not found');
    }

    const blueprint = {
      name: config.rows[0].name,
      created_at: new Date().toISOString(),
      implementation_steps: [],
      database_changes: [],
      file_changes: [],
      environment_variables: [],
      estimated_effort: ''
    };

    // Generate implementation steps
    blueprint.implementation_steps = [
      '1. Database Setup',
      '  - Run migration to create tenant tables',
      '  - Add org_id columns to existing tables',
      '  - Create default organization record',
      '',
      '2. Backend Changes',
      '  - Implement tenant resolution middleware',
      '  - Update all repositories with tenant scoping',
      '  - Remove hardcoded ClubOS references',
      '  - Make integrations configurable',
      '',
      '3. Frontend Changes',
      '  - Create dynamic theme provider',
      '  - Replace hardcoded branding',
      '  - Add tenant context throughout app',
      '  - Update navigation and routing',
      '',
      '4. Configuration',
      '  - Set up environment variables',
      '  - Configure subdomain routing',
      '  - Set up tenant-specific assets',
      '',
      '5. Testing',
      '  - Test tenant isolation',
      '  - Verify data segregation',
      '  - Test theme switching',
      '  - Validate multi-tenant auth'
    ];

    return blueprint;
  }

  async getInventorySummary() {
    const features = await db.query('SELECT * FROM feature_inventory');
    const branding = await db.query('SELECT * FROM branding_inventory');
    const sops = await db.query('SELECT * FROM sop_inventory');
    const integrations = await db.query('SELECT * FROM integration_inventory');

    return {
      features: features.rows,
      branding: branding.rows,
      sops: sops.rows,
      integrations: integrations.rows
    };
  }

  async saveConfiguration(config: any) {
    const result = await db.query(
      `INSERT INTO white_label_configurations 
       (name, description, features, branding_items, sop_replacements, 
        integrations, excluded_features, implementation_notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        config.name,
        config.description,
        JSON.stringify(config.features),
        JSON.stringify(config.branding_items),
        JSON.stringify(config.sop_replacements),
        JSON.stringify(config.integrations),
        JSON.stringify(config.excluded_features),
        config.implementation_notes,
        config.created_by
      ]
    );

    return result.rows[0];
  }
}