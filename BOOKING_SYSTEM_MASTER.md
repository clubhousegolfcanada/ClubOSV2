# ClubOS Booking System - Master Implementation Plan
**Version 3.0 - Updated with Complete Feature Requirements**

## Executive Summary
Replace Skedda/Kisi with a fully integrated ClubOS booking platform that leverages existing infrastructure, supports cross-midnight bookings, customer tiers, dynamic pricing, loyalty rewards, and provides a modular configuration system for easy adjustments without code changes.

**Key Innovations**:
- All booking rules stored in database as JSONB (changeable via admin panel)
- Color-coded customer categories with dynamic pricing
- Smart upsell prompts and loyalty automation
- Multi-simulator booking support
- Location-specific notices and alerts

---

## System Architecture

### High-Level Flow
```
Customer/Operator → ClubOS Frontend → Booking Components → Jason's Backend API → UniFi Doors
                                    ↓
                          ClubOS Backend (Config & State)
```

### Integration Strategy
- **Frontend**: Replace Skedda iframe with native ClubOS components
- **Backend**: Use Jason's existing booking API (mirrors Skedda/Kisi)
- **Database**: Store config in `system_settings` table as JSONB
- **Door Access**: Jason's server handles UniFi integration

---

## Leverage Existing ClubOS Infrastructure

### UI Components to Reuse
```typescript
// Already available in ClubOS:
- Button, LoadingSpinner, Skeleton (UI basics)
- PageHeader, Navigation (Layout)
- Input, Toggle (Forms)
- StatusBadge (States)
- MessageCard pattern (Booking cards)
- Modal patterns (Booking details)
- ErrorBoundary (Error handling)
```

### Infrastructure to Leverage
```typescript
// Authentication & API
import { tokenManager } from '@/utils/tokenManager';
import { http } from '@/api/http';
import { useAuthState } from '@/state/useStore';

// Notifications & Feedback
import { useNotifications } from '@/state/hooks';

// Role Management
import { hasRole } from '@/utils/roleUtils';

// Existing Locations
const LOCATIONS = ['Bedford', 'Dartmouth', 'River Oaks', 'Bayers Lake', 'Stratford', 'Truro', 'Halifax'];
```

### Database Configuration Pattern
```sql
-- Store booking config in existing system_settings table
INSERT INTO system_settings (key, value, category) VALUES
('booking_config', '{
  "minDuration": 60,
  "maxDuration": 360,
  "gridInterval": 30,
  "bufferBefore": 5,
  "bufferAfter": 5,
  "allowCrossMidnight": true,
  "maxAdvanceBooking": 30
}'::jsonb, 'booking');

-- Per-location settings
INSERT INTO system_settings (key, value, category) VALUES
('booking_locations', '[
  {
    "id": "dartmouth",
    "name": "Dartmouth",
    "timezone": "America/Toronto",
    "hours": {"open": "00:00", "close": "24:00"},
    "spaces": ["box-1", "box-2", "box-3", "box-4"],
    "theme": {"primary": "#0B3D3A"}
  }
]'::jsonb, 'booking');
```

---

## 🔑 CORE FEATURE REQUIREMENTS (From SOPs)

### Customer Tiers & Color Coding
```typescript
interface CustomerTier {
  id: string;
  name: string;
  color: string;          // Hex color for calendar display
  bookingRules: {
    maxAdvanceDays: number;     // 14 for new, 30 for existing
    allowRecurring: boolean;    // Only Standard Members+
    requireDeposit: boolean;    // $10 deposit requirement
    changeLimit: number;        // 1 free change, then $10 fee
  };
  pricing: {
    hourlyRate: number;         // Dynamic per tier
    discountPercent?: number;   // e.g., 50% for promo
  };
  triggers: {
    afterBookings?: number;     // Auto-upgrade after X bookings
    emailOnUpgrade?: boolean;   // Send tier upgrade email
  };
}

// Default Customer Tiers
const CUSTOMER_TIERS = {
  NEW: { color: '#3B82F6', maxAdvanceDays: 14, hourlyRate: 30 },      // Blue
  MEMBER: { color: '#FCD34D', maxAdvanceDays: 30, hourlyRate: 22.50 }, // Yellow
  PROMO: { color: '#10B981', maxAdvanceDays: 14, hourlyRate: 15 },     // Green
  FREQUENT: { color: '#8B5CF6', maxAdvanceDays: 30, hourlyRate: 20 }   // Purple
};
```

