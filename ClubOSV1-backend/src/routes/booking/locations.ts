import { Router, Request, Response } from 'express';
import { authenticate, requireRole } from '../../middleware/auth';
import { logger } from '../../utils/logger';
import { pool } from '../../utils/database';

const router = Router();

// GET /api/booking/locations - Get all visible locations (or all for admin)
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'operator';

    const query = `
      SELECT
        l.*,
        COUNT(DISTINCT n.id) FILTER (WHERE n.is_active = true) as active_notice_count,
        COUNT(DISTINCT s.id) FILTER (WHERE s.is_active = true AND s.is_bookable = true) as available_spaces
      FROM booking_locations l
      LEFT JOIN location_notices n ON l.id = n.location_id AND n.is_active = true
      LEFT JOIN booking_spaces s ON l.id = s.location_id
      WHERE l.is_active = true
        ${!isAdmin ? 'AND l.is_visible = true' : ''}
      GROUP BY l.id
      ORDER BY l.name
    `;

    const result = await pool.query(query);

    res.json({
      success: true,
      data: result.rows.map(row => ({
        id: row.id,
        name: row.name,
        address: row.address,
        city: row.city,
        state: row.state,
        zip: row.zip,
        phone: row.phone,
        email: row.email,
        opensAt: row.opens_at,
        closesAt: row.closes_at,
        isVisible: row.is_visible,
        isActive: row.is_active,
        minBookingHours: row.min_booking_hours,
        maxAdvanceDays: row.max_advance_days,
        depositAmount: row.deposit_amount,
        activeNotices: parseInt(row.active_notice_count),
        availableSpaces: parseInt(row.available_spaces)
      }))
    });
  } catch (error) {
    logger.error('Failed to get locations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve locations'
    });
  }
});

// GET /api/booking/locations/:id/notices - Get active notices for a location
router.get('/:locationId/notices', authenticate, async (req: Request, res: Response) => {
  try {
    const { locationId } = req.params;
    const { includeExpired = false } = req.query;

    // Auto-expire old notices
    await pool.query('SELECT expire_old_notices()');

    const query = `
      SELECT
        n.*,
        u.name as created_by_name
      FROM location_notices n
      LEFT JOIN users u ON n.created_by = u.id
      WHERE n.location_id = $1
        ${!includeExpired ? 'AND n.is_active = true' : ''}
        AND (n.show_until IS NULL OR n.show_until > NOW())
      ORDER BY n.severity = 'critical' DESC,
               n.severity = 'warning' DESC,
               n.created_at DESC
    `;

    const result = await pool.query(query, [locationId]);

    res.json({
      success: true,
      data: result.rows.map(row => ({
        id: row.id,
        locationId: row.location_id,
        title: row.title,
        message: row.message,
        severity: row.severity,
        isActive: row.is_active,
        showOnBookingPage: row.show_on_booking_page,
        showInConfirmations: row.show_in_confirmations,
        showUntil: row.show_until,
        createdBy: row.created_by,
        createdByName: row.created_by_name,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }))
    });
  } catch (error) {
    logger.error('Failed to get location notices:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve notices'
    });
  }
});

// POST /api/booking/locations/:id/notices - Create a notice (admin only)
router.post('/:locationId/notices', authenticate, requireRole(['admin', 'operator']), async (req: Request, res: Response) => {
  try {
    const { locationId } = req.params;
    const {
      title,
      message,
      severity = 'info',
      showOnBookingPage = true,
      showInConfirmations = true,
      showUntil
    } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Notice message is required'
      });
    }

    const query = `
      INSERT INTO location_notices (
        location_id,
        title,
        message,
        severity,
        show_on_booking_page,
        show_in_confirmations,
        show_until,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const values = [
      locationId,
      title,
      message,
      severity,
      showOnBookingPage,
      showInConfirmations,
      showUntil || null,
      req.user!.id
    ];

    const result = await pool.query(query, values);

    logger.info('Location notice created', {
      noticeId: result.rows[0].id,
      locationId,
      severity,
      createdBy: req.user!.email
    });

    res.json({
      success: true,
      data: {
        id: result.rows[0].id,
        locationId: result.rows[0].location_id,
        title: result.rows[0].title,
        message: result.rows[0].message,
        severity: result.rows[0].severity,
        isActive: result.rows[0].is_active,
        showOnBookingPage: result.rows[0].show_on_booking_page,
        showInConfirmations: result.rows[0].show_in_confirmations,
        showUntil: result.rows[0].show_until,
        createdAt: result.rows[0].created_at
      }
    });
  } catch (error) {
    logger.error('Failed to create notice:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create notice'
    });
  }
});

// PATCH /api/booking/locations/:id/visibility - Toggle location visibility (admin only)
router.patch('/:locationId/visibility', authenticate, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const { locationId } = req.params;
    const { isVisible } = req.body;

    if (typeof isVisible !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isVisible must be a boolean value'
      });
    }

    const query = `
      UPDATE booking_locations
      SET is_visible = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;

    const result = await pool.query(query, [isVisible, locationId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Location not found'
      });
    }

    logger.info('Location visibility updated', {
      locationId,
      isVisible,
      updatedBy: req.user!.email
    });

    res.json({
      success: true,
      data: {
        id: result.rows[0].id,
        name: result.rows[0].name,
        isVisible: result.rows[0].is_visible,
        isActive: result.rows[0].is_active
      }
    });
  } catch (error) {
    logger.error('Failed to update location visibility:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update visibility'
    });
  }
});

