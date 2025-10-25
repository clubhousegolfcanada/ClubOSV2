import express, { Request, Response, NextFunction } from 'express';
import { db } from '../utils/database';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';
import { z } from 'zod';
import { BookingService } from '../services/booking/bookingService';
import { AvailabilityService } from '../services/booking/availabilityService';

const router = express.Router();

// Validation schemas
const CreateBookingSchema = z.object({
  locationId: z.string(),
  spaceIds: z.array(z.string()).min(1),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  customerName: z.string().optional(),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().optional(),
  customerId: z.string().optional(),
  promoCode: z.string().optional(),
  adminNotes: z.string().optional(),
  isAdminBlock: z.boolean().optional(),
  blockReason: z.string().optional(),
  maintenanceType: z.enum(['cleaning', 'repair', 'inspection', 'other']).optional(),
  recurringPattern: z.object({
    frequency: z.enum(['daily', 'weekly', 'monthly']),
    interval: z.number(),
    endDate: z.string().optional(),
    daysOfWeek: z.array(z.number()).optional()
  }).optional(),
  // Event/Class specific fields
  eventName: z.string().optional(),
  expectedAttendees: z.number().optional(),
  requiresDeposit: z.boolean().optional(),
  customPrice: z.number().optional(),
  totalAmount: z.number().optional(),
  photoUrls: z.array(z.string()).optional()
});

const UpdateBookingSchema = z.object({
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  status: z.enum(['pending', 'confirmed', 'cancelled', 'completed', 'no-show']).optional(),
  adminNotes: z.string().optional()
});

