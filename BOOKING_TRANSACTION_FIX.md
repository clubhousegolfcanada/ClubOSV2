# Booking System Transaction Fix - Critical Issue Resolution

## The Problem
The current booking creation endpoint has **NO TRANSACTION BOUNDARIES** and **NO CONFLICT DETECTION**, allowing:
1. Double bookings when two users select the same time slot simultaneously
2. Inconsistent loyalty tracking updates
3. Data corruption when partial failures occur

## The Solution

### Implementation Approach
We'll fix this with a **3-layer protection strategy**:

1. **Database Transactions** - Wrap all operations in BEGIN/COMMIT/ROLLBACK
2. **Optimistic Locking** - Check conflicts before committing
3. **PostgreSQL Exclusion Constraint** - Database-level guarantee against overlaps

### Files to Modify
1. `/ClubOSV1-backend/src/routes/bookings.ts` - Add transaction wrapper
2. `/ClubOSV1-backend/src/database/migrations/250_booking_exclusion_constraint.sql` - Add DB constraint
3. `/ClubOSV1-backend/src/services/booking/bookingService.ts` - New service with transaction logic

## Step-by-Step Fix

### Step 1: Create Migration for Exclusion Constraint
This PostgreSQL constraint makes double-bookings IMPOSSIBLE at the database level:

```sql
-- Migration 250: Add exclusion constraint to prevent booking overlaps
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Add exclusion constraint for booking time overlaps
ALTER TABLE bookings
ADD CONSTRAINT prevent_double_booking
EXCLUDE USING gist (
  location_id WITH =,
  tstzrange(start_at, end_at) WITH &&
) WHERE (status IN ('confirmed', 'pending'));

-- Create index for performance
CREATE INDEX idx_bookings_time_range ON bookings USING gist(tstzrange(start_at, end_at));
CREATE INDEX idx_bookings_location_status ON bookings(location_id, status);
```

### Step 2: Create Booking Service with Transaction Support
New file: `/ClubOSV1-backend/src/services/booking/bookingService.ts`

