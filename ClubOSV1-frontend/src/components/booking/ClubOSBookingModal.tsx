import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, MapPin, User, Mail, Phone, Check, AlertCircle } from 'lucide-react';
import { format, differenceInMinutes } from 'date-fns';
import Button from '@/components/ui/Button';
import { http } from '@/api/http';
import { useNotifications } from '@/state/hooks';
import { useAuthState } from '@/state/useStore';
import CustomerQuickSearch from './CustomerQuickSearch';
import BookingPricingPanel from './BookingPricingPanel';
import logger from '@/utils/logger';

interface ClubOSBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingData: {
    startTime: Date;
    endTime: Date;
    spaceId: string;
    spaceName: string;
    locationId: string;
    locationName?: string;
  };
  onSuccess?: (booking: any) => void;
}

export default function ClubOSBookingModal({
  isOpen,
  onClose,
  bookingData,
  onSuccess
}: ClubOSBookingModalProps) {
  const { notify } = useNotifications();
  const { user } = useAuthState();
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [createdBooking, setCreatedBooking] = useState<any>(null);

  // Form state
  const [customerData, setCustomerData] = useState({
    customerId: '',
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    customerTier: 'new'
  });

  const [notes, setNotes] = useState('');
  const [promoCode, setPromoCode] = useState('');

  // Pricing state
  const [pricing, setPricing] = useState({
    basePrice: 0,
    discount: 0,
    total: 0
  });

  // Role checks
  const isStaff = user?.role === 'admin' || user?.role === 'operator' || user?.role === 'support';
  const isCustomer = user?.role === 'customer';

  // Auto-fill customer data if logged in as customer
  useEffect(() => {
    if (isCustomer && user) {
      setCustomerData({
        customerId: user.id,
        customerName: user.name || '',
        customerEmail: user.email || '',
        customerPhone: user.phone || '',
        customerTier: 'new' // Default tier for customers
      });
    }
  }, [isCustomer, user]);

  // Calculate duration in minutes
  const durationMinutes = differenceInMinutes(bookingData.endTime, bookingData.startTime);
  const durationHours = durationMinutes / 60;
  const durationDisplay = durationHours >= 1
    ? `${durationHours} hour${durationHours !== 1 ? 's' : ''}`
    : `${durationMinutes} minutes`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!customerData.customerName) {
      notify('error', 'Please select or enter a customer name');
      return;
    }

    if (!customerData.customerEmail) {
      notify('error', 'Please enter a customer email');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        locationId: bookingData.locationId,
        spaceIds: [bookingData.spaceId],
        startAt: bookingData.startTime.toISOString(),
        endAt: bookingData.endTime.toISOString(),
        customerId: customerData.customerId || undefined,
        customerName: customerData.customerName,
        customerEmail: customerData.customerEmail,
        customerPhone: customerData.customerPhone || undefined,
        adminNotes: notes || undefined,
        promoCode: promoCode || undefined
      };

      logger.info('[ClubOSBookingModal] Creating booking:', payload);

      const response = await http.post('/bookings', payload);

      if (response.data.success) {
        logger.info('[ClubOSBookingModal] Booking created successfully:', response.data);
        setCreatedBooking(response.data.data);
        setShowSuccess(true);

        // Auto-close after 3 seconds
        setTimeout(() => {
          if (onSuccess) onSuccess(response.data.data);
          onClose();
        }, 3000);
      }
    } catch (error: any) {
      logger.error('[ClubOSBookingModal] Failed to create booking:', error);
      const errorMessage = error.response?.data?.error || 'Failed to create booking';
      notify('error', errorMessage);

      // Log additional error details for debugging
      if (error.response?.data?.details) {
        logger.error('[ClubOSBookingModal] Error details:', error.response.data.details);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setShowSuccess(false);
    setCreatedBooking(null);
    onClose();
  };

  if (!isOpen) return null;

  // Success state
  if (showSuccess) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn">
        <div className="fixed inset-0 bg-black/50" onClick={handleClose} />
        <div className="relative bg-[var(--bg-primary)] rounded-xl shadow-2xl max-w-md w-full p-8 animate-slideUp">
          <div className="text-center">
            <div className="w-16 h-16 bg-[var(--status-success)]/10 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
              <Check className="w-8 h-8 text-[var(--status-success)]" />
            </div>
            <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Booking Confirmed!</h2>
            <p className="text-[var(--text-secondary)] mb-6">
              Your booking for {bookingData.spaceName} has been successfully created.
            </p>
            <div className="bg-[var(--bg-secondary)] rounded-lg p-4 text-left mb-6">
              <div className="text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Date:</span>
                  <span className="font-medium">{format(bookingData.startTime, 'MMM d, yyyy')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Time:</span>
                  <span className="font-medium">
                    {format(bookingData.startTime, 'h:mm a')} - {format(bookingData.endTime, 'h:mm a')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Duration:</span>
                  <span className="font-medium">{durationDisplay}</span>
                </div>
                {createdBooking?.id && (
                  <div className="flex justify-between pt-2 border-t">
                    <span className="text-[var(--text-muted)]">Booking ID:</span>
                    <span className="font-mono font-medium">#{createdBooking.id.slice(0, 8)}</span>
                  </div>
                )}
              </div>
            </div>
            <Button
              onClick={handleClose}
              className="w-full"
              size="lg"
            >
              Done
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50" onClick={handleClose} />

      {/* Modal */}
      <div className="relative bg-[var(--bg-primary)] rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden animate-slideUp">
        {/* Header */}
        <div className="bg-gradient-to-r from-[var(--accent)] to-[#094A3F] text-white px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Confirm Your Booking</h2>
            <button
              onClick={handleClose}
              className="p-1 hover:bg-white/20 rounded-lg transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* Booking Details */}
          <div className="p-6 border-b">
            <h3 className="text-sm font-medium text-[var(--text-muted)] mb-3">BOOKING DETAILS</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <MapPin className="w-5 h-5 text-[var(--text-muted)]" />
                <div>
                  <div className="font-medium">{bookingData.spaceName}</div>
                  <div className="text-sm text-[var(--text-secondary)]">{bookingData.locationName || 'Clubhouse 24/7'}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-[var(--text-muted)]" />
                <div>
                  <div className="font-medium">{format(bookingData.startTime, 'EEEE, MMMM d, yyyy')}</div>
                  <div className="text-sm text-[var(--text-secondary)]">
                    {format(bookingData.startTime, 'h:mm a')} - {format(bookingData.endTime, 'h:mm a')}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-[var(--text-muted)]" />
                <div>
                  <div className="font-medium">{durationDisplay}</div>
                  <div className="text-sm text-[var(--text-secondary)]">Total duration</div>
                </div>
              </div>
            </div>
          </div>

          {/* Customer Information */}
          <div className="p-6 border-b">
            <h3 className="text-sm font-medium text-[var(--text-muted)] mb-3">CUSTOMER INFORMATION</h3>

            {isStaff ? (
              <CustomerQuickSearch
                value={customerData}
                onChange={setCustomerData}
              />
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Name</label>
                  <div className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-secondary)] rounded-lg">
                    <User className="w-4 h-4 text-[var(--text-muted)]" />
                    <span>{customerData.customerName}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Email</label>
                  <div className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-secondary)] rounded-lg">
                    <Mail className="w-4 h-4 text-[var(--text-muted)]" />
                    <span>{customerData.customerEmail}</span>
                  </div>
                </div>
                {customerData.customerPhone && (
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Phone</label>
                    <div className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-secondary)] rounded-lg">
                      <Phone className="w-4 h-4 text-[var(--text-muted)]" />
                      <span>{customerData.customerPhone}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Pricing */}
          <BookingPricingPanel
            duration={durationMinutes}
            customerTier={customerData.customerTier}
            promoCode={promoCode}
            onPromoCodeChange={setPromoCode}
            onPricingUpdate={setPricing}
          />

          {/* Notes (optional) */}
          {isStaff && (
            <div className="p-6 border-b">
              <h3 className="text-sm font-medium text-gray-500 mb-3">NOTES (OPTIONAL)</h3>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg resize-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
                rows={2}
                placeholder="Add any special instructions or notes..."
              />
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="bg-[var(--bg-secondary)] px-6 py-4 flex gap-3 justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            loading={loading}
            disabled={loading || !customerData.customerName || !customerData.customerEmail}
            className="min-w-[140px]"
          >
            {loading ? 'Creating...' : `Create Booking - $${pricing.total}`}
          </Button>
        </div>
      </div>
    </div>
  );
}