// PATCH /api/booking/locations/:id/notices/:noticeId - Update notice (admin only)
router.patch('/:locationId/notices/:noticeId', authenticate, requireRole(['admin', 'operator']), async (req: Request, res: Response) => {
  try {
    const { locationId, noticeId } = req.params;
    const updates = req.body;

    // Build dynamic update query
    const allowedFields = ['title', 'message', 'severity', 'is_active', 'show_on_booking_page', 'show_in_confirmations', 'show_until'];
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    for (const field of allowedFields) {
      if (field in updates) {
        updateFields.push(`${field} = $${paramCount}`);
        values.push(updates[field]);
        paramCount++;
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    values.push(noticeId);
    values.push(locationId);

    const query = `
      UPDATE location_notices
      SET ${updateFields.join(', ')}, updated_at = NOW()
      WHERE id = $${paramCount} AND location_id = $${paramCount + 1}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Notice not found'
      });
    }

    logger.info('Notice updated', {
      noticeId,
      locationId,
      updatedBy: req.user!.email
    });

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Failed to update notice:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update notice'
    });
  }
});

// DELETE /api/booking/notices/:id - Remove a notice (admin only)
router.delete('/notices/:noticeId', authenticate, requireRole(['admin', 'operator']), async (req: Request, res: Response) => {
  try {
    const { noticeId } = req.params;

    const query = 'DELETE FROM location_notices WHERE id = $1 RETURNING location_id';
    const result = await pool.query(query, [noticeId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Notice not found'
      });
    }

    logger.info('Notice deleted', {
      noticeId,
      locationId: result.rows[0].location_id,
      deletedBy: req.user!.email
    });

    res.json({
      success: true,
      message: 'Notice deleted successfully'
    });
  } catch (error) {
    logger.error('Failed to delete notice:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete notice'
    });
  }
});

// GET /api/booking/locations/:id/config - Get location configuration
router.get('/:locationId/config', authenticate, async (req: Request, res: Response) => {
  try {
    const { locationId } = req.params;

    const query = `
      SELECT c.*, l.name as location_name
      FROM booking_config c
      JOIN booking_locations l ON c.location_id = l.id
      WHERE c.location_id = $1
    `;

    const result = await pool.query(query, [locationId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Location configuration not found'
      });
    }

    res.json({
      success: true,
      data: {
        locationId: result.rows[0].location_id,
        locationName: result.rows[0].location_name,
        minDurationMinutes: result.rows[0].min_duration_minutes,
        incrementMinutes: result.rows[0].increment_minutes,
        minAdvanceNoticeHours: result.rows[0].min_advance_notice_hours,
        allowCrossMidnight: result.rows[0].allow_cross_midnight,
        allowRecurring: result.rows[0].allow_recurring,
        maxRecurringWeeks: result.rows[0].max_recurring_weeks,
        freeRescheduleCount: result.rows[0].free_reschedule_count,
        rescheduleFee: result.rows[0].reschedule_fee,
        maxChangesAllowed: result.rows[0].max_changes_allowed,
        flagAfterChanges: result.rows[0].flag_after_changes,
        enableUpsellPrompts: result.rows[0].enable_upsell_prompts,
        upsellTriggerPercent: result.rows[0].upsell_trigger_percent,
        upsellMinutesBeforeEnd: result.rows[0].upsell_minutes_before_end,
        sessionsForFreeHour: result.rows[0].sessions_for_free_hour,
        autoUpgradeAfterBookings: result.rows[0].auto_upgrade_after_bookings
      }
    });
  } catch (error) {
    logger.error('Failed to get location config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve configuration'
    });
  }
});

// GET /api/booking/locations/:id/spaces - Get spaces for a location
router.get('/:locationId/spaces', authenticate, async (req: Request, res: Response) => {
  try {
    const { locationId } = req.params;
    const { includeInactive = false } = req.query;

    const query = `
      SELECT *
      FROM booking_spaces
      WHERE location_id = $1
        ${!includeInactive ? 'AND is_active = true AND is_bookable = true' : ''}
      ORDER BY display_order, name
    `;

    const result = await pool.query(query, [locationId]);

    res.json({
      success: true,
      data: result.rows.map(row => ({
        id: row.id,
        locationId: row.location_id,
        name: row.name,
        type: row.type,
        capacity: row.capacity,
        features: row.features,
        isPremium: row.is_premium,
        premiumRateMultiplier: row.premium_rate_multiplier,
        isActive: row.is_active,
        isBookable: row.is_bookable,
        displayOrder: row.display_order,
        colorHex: row.color_hex
      }))
    });
  } catch (error) {
    logger.error('Failed to get spaces:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve spaces'
    });
  }
});

export default router;