### Time Rules & Increments
```typescript
interface TimeRules {
  minimumDuration: 60;           // MUST be 1 hour minimum
  incrementAfterFirst: 30;       // After 1hr, allow 30min increments (1.5h, 2h, etc)
  minAdvanceBooking: 60;         // Cannot book <1hr before start
  maxAdvanceBooking: {
    new: 14,                     // New customers: 14 days
    existing: 30                 // Existing: 30 days
  };
  changePolicy: {
    allowedChanges: 1,           // One free reschedule
    changeFee: 10,               // $10 for additional changes
    flagAfterChanges: 2          // Flag frequent changers
  };
}
```

### Smart Features
```typescript
interface SmartFeatures {
  upsellPrompt: {
    enabled: boolean;
    triggerMinutesBefore: 10;    // 10min before end
    triggerProbability: 0.4;     // 40% of sessions
    discountPercent?: 20;        // Optional discount
    messageTemplate: string;
  };
  loyaltyRewards: {
    freeAfterSessions: 10;       // 11th session free
    surpriseRewards: boolean;    // Random rewards
    badges: boolean;             // Achievement system
  };
  favoriteSimulator: {
    enabled: boolean;
    oneClickRebook: boolean;     // "Book same time next week?"
  };
}
```

## Modular Configuration System

### Enhanced BookingConfig Service
```typescript
// /ClubOSV1-frontend/src/services/booking/bookingConfig.ts

interface BookingConfig {
  // Time Settings (from requirements)
  minDuration: number;           // 60 minutes REQUIRED
  incrementAfterFirst: number;   // 30 minute increments after 1st hour
  maxDuration: number;           // 360 minutes (6 hours)
  gridInterval: number;          // 30 minutes display grid
  snapInterval: number;          // 30 minutes snap

  // Customer Tiers & Colors
  customerTiers: CustomerTier[];
  autoTierUpgrade: boolean;

  // Pricing & Deposits
  depositAmount: number;         // $10 deposit
  changeFee: number;            // $10 change fee after first
  dynamicPricing: boolean;

  // Door Access Buffers
  bufferBefore: number;          // 5 minutes before booking
  bufferAfter: number;           // 5 minutes after booking

  // Booking Rules
  allowCrossMidnight: boolean;   // Enable 11 PM - 2 AM bookings
  requireDeposit: boolean;       // Payment required
  cancellationWindow: number;    // Hours before booking
  allowMultiSimulator: boolean;  // Book multiple boxes at once

  // Smart Features
  upsellPrompts: SmartFeatures['upsellPrompt'];
  loyaltyProgram: SmartFeatures['loyaltyRewards'];

  // Display Options
  showPricing: boolean;          // Show prices in UI
  showPhotos: boolean;          // Show space photos
  groupByLocation: boolean;      // Group view by location
  showNotices: boolean;         // Location-specific alerts
}

class BookingConfigService {
  private static config: BookingConfig | null = null;

  static async getConfig(): Promise<BookingConfig> {
    if (!this.config) {
      const { data } = await http.get('/api/settings/booking_config');
      this.config = data.value;
    }
    return this.config;
  }

  static async updateConfig(updates: Partial<BookingConfig>) {
    const { data } = await http.patch('/api/settings/booking_config', updates);
    this.config = data.value;
    return this.config;
  }

  // Helper methods
  static getMinDuration() {
    return this.config?.minDuration || 60;
  }

  static isValidDuration(minutes: number) {
    return minutes >= this.getMinDuration() &&
           minutes <= (this.config?.maxDuration || 360);
  }
}
```

### Admin Configuration Panel
```typescript
// /ClubOSV1-frontend/src/components/admin/BookingConfigPanel.tsx

export const BookingConfigPanel = () => {
  const [config, setConfig] = useState<BookingConfig>();

  return (
    <div className="space-y-4">
      <h3>Booking Configuration</h3>

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Minimum Booking (minutes)"
          type="number"
          value={config?.minDuration}
          onChange={(e) => updateConfig({minDuration: Number(e.target.value)})}
          help="Change from 60 to 30 to allow 30-minute bookings"
        />

        <Input
          label="Maximum Booking (minutes)"
          type="number"
          value={config?.maxDuration}
          onChange={(e) => updateConfig({maxDuration: Number(e.target.value)})}
        />

        <Toggle
          label="Allow Cross-Midnight Bookings"
          checked={config?.allowCrossMidnight}
          onChange={(checked) => updateConfig({allowCrossMidnight: checked})}
          help="Enable bookings like 11 PM - 2 AM"
        />
      </div>

      <Button onClick={saveConfig}>Save Configuration</Button>
    </div>
  );
};
```