// GET /api/bookings/day - Get bookings for a specific day
router.get('/day', authenticate, async (req: Request, res: Response) => {
  try {
    const { locationId, date } = req.query;

    if (!date) {
      return res.status(400).json({
        success: false,
        error: 'Date parameter is required'
      });
    }

    // Parse date and get start/end of day in UTC
    const queryDate = new Date(date as string);
    const startOfDay = new Date(queryDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(queryDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    // Check which columns exist (defensive for production)
    const checkColumns = await db.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'bookings'
    `);

    const columns = checkColumns.rows.map(row => row.column_name);

    // Log detected columns for debugging
    logger.info('Bookings table columns detected:', {
      columns: columns,
      count: columns.length
    });

    // Check for all potentially missing columns
    const hasSpaceIds = columns.includes('space_ids');
    const hasSpaceId = columns.includes('space_id');
    const hasSimulatorId = columns.includes('simulator_id');
    const hasUserId = columns.includes('user_id');
    const hasCustomerId = columns.includes('customer_id');
    const hasCustomerName = columns.includes('customer_name');
    const hasCustomerEmail = columns.includes('customer_email');
    const hasCustomerPhone = columns.includes('customer_phone');
    const hasTotalAmount = columns.includes('total_amount');
    const hasDepositAmount = columns.includes('deposit_amount');
    const hasPaymentStatus = columns.includes('payment_status');
    const hasAmountCents = columns.includes('amount_cents');
    // Check for date/time columns
    const hasStartAt = columns.includes('start_at');
    const hasStartTime = columns.includes('start_time');
    const hasEndAt = columns.includes('end_at');
    const hasEndTime = columns.includes('end_time');
    const hasDuration = columns.includes('duration');

    // Log date column detection
    logger.info('Date column detection:', {
      hasStartAt,
      hasStartTime,
      hasEndAt,
      hasEndTime,
      hasDuration
    });

    // Build space_ids field based on what columns exist
    let spaceIdsField = 'ARRAY[]::INTEGER[] as space_ids'; // Default empty array
    if (hasSpaceIds) {
      spaceIdsField = 'b.space_ids';
    } else if (hasSpaceId) {
      spaceIdsField = 'ARRAY[b.space_id]::INTEGER[] as space_ids';
    } else if (hasSimulatorId) {
      spaceIdsField = 'ARRAY[b.simulator_id]::INTEGER[] as space_ids';
    }

    // Build user/customer ID field
    let userIdField = 'NULL::INTEGER as user_id';
    if (hasUserId) {
      userIdField = 'b.user_id';
    } else if (hasCustomerId) {
      userIdField = 'b.customer_id as user_id';
    }

    // Build customer fields
    let customerNameField = "'Guest'::VARCHAR as customer_name";
    if (hasCustomerName) {
      customerNameField = "COALESCE(b.customer_name, u.name, 'Guest') as customer_name";
    } else if (hasUserId || hasCustomerId) {
      customerNameField = "COALESCE(u.name, 'Guest') as customer_name";
    }

    let customerEmailField = "''::VARCHAR as customer_email";
    if (hasCustomerEmail) {
      customerEmailField = "COALESCE(b.customer_email, u.email, '') as customer_email";
    } else if (hasUserId || hasCustomerId) {
      customerEmailField = "COALESCE(u.email, '') as customer_email";
    }

    let customerPhoneField = "''::VARCHAR as customer_phone";
    if (hasCustomerPhone) {
      customerPhoneField = "COALESCE(b.customer_phone, u.phone, '') as customer_phone";
    } else if (hasUserId || hasCustomerId) {
      customerPhoneField = "COALESCE(u.phone, '') as customer_phone";
    }

    // Build payment fields
    let totalAmountField = '0::INTEGER as total_amount';
    if (hasTotalAmount) {
      totalAmountField = 'COALESCE(b.total_amount, 0) as total_amount';
    } else if (hasAmountCents) {
      totalAmountField = 'COALESCE(b.amount_cents, 0) as total_amount';
    }

    let depositAmountField = '0::INTEGER as deposit_amount';
    if (hasDepositAmount) {
      depositAmountField = 'COALESCE(b.deposit_amount, 0) as deposit_amount';
    }

    let paymentStatusField = "'pending'::VARCHAR as payment_status";
    if (hasPaymentStatus) {
      paymentStatusField = "COALESCE(b.payment_status, 'pending') as payment_status";
    }

    // Build date/time fields
    let startField = "CURRENT_TIMESTAMP as start_at";
    let endField = "CURRENT_TIMESTAMP as end_at";
    let whereStartField = "TRUE"; // Default to always true if no date columns

    if (hasStartAt) {
      startField = "b.start_at";
      endField = hasEndAt ? "b.end_at" : "b.start_at + INTERVAL '60 minutes' as end_at";
      whereStartField = "b.start_at";
    } else if (hasStartTime) {
      startField = "b.start_time as start_at";
      if (hasEndTime) {
        endField = "b.end_time as end_at";
      } else if (hasDuration) {
        endField = "b.start_time + (b.duration || ' minutes')::INTERVAL as end_at";
      } else {
        endField = "b.start_time + INTERVAL '60 minutes' as end_at";
      }
      whereStartField = "b.start_time";
    }

    // Build the JOIN clause based on available columns
    let joinClause = '';
    if (hasUserId || hasCustomerId) {
      const joinColumn = hasUserId ? 'b.user_id' : 'b.customer_id';
      joinClause = `LEFT JOIN users u ON ${joinColumn} = u.id`;
    }

    // Build query based on available columns
    let query = `
      SELECT
        b.id,
        b.location_id,
        ${spaceIdsField},
        ${userIdField},
        ${startField},
        ${endField},
        b.status,
        ${customerNameField},
        ${customerEmailField},
        ${customerPhoneField},
        ${totalAmountField},
        ${depositAmountField},
        ${paymentStatusField}
        ${joinClause ? ', u.name as user_name, u.email as user_email' : ", NULL as user_name, NULL as user_email"}
      FROM bookings b
      ${joinClause}
      WHERE ${whereStartField} >= $1 AND ${whereStartField} <= $2
    `;

    const params: any[] = [startOfDay.toISOString(), endOfDay.toISOString()];

    if (locationId && locationId !== 'all') {
      query += ` AND b.location_id = $3`;
      params.push(locationId);
    }

    // Use the correct field for ORDER BY based on what exists
    const orderByField = hasStartAt ? 'b.start_at' : hasStartTime ? 'b.start_time' : 'b.id';
    query += ` ORDER BY ${orderByField} ASC`;

    logger.info('Executing booking day query', {
      startOfDay: startOfDay.toISOString(),
      endOfDay: endOfDay.toISOString(),
      locationId,
      queryPreview: query.substring(0, 500), // Log first 500 chars of query
      orderByField
    });

    const result = await db.query(query, params);

    // Transform the results to match expected format
    const transformedData = result.rows.map((row: any) => ({
      ...row,
      // Add default tier info if missing
      customer_tier_id: row.customer_tier_id || 'new',
      tier_name: 'Standard',
      tier_color: '#3B82F6',
      // Parse space_ids if it's a string
      spaceIds: Array.isArray(row.space_ids) ? row.space_ids : [row.space_ids].filter(Boolean),
      // Format dates
      startAt: row.start_at,
      endAt: row.end_at,
      // Add computed duration
      duration: row.duration_minutes || Math.floor((new Date(row.end_at).getTime() - new Date(row.start_at).getTime()) / 60000)
    }));

    res.json({
      success: true,
      data: transformedData
    });
  } catch (error) {
    logger.error('Error fetching day bookings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch bookings',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/bookings/availability - Check availability for a time slot
router.get('/availability', authenticate, async (req: Request, res: Response) => {
  try {
    const { locationId, spaceId, date } = req.query;

    if (!locationId || !date) {
      return res.status(400).json({
        success: false,
        error: 'locationId and date are required'
      });
    }

    // Get all bookings for the location on this date
    const queryDate = new Date(date as string);
    const startOfDay = new Date(queryDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(queryDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    // Check if space_ids column exists
    const checkCol = await db.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'bookings'
      AND column_name = 'space_ids'
    `);

    const hasSpaceIdsCol = checkCol.rows.length > 0;

    let query = `
      SELECT
        start_at,
        end_at,
        ${hasSpaceIdsCol ? 'space_ids' : 'ARRAY[]::VARCHAR(50)[] as space_ids'},
        is_admin_block
      FROM bookings
      WHERE location_id = $1
        AND start_at >= $2
        AND start_at <= $3
        AND status IN ('confirmed', 'pending')
    `;

    const params: any[] = [locationId, startOfDay.toISOString(), endOfDay.toISOString()];

    if (spaceId && hasSpaceIdsCol) {
      query += ` AND $4 = ANY(space_ids)`;
      params.push(spaceId);
    }

    const result = await db.query(query, params);

    // Calculate available time slots (30-minute intervals)
    const bookedSlots = result.rows.map(row => ({
      start: new Date(row.start_at),
      end: new Date(row.end_at),
      isAdminBlock: row.is_admin_block
    }));

    // Generate available slots for the day
    const slots = [];
    const current = new Date(startOfDay);
    current.setUTCHours(6, 0, 0, 0); // Start at 6 AM

    while (current < endOfDay) {
      const slotEnd = new Date(current);
      slotEnd.setMinutes(slotEnd.getMinutes() + 30);

      // Check if this slot overlaps with any booking
      const isBooked = bookedSlots.some(booked =>
        (current >= booked.start && current < booked.end) ||
        (slotEnd > booked.start && slotEnd <= booked.end)
      );

      slots.push({
        start: current.toISOString(),
        end: slotEnd.toISOString(),
        available: !isBooked
      });

      current.setMinutes(current.getMinutes() + 30);
    }

    res.json({
      success: true,
      data: {
        date: queryDate.toISOString(),
        locationId,
        spaceId,
        slots
      }
    });
  } catch (error) {
    logger.error('Error checking availability:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check availability'
    });
  }
});

