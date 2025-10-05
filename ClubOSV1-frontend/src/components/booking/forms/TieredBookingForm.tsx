import React, { useState, useEffect } from 'react';
import { useAuthState } from '@/state/useStore';
import { http } from '@/api/http';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import StatusBadge from '@/components/ui/StatusBadge';
import Input from '@/components/Input';
import { Calendar, Clock, MapPin, DollarSign, AlertCircle, Users } from 'lucide-react';
import PromoCodeInput from './PromoCodeInput';
import RecurringBookingOptions from './RecurringBookingOptions';
import CRMNotesPanel from './CRMNotesPanel';
import PricingDisplay from './PricingDisplay';

interface CustomerTier {
  id: string;
  name: string;
  color: string;
  hourly_rate: number;
  max_advance_days: number;
  allow_recurring: boolean;
  require_deposit: boolean;
  change_limit: number;
  change_fee: number;
}

interface BookingFormData {
  locationId: string;
  spaceIds: string[];
  startAt: string;
  endAt: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  promoCode?: string;
  isRecurring: boolean;
  recurringPattern?: any;
  adminNotes?: string;
}

interface TieredBookingFormProps {
  locationId?: string;
  spaceId?: string;
  date?: Date;
  onSuccess?: (booking: any) => void;
  onCancel?: () => void;
  existingBooking?: any; // For reschedules
}