---

## Implementation Components (6 Parallel Tracks - Updated)

### Part 1: BookingCalendar with Color-Coded Categories ✅
**Developer 1 Focus**: Calendar grid with customer tier colors

```typescript
interface BookingCalendarProps {
  locationId?: string;
  date?: Date;
  onBookingCreate: (booking: BookingIntent) => void;
  showColorLegend?: boolean;
}

Key Features:
- COLOR-CODED bookings by customer tier (Blue=New, Yellow=Member, Green=Promo)
- Grid view (Day/Week views required)
- Drag-select with 1hr minimum, 30min increments after
- Admin block-off times (cleaning, maintenance)
- Filter by customer type, location, time
- Reuse TicketCenter location patterns
```

**Files to Create**:
- `/components/booking/calendar/BookingCalendar.tsx`
- `/components/booking/calendar/DayGrid.tsx`
- `/components/booking/calendar/BookingBlock.tsx` (with color coding)
- `/components/booking/calendar/ColorLegend.tsx`
- `/components/booking/calendar/AdminBlockOff.tsx`
- `/hooks/booking/useDragSelect.ts`

---

### Part 2: Time Selector with Smart Increments ✅
**Developer 2 Focus**: 1hr minimum + 30min increments after

```typescript
interface TimeIncrementSelectorProps {
  config: BookingConfig;
  customerTier: CustomerTier;
  startTime?: Date;
  endTime?: Date;
  onChange: (start: Date, end: Date) => void;
}

Key Features:
- ENFORCED 1-hour minimum booking
- 30-minute increments AFTER first hour (1.5h, 2h, 2.5h)
- Cannot book <1hr before start time
- Respect tier-based advance booking limits (14 or 30 days)
- Cross-midnight support (11 PM - 2 AM)
- Visual feedback for invalid times
```

**Files to Create**:
- `/components/booking/selectors/TimeIncrementSelector.tsx`
- `/components/booking/selectors/DurationPicker.tsx`
- `/components/booking/selectors/AdvanceBookingValidator.tsx`
- `/utils/booking/timeIncrementLogic.ts`

---

### Part 3: Tiered Booking Forms with Change Management ✅
**Developer 3 Focus**: Customer tier-aware forms with change tracking

```typescript
interface TieredBookingFormProps {
  userRole: 'admin' | 'operator' | 'customer';
  customerTier: CustomerTier;
  changeCount: number;  // Track reschedules
  onSubmit: (booking: Booking) => void;
}

Key Features:
- Dynamic pricing based on tier ($15-$30/hr)
- $10 deposit collection
- One free reschedule, $10 fee after
- Flag users with >2 changes
- CRM notes for staff (behavior tracking)
- Promo code/gift card integration
- Recurring bookings (Standard Members only)
```

**Files to Create**:
- `/components/booking/forms/TieredBookingForm.tsx`
- `/components/booking/forms/ChangeManagement.tsx`
- `/components/booking/forms/PromoCodeInput.tsx`
- `/components/booking/forms/RecurringBookingOptions.tsx`
- `/components/booking/forms/CRMNotesPanel.tsx`

---

### Part 4: Multi-Location with Notices & Alerts ✅ COMPLETED
**Developer 4 Focus**: Location management with temporary alerts

```typescript
interface LocationWithNoticesProps {
  locationId: string;
  activeNotices: LocationNotice[];
  visibility: 'single' | 'all' | 'filtered';
}

interface LocationNotice {
  id: string;
  locationId: string;
  message: string;  // "Side screens down - play at own risk"
  severity: 'info' | 'warning' | 'critical';
  showUntil?: Date;
}

Key Features:
- Admin-posted location notices
- Show on booking page & confirmations
- Toggle location visibility on/off
- Filter view by location
- Notices persist until manually removed
```