// POST /api/bookings - Create a new booking
router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const validated = CreateBookingSchema.parse(req.body);
    const userId = (req as any).user?.id;

    // Get booking configuration
    const configResult = await db.query(
      "SELECT value FROM system_settings WHERE key = 'booking_config'"
    );
    const config = configResult.rows[0]?.value || {};

    // Validate duration with strict business rules
    const startTime = new Date(validated.startAt);
    const endTime = new Date(validated.endAt);
    const durationMinutes = Math.floor((endTime.getTime() - startTime.getTime()) / 60000);

    // ENFORCE 1-HOUR MINIMUM
    const minDuration = config.minDuration || 60;
    if (durationMinutes < minDuration) {
      return res.status(400).json({
        success: false,
        error: `Minimum booking duration is ${minDuration} minutes (1 hour)`,
        details: {
          provided: durationMinutes,
          minimum: minDuration
        }
      });
    }

    // ENFORCE 30-MINUTE INCREMENTS AFTER FIRST HOUR
    const incrementAfterFirst = config.incrementAfterFirst || 30;
    if (durationMinutes > minDuration) {
      const minutesAfterFirst = durationMinutes - minDuration;
      if (minutesAfterFirst % incrementAfterFirst !== 0) {
        const nextValid = minDuration + Math.ceil(minutesAfterFirst / incrementAfterFirst) * incrementAfterFirst;
        const prevValid = minDuration + Math.floor(minutesAfterFirst / incrementAfterFirst) * incrementAfterFirst;

        return res.status(400).json({
          success: false,
          error: `After the first hour, bookings must be in ${incrementAfterFirst}-minute increments`,
          details: {
            provided: durationMinutes,
            validOptions: [prevValid, nextValid],
            suggestion: `Try booking for ${prevValid / 60} or ${nextValid / 60} hours`
          }
        });
      }
    }

    // Validate maximum duration
    const maxDuration = config.maxDuration || 360;
    if (durationMinutes > maxDuration) {
      return res.status(400).json({
        success: false,
        error: `Maximum booking duration is ${maxDuration} minutes (${maxDuration / 60} hours)`,
        details: {
          provided: durationMinutes,
          maximum: maxDuration
        }
      });
    }

    // Validate advance booking limits based on customer tier
    const now = new Date();
    const hoursInAdvance = Math.floor((startTime.getTime() - now.getTime()) / (1000 * 60 * 60));

    // Cannot book less than 1 hour in advance
    if (hoursInAdvance < 1) {
      return res.status(400).json({
        success: false,
        error: 'Bookings must be made at least 1 hour in advance',
        details: {
          currentTime: now.toISOString(),
          requestedStart: startTime.toISOString()
        }
      });
    }

    // Get or assign customer tier first (before using it)
    let customerTierId = 'new'; // Default to new customer
    if (userId) {
      const loyaltyResult = await db.query(
        'SELECT current_tier_id FROM loyalty_tracking WHERE user_id = $1',
        [userId]
      );
      if (loyaltyResult.rows[0]) {
        customerTierId = loyaltyResult.rows[0].current_tier_id;
      }
    }

    // Check advance booking limits by tier
    const maxAdvanceDays = {
      new: 14,
      member: 30,
      promo: 14,
      frequent: 30
    };

    const daysInAdvance = Math.floor(hoursInAdvance / 24);
    const maxDays = maxAdvanceDays[customerTierId as keyof typeof maxAdvanceDays] || 14;

    if (daysInAdvance > maxDays) {
      return res.status(400).json({
        success: false,
        error: `${customerTierId === 'new' ? 'New customers' : `${customerTierId} tier`} can only book ${maxDays} days in advance`,
        details: {
          daysInAdvance,
          maxAllowed: maxDays,
          customerTier: customerTierId
        }
      });
    }

    // Get tier pricing
    const tierResult = await db.query(
      'SELECT hourly_rate FROM customer_tiers WHERE id = $1',
      [customerTierId]
    );
    const hourlyRate = tierResult.rows[0]?.hourly_rate || 30;
    const totalAmount = (hourlyRate * durationMinutes) / 60;

    // Use the new transactional service to create the booking
    // This prevents double bookings and ensures data consistency
    const result = await BookingService.createBookingWithTransaction({
      locationId: validated.locationId,
      spaceIds: validated.spaceIds,
      userId,
      customerTierId,
      customerName: validated.customerName,
      customerEmail: validated.customerEmail,
      customerPhone: validated.customerPhone,
      customerId: validated.customerId,
      startAt: validated.startAt,
      endAt: validated.endAt,
      baseRate: hourlyRate,
      totalAmount: validated.totalAmount || totalAmount,
      customPrice: validated.customPrice,
      promoCode: validated.promoCode,
      adminNotes: validated.adminNotes,
      isAdminBlock: validated.isAdminBlock,
      blockReason: validated.blockReason,
      maintenanceType: validated.maintenanceType,
      recurringPattern: validated.recurringPattern,
      eventName: validated.eventName,
      expectedAttendees: validated.expectedAttendees,
      requiresDeposit: validated.requiresDeposit,
      photoUrls: validated.photoUrls
    });

    // Handle transaction result
    if (!result.success) {
      // Return 409 Conflict for booking conflicts
      const statusCode = result.errorCode === 'TIME_CONFLICT' ||
                        result.errorCode === 'SPACE_CONFLICT' ||
                        result.errorCode === 'BOOKING_CONFLICT' ? 409 : 400;

      return res.status(statusCode).json({
        success: false,
        error: result.error,
        errorCode: result.errorCode,
        details: result.conflictingBookings || result.conflictingSpaces
      });
    }

    res.json({
      success: true,
      data: result.data
    });
  } catch (error) {
    logger.error('Error creating booking:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create booking'
    });
  }
});

