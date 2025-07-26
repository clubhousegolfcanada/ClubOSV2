import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';
import { db } from '../utils/database';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// GET /api/bookings - Get bookings for user or all (admin/operator)
router.get('/', authenticate, async (req, res) => {
  try {
    const { simulator_id, date, status } = req.query;
    
    // Admin/operator can see all bookings
    const userId = (req.user?.role === 'admin' || req.user?.role === 'operator') 
      ? undefined 
      : req.user?.id;
    
    const bookings = await db.getBookings({
      user_id: userId,
      simulator_id: simulator_id as string,
      date: date ? new Date(date as string) : undefined,
      status: status as string
    });
    
    res.json({
      success: true,
      data: bookings.map(b => ({
        id: b.id,
        userId: b.user_id,
        simulatorId: b.simulator_id,
        startTime: b.start_time.toISOString(),
        duration: b.duration,
        type: b.type,
        recurringDays: b.recurring_days,
        status: b.status,
        createdAt: b.created_at.toISOString(),
        updatedAt: b.updated_at.toISOString(),
        cancelledAt: b.cancelled_at?.toISOString(),
        metadata: b.metadata
      }))
    });
  } catch (error) {
    logger.error('Failed to get bookings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve bookings'
    });
  }
});

// POST /api/bookings - Create a new booking
router.post('/', authenticate, async (req, res) => {
  try {
    const { 
      simulatorId, 
      startTime, 
      duration, 
      type = 'single', 
      recurringDays 
    } = req.body;
    
    // Validate required fields
    if (!simulatorId || !startTime || !duration) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: simulatorId, startTime, duration'
      });
    }
    
    // Validate duration (30-240 minutes)
    if (duration < 30 || duration > 240) {
      return res.status(400).json({
        success: false,
        message: 'Duration must be between 30 and 240 minutes'
      });
    }
    
    // Check for conflicts
    const existingBookings = await db.getBookings({
      simulator_id: simulatorId,
      date: new Date(startTime)
    });
    
    const newStart = new Date(startTime);
    const newEnd = new Date(newStart.getTime() + duration * 60000);
    
    const hasConflict = existingBookings.some(booking => {
      if (booking.status === 'cancelled') return false;
      
      const bookingEnd = new Date(booking.start_time.getTime() + booking.duration * 60000);
      return (newStart < bookingEnd && newEnd > booking.start_time);
    });
    
    if (hasConflict) {
      return res.status(409).json({
        success: false,
        message: 'Time slot is already booked'
      });
    }
    
    // Create booking
    const newBooking = await db.createBooking({
      user_id: req.user!.id,
      simulator_id: simulatorId,
      start_time: new Date(startTime),
      duration,
      type,
      recurring_days: recurringDays,
      status: 'confirmed'
    });
    
    logger.info('Booking created', {
      bookingId: newBooking.id,
      userId: req.user!.id,
      simulatorId,
      startTime
    });
    
    res.json({
      success: true,
      data: {
        id: newBooking.id,
        userId: newBooking.user_id,
        simulatorId: newBooking.simulator_id,
        startTime: newBooking.start_time.toISOString(),
        duration: newBooking.duration,
        type: newBooking.type,
        recurringDays: newBooking.recurring_days,
        status: newBooking.status,
        createdAt: newBooking.created_at.toISOString(),
        updatedAt: newBooking.updated_at.toISOString()
      }
    });
  } catch (error) {
    logger.error('Failed to create booking:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create booking'
    });
  }
});

// PATCH /api/bookings/:id/cancel - Cancel a booking
router.patch('/:id/cancel', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get booking to check ownership
    const bookings = await db.getBookings({ user_id: req.user!.id });
    const booking = bookings.find(b => b.id === id);
    
    if (!booking) {
      // Check if admin/operator
      if (req.user?.role === 'admin' || req.user?.role === 'operator') {
        // Admin/operator can cancel any booking
        const allBookings = await db.getBookings({});
        const adminBooking = allBookings.find(b => b.id === id);
        
        if (!adminBooking) {
          return res.status(404).json({
            success: false,
            message: 'Booking not found'
          });
        }
      } else {
        return res.status(404).json({
          success: false,
          message: 'Booking not found or unauthorized'
        });
      }
    }
    
    // Cancel booking
    const cancelled = await db.cancelBooking(id);
    
    if (!cancelled) {
      return res.status(500).json({
        success: false,
        message: 'Failed to cancel booking'
      });
    }
    
    logger.info('Booking cancelled', {
      bookingId: id,
      cancelledBy: req.user!.email
    });
    
    res.json({
      success: true,
      message: 'Booking cancelled successfully'
    });
  } catch (error) {
    logger.error('Failed to cancel booking:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel booking'
    });
  }
});

// GET /api/bookings/availability - Check availability for a time slot
router.get('/availability', authenticate, async (req, res) => {
  try {
    const { simulatorId, date, duration = 60 } = req.query;
    
    if (!simulatorId || !date) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters: simulatorId, date'
      });
    }
    
    const bookings = await db.getBookings({
      simulator_id: simulatorId as string,
      date: new Date(date as string)
    });
    
    // Generate available time slots (6 AM to 10 PM)
    const slots = [];
    const startDate = new Date(date as string);
    startDate.setHours(6, 0, 0, 0);
    
    for (let hour = 6; hour < 22; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const slotStart = new Date(startDate);
        slotStart.setHours(hour, minute, 0, 0);
        const slotEnd = new Date(slotStart.getTime() + Number(duration) * 60000);
        
        // Check if slot conflicts with any booking
        const isAvailable = !bookings.some(booking => {
          if (booking.status === 'cancelled') return false;
          
          const bookingEnd = new Date(booking.start_time.getTime() + booking.duration * 60000);
          return (slotStart < bookingEnd && slotEnd > booking.start_time);
        });
        
        if (isAvailable && slotEnd.getHours() <= 22) {
          slots.push({
            startTime: slotStart.toISOString(),
            endTime: slotEnd.toISOString(),
            available: true
          });
        }
      }
    }
    
    res.json({
      success: true,
      data: {
        simulatorId,
        date: date as string,
        duration: Number(duration),
        availableSlots: slots
      }
    });
  } catch (error) {
    logger.error('Failed to check availability:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check availability'
    });
  }
});

export default router;