**Files to Create**:
- `/components/booking/locations/LocationNoticeManager.tsx`
- `/components/booking/locations/LocationVisibilityToggle.tsx`
- `/components/booking/locations/NoticeDisplay.tsx`
- `/services/booking/locationNoticeService.ts`

---

### Part 5: Multi-Simulator Booking & Group Coordination ✅
**Developer 5 Focus**: Book multiple boxes at once

```typescript
interface MultiSimulatorBookingProps {
  locationId: string;
  availableSpaces: Space[];
  onMultiSelect: (spaceIds: string[]) => void;
}

Key Features:
- Select multiple simulators in one booking
- Prevent overlap/overbooking
- Support full-location rental
- Clear availability indicators
- Group booking coordination
- Favorite simulator tracking
```

**Files to Create**:
- `/components/booking/multi/MultiSimulatorSelector.tsx`
- `/components/booking/multi/GroupBookingCoordinator.tsx`
- `/components/booking/multi/FavoriteSimulator.tsx`
- `/components/booking/multi/AvailabilityMatrix.tsx`

---

### Part 6: Smart Upsell & Loyalty System ✅
**Developer 6 Focus**: Automated prompts and rewards

```typescript
interface SmartUpsellSystemProps {
  bookingId: string;
  customerId: string;
  sessionEndTime: Date;
  loyaltyStats: {
    totalSessions: number;
    currentStreak: number;
    tierStatus: CustomerTier;
  };
}

Key Features:
- SMS upsell 10min before session end (40% trigger rate)
- One-click extend with optional discount
- "Book same time next week?" after confirmation
- Free hour after 10 sessions
- Surprise rewards and badges
- Auto-tier upgrades (3 bookings = Standard Member)
- Email notifications on tier changes
```

**Files to Create**:
- `/components/booking/smart/UpsellPromptManager.tsx`
- `/components/booking/smart/LoyaltyTracker.tsx`
- `/components/booking/smart/OneClickRebook.tsx`
- `/components/booking/smart/TierUpgradeNotifier.tsx`
- `/services/booking/smartUpsellService.ts`
- `/services/booking/loyaltyRewardService.ts`

---

## API Integration with Jason's Backend

### Expected Endpoints from Jason
```typescript
// Jason's backend should provide these endpoints
interface BookingAPI {
  // Core Operations
  'GET /api/bookings/day': (params: {locationId, date}) => Booking[];
  'POST /api/bookings': (body: CreateBookingDto) => Booking;
  'PATCH /api/bookings/:id': (body: UpdateBookingDto) => Booking;
  'DELETE /api/bookings/:id': () => void;

  // Availability
  'GET /api/bookings/availability': (params: {locationId, spaceId, date}) => TimeSlot[];
  'POST /api/bookings/check': (body: {spaceId, start, end}) => {available: boolean};

  // Spaces & Locations
  'GET /api/spaces': (params: {locationId}) => Space[];
  'GET /api/spaces/:id': () => SpaceDetails;

  // Door Integration
  'POST /api/doors/schedule': (body: {bookingId, unlockAt, lockAt}) => {tokenId: string};
  'DELETE /api/doors/schedule/:tokenId': () => void;
}
```

### Service Layer
```typescript
// /ClubOSV1-frontend/src/services/booking/bookingApi.ts

import { http } from '@/api/http';

export class BookingAPI {
  static async getDayBookings(locationId: string, date: string) {
    // Use Jason's backend URL if different
    const response = await http.get('/api/bookings/day', {
      params: { locationId, date }
    });
    return response.data;
  }

  static async createBooking(booking: CreateBookingDto) {
    const config = await BookingConfigService.getConfig();

    // Apply config rules
    if (booking.duration < config.minDuration) {
      throw new Error(`Minimum booking is ${config.minDuration} minutes`);
    }

    const response = await http.post('/api/bookings', booking);
    return response.data;
  }
}
```

---

## Enhanced Database Schema