// PATCH /api/bookings/:id - Update a booking
router.patch('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validated = UpdateBookingSchema.parse(req.body);
    const userId = (req as any).user?.id;
    const userRole = (req as any).user?.role;

    // Check if booking exists and user has permission
    const bookingResult = await db.query(
      'SELECT * FROM bookings WHERE id = $1',
      [id]
    );

    if (!bookingResult.rows[0]) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    const booking = bookingResult.rows[0];

    // Check permissions
    if (userRole !== 'admin' && booking.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Permission denied'
      });
    }

    // Track changes
    let changeCount = booking.change_count;
    let changeFeeCharged = booking.change_fee_charged;
    let flaggedForChanges = booking.flagged_for_changes;

    if (validated.startAt || validated.endAt) {
      changeCount++;

      // Charge fee after first change
      if (changeCount > 1) {
        changeFeeCharged = 10;
      }

      // Flag after 2 changes
      if (changeCount >= 2) {
        flaggedForChanges = true;
      }
    }

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (validated.startAt) {
      updates.push(`start_at = $${paramCount++}`);
      values.push(validated.startAt);
    }
    if (validated.endAt) {
      updates.push(`end_at = $${paramCount++}`);
      values.push(validated.endAt);
    }
    if (validated.status) {
      updates.push(`status = $${paramCount++}`);
      values.push(validated.status);
    }
    if (validated.adminNotes !== undefined) {
      updates.push(`admin_notes = $${paramCount++}`);
      values.push(validated.adminNotes);
    }

    updates.push(`change_count = $${paramCount++}`);
    values.push(changeCount);
    updates.push(`change_fee_charged = $${paramCount++}`);
    values.push(changeFeeCharged);
    updates.push(`flagged_for_changes = $${paramCount++}`);
    values.push(flaggedForChanges);

    values.push(id); // For WHERE clause

    const updateResult = await db.query(
      `UPDATE bookings
       SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );

    res.json({
      success: true,
      data: updateResult.rows[0]
    });
  } catch (error) {
    logger.error('Error updating booking:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update booking'
    });
  }
});

// DELETE /api/bookings/:id - Cancel a booking
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    const userRole = (req as any).user?.role;

    // Check if booking exists and user has permission
    const bookingResult = await db.query(
      'SELECT * FROM bookings WHERE id = $1',
      [id]
    );

    if (!bookingResult.rows[0]) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    const booking = bookingResult.rows[0];

    // Check permissions
    if (userRole !== 'admin' && booking.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Permission denied'
      });
    }

    // Cancel the booking
    const updateResult = await db.query(
      `UPDATE bookings
       SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    res.json({
      success: true,
      data: updateResult.rows[0]
    });
  } catch (error) {
    logger.error('Error cancelling booking:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel booking'
    });
  }
});

