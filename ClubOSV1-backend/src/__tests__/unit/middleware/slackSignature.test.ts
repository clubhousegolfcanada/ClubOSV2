import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { verifySlackSignature } from '../../../middleware/slackSignature';
import { config } from '../../../utils/envValidator';

// Mock the config
jest.mock('../../../utils/envValidator', () => ({
  config: {
    SLACK_SIGNING_SECRET: 'test_slack_signing_secret'
  }
}));

// Mock logger
jest.mock('../../../utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn()
  }
}));

describe('Slack Signature Verification Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      headers: {},
      body: undefined
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Missing Requirements', () => {
    it('should return 403 if signing secret is not configured', async () => {
      // Override config
      (config as any).SLACK_SIGNING_SECRET = undefined;

      await verifySlackSignature(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Slack verification not configured'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 if signature header is missing', async () => {
      (config as any).SLACK_SIGNING_SECRET = 'test_secret';
      mockReq.headers = {
        'x-slack-request-timestamp': '1234567890'
      };

      await verifySlackSignature(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Missing Slack signature'
      });
    });

    it('should return 403 if timestamp header is missing', async () => {
      (config as any).SLACK_SIGNING_SECRET = 'test_secret';
      mockReq.headers = {
        'x-slack-signature': 'v0=signature'
      };

      await verifySlackSignature(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Missing Slack signature'
      });
    });
  });

  describe('Timestamp Validation', () => {
    it('should reject requests older than 5 minutes', async () => {
      (config as any).SLACK_SIGNING_SECRET = 'test_secret';
      const oldTimestamp = Math.floor(Date.now() / 1000) - 400; // 6+ minutes ago

      mockReq.headers = {
        'x-slack-signature': 'v0=signature',
        'x-slack-request-timestamp': oldTimestamp.toString()
      };
      mockReq.body = Buffer.from('test body');

      await verifySlackSignature(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Request timestamp expired'
      });
    });

    it('should accept requests within 5 minutes', async () => {
      (config as any).SLACK_SIGNING_SECRET = 'test_secret';
      const recentTimestamp = Math.floor(Date.now() / 1000) - 100; // ~1.5 minutes ago
      const body = 'test body';
      const bodyBuffer = Buffer.from(body);

      // Generate valid signature
      const sigBasestring = 'v0:' + recentTimestamp + ':' + body;
      const signature = 'v0=' + crypto
        .createHmac('sha256', 'test_secret')
        .update(sigBasestring, 'utf8')
        .digest('hex');

      mockReq.headers = {
        'x-slack-signature': signature,
        'x-slack-request-timestamp': recentTimestamp.toString()
      };
      mockReq.body = bodyBuffer;

      await verifySlackSignature(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });

  describe('Signature Verification', () => {
    it('should reject invalid signatures', async () => {
      (config as any).SLACK_SIGNING_SECRET = 'test_secret';
      const timestamp = Math.floor(Date.now() / 1000);

      mockReq.headers = {
        'x-slack-signature': 'v0=invalid_signature',
        'x-slack-request-timestamp': timestamp.toString()
      };
      mockReq.body = Buffer.from('test body');

      await verifySlackSignature(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Invalid Slack signature'
      });
    });

    it('should accept valid signatures', async () => {
      (config as any).SLACK_SIGNING_SECRET = 'test_secret';
      const timestamp = Math.floor(Date.now() / 1000);
      const body = JSON.stringify({ text: 'hello', user: 'test' });
      const bodyBuffer = Buffer.from(body);

      // Generate valid signature
      const sigBasestring = 'v0:' + timestamp + ':' + body;
      const signature = 'v0=' + crypto
        .createHmac('sha256', 'test_secret')
        .update(sigBasestring, 'utf8')
        .digest('hex');

      mockReq.headers = {
        'x-slack-signature': signature,
        'x-slack-request-timestamp': timestamp.toString()
      };
      mockReq.body = bodyBuffer;

      await verifySlackSignature(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should handle empty body', async () => {
      (config as any).SLACK_SIGNING_SECRET = 'test_secret';
      const timestamp = Math.floor(Date.now() / 1000);
      const body = '';
      const bodyBuffer = Buffer.from(body);

      // Generate valid signature for empty body
      const sigBasestring = 'v0:' + timestamp + ':' + body;
      const signature = 'v0=' + crypto
        .createHmac('sha256', 'test_secret')
        .update(sigBasestring, 'utf8')
        .digest('hex');

      mockReq.headers = {
        'x-slack-signature': signature,
        'x-slack-request-timestamp': timestamp.toString()
      };
      mockReq.body = bodyBuffer;

      await verifySlackSignature(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Body Parsing', () => {
    it('should parse JSON body after verification', async () => {
      (config as any).SLACK_SIGNING_SECRET = 'test_secret';
      const timestamp = Math.floor(Date.now() / 1000);
      const bodyObj = { text: 'hello', user: 'test' };
      const body = JSON.stringify(bodyObj);
      const bodyBuffer = Buffer.from(body);

      // Generate valid signature
      const sigBasestring = 'v0:' + timestamp + ':' + body;
      const signature = 'v0=' + crypto
        .createHmac('sha256', 'test_secret')
        .update(sigBasestring, 'utf8')
        .digest('hex');

      mockReq.headers = {
        'x-slack-signature': signature,
        'x-slack-request-timestamp': timestamp.toString()
      };
      mockReq.body = bodyBuffer;

      await verifySlackSignature(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.body).toEqual(bodyObj);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle invalid JSON gracefully', async () => {
      (config as any).SLACK_SIGNING_SECRET = 'test_secret';
      const timestamp = Math.floor(Date.now() / 1000);
      const body = 'not valid json';
      const bodyBuffer = Buffer.from(body);

      // Generate valid signature
      const sigBasestring = 'v0:' + timestamp + ':' + body;
      const signature = 'v0=' + crypto
        .createHmac('sha256', 'test_secret')
        .update(sigBasestring, 'utf8')
        .digest('hex');

      mockReq.headers = {
        'x-slack-signature': signature,
        'x-slack-request-timestamp': timestamp.toString()
      };
      mockReq.body = bodyBuffer;

      await verifySlackSignature(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.body).toBe(body); // Should remain as string
      expect(mockNext).toHaveBeenCalled();
    });
  });
});
