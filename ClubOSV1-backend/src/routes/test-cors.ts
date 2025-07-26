import { Router, Request, Response } from 'express';

const router = Router();

// Simple endpoint that should always work
router.get('/test', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'CORS test successful',
    timestamp: new Date().toISOString(),
    headers: {
      origin: req.get('origin'),
      'access-control-request-method': req.get('access-control-request-method'),
      'access-control-request-headers': req.get('access-control-request-headers')
    }
  });
});

// POST endpoint to test CORS with body
router.post('/test', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'POST CORS test successful',
    body: req.body,
    timestamp: new Date().toISOString()
  });
});

export default router;