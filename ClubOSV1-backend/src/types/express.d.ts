import { RateLimitInfo } from 'express-rate-limit';

declare global {
  namespace Express {
    interface Request {
      rateLimit?: RateLimitInfo;
      rawBody?: Buffer;
      user?: {
        id: string;
        email: string;
        role: 'admin' | 'operator' | 'support' | 'kiosk';
      };
    }
  }
}

export {};