import { Router, Request, Response } from 'express';
import path from 'path';
import { authenticate, authorize } from '../middleware/auth';
import { WhiteLabelScanner } from '../services/whiteLabelScanner';
import { db } from '../utils/database';
import { logger } from '../utils/logger';

const router = Router();

// Apply auth middleware to all routes
router.use(authenticate);
router.use(authorize(['admin'])); // Only admins can use scanner

// Start a new scan
router.post('/scan', async (req: Request, res: Response) => {
  try {
    const { scanType = 'full' } = req.body;

    // Get project root (2 levels up from this file)
    const projectRoot = path.resolve(__dirname, '..', '..', '..');

    logger.info('Starting white label scan', {
      scanType,
      userId: req.user?.id,
      projectRoot
    });

    // Start scan in background (non-blocking)
    const scanner = new WhiteLabelScanner(projectRoot);

    // Return immediately and run scan async
    res.json({
      success: true,
      message: 'Scan started',
      scanType
    });

    // Run scan in background
    scanner.scanProject(scanType as any)
      .then(result => {
        logger.info('Scan completed successfully', {
          golfTermsFound: result.golfTerms.length,
          featuresFound: result.features.length
        });
      })
      .catch(error => {
        logger.error('Scan failed', error);
      });

  } catch (error: any) {
    logger.error('Failed to start scan', error);
    res.status(500).json({
      error: 'Failed to start scan',
      message: error.message
    });
  }
});

// Get scan history
router.get('/scans', async (req: Request, res: Response) => {
  try {
    const { limit = 10 } = req.query;

    const scans = await db.query(
      `SELECT id, scan_type, total_files_scanned, golf_specific_found,
              transferable_found, duration_ms, created_at
       FROM white_label_scans
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );

    res.json({
      success: true,
      scans: scans.rows
    });
  } catch (error: any) {
    logger.error('Failed to get scan history', error);
    res.status(500).json({
      error: 'Failed to get scan history',
      message: error.message
    });
  }
});

// Get scan results
router.get('/scans/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const scan = await db.query(
      'SELECT * FROM white_label_scans WHERE id = $1',
      [id]
    );

    if (scan.rows.length === 0) {
      return res.status(404).json({
        error: 'Scan not found'
      });
    }

    res.json({
      success: true,
      scan: scan.rows[0]
    });
  } catch (error: any) {
    logger.error('Failed to get scan results', error);
    res.status(500).json({
      error: 'Failed to get scan results',
      message: error.message
    });
  }
});

// Get golf-specific terms
router.get('/golf-terms', async (req: Request, res: Response) => {
  try {
    const { category, critical } = req.query;

    let query = 'SELECT * FROM golf_specific_terms WHERE 1=1';
    const params: any[] = [];

    if (category) {
      params.push(category);
      query += ` AND category = $${params.length}`;
    }

    if (critical !== undefined) {
      params.push(critical === 'true');
      query += ` AND is_critical = $${params.length}`;
    }

    query += ' ORDER BY is_critical DESC, term ASC';

    const terms = await db.query(query, params);

    // Group by file for easier viewing
    const groupedByFile: { [key: string]: any[] } = {};
    terms.rows.forEach(term => {
      if (!groupedByFile[term.file_path]) {
        groupedByFile[term.file_path] = [];
      }
      groupedByFile[term.file_path].push(term);
    });

    res.json({
      success: true,
      totalTerms: terms.rows.length,
      files: Object.keys(groupedByFile).length,
      terms: terms.rows,
      groupedByFile
    });
  } catch (error: any) {
    logger.error('Failed to get golf terms', error);
    res.status(500).json({
      error: 'Failed to get golf terms',
      message: error.message
    });
  }
});

// Get feature dependencies
router.get('/dependencies', async (req: Request, res: Response) => {
  try {
    const features = await db.query(
      `SELECT name, category, is_transferable, dependencies,
              code_locations, config_keys, file_count
       FROM feature_inventory
       WHERE dependencies IS NOT NULL AND dependencies != '[]'::jsonb
       ORDER BY file_count DESC`
    );

    // Build dependency graph
    const dependencyGraph: { [key: string]: string[] } = {};
    features.rows.forEach(feature => {
      dependencyGraph[feature.name] = feature.dependencies || [];
    });

    res.json({
      success: true,
      features: features.rows,
      dependencyGraph
    });
  } catch (error: any) {
    logger.error('Failed to get dependencies', error);
    res.status(500).json({
      error: 'Failed to get dependencies',
      message: error.message
    });
  }
});

// Get branding locations
router.get('/branding-locations', async (req: Request, res: Response) => {
  try {
    const branding = await db.query(
      `SELECT element_type, current_value, code_locations, file_count
       FROM branding_inventory
       WHERE code_locations IS NOT NULL AND code_locations != '[]'::jsonb
       ORDER BY file_count DESC`
    );

    res.json({
      success: true,
      brandingElements: branding.rows
    });
  } catch (error: any) {
    logger.error('Failed to get branding locations', error);
    res.status(500).json({
      error: 'Failed to get branding locations',
      message: error.message
    });
  }
});

// Generate replacement suggestions
router.post('/generate-replacements', async (req: Request, res: Response) => {
  try {
    const { industry = 'generic', businessType = 'service' } = req.body;

    // Get all golf terms
    const terms = await db.query(
      'SELECT DISTINCT term, replacement_suggestion, category FROM golf_specific_terms'
    );

    // Generate industry-specific replacements
    const replacements: { [key: string]: string } = {};

    terms.rows.forEach(term => {
      let replacement = term.replacement_suggestion || '';

      // Customize based on industry
      if (industry === 'fitness') {
        if (term.term === 'bay') replacement = 'workout station';
        if (term.term === 'simulator') replacement = 'equipment';
        if (term.term === 'round') replacement = 'session';
        if (term.term === 'clubhouse') replacement = 'gym';
      } else if (industry === 'gaming') {
        if (term.term === 'bay') replacement = 'gaming pod';
        if (term.term === 'simulator') replacement = 'console';
        if (term.term === 'round') replacement = 'match';
        if (term.term === 'clubhouse') replacement = 'arena';
      } else if (industry === 'education') {
        if (term.term === 'bay') replacement = 'learning station';
        if (term.term === 'simulator') replacement = 'training module';
        if (term.term === 'round') replacement = 'lesson';
        if (term.term === 'clubhouse') replacement = 'campus';
      }

      replacements[term.term] = replacement;
    });

    res.json({
      success: true,
      industry,
      businessType,
      replacements,
      totalTerms: Object.keys(replacements).length
    });
  } catch (error: any) {
    logger.error('Failed to generate replacements', error);
    res.status(500).json({
      error: 'Failed to generate replacements',
      message: error.message
    });
  }
});

export default router;