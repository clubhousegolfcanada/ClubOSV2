import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { config } from '../utils/envValidator';

interface SlackRequest extends Request {
  rawBody?: Buffer;
}

// Extend Express Request to include rawBody
declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
    }
  }
}

/**
 * Middleware to capture raw body for Slack signature verification
 */
export const captureRawBody = (req: Request, res: Response, buf: Buffer, encoding: string) => {
  if (buf && buf.length) {
    req.rawBody = buf;
  }
};

/**
 * Verify Slack request signature
 * https://api.slack.com/authentication/verifying-requests-from-slack
 */
export const verifySlackSignature = (signingSecret: string) => {
  return (req: SlackRequest, res: Response, next: NextFunction) => {
    const signature = req.headers['x-slack-signature'] as string;
    const timestamp = req.headers['x-slack-request-timestamp'] as string;
    const body = req.rawBody;

    // Check if required headers are present
    if (!signature || !timestamp || !body) {
      logger.warn('Missing Slack signature headers or body', {
        hasSignature: !!signature,
        hasTimestamp: !!timestamp,
        hasBody: !!body,
        path: req.path
      });
      
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing required Slack headers'
      });
    }

    // Verify timestamp to prevent replay attacks (5 minute window)
    const time = Math.floor(Date.now() / 1000);
    const timestampInt = parseInt(timestamp);
    
    if (Math.abs(time - timestampInt) > 300) {
      logger.warn('Slack request timestamp too old', {
        currentTime: time,
        requestTime: timestampInt,
        difference: Math.abs(time - timestampInt)
      });
      
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Request timestamp too old'
      });
    }

    // Create the signature base string
    const sigBasestring = `v0:${timestamp}:${body.toString('utf8')}`;
    
    // Calculate expected signature
    const mySignature = 'v0=' + crypto
      .createHmac('sha256', signingSecret)
      .update(sigBasestring, 'utf8')
      .digest('hex');
    
    // Compare signatures using timing-safe comparison
    const signatureBuffer = Buffer.from(signature, 'utf8');
    const mySignatureBuffer = Buffer.from(mySignature, 'utf8');
    
    if (signatureBuffer.length !== mySignatureBuffer.length) {
      logger.warn('Slack signature length mismatch', {
        expected: mySignatureBuffer.length,
        received: signatureBuffer.length
      });
      
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid signature'
      });
    }
    
    if (!crypto.timingSafeEqual(signatureBuffer, mySignatureBuffer)) {
      logger.warn('Invalid Slack signature', {
        path: req.path,
        method: req.method,
        ip: req.ip
      });
      
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid signature'
      });
    }
    
    // Signature is valid
    logger.info('Slack signature verified', {
      path: req.path,
      timestamp: timestamp
    });
    
    next();
  };
};

/**
 * Optional Slack signature verification
 * Logs warning but doesn't block if signature is invalid
 */
export const optionalVerifySlackSignature = (signingSecret: string) => {
  return (req: SlackRequest, res: Response, next: NextFunction) => {
    const signature = req.headers['x-slack-signature'] as string;
    const timestamp = req.headers['x-slack-request-timestamp'] as string;
    
    if (!signature || !timestamp) {
      // No Slack headers, continue without verification
      return next();
    }
    
    // If headers are present, verify them
    const verifier = verifySlackSignature(signingSecret);
    verifier(req, res, (err?: any) => {
      if (err) {
        logger.warn('Optional Slack signature verification failed', { error: err });
      }
      // Continue regardless of verification result
      next();
    });
  };
};

/**
 * Slack event subscription URL verification
 */
export const handleSlackUrlVerification = (req: Request, res: Response, next: NextFunction) => {
  const { type, challenge } = req.body;
  
  if (type === 'url_verification') {
    logger.info('Slack URL verification challenge received', { challenge });
    return res.json({ challenge });
  }
  
  next();
};

/**
 * Get Slack signing secret from environment
 */
export const getSlackSigningSecret = (): string | null => {
  const secret = process.env.SLACK_SIGNING_SECRET;
  
  if (!secret) {
    logger.warn('SLACK_SIGNING_SECRET not configured');
    return null;
  }
  
  return secret;
};

/**
 * Apply Slack security middleware to specific routes
 */
export const applySlackSecurity = (req: Request, res: Response, next: NextFunction) => {
  const signingSecret = getSlackSigningSecret();
  
  if (!signingSecret) {
    // If no signing secret is configured, skip verification
    logger.warn('Slack signature verification skipped - no signing secret');
    return next();
  }
  
  // Apply verification
  const verifier = verifySlackSignature(signingSecret);
  verifier(req, res, next);
};
