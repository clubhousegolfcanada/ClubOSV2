import express, { Request, Response, NextFunction } from 'express';
import { pool } from '../database';
import { authMiddleware } from '../middleware/auth';
import logger from '../services/logger';
import { z } from 'zod';

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
  promoCode: z.string().optional(),
  adminNotes: z.string().optional(),
  isAdminBlock: z.boolean().optional(),
  blockReason: z.string().optional()
});

const UpdateBookingSchema = z.object({
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  status: z.enum(['pending', 'confirmed', 'cancelled', 'completed', 'no-show']).optional(),
  adminNotes: z.string().optional()
});

// GET /api/bookings/day - Get bookings for a specific day
router.get('/day', authMiddleware, async (req: Request, res: Response) => {
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

    let query = `
      SELECT
        b.*,
        bl.name as location_name,
        ct.name as tier_name,
        ct.color as tier_color,
        u.name as user_name,
        u.email as user_email,
        ARRAY_AGG(
          json_build_object(
            'id', bs.id,
            'name', bs.name
          )
        ) as spaces
      FROM bookings b
      LEFT JOIN booking_locations bl ON b.location_id = bl.id
      LEFT JOIN customer_tiers ct ON b.customer_tier_id = ct.id
      LEFT JOIN users u ON b.user_id = u.id
      LEFT JOIN booking_spaces bs ON bs.id = ANY(b.space_ids)
      WHERE b.start_at >= $1 AND b.start_at <= $2
    `;

    const params: any[] = [startOfDay.toISOString(), endOfDay.toISOString()];

    if (locationId && locationId !== 'all') {
      query += ` AND b.location_id = $3`;
      params.push(locationId);
    }

    query += ` GROUP BY b.id, bl.name, ct.name, ct.color, u.name, u.email`;
    query += ` ORDER BY b.start_at ASC`;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    logger.error('Error fetching day bookings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch bookings'
    });
  }
});

// GET /api/bookings/availability - Check availability for a time slot
router.get('/availability', authMiddleware, async (req: Request, res: Response) => {
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

    let query = `
      SELECT
        start_at,
        end_at,
        space_ids,
        is_admin_block
      FROM bookings
      WHERE location_id = $1
        AND start_at >= $2
        AND start_at <= $3
        AND status IN ('confirmed', 'pending')
    `;

    const params: any[] = [locationId, startOfDay.toISOString(), endOfDay.toISOString()];

    if (spaceId) {
      query += ` AND $4 = ANY(space_ids)`;
      params.push(spaceId);
    }

    const result = await pool.query(query, params);

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
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const validated = CreateBookingSchema.parse(req.body);
    const userId = (req as any).user?.id;

    // Get booking configuration
    const configResult = await pool.query(
      "SELECT value FROM system_settings WHERE key = 'booking_config'"
    );
    const config = configResult.rows[0]?.value || {};

    // Validate duration
    const startTime = new Date(validated.startAt);
    const endTime = new Date(validated.endAt);
    const durationMinutes = Math.floor((endTime.getTime() - startTime.getTime()) / 60000);

    if (durationMinutes < (config.minDuration || 60)) {
      return res.status(400).json({
        success: false,
        error: `Minimum booking duration is ${config.minDuration || 60} minutes`
      });
    }

    // Check for 30-minute increments after first hour
    if (durationMinutes > 60 && (durationMinutes - 60) % 30 !== 0) {
      return res.status(400).json({
        success: false,
        error: 'Bookings after 1 hour must be in 30-minute increments (1.5h, 2h, 2.5h, etc)'
      });
    }

    // Get or assign customer tier
    let customerTierId = 'new'; // Default to new customer
    if (userId) {
      const loyaltyResult = await pool.query(
        'SELECT current_tier_id FROM loyalty_tracking WHERE user_id = $1',
        [userId]
      );
      if (loyaltyResult.rows[0]) {
        customerTierId = loyaltyResult.rows[0].current_tier_id;
      }
    }

    // Get tier pricing
    const tierResult = await pool.query(
      'SELECT hourly_rate FROM customer_tiers WHERE id = $1',
      [customerTierId]
    );
    const hourlyRate = tierResult.rows[0]?.hourly_rate || 30;
    const totalAmount = (hourlyRate * durationMinutes) / 60;

    // Create the booking
    const insertResult = await pool.query(
      `INSERT INTO bookings (
        location_id, space_ids, user_id, customer_tier_id,
        customer_name, customer_email, customer_phone,
        start_at, end_at, base_rate, total_amount,
        promo_code, admin_notes, is_admin_block, block_reason,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *`,
      [
        validated.locationId,
        validated.spaceIds,
        userId,
        customerTierId,
        validated.customerName,
        validated.customerEmail,
        validated.customerPhone,
        validated.startAt,
        validated.endAt,
        hourlyRate,
        totalAmount,
        validated.promoCode,
        validated.adminNotes,
        validated.isAdminBlock || false,
        validated.blockReason,
        validated.isAdminBlock ? 'confirmed' : 'pending'
      ]
    );

    // Update loyalty tracking if it's a regular booking
    if (!validated.isAdminBlock && userId) {
      await pool.query(
        `INSERT INTO loyalty_tracking (user_id, total_bookings, current_tier_id)
         VALUES ($1, 1, $2)
         ON CONFLICT (user_id)
         DO UPDATE SET
           total_bookings = loyalty_tracking.total_bookings + 1,
           updated_at = CURRENT_TIMESTAMP`,
        [userId, customerTierId]
      );

      // Check for auto tier upgrade
      const loyaltyCheck = await pool.query(
        `SELECT lt.total_bookings, ct.auto_upgrade_after
         FROM loyalty_tracking lt
         JOIN customer_tiers ct ON lt.current_tier_id = ct.id
         WHERE lt.user_id = $1`,
        [userId]
      );

      if (loyaltyCheck.rows[0]) {
        const { total_bookings, auto_upgrade_after } = loyaltyCheck.rows[0];
        if (auto_upgrade_after && total_bookings >= auto_upgrade_after) {
          // Upgrade to member tier
          await pool.query(
            `UPDATE loyalty_tracking
             SET current_tier_id = 'member', last_tier_upgrade = CURRENT_TIMESTAMP
             WHERE user_id = $1`,
            [userId]
          );
        }
      }
    }

    res.json({
      success: true,
      data: insertResult.rows[0]
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
router.patch('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validated = UpdateBookingSchema.parse(req.body);
    const userId = (req as any).user?.id;
    const userRole = (req as any).user?.role;

    // Check if booking exists and user has permission
    const bookingResult = await pool.query(
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

    const updateResult = await pool.query(
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
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    const userRole = (req as any).user?.role;

    // Check if booking exists and user has permission
    const bookingResult = await pool.query(
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
    const updateResult = await pool.query(
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
router.get('/spaces', authMiddleware, async (req: Request, res: Response) => {
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

    const result = await pool.query(query, params);

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
router.get('/customer-tiers', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
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
router.get('/locations', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
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

export default router;