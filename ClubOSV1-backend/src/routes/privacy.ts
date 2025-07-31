import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';
import { validate } from '../middleware/validation';
import { body, param } from 'express-validator';
import { logger } from '../utils/logger';
import { db } from '../utils/database';
import { dataPrivacyService } from '../services/dataPrivacyService';
import { formatToE164, isValidE164 } from '../utils/phoneNumberFormatter';
import { anonymizePhoneNumber } from '../utils/encryption';

const router = Router();

// Export user data (GDPR data portability)
router.post('/export/:phoneNumber',
  authenticate,
  roleGuard(['admin']),
  validate([
    param('phoneNumber').notEmpty().withMessage('Phone number is required')
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { phoneNumber } = req.params;
      
      // Format and validate phone number
      const formattedPhone = formatToE164(phoneNumber);
      if (!formattedPhone || !isValidE164(formattedPhone)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid phone number format'
        });
      }
      
      logger.info('Data export requested', {
        phoneNumber: anonymizePhoneNumber(formattedPhone),
        requestedBy: req.user!.id
      });
      
      const data = await dataPrivacyService.exportUserData(formattedPhone, req.user!.id);
      
      // Set headers for file download
      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition', 
        `attachment; filename="user-data-${anonymizePhoneNumber(formattedPhone)}-${Date.now()}.json"`
      );
      
      res.json({
        success: true,
        data,
        metadata: {
          exportDate: new Date().toISOString(),
          exportedBy: req.user!.id,
          phoneNumber: anonymizePhoneNumber(formattedPhone)
        }
      });
    } catch (error) {
      logger.error('Failed to export user data:', error);
      next(error);
    }
  }
);

// Delete user data (GDPR right to erasure)
router.delete('/delete/:phoneNumber',
  authenticate,
  roleGuard(['admin']),
  validate([
    param('phoneNumber').notEmpty().withMessage('Phone number is required'),
    body('hardDelete').optional().isBoolean().withMessage('hardDelete must be boolean'),
    body('reason').notEmpty().withMessage('Deletion reason is required')
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { phoneNumber } = req.params;
      const { hardDelete = false, reason } = req.body;
      
      // Format and validate phone number
      const formattedPhone = formatToE164(phoneNumber);
      if (!formattedPhone || !isValidE164(formattedPhone)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid phone number format'
        });
      }
      
      logger.info('Data deletion requested', {
        phoneNumber: anonymizePhoneNumber(formattedPhone),
        requestedBy: req.user!.id,
        hardDelete,
        reason
      });
      
      const results = await dataPrivacyService.deleteUserData(
        formattedPhone, 
        req.user!.id, 
        hardDelete
      );
      
      res.json({
        success: true,
        data: {
          ...results,
          phoneNumber: anonymizePhoneNumber(formattedPhone),
          deletionType: hardDelete ? 'hard_delete' : 'anonymization',
          deletedBy: req.user!.id,
          deletedAt: new Date().toISOString(),
          reason
        }
      });
    } catch (error) {
      logger.error('Failed to delete user data:', error);
      next(error);
    }
  }
);

// Apply retention policies manually
router.post('/retention/apply',
  authenticate,
  roleGuard(['admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      logger.info('Manual retention policy application requested', {
        requestedBy: req.user!.id
      });
      
      const results = await dataPrivacyService.applyRetentionPolicies();
      
      res.json({
        success: true,
        data: results,
        metadata: {
          appliedBy: req.user!.id,
          appliedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Failed to apply retention policies:', error);
      next(error);
    }
  }
);

// Get retention report
router.get('/retention/report',
  authenticate,
  roleGuard(['admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const report = await dataPrivacyService.getRetentionReport();
      
      res.json({
        success: true,
        data: report,
        metadata: {
          generatedAt: new Date().toISOString(),
          generatedBy: req.user!.id
        }
      });
    } catch (error) {
      logger.error('Failed to generate retention report:', error);
      next(error);
    }
  }
);

// Privacy policy compliance check
router.get('/compliance-check',
  authenticate,
  roleGuard(['admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const checks = {
        encryptionEnabled: !!process.env.ENCRYPTION_KEY,
        retentionPoliciesActive: true,
        dataExportAvailable: true,
        dataErasureAvailable: true,
        auditLoggingActive: true,
        lastRetentionRun: null, // TODO: Track last run
        recommendations: [] as string[]
      };
      
      // Add recommendations
      if (!process.env.ENCRYPTION_KEY) {
        checks.recommendations.push('Enable encryption by setting ENCRYPTION_KEY environment variable');
      }
      
      if (!process.env.OPENPHONE_WEBHOOK_SECRET) {
        checks.recommendations.push('Set up webhook signature verification for OpenPhone');
      }
      
      // Check for old data
      const report = await dataPrivacyService.getRetentionReport();
      for (const [table, data] of Object.entries(report.currentData)) {
        if ((data as any).expiredRecords > 0) {
          checks.recommendations.push(
            `Apply retention policy for ${table}: ${(data as any).expiredRecords} expired records found`
          );
        }
      }
      
      res.json({
        success: true,
        data: checks
      });
    } catch (error) {
      logger.error('Failed to run compliance check:', error);
      next(error);
    }
  }
);

// Consent management endpoint
router.post('/consent/:phoneNumber',
  authenticate,
  roleGuard(['admin', 'operator']),
  validate([
    param('phoneNumber').notEmpty().withMessage('Phone number is required'),
    body('consentType').isIn(['marketing', 'analytics', 'ai_assistance']).withMessage('Invalid consent type'),
    body('granted').isBoolean().withMessage('granted must be boolean')
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { phoneNumber } = req.params;
      const { consentType, granted } = req.body;
      
      // Format phone number
      const formattedPhone = formatToE164(phoneNumber);
      if (!formattedPhone || !isValidE164(formattedPhone)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid phone number format'
        });
      }
      
      // Store consent (create table if needed)
      await db.query(`
        CREATE TABLE IF NOT EXISTS user_consents (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          phone_number_hash VARCHAR(64) NOT NULL,
          consent_type VARCHAR(50) NOT NULL,
          granted BOOLEAN NOT NULL,
          granted_by UUID REFERENCES users(id),
          granted_at TIMESTAMP DEFAULT NOW(),
          ip_address VARCHAR(45),
          UNIQUE(phone_number_hash, consent_type)
        )
      `);
      
      const phoneHash = require('crypto').createHash('sha256').update(formattedPhone).digest('hex');
      
      await db.query(`
        INSERT INTO user_consents (phone_number_hash, consent_type, granted, granted_by, ip_address)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (phone_number_hash, consent_type) 
        DO UPDATE SET 
          granted = EXCLUDED.granted,
          granted_by = EXCLUDED.granted_by,
          granted_at = NOW(),
          ip_address = EXCLUDED.ip_address
      `, [phoneHash, consentType, granted, req.user!.id, req.ip]);
      
      logger.info('Consent updated', {
        phoneNumber: anonymizePhoneNumber(formattedPhone),
        consentType,
        granted,
        updatedBy: req.user!.id
      });
      
      res.json({
        success: true,
        data: {
          phoneNumber: anonymizePhoneNumber(formattedPhone),
          consentType,
          granted,
          updatedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Failed to update consent:', error);
      next(error);
    }
  }
);

export default router;