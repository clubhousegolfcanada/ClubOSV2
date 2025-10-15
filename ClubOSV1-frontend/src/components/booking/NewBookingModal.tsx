import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, User } from 'lucide-react';
import { format } from 'date-fns';
import Button from '@/components/ui/Button';
import { http } from '@/api/http';
import { useNotifications } from '@/state/hooks';

interface NewBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  prefilledData?: {
    date: Date;
    startTime: Date;
    endTime: Date;
    spaceId: string;
    spaceName: string;
    locationId: string;
  };
  onSuccess?: (booking: any) => void;
}

const NewBookingModal: React.FC<NewBookingModalProps> = ({
  isOpen,
  onClose,
  prefilledData,
  onSuccess
}) => {
  const { notify } = useNotifications();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    bookingType: 'user',
    date: prefilledData?.date || new Date(),
    startTime: prefilledData?.startTime || new Date(),
    endTime: prefilledData?.endTime || new Date(),
    repeat: 'none',
    spaceId: prefilledData?.spaceId || '',
    spaceName: prefilledData?.spaceName || '',
    locationId: prefilledData?.locationId || '',
    holder: 'casual',
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    price: 0,
    paymentStatus: 'not-applicable',
    bookingTitle: '',
    notes: ''
  });

  useEffect(() => {
    if (prefilledData) {
      setFormData(prev => ({
        ...prev,
        date: prefilledData.date,
        startTime: prefilledData.startTime,
        endTime: prefilledData.endTime,
        spaceId: prefilledData.spaceId,
        spaceName: prefilledData.spaceName,
        locationId: prefilledData.locationId
      }));
    }
  }, [prefilledData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await http.post('/bookings', {
        locationId: formData.locationId,
        spaceIds: [formData.spaceId],
        startAt: formData.startTime.toISOString(),
        endAt: formData.endTime.toISOString(),
        customerName: formData.customerName || formData.bookingTitle,
        customerEmail: formData.customerEmail,
        customerPhone: formData.customerPhone,
        adminNotes: formData.notes,
        isAdminBlock: formData.bookingType === 'unavailable',
        blockReason: formData.bookingType === 'unavailable' ? formData.bookingTitle : undefined
      });

      notify('success', 'Booking created successfully');
      if (onSuccess) onSuccess(response.data);
      onClose();
    } catch (error: any) {
      notify('error', error.response?.data?.error || 'Failed to create booking');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="card max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="bg-[var(--accent)] text-white px-4 py-3 flex items-center justify-between -m-3 mb-4 rounded-t-xl">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              <h2 className="text-lg font-medium">New booking</h2>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Booking Type */}
            <div className="form-group">
              <label className="form-label">
                Booking type<span className="text-[var(--status-error)] ml-1">*</span>
              </label>
              <div className="flex gap-2">
                {['user', 'internal', 'unavailable'].map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setFormData({...formData, bookingType: type})}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      formData.bookingType === type
                        ? 'bg-[var(--accent)] text-white'
                        : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {type === 'user' && <User className="h-4 w-4" />}
                      {type === 'internal' && '🏠'}
                      {type === 'unavailable' && '⛔'}
                      {type.charAt(0).toUpperCase() + type.slice(1)} booking
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Date */}
            <div className="form-group">
              <label className="form-label">
                Date<span className="text-[var(--status-error)] ml-1">*</span>
              </label>
              <input
                type="date"
                value={format(formData.date, 'yyyy-MM-dd')}
                onChange={(e) => setFormData({...formData, date: new Date(e.target.value)})}
                className="form-input focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
                required
              />
            </div>

            {/* Time */}
            <div className="form-group">
              <label className="form-label">
                Time<span className="text-[var(--status-error)] ml-1">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-xs text-[var(--text-secondary)] block mb-1">From</span>
                  <input
                    type="time"
                    value={format(formData.startTime, 'HH:mm')}
                    onChange={(e) => {
                      const [hours, minutes] = e.target.value.split(':');
                      const newTime = new Date(formData.startTime);
                      newTime.setHours(parseInt(hours), parseInt(minutes));
                      setFormData({...formData, startTime: newTime});
                    }}
                    className="form-input"
                    required
                  />
                </div>
                <div>
                  <span className="text-xs text-[var(--text-secondary)] block mb-1">To</span>
                  <input
                    type="time"
                    value={format(formData.endTime, 'HH:mm')}
                    onChange={(e) => {
                      const [hours, minutes] = e.target.value.split(':');
                      const newTime = new Date(formData.endTime);
                      newTime.setHours(parseInt(hours), parseInt(minutes));
                      setFormData({...formData, endTime: newTime});
                    }}
                    className="form-input"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Repeat */}
            <div className="form-group">
              <label className="form-label">
                Repeat<span className="text-[var(--status-error)] ml-1">*</span>
              </label>
              <select
                value={formData.repeat}
                onChange={(e) => setFormData({...formData, repeat: e.target.value})}
                className="form-input"
              >
                <option value="none">None</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            {/* Space */}
            <div className="form-group">
              <label className="form-label">
                Space<span className="text-[var(--status-error)] ml-1">*</span>
              </label>
              <div className="form-input bg-[var(--bg-tertiary)]">
                {formData.spaceName || 'Select a space'}
              </div>
            </div>

            {/* Holder (for user bookings) */}
            {formData.bookingType === 'user' && (
              <>
                <div className="form-group">
                  <label className="form-label">
                    Holder<span className="text-[var(--status-error)] ml-1">*</span>
                  </label>
                  <select
                    value={formData.holder}
                    onChange={(e) => setFormData({...formData, holder: e.target.value})}
                    className="form-input"
                  >
                    <option value="casual">👤 Casual user (no details needed)</option>
                    <option value="member">👥 Member</option>
                    <option value="new">🆕 New customer</option>
                  </select>
                </div>

                {formData.holder !== 'casual' && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Name</label>
                      <input
                        type="text"
                        value={formData.customerName}
                        onChange={(e) => setFormData({...formData, customerName: e.target.value})}
                        className="form-input"
                        placeholder="Customer name"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="form-group">
                        <label className="form-label">Email</label>
                        <input
                          type="email"
                          value={formData.customerEmail}
                          onChange={(e) => setFormData({...formData, customerEmail: e.target.value})}
                          className="form-input"
                          placeholder="email@example.com"
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Phone</label>
                        <input
                          type="tel"
                          value={formData.customerPhone}
                          onChange={(e) => setFormData({...formData, customerPhone: e.target.value})}
                          className="form-input"
                          placeholder="(555) 123-4567"
                        />
                      </div>
                    </div>
                  </>
                )}
              </>
            )}

            {/* Price and Payment */}
            <div className="grid grid-cols-2 gap-3">
              <div className="form-group">
                <label className="form-label">Price<span className="text-[var(--status-error)] ml-1">*</span></label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-[var(--border-primary)] bg-[var(--bg-tertiary)] text-[var(--text-secondary)] text-sm">
                    $
                  </span>
                  <input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({...formData, price: parseFloat(e.target.value) || 0})}
                    className="form-input rounded-l-none"
                    step="0.01"
                    min="0"
                  />
                  <span className="inline-flex items-center px-3 rounded-r-lg border border-l-0 border-[var(--border-primary)] bg-[var(--bg-tertiary)] text-[var(--text-secondary)] text-sm">
                    CAD
                  </span>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Payment status<span className="text-[var(--status-error)] ml-1">*</span></label>
                <select
                  value={formData.paymentStatus}
                  onChange={(e) => setFormData({...formData, paymentStatus: e.target.value})}
                  className="form-input"
                >
                  <option value="not-applicable">Not applicable (no charge)</option>
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                </select>
              </div>
            </div>

            {/* Booking Title */}
            <div className="form-group">
              <label className="form-label">Booking title</label>
              <input
                type="text"
                value={formData.bookingTitle}
                onChange={(e) => setFormData({...formData, bookingTitle: e.target.value})}
                className="form-input"
                placeholder="Add title"
              />
            </div>

            {/* Notes */}
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                className="form-textarea"
                placeholder="Any additional notes..."
                rows={3}
              />
            </div>

            {/* Info Box */}
            <div className="bg-[var(--accent-light)] border border-[var(--accent)]/20 rounded-lg p-3 text-sm">
              <div className="flex items-start gap-2">
                <span className="text-[var(--accent)]">ℹ️</span>
                <p className="text-[var(--text-secondary)]">This booking will be created for {formData.spaceName} on {format(formData.date, 'MMMM d, yyyy')} from {format(formData.startTime, 'h:mm a')} to {format(formData.endTime, 'h:mm a')}.</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={loading}
              >
                Cancel booking
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={loading}
                disabled={loading}
              >
                Confirm booking
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default NewBookingModal;