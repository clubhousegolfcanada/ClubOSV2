import webpush from 'web-push';
import { NotificationService } from '../../../services/notificationService';
import { logger } from '../../../utils/logger';
import { db } from '../../../utils/database';
import { config } from '../../../utils/envValidator';

// Mock dependencies
jest.mock('web-push');
jest.mock('../../../utils/logger');
jest.mock('../../../utils/database');
jest.mock('../../../utils/envValidator');

const mockedWebpush = webpush as jest.Mocked<typeof webpush>;
const mockedLogger = logger as jest.Mocked<typeof logger>;
const mockedDb = db as jest.Mocked<typeof db>;
const mockedConfig = config as jest.Mocked<typeof config>;

describe('NotificationService', () => {
  let notificationService: NotificationService;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock config with VAPID keys
    mockedConfig.VAPID_PUBLIC_KEY = 'test-public-key';
    mockedConfig.VAPID_PRIVATE_KEY = 'test-private-key';
    mockedConfig.VAPID_EMAIL = 'mailto:test@example.com';
    
    // Mock database query
    mockedDb.query = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with valid VAPID keys', () => {
      notificationService = new NotificationService();

      expect(mockedWebpush.setVapidDetails).toHaveBeenCalledWith(
        'mailto:test@example.com',
        'test-public-key',
        'test-private-key'
      );
      expect(mockedLogger.info).toHaveBeenCalledWith('Notification service initialized');
    });

    it('should warn when VAPID keys not configured', () => {
      mockedConfig.VAPID_PUBLIC_KEY = undefined;
      
      notificationService = new NotificationService();

      expect(mockedWebpush.setVapidDetails).not.toHaveBeenCalled();
      expect(mockedLogger.warn).toHaveBeenCalledWith(
        'VAPID keys not configured - push notifications disabled'
      );
    });

    it('should handle initialization errors', () => {
      mockedWebpush.setVapidDetails.mockImplementation(() => {
        throw new Error('Invalid VAPID keys');
      });

      notificationService = new NotificationService();

      expect(mockedLogger.error).toHaveBeenCalledWith(
        'Failed to initialize notification service:',
        expect.any(Error)
      );
    });
  });

  describe('sendToUser', () => {
    beforeEach(() => {
      notificationService = new NotificationService();
    });

    it('should send notification to user with active subscriptions', async () => {
      const mockSubscriptions = [
        {
          id: 'sub-1',
          user_id: 'user-123',
          endpoint: 'https://push.example.com/1',
          p256dh: 'key1',
          auth: 'auth1'
        },
        {
          id: 'sub-2',
          user_id: 'user-123',
          endpoint: 'https://push.example.com/2',
          p256dh: 'key2',
          auth: 'auth2'
        }
      ];

      // Mock preferences query
      mockedDb.query.mockResolvedValueOnce({
        rows: [{
          messages_enabled: true,
          tickets_enabled: true,
          system_enabled: true,
          quiet_hours_enabled: false
        }]
      });

      // Mock subscriptions query
      mockedDb.query.mockResolvedValueOnce({
        rows: mockSubscriptions
      });

      // Mock successful push
      mockedWebpush.sendNotification.mockResolvedValue({} as any);

      await notificationService.sendToUser('user-123', {
        title: 'Test Notification',
        body: 'Test message body',
        data: { type: 'messages' }
      });

      expect(mockedWebpush.sendNotification).toHaveBeenCalledTimes(2);
      expect(mockedLogger.info).toHaveBeenCalledWith(
        'Sent notification to 2 devices for user user-123'
      );
    });

    it('should respect notification preferences', async () => {
      // User has messages disabled
      mockedDb.query.mockResolvedValueOnce({
        rows: [{
          messages_enabled: false,
          tickets_enabled: true,
          system_enabled: true,
          quiet_hours_enabled: false
        }]
      });

      await notificationService.sendToUser('user-123', {
        title: 'New Message',
        body: 'You have a new message',
        data: { type: 'messages' }
      });

      expect(mockedWebpush.sendNotification).not.toHaveBeenCalled();
    });

    it('should respect quiet hours', async () => {
      // Mock current time to be within quiet hours
      const mockDate = new Date('2025-01-01T22:30:00'); // 10:30 PM
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

      mockedDb.query.mockResolvedValueOnce({
        rows: [{
          messages_enabled: true,
          quiet_hours_enabled: true,
          quiet_hours_start: '22:00',
          quiet_hours_end: '08:00'
        }]
      });

      await notificationService.sendToUser('user-123', {
        title: 'Late Night Message',
        body: 'This should be blocked',
        data: { type: 'messages' }
      });

      expect(mockedWebpush.sendNotification).not.toHaveBeenCalled();
      expect(mockedLogger.info).toHaveBeenCalledWith(
        'Skipping notification for user user-123 - quiet hours'
      );
    });

    it('should handle subscription delivery failures', async () => {
      const mockSubscriptions = [
        {
          id: 'sub-1',
          endpoint: 'https://push.example.com/1',
          p256dh: 'key1',
          auth: 'auth1'
        }
      ];

      mockedDb.query.mockResolvedValueOnce({ rows: [{}] }); // Default prefs
      mockedDb.query.mockResolvedValueOnce({ rows: mockSubscriptions });

      // Mock 410 error (subscription expired)
      mockedWebpush.sendNotification.mockRejectedValue({
        statusCode: 410,
        message: 'Subscription expired'
      });

      await notificationService.sendToUser('user-123', {
        title: 'Test',
        body: 'Test'
      });

      // Should attempt to delete expired subscription
      expect(mockedDb.query).toHaveBeenCalledWith(
        `DELETE FROM push_subscriptions WHERE id = $1`,
        ['sub-1']
      );
    });

    it('should skip when service not initialized', async () => {
      mockedConfig.VAPID_PUBLIC_KEY = undefined;
      notificationService = new NotificationService();

      await notificationService.sendToUser('user-123', {
        title: 'Test',
        body: 'Test'
      });

      expect(mockedWebpush.sendNotification).not.toHaveBeenCalled();
      expect(mockedLogger.warn).toHaveBeenCalledWith(
        'Notification service not initialized'
      );
    });
  });

  describe('sendToRole', () => {
    beforeEach(() => {
      notificationService = new NotificationService();
    });

    it('should send notifications to all users with role', async () => {
      const mockUsers = [
        { id: 'user-1' },
        { id: 'user-2' },
        { id: 'user-3' }
      ];

      mockedDb.query.mockResolvedValueOnce({ rows: mockUsers });

      // Mock sendToUser
      notificationService.sendToUser = jest.fn();

      await notificationService.sendToRole('admin', {
        title: 'Admin Alert',
        body: 'Important system message'
      });

      expect(mockedDb.query).toHaveBeenCalledWith(
        `SELECT id FROM users WHERE role = $1 AND is_active = true`,
        ['admin']
      );
      expect(notificationService.sendToUser).toHaveBeenCalledTimes(3);
    });

    it('should handle errors when sending to role', async () => {
      mockedDb.query.mockRejectedValue(new Error('Database error'));

      await notificationService.sendToRole('admin', {
        title: 'Test',
        body: 'Test'
      });

      expect(mockedLogger.error).toHaveBeenCalledWith(
        'Failed to send notification to role:',
        expect.any(Error)
      );
    });
  });

  describe('saveSubscription', () => {
    beforeEach(() => {
      notificationService = new NotificationService();
    });

    it('should save new subscription', async () => {
      const subscription = {
        endpoint: 'https://push.example.com/new',
        keys: {
          p256dh: 'new-key',
          auth: 'new-auth'
        }
      };

      // Mock existing check
      mockedDb.query.mockResolvedValueOnce({ rows: [] });
      // Mock insert
      mockedDb.query.mockResolvedValueOnce({
        rows: [{ id: 'new-sub-id' }]
      });

      await notificationService.saveSubscription('user-123', subscription);

      expect(mockedDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO push_subscriptions'),
        expect.arrayContaining(['user-123', 'https://push.example.com/new'])
      );
    });

    it('should update existing subscription', async () => {
      const subscription = {
        endpoint: 'https://push.example.com/existing',
        keys: {
          p256dh: 'updated-key',
          auth: 'updated-auth'
        }
      };

      // Mock existing subscription
      mockedDb.query.mockResolvedValueOnce({
        rows: [{ id: 'existing-sub-id' }]
      });
      // Mock update
      mockedDb.query.mockResolvedValueOnce({ rows: [] });

      await notificationService.saveSubscription('user-123', subscription);

      expect(mockedDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE push_subscriptions'),
        expect.arrayContaining(['updated-key', 'updated-auth'])
      );
    });
  });

  describe('removeSubscription', () => {
    beforeEach(() => {
      notificationService = new NotificationService();
    });

    it('should remove subscription', async () => {
      mockedDb.query.mockResolvedValueOnce({ rows: [] });

      await notificationService.removeSubscription(
        'user-123',
        'https://push.example.com/remove'
      );

      expect(mockedDb.query).toHaveBeenCalledWith(
        `DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2`,
        ['user-123', 'https://push.example.com/remove']
      );
    });
  });

  describe('updatePreferences', () => {
    beforeEach(() => {
      notificationService = new NotificationService();
    });

    it('should update notification preferences', async () => {
      const preferences = {
        messages_enabled: true,
        tickets_enabled: false,
        system_enabled: true,
        quiet_hours_enabled: true,
        quiet_hours_start: '22:00',
        quiet_hours_end: '08:00'
      };

      mockedDb.query.mockResolvedValueOnce({ rows: [] });

      await notificationService.updatePreferences('user-123', preferences);

      expect(mockedDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO notification_preferences'),
        expect.arrayContaining(['user-123', true, false, true])
      );
    });
  });
});