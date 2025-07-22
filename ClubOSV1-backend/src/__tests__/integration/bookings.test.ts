import request from 'supertest';
import express from 'express';
import path from 'path';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import bookingRoutes from '../../../routes/bookings';
import { errorHandler } from '../../../middleware/errorHandler';

// Create test data directory
const testDataDir = path.join(__dirname, '../../../data-test');
const bookingsFile = path.join(testDataDir, 'bookings.json');

describe('Bookings API Integration Tests', () => {
  let app: express.Application;

  beforeAll(() => {
    // Create test data directory
    if (!existsSync(testDataDir)) {
      mkdirSync(testDataDir, { recursive: true });
    }
  });

  beforeEach(() => {
    // Create fresh Express app for each test
    app = express();
    app.use(express.json());
    app.use('/api/bookings', bookingRoutes);
    app.use(errorHandler);

    // Initialize empty bookings file
    writeFileSync(bookingsFile, JSON.stringify([]));
  });

  afterEach(() => {
    // Clean up test data
    if (existsSync(bookingsFile)) {
      rmSync(bookingsFile);
    }
  });

  afterAll(() => {
    // Remove test data directory
    if (existsSync(testDataDir)) {
      rmSync(testDataDir, { recursive: true });
    }
  });

  describe('GET /api/bookings', () => {
    it('should return empty array when no bookings exist', async () => {
      const response = await request(app)
        .get('/api/bookings')
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('should return all bookings', async () => {
      const testBookings = [
        {
          id: '1',
          userId: 'user1',
          bayNumber: 1,
          date: '2024-01-20',
          time: '14:00',
          duration: 60,
          status: 'confirmed',
          createdAt: new Date().toISOString()
        },
        {
          id: '2',
          userId: 'user2',
          bayNumber: 2,
          date: '2024-01-20',
          time: '15:00',
          duration: 60,
          status: 'confirmed',
          createdAt: new Date().toISOString()
        }
      ];

      writeFileSync(bookingsFile, JSON.stringify(testBookings));

      const response = await request(app)
        .get('/api/bookings')
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0].id).toBe('1');
      expect(response.body[1].id).toBe('2');
    });

    it('should filter bookings by userId', async () => {
      const testBookings = [
        {
          id: '1',
          userId: 'user1',
          bayNumber: 1,
          date: '2024-01-20',
          time: '14:00',
          duration: 60,
          status: 'confirmed',
          createdAt: new Date().toISOString()
        },
        {
          id: '2',
          userId: 'user2',
          bayNumber: 2,
          date: '2024-01-20',
          time: '15:00',
          duration: 60,
          status: 'confirmed',
          createdAt: new Date().toISOString()
        }
      ];

      writeFileSync(bookingsFile, JSON.stringify(testBookings));

      const response = await request(app)
        .get('/api/bookings?userId=user1')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].userId).toBe('user1');
    });
  });

  describe('POST /api/bookings', () => {
    it('should create a new booking', async () => {
      const newBooking = {
        userId: 'user1',
        bayNumber: 1,
        date: '2024-01-20',
        time: '14:00',
        duration: 60
      };

      const response = await request(app)
        .post('/api/bookings')
        .send(newBooking)
        .expect(201);

      expect(response.body).toMatchObject({
        ...newBooking,
        id: expect.any(String),
        status: 'confirmed',
        createdAt: expect.any(String)
      });
    });

    it('should validate required fields', async () => {
      const invalidBooking = {
        userId: 'user1',
        // Missing required fields
      };

      const response = await request(app)
        .post('/api/bookings')
        .send(invalidBooking)
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should prevent double booking', async () => {
      const booking1 = {
        userId: 'user1',
        bayNumber: 1,
        date: '2024-01-20',
        time: '14:00',
        duration: 60
      };

      // Create first booking
      await request(app)
        .post('/api/bookings')
        .send(booking1)
        .expect(201);

      // Try to create conflicting booking
      const booking2 = {
        userId: 'user2',
        bayNumber: 1, // Same bay
        date: '2024-01-20', // Same date
        time: '14:30', // Overlapping time
        duration: 60
      };

      const response = await request(app)
        .post('/api/bookings')
        .send(booking2)
        .expect(409);

      expect(response.body.error).toContain('already booked');
    });
  });

  describe('GET /api/bookings/:id', () => {
    it('should return a specific booking', async () => {
      const testBooking = {
        id: 'test-id-123',
        userId: 'user1',
        bayNumber: 1,
        date: '2024-01-20',
        time: '14:00',
        duration: 60,
        status: 'confirmed',
        createdAt: new Date().toISOString()
      };

      writeFileSync(bookingsFile, JSON.stringify([testBooking]));

      const response = await request(app)
        .get('/api/bookings/test-id-123')
        .expect(200);

      expect(response.body).toMatchObject(testBooking);
    });

    it('should return 404 for non-existent booking', async () => {
      const response = await request(app)
        .get('/api/bookings/non-existent-id')
        .expect(404);

      expect(response.body.error).toBe('Booking not found');
    });
  });

  describe('PUT /api/bookings/:id', () => {
    it('should update an existing booking', async () => {
      const testBooking = {
        id: 'test-id-123',
        userId: 'user1',
        bayNumber: 1,
        date: '2024-01-20',
        time: '14:00',
        duration: 60,
        status: 'confirmed',
        createdAt: new Date().toISOString()
      };

      writeFileSync(bookingsFile, JSON.stringify([testBooking]));

      const updates = {
        time: '15:00',
        duration: 90
      };

      const response = await request(app)
        .put('/api/bookings/test-id-123')
        .send(updates)
        .expect(200);

      expect(response.body.time).toBe('15:00');
      expect(response.body.duration).toBe(90);
      expect(response.body.updatedAt).toBeDefined();
    });

    it('should return 404 when updating non-existent booking', async () => {
      const response = await request(app)
        .put('/api/bookings/non-existent-id')
        .send({ time: '15:00' })
        .expect(404);

      expect(response.body.error).toBe('Booking not found');
    });
  });

  describe('DELETE /api/bookings/:id', () => {
    it('should cancel a booking', async () => {
      const testBooking = {
        id: 'test-id-123',
        userId: 'user1',
        bayNumber: 1,
        date: '2024-01-20',
        time: '14:00',
        duration: 60,
        status: 'confirmed',
        createdAt: new Date().toISOString()
      };

      writeFileSync(bookingsFile, JSON.stringify([testBooking]));

      const response = await request(app)
        .delete('/api/bookings/test-id-123')
        .expect(200);

      expect(response.body.status).toBe('cancelled');
      expect(response.body.cancelledAt).toBeDefined();
    });

    it('should return 404 when cancelling non-existent booking', async () => {
      const response = await request(app)
        .delete('/api/bookings/non-existent-id')
        .expect(404);

      expect(response.body.error).toBe('Booking not found');
    });
  });

  describe('GET /api/bookings/availability', () => {
    it('should return available time slots', async () => {
      const existingBooking = {
        id: '1',
        userId: 'user1',
        bayNumber: 1,
        date: '2024-01-20',
        time: '14:00',
        duration: 60,
        status: 'confirmed',
        createdAt: new Date().toISOString()
      };

      writeFileSync(bookingsFile, JSON.stringify([existingBooking]));

      const response = await request(app)
        .get('/api/bookings/availability?date=2024-01-20&bayNumber=1')
        .expect(200);

      expect(response.body.date).toBe('2024-01-20');
      expect(response.body.bayNumber).toBe(1);
      expect(response.body.availableSlots).toBeDefined();
      expect(response.body.bookedSlots).toContain('14:00');
    });

    it('should validate date format', async () => {
      const response = await request(app)
        .get('/api/bookings/availability?date=invalid-date&bayNumber=1')
        .expect(400);

      expect(response.body.error).toContain('Invalid date format');
    });
  });
});