### Core Tables with New Requirements
```sql
-- Customer tiers and tags
CREATE TABLE customer_tiers (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(7) NOT NULL,  -- Hex color for calendar
  hourly_rate DECIMAL(10,2),
  discount_percent INT,
  max_advance_days INT,
  allow_recurring BOOLEAN DEFAULT false,
  require_deposit BOOLEAN DEFAULT true,
  auto_upgrade_after INT,  -- Bookings count for auto-upgrade
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default tiers
INSERT INTO customer_tiers (id, name, color, hourly_rate, max_advance_days) VALUES
('new', 'New Customer', '#3B82F6', 30.00, 14),
('member', 'Standard Member', '#FCD34D', 22.50, 30),
('promo', 'Promo User', '#10B981', 15.00, 14),
('frequent', 'Frequent Booker', '#8B5CF6', 20.00, 30);

-- Enhanced bookings table
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id VARCHAR(50) REFERENCES booking_locations(id),
  space_ids VARCHAR(50)[] NOT NULL,  -- Array for multi-simulator
  user_id UUID REFERENCES users(id),
  customer_tier_id VARCHAR(50) REFERENCES customer_tiers(id),

  -- Time fields
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  duration_minutes INT GENERATED ALWAYS AS (
    EXTRACT(EPOCH FROM (end_at - start_at)) / 60
  ) STORED,

  -- Pricing
  base_rate DECIMAL(10,2),
  deposit_amount DECIMAL(10,2) DEFAULT 10.00,
  total_amount DECIMAL(10,2),
  promo_code VARCHAR(50),

  -- Change tracking
  change_count INT DEFAULT 0,
  change_fee_charged DECIMAL(10,2) DEFAULT 0,
  flagged_for_changes BOOLEAN DEFAULT false,

  -- Status
  status VARCHAR(20) DEFAULT 'confirmed',
  is_recurring BOOLEAN DEFAULT false,
  recurring_id UUID,  -- Links recurring bookings

  -- Smart features
  upsell_sent BOOLEAN DEFAULT false,
  upsell_accepted BOOLEAN DEFAULT false,
  favorite_simulator VARCHAR(50),

  -- Metadata
  crm_notes TEXT,
  admin_notes TEXT,
  block_reason VARCHAR(100),  -- For admin blocks

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent double bookings (updated for array)
  EXCLUDE USING gist (
    space_ids WITH &&,
    tstzrange(start_at, end_at) WITH &&
  ) WHERE (status IN ('confirmed', 'pending'))
);

-- Location notices/alerts
CREATE TABLE location_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id VARCHAR(50) REFERENCES booking_locations(id),
  message TEXT NOT NULL,
  severity VARCHAR(20) DEFAULT 'info',  -- info, warning, critical
  active BOOLEAN DEFAULT true,
  show_until TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Loyalty tracking
CREATE TABLE loyalty_tracking (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  total_bookings INT DEFAULT 0,
  current_tier_id VARCHAR(50) REFERENCES customer_tiers(id),
  free_hours_earned INT DEFAULT 0,
  free_hours_used INT DEFAULT 0,
  last_tier_upgrade TIMESTAMPTZ,
  badges JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Smart upsell tracking
CREATE TABLE upsell_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id),
  sent_at TIMESTAMPTZ,
  discount_offered DECIMAL(10,2),
  accepted BOOLEAN DEFAULT false,
  extended_minutes INT,
  revenue_generated DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_bookings_user_tier ON bookings(user_id, customer_tier_id);
CREATE INDEX idx_bookings_dates ON bookings(start_at, end_at);
CREATE INDEX idx_bookings_changes ON bookings(change_count) WHERE flagged_for_changes = true;
CREATE INDEX idx_loyalty_tier ON loyalty_tracking(current_tier_id);
```

---

## Implementation Timeline

### Week 1: Foundation & Config
- [ ] Create booking config service
- [ ] Add admin configuration panel
- [ ] Set up database tables
- [ ] Create base component structure
- [ ] Define TypeScript interfaces

### Week 2: Core Components (Parallel)
- [ ] Part 1: Calendar grid development
- [ ] Part 2: Time selector with cross-midnight
- [ ] Part 3: Booking forms (admin/customer)
- [ ] Part 4: Location system integration
- [ ] Part 5: Space details components

### Week 3: Integration
- [ ] Connect to Jason's backend API
- [ ] Replace Skedda iframe in customer portal
- [ ] Update QuickBookCard component
- [ ] Add booking to main navigation
- [ ] Integrate with notification system

### Week 4: Testing & Polish
- [ ] Mobile responsiveness testing
- [ ] Cross-midnight booking tests
- [ ] Configuration change testing
- [ ] Door integration testing
- [ ] Performance optimization

---

## Comprehensive Testing Checklist

