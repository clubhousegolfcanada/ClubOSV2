import { Router, Request, Response } from 'express';
import { generateCSRFToken, getSessionId } from '../utils/csrf';

const router = Router();

// Endpoint to get CSRF token
router.get('/csrf-token', (req: Request, res: Response) => {
  const sessionId = getSessionId(req);
  const token = generateCSRFToken(sessionId);
  
  // Set token in cookie and header
  res.cookie('csrf-token', token, {
    httpOnly: false, // Allow JavaScript to read
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 3600000 // 1 hour
  });
  
  res.json({ csrfToken: token });
});

export default router;