export default function TieredBookingForm({
  locationId: defaultLocationId,
  spaceId: defaultSpaceId,
  date: defaultDate,
  onSuccess,
  onCancel,
  existingBooking
}: TieredBookingFormProps) {
  const { user } = useAuthState();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<BookingFormData>({
    locationId: defaultLocationId || '',
    spaceIds: defaultSpaceId ? [defaultSpaceId] : [],
    startAt: '',
    endAt: '',
    isRecurring: false
  });

  // Tier and pricing state
  const [customerTier, setCustomerTier] = useState<CustomerTier | null>(null);
  const [pricing, setPricing] = useState({
    basePrice: 0,
    discountAmount: 0,
    depositAmount: 0,
    changeFee: 0,
    totalAmount: 0
  });

  // Available options
  const [locations, setLocations] = useState<any[]>([]);
  const [spaces, setSpaces] = useState<any[]>([]);
  const [availableSlots, setAvailableSlots] = useState<any[]>([]);

  // Change tracking
  const [changeCount, setChangeCount] = useState(0);
  const [isReschedule, setIsReschedule] = useState(false);
  const [changeFeeApplied, setChangeFeeApplied] = useState(false);

  // User role checks
  const isAdmin = user?.role === 'admin';
  const isOperator = user?.role === 'operator';
  const isStaff = isAdmin || isOperator;

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (existingBooking) {
      setIsReschedule(true);
      setChangeCount(existingBooking.change_count || 0);
      setFormData({
        ...formData,
        locationId: existingBooking.location_id,
        spaceIds: existingBooking.space_ids,
        startAt: existingBooking.start_at,
        endAt: existingBooking.end_at
      });
    }
  }, [existingBooking]);

  useEffect(() => {
    calculatePricing();
  }, [formData.startAt, formData.endAt, formData.promoCode, customerTier]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      // Load user tier
      if (user?.id) {
        const tierResponse = await http.get(`/api/users/${user.id}/tier`);
        setCustomerTier(tierResponse.data.tier);
      }

      // Load locations
      const locationsResponse = await http.get('/api/bookings/locations');
      setLocations(locationsResponse.data.data);

      // Load customer tiers for staff
      if (isStaff) {
        const tiersResponse = await http.get('/api/bookings/customer-tiers');
        // Store for staff tier selection
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load booking data');
    } finally {
      setLoading(false);
    }
  };

  const loadSpaces = async (locationId: string) => {
    try {
      const response = await http.get('/api/bookings/spaces', {
        params: { locationId }
      });
      setSpaces(response.data.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load spaces');
    }
  };

  const checkAvailability = async () => {
    if (!formData.locationId || !formData.startAt) return;

    try {
      const response = await http.get('/api/bookings/availability', {
        params: {
          locationId: formData.locationId,
          date: formData.startAt.split('T')[0],
          spaceId: formData.spaceIds[0]
        }
      });
      setAvailableSlots(response.data.data.slots);
    } catch (err: any) {
      setError(err.message || 'Failed to check availability');
    }
  };

  const calculatePricing = () => {
    if (!formData.startAt || !formData.endAt || !customerTier) return;

    const start = new Date(formData.startAt);
    const end = new Date(formData.endAt);
    const durationMinutes = Math.floor((end.getTime() - start.getTime()) / 60000);
    const hours = durationMinutes / 60;

    const basePrice = customerTier.hourly_rate * hours;
    const depositAmount = customerTier.require_deposit ? 10 : 0;

    // Apply change fee if this is a reschedule
    let changeFee = 0;
    if (isReschedule && changeCount >= customerTier.change_limit) {
      changeFee = customerTier.change_fee;
      setChangeFeeApplied(true);
    }

    setPricing({
      basePrice,
      discountAmount: 0, // Will be updated by promo code
      depositAmount,
      changeFee,
      totalAmount: basePrice + depositAmount + changeFee
    });
  };

  const validateDuration = () => {
    if (!formData.startAt || !formData.endAt) return 'Please select start and end times';

    const start = new Date(formData.startAt);
    const end = new Date(formData.endAt);
    const durationMinutes = Math.floor((end.getTime() - start.getTime()) / 60000);

    if (durationMinutes < 60) {
      return 'Minimum booking duration is 1 hour';
    }

    if (durationMinutes > 60 && (durationMinutes - 60) % 30 !== 0) {
      return 'After the first hour, bookings must be in 30-minute increments (1.5h, 2h, 2.5h, etc)';
    }

    // Check advance booking limits
    const now = new Date();
    const daysInAdvance = Math.floor((start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysInAdvance > (customerTier?.max_advance_days || 14)) {
      return `You can only book up to ${customerTier?.max_advance_days || 14} days in advance`;
    }

    if (start.getTime() - now.getTime() < 60 * 60 * 1000) {
      return 'Bookings must be made at least 1 hour in advance';
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationError = validateDuration();
    if (validationError) {
      setError(validationError);
      return;
    }

    // Check if user is flagged for changes
    if (isReschedule && changeCount >= 2 && !isStaff) {
      setError('You have exceeded the maximum number of changes for this booking. Please contact support.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const endpoint = existingBooking
        ? `/api/bookings/${existingBooking.id}`
        : '/api/bookings';

      const method = existingBooking ? 'PATCH' : 'POST';

      const response = await http.request({
        method,
        url: endpoint,
        data: {
          ...formData,
          customerTierId: customerTier?.id,
          depositPaid: pricing.depositAmount > 0,
          changeFeeCharged: pricing.changeFee
        }
      });

      if (onSuccess) {
        onSuccess(response.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to create booking');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card max-w-2xl mx-auto">
      {/* Header with tier info */}
      <div className="border-b border-[var(--border-primary)] pb-3 mb-3">
        <h2 className="text-lg font-semibold mb-2">
          {isReschedule ? 'Reschedule Booking' : 'New Booking'}
        </h2>

        {customerTier && (
          <div className="flex items-center gap-2">
            <StatusBadge
              status={customerTier.id === 'new' ? 'info' : customerTier.id === 'member' ? 'warning' : customerTier.id === 'frequent' ? 'success' : 'default'}
              label={customerTier.name}
            />
            <span className="text-sm text-gray-600">
              ${customerTier.hourly_rate}/hour • Book up to {customerTier.max_advance_days} days ahead
            </span>
          </div>
        )}

        {isReschedule && (
          <div className="mt-2 p-2 bg-[var(--status-warning-bg)] rounded-lg">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-[var(--status-warning)]" />
              <span className="text-sm text-[var(--status-warning)]">
                Change #{changeCount + 1}
                {changeFeeApplied && ` • $${pricing.changeFee} change fee applies`}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Location Selection */}
      <div>
        <label className="block text-sm font-medium mb-2">
          <MapPin className="inline w-4 h-4 mr-1" />
          Location
        </label>
        <select
          value={formData.locationId}
          onChange={(e) => {
            setFormData({ ...formData, locationId: e.target.value, spaceIds: [] });
            loadSpaces(e.target.value);
          }}
          className="w-full p-2 border rounded-lg"
          required
        >
          <option value="">Select Location</option>
          {locations.map(loc => (
            <option key={loc.id} value={loc.id}>{loc.name}</option>
          ))}
        </select>
      </div>

      {/* Space Selection */}
      {formData.locationId && (
        <div>
          <label className="block text-sm font-medium mb-2">
            <Users className="inline w-4 h-4 mr-1" />
            Simulator
          </label>
          <div className="grid grid-cols-2 gap-2">
            {spaces.map(space => (
              <label key={space.id} className="flex items-center p-2 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  value={space.id}
                  checked={formData.spaceIds.includes(space.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setFormData({ ...formData, spaceIds: [...formData.spaceIds, space.id] });
                    } else {
                      setFormData({ ...formData, spaceIds: formData.spaceIds.filter(id => id !== space.id) });
                    }
                  }}
                  className="mr-2"
                />
                <span>{space.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Date/Time Selection */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            <Calendar className="inline w-4 h-4 mr-1" />
            Start Time
          </label>
          <input
            type="datetime-local"
            value={formData.startAt}
            onChange={(e) => {
              setFormData({ ...formData, startAt: e.target.value });
              checkAvailability();
            }}
            min={new Date().toISOString().slice(0, 16)}
            className="w-full p-2 border rounded-lg"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            <Clock className="inline w-4 h-4 mr-1" />
            End Time
          </label>
          <input
            type="datetime-local"
            value={formData.endAt}
            onChange={(e) => setFormData({ ...formData, endAt: e.target.value })}
            min={formData.startAt}
            className="w-full p-2 border rounded-lg"
            required
          />
        </div>
      </div>

      {/* Customer Info (for staff bookings) */}
      {isStaff && (
        <div className="space-y-4 p-3 bg-[var(--bg-tertiary)] rounded-lg">
          <h3 className="font-medium">Customer Information (Staff Only)</h3>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Customer Name"
              value={formData.customerName || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, customerName: e.target.value })}
            />
            <Input
              label="Customer Email"
              type="email"
              value={formData.customerEmail || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, customerEmail: e.target.value })}
            />
          </div>
          <Input
            label="Customer Phone"
            value={formData.customerPhone || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, customerPhone: e.target.value })}
          />
        </div>
      )}

      {/* Promo Code */}
      <PromoCodeInput
        value={formData.promoCode || ''}
        onChange={(code, discount) => {
          setFormData({ ...formData, promoCode: code });
          setPricing({ ...pricing, discountAmount: discount });
        }}
      />

      {/* Recurring Options */}
      {customerTier?.allow_recurring && (
        <RecurringBookingOptions
          enabled={formData.isRecurring}
          pattern={formData.recurringPattern}
          onChange={(enabled, pattern) => {
            setFormData({ ...formData, isRecurring: enabled, recurringPattern: pattern });
          }}
        />
      )}

      {/* CRM Notes (staff only) */}
      {isStaff && (
        <CRMNotesPanel
          notes={formData.adminNotes || ''}
          onChange={(notes) => setFormData({ ...formData, adminNotes: notes })}
          existingNotes={existingBooking?.crm_notes}
          userFlagged={changeCount >= 2}
        />
      )}

      {/* Pricing Display */}
      <PricingDisplay
        basePrice={pricing.basePrice}
        discountAmount={pricing.discountAmount}
        depositAmount={pricing.depositAmount}
        changeFee={pricing.changeFee}
        totalAmount={pricing.totalAmount}
        tierColor={customerTier?.color}
      />

      {/* Error Display */}
      {error && (
        <div className="p-3 bg-[var(--status-error-bg)] border border-[var(--status-error)] rounded-lg">
          <p className="text-[var(--status-error)] text-sm">{error}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 justify-end">
        {onCancel && (
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          disabled={submitting || formData.spaceIds.length === 0}
        >
          {submitting ? (
            <>
              <LoadingSpinner className="w-4 h-4 mr-2" />
              {isReschedule ? 'Rescheduling...' : 'Booking...'}
            </>
          ) : (
            <>
              <DollarSign className="w-4 h-4 mr-2" />
              {isReschedule ? 'Confirm Reschedule' : 'Confirm Booking'}
              {pricing.totalAmount > 0 && ` ($${pricing.totalAmount.toFixed(2)})`}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}