```typescript
import { db } from '../../utils/database';
import { logger } from '../../utils/logger';

export class BookingService {
  /**
   * Create a booking with full transaction support
   * This prevents double bookings and ensures data consistency
   */
  static async createBookingWithTransaction(bookingData: any) {
    const client = await db.getClient();

    try {
      // START TRANSACTION
      await client.query('BEGIN');

      // Step 1: Lock the time slot for checking (SELECT FOR UPDATE)
      const conflictCheck = await client.query(
        `SELECT id FROM bookings
         WHERE location_id = $1
         AND status IN ('confirmed', 'pending')
         AND tstzrange(start_at, end_at) && tstzrange($2::timestamptz, $3::timestamptz)
         FOR UPDATE`,
        [bookingData.locationId, bookingData.startAt, bookingData.endAt]
      );

      if (conflictCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        return {
          success: false,
          error: 'This time slot has just been booked by another customer. Please select a different time.',
          conflictingBookings: conflictCheck.rows
        };
      }

      // Step 2: Check space-specific conflicts for multi-simulator bookings
      for (const spaceId of bookingData.spaceIds) {
        const spaceConflict = await client.query(
          `SELECT id FROM bookings
           WHERE location_id = $1
           AND $2 = ANY(space_ids)
           AND status IN ('confirmed', 'pending')
           AND tstzrange(start_at, end_at) && tstzrange($3::timestamptz, $4::timestamptz)
           FOR UPDATE`,
          [bookingData.locationId, spaceId, bookingData.startAt, bookingData.endAt]
        );

        if (spaceConflict.rows.length > 0) {
          await client.query('ROLLBACK');
          return {
            success: false,
            error: 'One or more selected simulators are no longer available for this time.',
            conflictingSpace: spaceId
          };
        }
      }

      // Step 3: Create the booking
      const bookingResult = await client.query(
        `INSERT INTO bookings (
          location_id, space_ids, user_id, customer_tier_id,
          customer_name, customer_email, customer_phone,
          start_at, end_at, base_rate, total_amount,
          promo_code, admin_notes, is_admin_block, block_reason,
          status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())
        RETURNING *`,
        [
          bookingData.locationId,
          bookingData.spaceIds,
          bookingData.userId,
          bookingData.customerTierId,
          bookingData.customerName,
          bookingData.customerEmail,
          bookingData.customerPhone,
          bookingData.startAt,
          bookingData.endAt,
          bookingData.baseRate,
          bookingData.totalAmount,
          bookingData.promoCode,
          bookingData.adminNotes,
          bookingData.isAdminBlock || false,
          bookingData.blockReason,
          bookingData.isAdminBlock ? 'confirmed' : 'pending'
        ]
      );

      // Step 4: Update loyalty tracking (if applicable)
      if (!bookingData.isAdminBlock && bookingData.userId) {
        await client.query(
          `INSERT INTO loyalty_tracking (user_id, total_bookings, current_tier_id)
           VALUES ($1, 1, $2)
           ON CONFLICT (user_id)
           DO UPDATE SET
             total_bookings = loyalty_tracking.total_bookings + 1,
             updated_at = CURRENT_TIMESTAMP`,
          [bookingData.userId, bookingData.customerTierId]
        );

        // Check for auto tier upgrade
        const loyaltyCheck = await client.query(
          `SELECT lt.total_bookings, ct.auto_upgrade_after
           FROM loyalty_tracking lt
           JOIN customer_tiers ct ON lt.current_tier_id = ct.id
           WHERE lt.user_id = $1`,
          [bookingData.userId]
        );

        if (loyaltyCheck.rows[0]) {
          const { total_bookings, auto_upgrade_after } = loyaltyCheck.rows[0];
          if (auto_upgrade_after && total_bookings >= auto_upgrade_after) {
            await client.query(
              `UPDATE loyalty_tracking
               SET current_tier_id = 'member', last_tier_upgrade = CURRENT_TIMESTAMP
               WHERE user_id = $1`,
              [bookingData.userId]
            );

            // Log tier upgrade
            await client.query(
              `INSERT INTO customer_tier_history (user_id, old_tier_id, new_tier_id, change_reason)
               VALUES ($1, $2, 'member', 'Auto-upgrade after ' || $3 || ' bookings')`,
              [bookingData.userId, bookingData.customerTierId, auto_upgrade_after]
            );
          }
        }
      }

      // Step 5: Process promo code usage (if applicable)
      if (bookingData.promoCode) {
        await client.query(
          `UPDATE promo_codes
           SET use_count = use_count + 1,
               last_used = NOW()
           WHERE code = $1`,
          [bookingData.promoCode]
        );
      }

      // COMMIT TRANSACTION - All or nothing!
      await client.query('COMMIT');

      return {
        success: true,
        data: bookingResult.rows[0]
      };

    } catch (error: any) {
      // ROLLBACK on any error
      await client.query('ROLLBACK');

      // Check for exclusion constraint violation
      if (error.code === '23P01') {
        return {
          success: false,
          error: 'This time slot was just booked. Please refresh and select another time.',
          errorCode: 'BOOKING_CONFLICT'
        };
      }

      logger.error('Booking transaction failed:', error);
      throw error;
    } finally {
      // Always release the client back to the pool
      client.release();
    }
  }

  /**
   * Cancel a booking with proper transaction handling
   */
  static async cancelBookingWithTransaction(bookingId: string, userId: string, reason?: string) {
    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      // Lock the booking for update
      const booking = await client.query(
        `SELECT * FROM bookings WHERE id = $1 FOR UPDATE`,
        [bookingId]
      );

      if (!booking.rows[0]) {
        await client.query('ROLLBACK');
        return { success: false, error: 'Booking not found' };
      }

      // Update booking status
      await client.query(
        `UPDATE bookings
         SET status = 'cancelled',
             cancelled_at = NOW(),
             cancelled_by = $2,
             cancellation_reason = $3
         WHERE id = $1`,
        [bookingId, userId, reason]
      );

      // Restore promo code usage if applicable
      if (booking.rows[0].promo_code) {
        await client.query(
          `UPDATE promo_codes
           SET use_count = GREATEST(0, use_count - 1)
           WHERE code = $1`,
          [booking.rows[0].promo_code]
        );
      }

      await client.query('COMMIT');

      return { success: true };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Cancel booking transaction failed:', error);
      throw error;
    } finally {
      client.release();
    }
  }
}
```

