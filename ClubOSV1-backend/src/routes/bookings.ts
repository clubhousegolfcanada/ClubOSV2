import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import Joi from 'joi';
import { logger } from '../utils/logger';
import { readJsonFile, writeJsonFile, appendToJsonArray } from '../utils/fileUtils';
import { BookingRequest } from '../types';
import { AppError } from '../middleware/errorHandler';

const router = Router();

// Validation schema for booking requests
const bookingSchema = Joi.object({
  userId: Joi.string().required(),
  simulatorId: Joi.string().required(),
  startTime: Joi.date().iso().required(),
  duration: Joi.number().min(30).max(240).required(),
  type: Joi.string().valid('single', 'recurring').required(),
  recurringDays: Joi.when('type', {
    is: 'recurring',
    then: Joi.array().items(Joi.number().min(0).max(6)).required(),
    otherwise: Joi.forbidden()
  })
});

// Get all bookings
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, simulatorId, date } = req.query;
    let bookings = await readJsonFile<any[]>('bookings.json');

    // Apply filters
    if (userId) {
      bookings = bookings.filter(b => b.userId === userId);
    }
    if (simulatorId) {
      bookings = bookings.filter(b => b.simulatorId === simulatorId);
    }
    if (date) {
      const targetDate = new Date(date as string).toDateString();
      bookings = bookings.filter(b => 
        new Date(b.startTime).toDateString() === targetDate
      );
    }

    res.json({
      success: true,
      count: bookings.length,
      data: bookings
    });
  } catch (error) {
    next(error);
  }
});

// Get booking by ID
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bookings = await readJsonFile<any[]>('bookings.json');
    const booking = bookings.find(b => b.id === req.params.id);

    if (!booking) {
      throw new AppError('BOOKING_NOT_FOUND', 'Booking not found', 404);
    }

    res.json({
      success: true,
      data: booking
    });
  } catch (error) {
    next(error);
  }
});

// Create new booking
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Validate request body
    const { error, value } = bookingSchema.validate(req.body);
    if (error) {
      throw new AppError('VALIDATION_ERROR', error.details[0].message, 400);
    }

    const bookingRequest: BookingRequest = value;
    const bookingId = uuidv4();

    // Check for conflicts
    const existingBookings = await readJsonFile<any[]>('bookings.json');
    const hasConflict = checkBookingConflict(
      existingBookings,
      bookingRequest.simulatorId,
      new Date(bookingRequest.startTime),
      bookingRequest.duration
    );

    if (hasConflict) {
      throw new AppError('BOOKING_CONFLICT', 'Time slot is already booked', 409);
    }

    // Create booking record
    const booking = {
      id: bookingId,
      ...bookingRequest,
      status: 'confirmed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Save booking
    await appendToJsonArray('bookings.json', booking);

    logger.info('Booking created', { bookingId, userId: bookingRequest.userId });

    res.status(201).json({
      success: true,
      data: booking
    });
  } catch (error) {
    next(error);
  }
});

// Update booking
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bookings = await readJsonFile<any[]>('bookings.json');
    const bookingIndex = bookings.findIndex(b => b.id === req.params.id);

    if (bookingIndex === -1) {
      throw new AppError('BOOKING_NOT_FOUND', 'Booking not found', 404);
    }

    // Validate update data
    const updateSchema = bookingSchema.fork(['userId', 'simulatorId'], (schema) => schema.optional());
    const { error, value } = updateSchema.validate(req.body);
    if (error) {
      throw new AppError('VALIDATION_ERROR', error.details[0].message, 400);
    }

    // Check for conflicts if time is being changed
    if (value.startTime || value.duration) {
      const hasConflict = checkBookingConflict(
        bookings.filter((_, i) => i !== bookingIndex),
        value.simulatorId || bookings[bookingIndex].simulatorId,
        new Date(value.startTime || bookings[bookingIndex].startTime),
        value.duration || bookings[bookingIndex].duration
      );

      if (hasConflict) {
        throw new AppError('BOOKING_CONFLICT', 'Time slot is already booked', 409);
      }
    }

    // Update booking
    bookings[bookingIndex] = {
      ...bookings[bookingIndex],
      ...value,
      updatedAt: new Date().toISOString()
    };

    await writeJsonFile('bookings.json', bookings);

    logger.info('Booking updated', { bookingId: req.params.id });

    res.json({
      success: true,
      data: bookings[bookingIndex]
    });
  } catch (error) {
    next(error);
  }
});

// Cancel booking
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bookings = await readJsonFile<any[]>('bookings.json');
    const bookingIndex = bookings.findIndex(b => b.id === req.params.id);

    if (bookingIndex === -1) {
      throw new AppError('BOOKING_NOT_FOUND', 'Booking not found', 404);
    }

    // Update status instead of deleting
    bookings[bookingIndex] = {
      ...bookings[bookingIndex],
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await writeJsonFile('bookings.json', bookings);

    logger.info('Booking cancelled', { bookingId: req.params.id });

    res.json({
      success: true,
      message: 'Booking cancelled successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Helper function to check booking conflicts
function checkBookingConflict(
  bookings: any[],
  simulatorId: string,
  startTime: Date,
  duration: number
): boolean {
  const endTime = new Date(startTime.getTime() + duration * 60000);

  return bookings.some(booking => {
    if (booking.simulatorId !== simulatorId || booking.status === 'cancelled') {
      return false;
    }

    const bookingStart = new Date(booking.startTime);
    const bookingEnd = new Date(bookingStart.getTime() + booking.duration * 60000);

    return (
      (startTime >= bookingStart && startTime < bookingEnd) ||
      (endTime > bookingStart && endTime <= bookingEnd) ||
      (startTime <= bookingStart && endTime >= bookingEnd)
    );
  });
}

export default router;
