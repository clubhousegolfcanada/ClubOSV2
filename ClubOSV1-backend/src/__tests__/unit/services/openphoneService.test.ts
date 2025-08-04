import axios from 'axios';
import { OpenPhoneService } from '../../../services/openphoneService';
import { logger } from '../../../utils/logger';
import { db } from '../../../utils/database';
import { openPhoneRateLimiter } from '../../../utils/openphone-rate-limiter';

// Mock dependencies
jest.mock('axios');
jest.mock('../../../utils/logger');
jest.mock('../../../utils/database');
jest.mock('../../../utils/openphone-rate-limiter');

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedLogger = logger as jest.Mocked<typeof logger>;
const mockedDb = db as jest.Mocked<typeof db>;

describe('OpenPhoneService', () => {
  let service: OpenPhoneService;
  let mockAxiosInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock axios instance
    mockAxiosInstance = {
      get: jest.fn(),
      post: jest.fn(),
      patch: jest.fn()
    };
    
    mockedAxios.create.mockReturnValue(mockAxiosInstance);
    
    // Mock rate limiter to execute function immediately
    (openPhoneRateLimiter.execute as jest.Mock) = jest.fn().mockImplementation((fn) => fn());
    
    // Mock database query
    mockedDb.query = jest.fn();
  });

  describe('constructor', () => {
    it('should initialize with config', () => {
      service = new OpenPhoneService({
        apiKey: 'test-api-key',
        apiUrl: 'https://test.api.com'
      });

      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'https://test.api.com',
        headers: {
          'Authorization': 'test-api-key',
          'Content-Type': 'application/json'
        }
      });
      expect(mockedLogger.info).toHaveBeenCalledWith('OpenPhone service initialized');
    });

    it('should initialize with environment variables', () => {
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        OPENPHONE_API_KEY: 'env-api-key',
        OPENPHONE_API_URL: 'https://env.api.com'
      };

      service = new OpenPhoneService();

      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'https://env.api.com',
        headers: {
          'Authorization': 'env-api-key',
          'Content-Type': 'application/json'
        }
      });

      process.env = originalEnv;
    });

    it('should warn when API key is not configured', () => {
      const originalEnv = process.env;
      process.env = { ...originalEnv };
      delete process.env.OPENPHONE_API_KEY;

      service = new OpenPhoneService();

      expect(mockedLogger.warn).toHaveBeenCalledWith('OpenPhone API key not configured');
      
      process.env = originalEnv;
    });
  });

  describe('fetchRecentConversations', () => {
    beforeEach(() => {
      service = new OpenPhoneService({ apiKey: 'test-key' });
    });

    it('should fetch conversations successfully', async () => {
      const mockConversations = [
        { id: '1', phoneNumber: '+1234567890', lastMessageAt: '2024-01-01' },
        { id: '2', phoneNumber: '+0987654321', lastMessageAt: '2024-01-02' }
      ];

      mockAxiosInstance.get.mockResolvedValue({
        data: { data: mockConversations }
      });

      const result = await service.fetchRecentConversations(10);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/conversations', {
        params: {
          limit: 10,
          sort: 'lastMessageAt:desc'
        }
      });
      expect(result).toEqual(mockConversations);
      expect(mockedLogger.info).toHaveBeenCalledWith('Fetching 10 recent conversations from OpenPhone');
      expect(mockedLogger.info).toHaveBeenCalledWith('Fetched 2 conversations from OpenPhone');
    });

    it('should handle API errors', async () => {
      const error = new Error('API Error');
      (error as any).response = { data: { error: 'Rate limited' } };
      
      mockAxiosInstance.get.mockRejectedValue(error);

      await expect(service.fetchRecentConversations()).rejects.toThrow('API Error');
      expect(mockedLogger.error).toHaveBeenCalledWith(
        'Failed to fetch OpenPhone conversations:',
        { error: 'Rate limited' }
      );
    });

    it('should return empty array when not configured', async () => {
      const originalEnv = process.env;
      process.env = { ...originalEnv };
      delete process.env.OPENPHONE_API_KEY;

      service = new OpenPhoneService();
      const result = await service.fetchRecentConversations();

      expect(result).toEqual([]);
      expect(mockedLogger.warn).toHaveBeenCalledWith('OpenPhone not configured, cannot fetch conversations');
      
      process.env = originalEnv;
    });
  });

  describe('fetchConversationMessages', () => {
    beforeEach(() => {
      service = new OpenPhoneService({ apiKey: 'test-key' });
    });

    it('should fetch messages successfully', async () => {
      const mockMessages = [
        { id: '1', text: 'Hello', direction: 'inbound' },
        { id: '2', text: 'Hi there', direction: 'outbound' }
      ];

      mockAxiosInstance.get.mockResolvedValue({
        data: { data: mockMessages }
      });

      const result = await service.fetchConversationMessages('conv-123');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/conversations/conv-123/messages', {
        params: {
          limit: 100,
          sort: 'createdAt:desc'
        }
      });
      expect(result).toEqual(mockMessages);
    });

    it('should return empty array when not configured', async () => {
      const originalEnv = process.env;
      process.env = { ...originalEnv };
      delete process.env.OPENPHONE_API_KEY;

      service = new OpenPhoneService();
      const result = await service.fetchConversationMessages('conv-123');

      expect(result).toEqual([]);
      
      process.env = originalEnv;
    });
  });

  describe('sendMessage', () => {
    beforeEach(() => {
      service = new OpenPhoneService({ apiKey: 'test-key' });
    });

    it('should send message successfully', async () => {
      const mockResponse = {
        id: 'msg-123',
        text: 'Test message',
        status: 'sent'
      };

      mockAxiosInstance.post.mockResolvedValue({
        data: { data: mockResponse }
      });

      const result = await service.sendMessage('+1234567890', 'Test message');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/messages', {
        to: '+1234567890',
        text: 'Test message'
      });
      expect(result).toEqual(mockResponse);
      expect(mockedLogger.info).toHaveBeenCalledWith('Sending message to +1234567890');
    });

    it('should handle send errors', async () => {
      const error = new Error('Send failed');
      mockAxiosInstance.post.mockRejectedValue(error);

      await expect(service.sendMessage('+1234567890', 'Test')).rejects.toThrow('Send failed');
      expect(mockedLogger.error).toHaveBeenCalledWith(
        'Failed to send OpenPhone message:',
        'Send failed'
      );
    });
  });

  describe('syncConversationsToDB', () => {
    beforeEach(() => {
      service = new OpenPhoneService({ apiKey: 'test-key' });
    });

    it('should sync conversations to database', async () => {
      const mockConversations = [{
        id: 'conv-123',
        phoneNumber: '+1234567890',
        messages: [
          { id: '1', text: 'Hello', direction: 'inbound', createdAt: '2024-01-01' }
        ],
        lastMessageAt: '2024-01-01',
        createdAt: '2024-01-01'
      }];

      mockAxiosInstance.get.mockResolvedValue({
        data: { data: mockConversations }
      });

      mockedDb.query.mockResolvedValue({ rows: [] });

      await service.syncConversationsToDB();

      expect(mockedDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO openphone_conversations'),
        expect.any(Array)
      );
      expect(mockedLogger.info).toHaveBeenCalledWith('Synced 1 conversations to database');
    });

    it('should handle database errors', async () => {
      const mockConversations = [{ id: 'conv-123', phoneNumber: '+1234567890' }];
      
      mockAxiosInstance.get.mockResolvedValue({
        data: { data: mockConversations }
      });

      mockedDb.query.mockRejectedValue(new Error('DB Error'));

      await expect(service.syncConversationsToDB()).rejects.toThrow('DB Error');
      expect(mockedLogger.error).toHaveBeenCalledWith(
        'Failed to sync conversations to database:',
        expect.any(Error)
      );
    });
  });

  describe('testConnection', () => {
    beforeEach(() => {
      service = new OpenPhoneService({ apiKey: 'test-key' });
    });

    it('should test connection successfully', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { data: { id: 'user-123', name: 'Test User' } }
      });

      const result = await service.testConnection();

      expect(result).toBe(true);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/users/me');
      expect(mockedLogger.info).toHaveBeenCalledWith('OpenPhone connection test successful');
    });

    it('should return false on connection failure', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('Connection failed'));

      const result = await service.testConnection();

      expect(result).toBe(false);
      expect(mockedLogger.error).toHaveBeenCalledWith(
        'OpenPhone connection test failed:',
        'Connection failed'
      );
    });

    it('should return false when not configured', async () => {
      const originalEnv = process.env;
      process.env = { ...originalEnv };
      delete process.env.OPENPHONE_API_KEY;

      service = new OpenPhoneService();
      const result = await service.testConnection();

      expect(result).toBe(false);
      
      process.env = originalEnv;
    });
  });
});