### Core Booking Rules ✅
- [ ] 1-hour minimum booking enforced
- [ ] 30-minute increments after first hour (1.5h, 2h, 2.5h)
- [ ] Cannot book <1hr before start time
- [ ] New customers limited to 14 days advance
- [ ] Existing customers can book 30 days ahead
- [ ] $10 deposit collected on booking
- [ ] Cross-midnight bookings work (11 PM - 2 AM)

### Customer Tiers & Colors ✅
- [ ] Blue color for new customers on calendar
- [ ] Yellow color for standard members
- [ ] Green color for promo users
- [ ] Auto-upgrade to Standard Member after 3 bookings
- [ ] Email sent on tier upgrade
- [ ] Dynamic pricing applies ($15-30/hr based on tier)
- [ ] Recurring bookings only for Standard Members+

### Change Management ✅
- [ ] First reschedule is free
- [ ] $10 fee charged for second change
- [ ] System blocks third change attempt
- [ ] User flagged after 2+ changes
- [ ] Admin can override change restrictions
- [ ] CRM notes saved for problematic users

### Multi-Simulator Booking ✅
- [ ] Can select multiple boxes in one booking
- [ ] No overlap/double booking allowed
- [ ] Full location rental supported
- [ ] Group booking coordination works
- [ ] Favorite simulator saved and recalled

### Location Features ✅
- [ ] Admin can post location notices
- [ ] Notices show on booking page
- [ ] Notices appear in confirmations
- [ ] Can toggle location visibility on/off
- [ ] Filter by single or all locations
- [ ] Admin block-off times hidden from customers

### Smart Features ✅
- [ ] SMS upsell sent 10min before end (40% of time)
- [ ] One-click extend link works
- [ ] "Book same time next week?" prompt after booking
- [ ] Free hour granted after 10 sessions
- [ ] Loyalty badges awarded
- [ ] Surprise rewards triggered

### Communication ✅
- [ ] Email confirmation on booking
- [ ] SMS confirmation sent
- [ ] Change notifications work
- [ ] Cancellation notices sent
- [ ] Location alerts included in messages

### Admin Features ✅
- [ ] Staff can manually book for customers
- [ ] Admin can block time slots
- [ ] CRM notes viewable by staff only
- [ ] Export booking reports
- [ ] Usage tracking accurate
- [ ] Promo codes apply correctly

---

## Success Metrics

### Performance
- Calendar loads < 1 second
- Drag interaction at 60 FPS
- Booking creation < 3 seconds
- Config changes apply instantly

### User Experience
- Mobile-first responsive design
- Intuitive drag-to-book interface
- Clear pricing and availability
- Seamless door access

### Business Impact
- Replace Skedda completely
- Enable cross-midnight bookings (new revenue)
- Reduce booking support tickets by 50%
- Increase booking conversion rate

---

## Notes for Developers

### Using Existing ClubOS Patterns
```typescript
// Always use ClubOS infrastructure
import { Button } from '@/components/ui/Button';  // Don't create new buttons
import { useNotifications } from '@/state/hooks';  // Use for all feedback
import { http } from '@/api/http';  // Has auth built-in

// Follow ClubOS conventions
- Mobile-first design
- Test on actual devices
- Use existing color variables
- Follow TypeScript strict mode
```

### Making It Modular
```typescript
// All magic numbers should come from config
const minDuration = config.minDuration;  // NOT hardcoded 60

// All features should be toggleable
if (config.allowCrossMidnight) {
  // Enable cross-midnight UI
}

// All text should be configurable
const bookingTitle = config.labels.bookingTitle || 'New Booking';
```

### Integration Points
1. **Customer Portal**: Replace `/customer/bookings` iframe
2. **Quick Book Card**: Update to use new system
3. **Dashboard**: Add booking widgets
4. **Messages**: Send booking confirmations
5. **Tickets**: Create tickets for booking issues

---

## 📋 COMPLETE FEATURE SUMMARY (21 Requirements)

