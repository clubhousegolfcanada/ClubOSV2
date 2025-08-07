import axios from 'axios';
import { HubSpotService } from '../../../services/hubspotService';
import { logger } from '../../../utils/logger';
import { db } from '../../../utils/database';

// Mock dependencies
jest.mock('axios');
jest.mock('../../../utils/logger');
jest.mock('../../../utils/database');

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedLogger = logger as jest.Mocked<typeof logger>;
const mockedDb = db as jest.Mocked<typeof db>;

describe('HubSpotService', () => {
  let hubspotService: HubSpotService;
  let mockAxiosInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock axios instance
    mockAxiosInstance = {
      get: jest.fn(),
      post: jest.fn()
    };
    
    (axios.create as jest.Mock) = jest.fn().mockReturnValue(mockAxiosInstance);
    
    // Set environment variable
    process.env.HUBSPOT_API_KEY = 'test-api-key';
    
    // Mock database functions
    mockedDb.getCachedHubspotContact = jest.fn();
    mockedDb.setCachedHubspotContact = jest.fn();
  });

  afterEach(() => {
    delete process.env.HUBSPOT_API_KEY;
  });

  describe('verifyConnection', () => {
    it('should verify connection successfully', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { results: [] }
      });

      hubspotService = new HubSpotService();
      await new Promise(resolve => setTimeout(resolve, 10)); // Wait for constructor async call

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/objects/contacts', {
        params: { limit: 1 }
      });
      expect(mockedLogger.info).toHaveBeenCalledWith('✓ HubSpot connected successfully');
    });

    it('should handle invalid API key', async () => {
      mockAxiosInstance.get.mockRejectedValue({
        response: { status: 401 }
      });

      hubspotService = new HubSpotService();
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockedLogger.error).toHaveBeenCalledWith('❌ HubSpot connection failed - Invalid API key');
    });

    it('should handle missing scopes', async () => {
      mockAxiosInstance.get.mockRejectedValue({
        response: { status: 403 }
      });

      hubspotService = new HubSpotService();
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockedLogger.error).toHaveBeenCalledWith(
        '❌ HubSpot connection failed - Missing required scopes (needs crm.objects.contacts.read)'
      );
    });

    it('should skip connection when API key not configured', async () => {
      delete process.env.HUBSPOT_API_KEY;

      hubspotService = new HubSpotService();
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockAxiosInstance.get).not.toHaveBeenCalled();
      expect(mockedLogger.warn).toHaveBeenCalledWith('HubSpot API key not configured');
    });
  });

  describe('searchByPhone', () => {
    beforeEach(() => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { results: [] }
      });
      hubspotService = new HubSpotService();
    });

    it('should find contact by phone number', async () => {
      const mockContact = {
        id: 'contact-123',
        properties: {
          firstname: 'John',
          lastname: 'Doe',
          phone: '(902) 555-1234',
          company: 'Test Company',
          email: 'john@example.com',
          hs_object_id: 'hs-123'
        }
      };

      // Mock cache miss
      mockedDb.getCachedHubspotContact.mockResolvedValue(null);
      
      // Mock API response
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          results: [mockContact]
        }
      });

      const result = await hubspotService.searchByPhone('9025551234');

      expect(result).toEqual({
        id: 'contact-123',
        name: 'John Doe',
        phone: '(902) 555-1234',
        company: 'Test Company',
        email: 'john@example.com',
        hubspotId: 'hs-123'
      });

      expect(mockedDb.setCachedHubspotContact).toHaveBeenCalled();
    });

    it('should return cached contact if available', async () => {
      const cachedContact = {
        id: 'cached-123',
        name: 'Cached User',
        phone: '9025551234',
        company: 'Cached Company'
      };

      mockedDb.getCachedHubspotContact.mockResolvedValue({
        contact_data: cachedContact,
        cached_at: new Date()
      });

      const result = await hubspotService.searchByPhone('9025551234');

      expect(result).toEqual(cachedContact);
      expect(mockAxiosInstance.post).not.toHaveBeenCalled();
    });

    it('should normalize phone numbers correctly', async () => {
      mockedDb.getCachedHubspotContact.mockResolvedValue(null);
      mockAxiosInstance.post.mockResolvedValue({
        data: { results: [] }
      });

      // Test various phone formats
      const phoneFormats = [
        '(902) 555-1234',
        '902-555-1234',
        '+19025551234',
        '9025551234',
        '1-902-555-1234'
      ];

      for (const phone of phoneFormats) {
        await hubspotService.searchByPhone(phone);
      }

      // All should normalize to same number
      const calls = mockAxiosInstance.post.mock.calls;
      calls.forEach(call => {
        const filterGroups = call[1].filterGroups[0].filters;
        expect(filterGroups.some((f: any) => 
          f.value === '9025551234' || 
          f.value === '902-555-1234' || 
          f.value === '(902) 555-1234'
        )).toBe(true);
      });
    });

    it('should handle API errors gracefully', async () => {
      mockedDb.getCachedHubspotContact.mockResolvedValue(null);
      mockAxiosInstance.post.mockRejectedValue(new Error('API Error'));

      const result = await hubspotService.searchByPhone('9025551234');

      expect(result).toBeNull();
      expect(mockedLogger.error).toHaveBeenCalledWith(
        'HubSpot search error:',
        expect.any(Error)
      );
    });

    it('should skip search when not connected', async () => {
      // Simulate connection failure
      mockAxiosInstance.get.mockRejectedValue(new Error('Connection failed'));
      hubspotService = new HubSpotService();
      await new Promise(resolve => setTimeout(resolve, 10));

      const result = await hubspotService.searchByPhone('9025551234');

      expect(result).toBeNull();
      expect(mockAxiosInstance.post).not.toHaveBeenCalled();
      expect(mockedLogger.debug).toHaveBeenCalledWith('HubSpot not connected, skipping lookup');
    });
  });

  describe('createContact', () => {
    beforeEach(() => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { results: [] }
      });
      hubspotService = new HubSpotService();
    });

    it('should create new contact', async () => {
      const newContact = {
        id: 'new-contact-123',
        properties: {
          firstname: 'New',
          lastname: 'User',
          phone: '9025556789',
          hs_object_id: 'hs-new-123'
        }
      };

      mockAxiosInstance.post.mockResolvedValue({
        data: newContact
      });

      const result = await hubspotService.createContact({
        firstname: 'New',
        lastname: 'User',
        phone: '9025556789'
      });

      expect(result).toEqual({
        id: 'new-contact-123',
        name: 'New User',
        phone: '9025556789',
        hubspotId: 'hs-new-123'
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/objects/contacts', {
        properties: {
          firstname: 'New',
          lastname: 'User',
          phone: '9025556789'
        }
      });
    });

    it('should handle creation errors', async () => {
      mockAxiosInstance.post.mockRejectedValue({
        response: {
          status: 409,
          data: { message: 'Contact already exists' }
        }
      });

      const result = await hubspotService.createContact({
        firstname: 'Existing',
        lastname: 'User',
        phone: '9025551234'
      });

      expect(result).toBeNull();
      expect(mockedLogger.error).toHaveBeenCalled();
    });
  });

  describe('getConnectionStatus', () => {
    it('should return connection status', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { results: [] }
      });

      hubspotService = new HubSpotService();
      await new Promise(resolve => setTimeout(resolve, 10));

      const status = hubspotService.getConnectionStatus();
      
      expect(status).toEqual({
        connected: true,
        hasApiKey: true
      });
    });

    it('should return disconnected status when no API key', () => {
      delete process.env.HUBSPOT_API_KEY;
      hubspotService = new HubSpotService();

      const status = hubspotService.getConnectionStatus();
      
      expect(status).toEqual({
        connected: false,
        hasApiKey: false
      });
    });
  });
});