// GET /api/bookings/spaces - Get spaces for a location
router.get('/spaces', authenticate, async (req: Request, res: Response) => {
  try {
    const { locationId } = req.query;

    let query = `
      SELECT
        bs.*,
        bl.name as location_name
      FROM booking_spaces bs
      JOIN booking_locations bl ON bs.location_id = bl.id
      WHERE bs.is_active = true
    `;

    const params: any[] = [];

    if (locationId && locationId !== 'all') {
      query += ` AND bs.location_id = $1`;
      params.push(locationId);
    }

    query += ` ORDER BY bs.location_id, bs.display_order`;

    const result = await db.query(query, params);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    logger.error('Error fetching spaces:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch spaces'
    });
  }
});

// GET /api/bookings/customer-tiers - Get customer tiers
router.get('/customer-tiers', authenticate, async (req: Request, res: Response) => {
  try {
    const result = await db.query(
      'SELECT * FROM customer_tiers ORDER BY hourly_rate DESC'
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    logger.error('Error fetching customer tiers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch customer tiers'
    });
  }
});

// GET /api/bookings/locations - Get all locations
router.get('/locations', authenticate, async (req: Request, res: Response) => {
  try {
    const result = await db.query(
      'SELECT * FROM booking_locations WHERE is_active = true ORDER BY name'
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    logger.error('Error fetching locations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch locations'
    });
  }
});

