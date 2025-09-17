import fs from 'fs/promises';
import path from 'path';
import { db } from '../utils/database';
import { logger } from '../utils/logger';

interface ScanResult {
  features: FeatureDiscovery[];
  golfTerms: GolfTermDiscovery[];
  branding: BrandingDiscovery[];
  integrations: IntegrationDiscovery[];
  statistics: ScanStatistics;
}

interface FeatureDiscovery {
  name: string;
  category: string;
  isTransferable: boolean;
  dependencies: string[];
  codeLocations: CodeLocation[];
  configKeys: string[];
}

interface CodeLocation {
  filePath: string;
  lineNumbers: number[];
  snippet?: string;
}

interface GolfTermDiscovery {
  term: string;
  context: string;
  filePath: string;
  lineNumber: number;
  category: 'ui_label' | 'variable_name' | 'comment' | 'database_field';
  replacementSuggestion?: string;
  isCritical: boolean;
}

interface BrandingDiscovery {
  elementType: string;
  currentValue: string;
  codeLocations: CodeLocation[];
  isCustomizable: boolean;
}

interface IntegrationDiscovery {
  name: string;
  type: string;
  isRequired: boolean;
  configKeys: string[];
}

interface ScanStatistics {
  totalFilesScanned: number;
  totalLinesScanned: number;
  golfSpecificCount: number;
  transferableCount: number;
  durationMs: number;
}

export class WhiteLabelScanner {
  private readonly projectRoot: string;
  private readonly golfTerms = [
    // UI Terms
    { term: 'bay', suggestion: 'station', category: 'ui_label' },
    { term: 'simulator', suggestion: 'equipment', category: 'ui_label' },
    { term: 'golf', suggestion: '', category: 'ui_label' },
    { term: 'clubhouse', suggestion: 'facility', category: 'ui_label' },
    { term: 'trackman', suggestion: 'tracking system', category: 'ui_label' },
    { term: 'tee', suggestion: 'start position', category: 'ui_label' },
    { term: 'hole', suggestion: 'target', category: 'ui_label' },
    { term: 'round', suggestion: 'session', category: 'ui_label' },
    { term: 'scorecard', suggestion: 'results', category: 'ui_label' },
    { term: 'handicap', suggestion: 'rating', category: 'ui_label' },
    { term: 'pro shop', suggestion: 'shop', category: 'ui_label' },
    { term: 'driving range', suggestion: 'practice area', category: 'ui_label' },
    { term: 'putting', suggestion: 'precision practice', category: 'ui_label' },
    { term: 'club', suggestion: 'equipment', category: 'ui_label' },
    { term: 'fairway', suggestion: 'zone', category: 'ui_label' },
    { term: 'birdie', suggestion: 'achievement', category: 'ui_label' },
    { term: 'par', suggestion: 'target score', category: 'ui_label' },
    { term: 'eagle', suggestion: 'bonus achievement', category: 'ui_label' },
    { term: 'bogey', suggestion: 'penalty', category: 'ui_label' },

    // Variable/Database names
    { term: 'bay_number', suggestion: 'station_number', category: 'variable_name' },
    { term: 'simulator_id', suggestion: 'equipment_id', category: 'variable_name' },
    { term: 'golf_', suggestion: '', category: 'variable_name' },
    { term: '_golf', suggestion: '', category: 'variable_name' },
    { term: 'trackman_', suggestion: 'tracking_', category: 'variable_name' },
    { term: 'course_', suggestion: 'venue_', category: 'variable_name' },
    { term: 'hole_', suggestion: 'target_', category: 'variable_name' },
  ];

  private readonly excludePaths = [
    'node_modules',
    '.git',
    'dist',
    'build',
    '.next',
    'coverage',
    '.env',
    '*.log',
    '*.map'
  ];

