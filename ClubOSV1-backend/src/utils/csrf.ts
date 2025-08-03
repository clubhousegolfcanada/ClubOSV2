import crypto from 'crypto';
import { Request, Response } from 'express';

// Store CSRF tokens in memory (in production, use Redis or similar)
const csrfTokens = new Map<string, { token: string; expires: number }>();

// Clean up expired tokens every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, data] of csrfTokens.entries()) {
    if (data.expires < now) {
      csrfTokens.delete(sessionId);
    }
  }
}, 5 * 60 * 1000);

export function generateCSRFToken(sessionId: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = Date.now() + 3600000; // 1 hour
  
  csrfTokens.set(sessionId, { token, expires });
  return token;
}

export function validateCSRFToken(sessionId: string, token: string): boolean {
  const storedData = csrfTokens.get(sessionId);
  
  if (!storedData) {
    return false;
  }
  
  // Check if token is expired
  if (storedData.expires < Date.now()) {
    csrfTokens.delete(sessionId);
    return false;
  }
  
  return storedData.token === token;
}

export function getSessionId(req: Request): string {
  // Use a combination of user ID and IP for session identification
  const userId = (req as any).user?.id || 'anonymous';
  const ip = req.ip || 'unknown';
  return `${userId}-${ip}`;
}

// Middleware to add CSRF token to response
export function addCSRFToken(req: Request, res: Response): void {
  const sessionId = getSessionId(req);
  const token = generateCSRFToken(sessionId);
  
  // Set token in response header and cookie
  res.setHeader('X-CSRF-Token', token);
  res.cookie('csrf-token', token, {
    httpOnly: false, // Allow JavaScript to read for inclusion in requests
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 3600000 // 1 hour
  });
}