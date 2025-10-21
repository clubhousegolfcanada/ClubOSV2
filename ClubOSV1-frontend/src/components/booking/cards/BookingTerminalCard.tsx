import React, { useState, useEffect } from 'react';
import { useAuthState } from '@/state/useStore';
import { http } from '@/api/http';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Input from '@/components/Input';
import {
  Calendar,
  Clock,
  MapPin,
  DollarSign,
  AlertCircle,
  Tag,
  FileText,
  X,
  Check,
  User,
  Mail,
  Phone,
  Terminal
} from 'lucide-react';
import { useNotifications } from '@/state/hooks';

interface BookingTerminalCardProps {
  initialStartTime?: Date;
  initialEndTime?: Date;
  initialSpaceId?: string;
  initialSpaceName?: string;
  onSuccess?: (booking: any) => void;
  onCancel?: () => void;
}

export default function BookingTerminalCard({
  initialStartTime,
  initialEndTime,
  initialSpaceId,
  initialSpaceName,
  onSuccess,
  onCancel
}: BookingTerminalCardProps) {
  const { user } = useAuthState();
  const { notify } = useNotifications();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Helper to format dates for datetime-local input
  const formatDateForInput = (date: Date | undefined) => {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Form state
  const [formData, setFormData] = useState({
    locationId: '',
    spaceId: initialSpaceId || '',
    spaceName: initialSpaceName || '',
    startAt: formatDateForInput(initialStartTime),
    endAt: formatDateForInput(initialEndTime),
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    promoCode: '',
    crmNotes: ''
  });

  // UI state
  const [showPromoInput, setShowPromoInput] = useState(false);
  const [promoApplied, setPromoApplied] = useState(false);
  const [locations, setLocations] = useState<any[]>([]);
  const [spaces, setSpaces] = useState<any[]>([]);
  const [selectedQuickNotes, setSelectedQuickNotes] = useState<string[]>([]);

  // Pricing state
  const [pricing, setPricing] = useState({
    basePrice: 0,
    discountAmount: 0,
    totalDue: 0
  });

  // Role checks
  const isStaff = user?.role === 'admin' || user?.role === 'operator' || user?.role === 'support';

  // Quick notes for CRM
  const quickNotes = [
    'No-show',
    'Late arrival',
    'Early departure',
    'Equipment issue',
    'Great customer',
    'VIP treatment',
    'Payment issue',
    'Behavior concern'
  ];

  useEffect(() => {
    loadLocations();
  }, []);

  useEffect(() => {
    if (formData.locationId) {
      loadSpaces(formData.locationId);
    }
  }, [formData.locationId]);

  useEffect(() => {
    calculatePricing();
  }, [formData.startAt, formData.endAt, promoApplied]);

  const loadLocations = async () => {
    try {
      const response = await http.get('bookings/locations');
      setLocations(response.data.data || []);
      if (response.data.data?.length === 1) {
        setFormData(prev => ({ ...prev, locationId: response.data.data[0].id }));
      }
    } catch (error) {
      console.error('Failed to load locations:', error);
    }
  };

  const loadSpaces = async (locationId: string) => {
    try {
      const response = await http.get('bookings/spaces', {
        params: { locationId }
      });
      setSpaces(response.data.data || []);
    } catch (error) {
      console.error('Failed to load spaces:', error);
    }
  };

  const calculatePricing = () => {
    if (!formData.startAt || !formData.endAt) return;

    const start = new Date(formData.startAt);
    const end = new Date(formData.endAt);
    const hours = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60));

    const basePrice = hours * 60; // $60/hour base rate
    const discountAmount = promoApplied ? basePrice * 0.1 : 0; // 10% discount if promo applied
    const totalDue = basePrice - discountAmount;

    setPricing({ basePrice, discountAmount, totalDue });
  };

  const handleQuickNoteToggle = (note: string) => {
    setSelectedQuickNotes(prev =>
      prev.includes(note)
        ? prev.filter(n => n !== note)
        : [...prev, note]
    );
  };

  const handleApplyPromo = () => {
    if (!formData.promoCode) {
      notify('error', 'Please enter a promo code');
      return;
    }

    // Simulate promo validation
    setPromoApplied(true);
    notify('success', 'Promo code applied successfully!');
  };

  const handleSubmit = async () => {
    // Validation
    if (!formData.locationId) {
      notify('error', 'Please select a location');
      return;
    }
    if (!formData.startAt || !formData.endAt) {
      notify('error', 'Please select start and end times');
      return;
    }
    if (isStaff && (!formData.customerName || !formData.customerEmail || !formData.customerPhone)) {
      notify('error', 'Please fill in all customer information');
      return;
    }

    setSubmitting(true);
    try {
      // Combine quick notes with manual notes
      const allNotes = [...selectedQuickNotes];
      if (formData.crmNotes) {
        allNotes.push(formData.crmNotes);
      }

      const bookingData = {
        locationId: formData.locationId,
        spaceIds: formData.spaceId ? [formData.spaceId] : [],
        startAt: formData.startAt,
        endAt: formData.endAt,
        customerName: formData.customerName || user?.name,
        customerEmail: formData.customerEmail || user?.email,
        customerPhone: formData.customerPhone,
        promoCode: formData.promoCode,
        adminNotes: allNotes.join(' | '),
        totalAmount: pricing.totalDue
      };

      const response = await http.post('bookings', bookingData);

      notify('success', 'Booking created successfully!');
      if (onSuccess) {
        onSuccess(response.data);
      }
    } catch (error: any) {
      notify('error', error.message || 'Failed to create booking');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Terminal-style header */}
      <div className="bg-gray-900 text-white px-4 py-3 rounded-t-xl flex items-center justify-between border-b border-gray-800">
        <div className="flex items-center gap-3">
          <Terminal className="w-5 h-5 text-green-400" />
          <span className="font-mono text-sm tracking-wider">NEW_BOOKING_SYSTEM</span>
          <span className="text-xs text-gray-400 font-mono">v1.22.1</span>
        </div>
        {onCancel && (
          <button
            onClick={onCancel}
            className="p-1 hover:bg-gray-800 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Main card body */}
      <div className="bg-[var(--bg-secondary)] border-x border-b border-[var(--border-primary)] rounded-b-xl">
        <div className="p-6 space-y-6">
          {/* Location Section */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wider">
              <MapPin className="w-4 h-4" />
              Location
            </label>
            <select
              value={formData.locationId}
              onChange={(e) => setFormData({ ...formData, locationId: e.target.value })}
              className="w-full px-4 py-3 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all"
            >
              <option value="">Select Location</option>
              {locations.map(loc => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
          </div>

          {/* Time Selection */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                <Calendar className="w-4 h-4" />
                Start Time
              </label>
              <input
                type="datetime-local"
                value={formData.startAt}
                onChange={(e) => setFormData({ ...formData, startAt: e.target.value })}
                className="w-full px-4 py-3 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                <Clock className="w-4 h-4" />
                End Time
              </label>
              <input
                type="datetime-local"
                value={formData.endAt}
                onChange={(e) => setFormData({ ...formData, endAt: e.target.value })}
                className="w-full px-4 py-3 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all"
              />
            </div>
          </div>

          {/* Customer Information (Staff Only) */}
          {isStaff && (
            <div className="space-y-4 p-4 bg-[var(--bg-primary)] rounded-lg border border-[var(--border-primary)]">
              <h3 className="text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                Customer Information (Staff Only)
              </h3>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                    <User className="w-3 h-3" />
                    Customer Name
                  </label>
                  <input
                    type="text"
                    value={formData.customerName}
                    onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                    className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
                  />
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                    <Mail className="w-3 h-3" />
                    Customer Email
                  </label>
                  <input
                    type="email"
                    value={formData.customerEmail}
                    onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                    className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                  <Phone className="w-3 h-3" />
                  Customer Phone
                </label>
                <input
                  type="tel"
                  value={formData.customerPhone}
                  onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
                />
              </div>
            </div>
          )}

          {/* Promo Code / Gift Card */}
          <div className="space-y-2">
            <button
              onClick={() => setShowPromoInput(!showPromoInput)}
              className="flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wider hover:text-[var(--text-primary)] transition-colors"
            >
              <Tag className="w-4 h-4" />
              Promo Code / Gift Card
            </button>

            {showPromoInput && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={formData.promoCode}
                  onChange={(e) => setFormData({ ...formData, promoCode: e.target.value.toUpperCase() })}
                  placeholder="ENTER CODE"
                  className="flex-1 px-4 py-3 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all font-mono uppercase"
                />
                <Button
                  variant={promoApplied ? "primary" : "secondary"}
                  onClick={handleApplyPromo}
                  disabled={promoApplied}
                  icon={promoApplied ? Check : undefined}
                >
                  {promoApplied ? 'Applied' : 'Apply'}
                </Button>
              </div>
            )}
          </div>

          {/* CRM Notes (Staff Only) */}
          {isStaff && (
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                <FileText className="w-4 h-4" />
                CRM Notes
                <span className="text-xs text-[var(--text-muted)] normal-case font-normal">Staff Only</span>
              </label>

              <div className="space-y-3">
                <textarea
                  value={formData.crmNotes}
                  onChange={(e) => setFormData({ ...formData, crmNotes: e.target.value })}
                  placeholder="Add internal notes about this booking or customer..."
                  className="w-full px-4 py-3 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all resize-none"
                  rows={3}
                />

                <div className="space-y-2">
                  <p className="text-xs text-[var(--text-muted)]">
                    These notes are only visible to staff and help track customer behavior or special requirements.
                  </p>

                  <div>
                    <p className="text-xs text-[var(--text-muted)] mb-2">Quick Add:</p>
                    <div className="flex flex-wrap gap-2">
                      {quickNotes.map(note => (
                        <button
                          key={note}
                          onClick={() => handleQuickNoteToggle(note)}
                          className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
                            selectedQuickNotes.includes(note)
                              ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                              : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] border-[var(--border-primary)] hover:bg-[var(--bg-hover)] hover:border-[var(--border-hover)]'
                          }`}
                        >
                          {note}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Booking Summary */}
          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-4">
              <DollarSign className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100">Booking Summary</h3>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Base Price</span>
                <span className="font-mono">${pricing.basePrice.toFixed(2)}</span>
              </div>

              {pricing.discountAmount > 0 && (
                <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                  <span>Promo Discount</span>
                  <span className="font-mono">-${pricing.discountAmount.toFixed(2)}</span>
                </div>
              )}

              <div className="pt-2 border-t border-blue-200 dark:border-blue-800">
                <div className="flex justify-between">
                  <span className="text-lg font-semibold">Total Due</span>
                  <span className="text-lg font-bold text-blue-600 dark:text-blue-400 font-mono">
                    ${pricing.totalDue.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 p-3 bg-blue-100 dark:bg-blue-900/20 rounded text-xs text-blue-800 dark:text-blue-200">
              <p className="font-semibold mb-1">Cancellation Policy:</p>
              <ul className="space-y-0.5">
                <li>• Free cancellation up to 24 hours before</li>
                <li>• 50% charge for same-day cancellation</li>
                <li>• Full charge for no-shows</li>
              </ul>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            {onCancel && (
              <Button
                variant="outline"
                onClick={onCancel}
                className="flex-1"
              >
                Cancel
              </Button>
            )}
            <Button
              variant="primary"
              onClick={handleSubmit}
              loading={submitting}
              disabled={submitting}
              icon={DollarSign}
              className="flex-1"
            >
              {submitting ? 'Processing...' : 'Confirm Booking'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}