### Must-Have Features (From SOPs)
1. ✅ **Color-coded customer categories** - Visual on calendar
2. ✅ **Dynamic pricing by tier** - $15-30/hr automatic
3. ✅ **Change management** - 1 free, $10 fee, flag frequent
4. ✅ **1-hour minimum** - 30min increments after
5. ✅ **Admin block-offs** - Cleaning, maintenance times
6. ✅ **Staff manual booking** - Search customer, apply rates
7. ✅ **Auto-tiering** - 3 visits = Standard Member
8. ✅ **Location control** - Toggle visibility, filter views
9. ✅ **Location notices** - "Screens down" alerts
10. ✅ **Grid calendar** - Day/Week views with colors
11. ✅ **Recurring bookings** - Standard Members only
12. ✅ **Confirmations** - Email + SMS automatic
13. ✅ **Promo codes** - Gift cards, discounts
14. ✅ **Multi-simulator** - Book multiple boxes
15. ✅ **Role-based access** - Admin, Staff, Cleaner views
16. ✅ **Tag perks** - Hidden slots, early access
17. ✅ **CRM notes** - Behavior tracking per user
18. ✅ **Favorite simulator** - One-click rebook
19. ✅ **Loyalty rewards** - Free hour after 10 sessions
20. ✅ **Smart upsell** - 10min before end (40% trigger)
21. ✅ **Cross-midnight** - 11 PM - 2 AM bookings

### Configuration-Driven Design
- ALL rules stored in database (no hardcoding)
- Admin panel to change any setting
- No code deployment needed for business rule changes
- Example: Change minimum from 60 to 30 minutes instantly

## 🚨 CRITICAL: Development Workflow & Documentation

### MANDATORY After EVERY Task Completion:

1. **Update BOOKING_SYSTEM_MASTER.md**
   - Mark completed features with ✅
   - Add any discovered requirements
   - Update component file paths if changed
   - Document any API changes

2. **Update CHANGELOG.md**
   ```markdown
   ## [1.21.35] - 2025-10-05
   ### Added
   - Booking system: Color-coded customer tiers
   - Booking system: 1hr minimum with 30min increments
   - Booking system: Smart upsell prompts
   ```

3. **Update README.md**
   - Increment version number to match CHANGELOG
   - Add new features to feature list
   - Update any changed commands or paths

4. **Commit & Push (AUTO-DEPLOYS TO PRODUCTION)**
   ```bash
   git add -A
   git commit -m "feat: [booking] add color-coded customer tiers with dynamic pricing"
   git push
   ```

### Development Checklist Template (Copy for Each Part):

```markdown
## Part X Development Checklist

### Pre-Development
- [ ] Read BOOKING_SYSTEM_MASTER.md completely
- [ ] Review existing ClubOS components to reuse
- [ ] Check with Jason for API endpoints needed
- [ ] Set up local test data

### During Development
- [ ] Follow ClubOS mobile-first design
- [ ] Use existing UI components (don't create new)
- [ ] All config from database (no hardcoding)
- [ ] Test on actual mobile device
- [ ] Add TypeScript types

### Post-Development
- [ ] Update BOOKING_SYSTEM_MASTER.md
- [ ] Update CHANGELOG.md with version bump
- [ ] Update README.md version to match
- [ ] Run `npx tsc --noEmit` (no errors)
- [ ] Test locally (frontend port 3001, backend 3000)
- [ ] Commit with descriptive message
- [ ] Push to auto-deploy
- [ ] Mark section complete in master doc
```

## Current Status: Ready for Implementation

**Immediate Next Steps**:
1. ✅ Plan complete with all 21 features
2. ✅ 6 parallel work streams defined
3. ✅ Documentation workflow established
4. ⏳ Assign developers to parts 1-6
5. ⏳ Each developer copies their section from this doc
6. ⏳ Begin with Part 1 (Calendar) as foundation

**Development Order** (Some Dependency):
- **First**: Part 1 (Calendar) - Others need this
- **Parallel**: Parts 2, 3, 4 - Independent
- **Then**: Part 5 (Multi-sim) - Needs calendar
- **Last**: Part 6 (Smart features) - Needs booking flow

**Risk Mitigation**:
- Each part can demo independently
- Jason's backend already handles door logic
- Reusing 80% of ClubOS infrastructure
- Config-driven = easy rollback

**Communication Protocol**:
- Daily 15min standup at 9 AM
- Slack thread #booking-system for questions
- Update this doc immediately when done
- Tag @jason for API questions
- Tag @mike for requirement clarifications

---

*Document Version: 3.1.0*
*Last Updated: October 5, 2025*
*Status: READY TO START DEVELOPMENT*
*Remember: ALWAYS update docs → commit → push after EVERY feature*