  private readonly includeExtensions = [
    '.ts', '.tsx', '.js', '.jsx',
    '.json', '.sql', '.md',
    '.css', '.scss', '.html'
  ];

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  async scanProject(scanType: 'full' | 'partial' | 'golf_terms' | 'dependencies' = 'full'): Promise<ScanResult> {
    const startTime = Date.now();
    logger.info('Starting white label scan', { scanType, projectRoot: this.projectRoot });

    const result: ScanResult = {
      features: [],
      golfTerms: [],
      branding: [],
      integrations: [],
      statistics: {
        totalFilesScanned: 0,
        totalLinesScanned: 0,
        golfSpecificCount: 0,
        transferableCount: 0,
        durationMs: 0
      }
    };

    try {
      // Scan for different aspects based on scan type
      if (scanType === 'full' || scanType === 'golf_terms') {
        await this.scanForGolfTerms(result);
      }

      if (scanType === 'full' || scanType === 'dependencies') {
        await this.scanForFeatures(result);
        await this.scanForBranding(result);
        await this.scanForIntegrations(result);
      }

      // Calculate statistics
      result.statistics.durationMs = Date.now() - startTime;

      // Save scan results to database
      await this.saveScanResults(result, scanType);

      logger.info('White label scan completed', {
        scanType,
        duration: result.statistics.durationMs,
        filesScanned: result.statistics.totalFilesScanned,
        golfTermsFound: result.golfTerms.length
      });

    } catch (error) {
      logger.error('White label scan failed', error);
      throw error;
    }

    return result;
  }