### Step 3: Update the Booking Route
Modify `/ClubOSV1-backend/src/routes/bookings.ts`:

```typescript
import { BookingService } from '../services/booking/bookingService';

// Replace the existing POST /api/bookings endpoint
router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const validated = CreateBookingSchema.parse(req.body);
    const userId = (req as any).user?.id;

    // ... existing validation logic ...

    // Use the new transactional service
    const result = await BookingService.createBookingWithTransaction({
      locationId: validated.locationId,
      spaceIds: validated.spaceIds,
      userId,
      customerTierId,
      customerName: validated.customerName,
      customerEmail: validated.customerEmail,
      customerPhone: validated.customerPhone,
      startAt: validated.startAt,
      endAt: validated.endAt,
      baseRate: hourlyRate,
      totalAmount,
      promoCode: validated.promoCode,
      adminNotes: validated.adminNotes,
      isAdminBlock: validated.isAdminBlock,
      blockReason: validated.blockReason
    });

    if (!result.success) {
      return res.status(409).json(result); // 409 Conflict
    }

    res.json(result);
  } catch (error) {
    logger.error('Error creating booking:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create booking. Please try again.'
    });
  }
});
```

## Testing the Fix

### Test Scenario 1: Concurrent Bookings
```bash
# Terminal 1
curl -X POST http://localhost:3000/api/bookings \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"locationId":"bedford","spaceIds":["bay-1"],"startAt":"2025-10-06T14:00:00Z","endAt":"2025-10-06T15:00:00Z"}'

# Terminal 2 (run simultaneously)
curl -X POST http://localhost:3000/api/bookings \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"locationId":"bedford","spaceIds":["bay-1"],"startAt":"2025-10-06T14:00:00Z","endAt":"2025-10-06T15:00:00Z"}'
```

Expected: One succeeds, one gets conflict error

### Test Scenario 2: Overlapping Bookings
```bash
# First booking: 2-3 PM
# Second booking: 2:30-3:30 PM (overlaps)
```

Expected: Second booking rejected with clear error message

## Deployment Steps

1. **Test locally first**:
   ```bash
   cd ClubOSV1-backend
   npm run dev
   # Run test scenarios
   ```

2. **Apply migration**:
   ```bash
   npm run db:migrate
   ```

3. **Deploy**:
   ```bash
   git add -A
   git commit -m "fix: critical booking transaction issue preventing double bookings"
   git push
   ```

4. **Monitor**:
   - Watch for 409 Conflict responses (expected when preventing double bookings)
   - Check error logs for transaction failures
   - Monitor booking creation success rate

## Benefits

1. **100% Prevention of Double Bookings** - Database constraint makes it impossible
2. **Data Consistency** - All-or-nothing transactions
3. **Better User Experience** - Clear error messages when conflicts occur
4. **Financial Integrity** - Promo codes and payments tracked accurately
5. **Scalability** - Works correctly under high load

## Rollback Plan

If issues arise:
1. Remove the exclusion constraint: `ALTER TABLE bookings DROP CONSTRAINT prevent_double_booking;`
2. Revert to previous booking code
3. Monitor and investigate issues before re-applying