// GET /api/bookings/stats - Get booking statistics for dashboard
router.get('/stats', authenticate, async (req: Request, res: Response) => {
  try {
    const { date, locationId } = req.query;
    const targetDate = date ? new Date(date as string) : new Date();

    // Set date range for today
    const startOfDay = new Date(targetDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    // Build location filter
    const locationFilter = locationId && locationId !== 'all'
      ? 'AND b.location_id = $3'
      : '';
    const params: any[] = [startOfDay.toISOString(), endOfDay.toISOString()];
    if (locationId && locationId !== 'all') {
      params.push(locationId);
    }

    // Get today's booking count and revenue
    const bookingStatsQuery = `
      SELECT
        COUNT(*) as today_count,
        COALESCE(SUM(total_amount), 0) as today_revenue,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count
      FROM bookings b
      WHERE b.start_at >= $1
        AND b.start_at <= $2
        AND b.status IN ('pending', 'confirmed')
        AND b.is_admin_block = false
        ${locationFilter}
    `;

    const bookingStats = await db.query(bookingStatsQuery, params);

    // Calculate occupancy rate (based on 6am-11pm = 17 hours = 34 slots per bay)
    const spacesQuery = locationId && locationId !== 'all'
      ? `SELECT COUNT(*) as space_count FROM booking_spaces WHERE location_id = $1 AND is_active = true`
      : `SELECT COUNT(*) as space_count FROM booking_spaces WHERE is_active = true`;

    const spacesResult = await db.query(
      spacesQuery,
      locationId && locationId !== 'all' ? [locationId] : []
    );

    const totalSpaces = spacesResult.rows[0]?.space_count || 1;
    const totalSlots = totalSpaces * 34; // 34 half-hour slots per day per space
    const bookedSlots = parseInt(bookingStats.rows[0]?.today_count || '0');
    const occupancyRate = totalSlots > 0
      ? Math.round((bookedSlots / totalSlots) * 100)
      : 0;

    res.json({
      success: true,
      data: {
        todayCount: parseInt(bookingStats.rows[0]?.today_count || '0'),
        todayRevenue: parseFloat(bookingStats.rows[0]?.today_revenue || '0'),
        occupancy: occupancyRate,
        pendingCount: parseInt(bookingStats.rows[0]?.pending_count || '0'),
        date: targetDate.toISOString(),
        locationId: locationId || 'all'
      }
    });
  } catch (error) {
    logger.error('Error fetching booking stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch booking statistics'
    });
  }
});

export default router;