  private async scanForGolfTerms(result: ScanResult): Promise<void> {
    const files = await this.getProjectFiles();

    for (const filePath of files) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.split('\n');
        result.statistics.totalFilesScanned++;
        result.statistics.totalLinesScanned += lines.length;

        lines.forEach((line, lineNumber) => {
          // Check for golf terms
          for (const golfTerm of this.golfTerms) {
            const regex = new RegExp(`\\b${golfTerm.term}\\b`, 'gi');
            const matches = line.match(regex);

            if (matches) {
              // Determine if it's critical (in user-facing text)
              const isCritical = this.isUserFacingText(line, filePath);

              result.golfTerms.push({
                term: golfTerm.term,
                context: line.trim(),
                filePath: path.relative(this.projectRoot, filePath),
                lineNumber: lineNumber + 1,
                category: golfTerm.category as any,
                replacementSuggestion: golfTerm.suggestion,
                isCritical
              });

              if (!this.isTransferable(line)) {
                result.statistics.golfSpecificCount++;
              }
            }
          }
        });
      } catch (error) {
        logger.warn(`Failed to scan file: ${filePath}`, error);
      }
    }
  }

  private async scanForFeatures(result: ScanResult): Promise<void> {
    // Scan for React components and features
    const componentFiles = await this.getProjectFiles('.tsx', '.jsx');

    for (const filePath of componentFiles) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');

        // Look for React components
        const componentMatches = content.match(/export\s+(const|function|class)\s+(\w+)/g);
        if (componentMatches) {
          for (const match of componentMatches) {
            const componentName = match.split(/\s+/).pop() || '';

            // Analyze if component is golf-specific
            const isGolfSpecific = this.containsGolfTerms(content);
            const dependencies = await this.findDependencies(content);
            const configKeys = this.findConfigKeys(content);

            result.features.push({
              name: componentName,
              category: this.categorizeFeature(componentName, filePath),
              isTransferable: !isGolfSpecific,
              dependencies,
              codeLocations: [{
                filePath: path.relative(this.projectRoot, filePath),
                lineNumbers: [1] // Would need more sophisticated parsing for exact lines
              }],
              configKeys
            });
          }
        }
      } catch (error) {
        logger.warn(`Failed to scan component file: ${filePath}`, error);
      }
    }
  }

  private async scanForBranding(result: ScanResult): Promise<void> {
    // Scan for branding elements
    const brandingPatterns = [
      { pattern: /ClubOS/gi, type: 'app_name' },
      { pattern: /Clubhouse 24\/7/gi, type: 'company_name' },
      { pattern: /#0B3D3A/gi, type: 'primary_color' },
      { pattern: /logo\.(png|svg|jpg)/gi, type: 'logo' },
      { pattern: /favicon/gi, type: 'favicon' }
    ];

    const files = await this.getProjectFiles();

    for (const filePath of files) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');

        for (const { pattern, type } of brandingPatterns) {
          const matches = content.match(pattern);
          if (matches) {
            result.branding.push({
              elementType: type,
              currentValue: matches[0],
              codeLocations: [{
                filePath: path.relative(this.projectRoot, filePath),
                lineNumbers: this.findLineNumbers(content, matches[0])
              }],
              isCustomizable: true
            });
          }
        }
      } catch (error) {
        logger.warn(`Failed to scan branding in file: ${filePath}`, error);
      }
    }
  }

  private async scanForIntegrations(result: ScanResult): Promise<void> {
    // Scan package.json and environment variables
    try {
      const packageJsonPath = path.join(this.projectRoot, 'ClubOSV1-backend', 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));

      // Key integrations to look for
      const integrationPatterns = {
        'OpenAI': { type: 'AI', required: true },
        'Slack': { type: 'Communication', required: false },
        'OpenPhone': { type: 'Communication', required: false },
        'NinjaOne': { type: 'Golf-Specific', required: false },
        'TrackMan': { type: 'Golf-Specific', required: false },
        'HubSpot': { type: 'CRM', required: false },
        'Sentry': { type: 'Monitoring', required: false },
        'PostgreSQL': { type: 'Database', required: true },
        'UniFi': { type: 'Golf-Specific', required: false }
      };

      // Check dependencies
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      };

      // Also scan for env variable references
      const envFiles = await this.getProjectFiles('.env.example', '.env.production.example');
      const envVars = new Set<string>();

      for (const envFile of envFiles) {
        const content = await fs.readFile(envFile, 'utf-8');
        const varMatches = content.match(/^([A-Z_]+)=/gm);
        if (varMatches) {
          varMatches.forEach(match => {
            const varName = match.split('=')[0];
            envVars.add(varName);
          });
        }
      }

      // Map integrations
      for (const [name, config] of Object.entries(integrationPatterns)) {
        const configKeys = Array.from(envVars).filter(v =>
          v.toLowerCase().includes(name.toLowerCase().replace(' ', '_'))
        );

        if (configKeys.length > 0 || name.toLowerCase() === 'postgresql') {
          result.integrations.push({
            name,
            type: config.type,
            isRequired: config.required,
            configKeys
          });
        }
      }
    } catch (error) {
      logger.warn('Failed to scan integrations', error);
    }
  }

  private async getProjectFiles(extension?: string, secondaryExtension?: string): Promise<string[]> {
    const files: string[] = [];

    async function walk(dir: string) {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          // Skip excluded paths
          if (this.excludePaths.some(exclude =>
            entry.name.includes(exclude) || fullPath.includes(exclude)
          )) {
            continue;
          }

          if (entry.isDirectory()) {
            await walk.call(this, fullPath);
          } else if (entry.isFile()) {
            if (extension && secondaryExtension) {
              if (fullPath.endsWith(extension) || fullPath.endsWith(secondaryExtension)) {
                files.push(fullPath);
              }
            } else if (extension) {
              if (fullPath.endsWith(extension)) {
                files.push(fullPath);
              }
            } else if (this.includeExtensions.some(ext => fullPath.endsWith(ext))) {
              files.push(fullPath);
            }
          }
        }
      } catch (error) {
        logger.warn(`Failed to walk directory: ${dir}`, error);
      }
    }

    await walk.call(this, this.projectRoot);
    return files;
  }

  private isUserFacingText(line: string, filePath: string): boolean {
    // Check if the line contains user-facing text
    const userFacingPatterns = [
      /className=.*"/,
      /label[=:]\s*['"]/,
      /title[=:]\s*['"]/,
      /placeholder[=:]\s*['"]/,
      /text[=:]\s*['"]/,
      /<h[1-6]>/,
      /<p>/,
      /<span>/,
      /console\.log/,
      /alert\(/,
      /toast\(/
    ];

    return userFacingPatterns.some(pattern => pattern.test(line)) ||
           filePath.includes('.md') ||
           filePath.includes('README');
  }

  private isTransferable(content: string): boolean {
    return !this.containsGolfTerms(content);
  }

  private containsGolfTerms(content: string): boolean {
    return this.golfTerms.some(term =>
      new RegExp(`\\b${term.term}\\b`, 'gi').test(content)
    );
  }

  private async findDependencies(content: string): Promise<string[]> {
    const dependencies: string[] = [];

    // Find import statements
    const importMatches = content.match(/import\s+.*\s+from\s+['"](.+)['"]/g);
    if (importMatches) {
      importMatches.forEach(match => {
        const module = match.match(/from\s+['"](.+)['"]/)?.[1];
        if (module && !module.startsWith('.')) {
          dependencies.push(module);
        }
      });
    }

    return [...new Set(dependencies)];
  }

  private findConfigKeys(content: string): string[] {
    const configKeys: string[] = [];

    // Find environment variable references
    const envMatches = content.match(/process\.env\.([A-Z_]+)/g);
    if (envMatches) {
      envMatches.forEach(match => {
        const key = match.replace('process.env.', '');
        configKeys.push(key);
      });
    }

    return [...new Set(configKeys)];
  }

  private categorizeFeature(name: string, filePath: string): string {
    if (filePath.includes('/components/')) {
      if (filePath.includes('/customer/')) return 'Customer';
      if (filePath.includes('/operations/')) return 'Operations';
      if (filePath.includes('/analytics/')) return 'Analytics';
      if (filePath.includes('/ai/')) return 'AI';
    }

    if (name.toLowerCase().includes('golf') ||
        name.toLowerCase().includes('bay') ||
        name.toLowerCase().includes('simulator')) {
      return 'Golf-Specific';
    }

    return 'Core';
  }

  private findLineNumbers(content: string, searchTerm: string): number[] {
    const lines = content.split('\n');
    const lineNumbers: number[] = [];

    lines.forEach((line, index) => {
      if (line.includes(searchTerm)) {
        lineNumbers.push(index + 1);
      }
    });

    return lineNumbers;
  }

  private async saveScanResults(result: ScanResult, scanType: string): Promise<void> {
    try {
      // Save scan summary
      await db.query(
        `INSERT INTO white_label_scans (
          scan_type, total_files_scanned, golf_specific_found,
          transferable_found, duration_ms, results
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          scanType,
          result.statistics.totalFilesScanned,
          result.statistics.golfSpecificCount,
          result.statistics.transferableCount,
          result.statistics.durationMs,
          JSON.stringify(result)
        ]
      );

      // Save golf-specific terms
      for (const term of result.golfTerms) {
        await db.query(
          `INSERT INTO golf_specific_terms (
            term, context, file_path, line_number,
            replacement_suggestion, category, is_critical
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (term, file_path, line_number) DO NOTHING`,
          [
            term.term,
            term.context,
            term.filePath,
            term.lineNumber,
            term.replacementSuggestion,
            term.category,
            term.isCritical
          ]
        );
      }

      // Update feature inventory
      for (const feature of result.features) {
        await db.query(
          `INSERT INTO feature_inventory (
            name, category, is_transferable, dependencies,
            code_locations, config_keys, file_count, last_scanned
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
          ON CONFLICT (name) DO UPDATE SET
            dependencies = $4,
            code_locations = $5,
            config_keys = $6,
            file_count = $7,
            last_scanned = NOW()`,
          [
            feature.name,
            feature.category,
            feature.isTransferable,
            JSON.stringify(feature.dependencies),
            JSON.stringify(feature.codeLocations),
            JSON.stringify(feature.configKeys),
            feature.codeLocations.length
          ]
        );
      }

      logger.info('Scan results saved to database');
    } catch (error) {
      logger.error('Failed to save scan results', error);
      throw error;
    }
  }
}