import React, { useState, useEffect } from 'react';
import { useAuthState } from '@/state/useStore';
import { http } from '@/api/http';
import { BookingMode } from './UnifiedBookingCard';
import Input from '@/components/Input';
import Button from '@/components/ui/Button';
import {
  Calendar,
  Clock,
  MapPin,
  User,
  Mail,
  Phone,
  FileText,
  Tag,
  Camera,
  AlertCircle,
  Search,
  ChevronDown,
  Plus,
  X,
  Repeat,
  Users as UsersIcon,
  DollarSign,
  Wrench
} from 'lucide-react';
import logger from '@/services/logger';
import { TimeValidationService, formatDuration, getValidDurations } from '@/services/booking/timeValidationService';
import { parseISO, differenceInMinutes, addMinutes, format } from 'date-fns';

interface SmartBookingFormProps {
  mode: BookingMode;
  formData: any;
  onChange: (data: any) => void;
  conflicts: any[];
  suggestions: any[];
}

export default function SmartBookingForm({
  mode,
  formData,
  onChange,
  conflicts,
  suggestions
}: SmartBookingFormProps) {
  const { user } = useAuthState();
  const [locations, setLocations] = useState<any[]>([]);
  const [spaces, setSpaces] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [searchingCustomer, setSearchingCustomer] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [timeValidationError, setTimeValidationError] = useState<string | null>(null);
  const [validDurations, setValidDurations] = useState<number[]>([]);
  const [showRecurring, setShowRecurring] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);

  // Role checks
  const isStaff = user?.role === 'admin' || user?.role === 'operator' || user?.role === 'support';
  const isAdmin = user?.role === 'admin';

  // Load locations on mount
  useEffect(() => {
    loadLocations();
  }, []);

  // Load spaces when location changes
  useEffect(() => {
    if (formData.locationId) {
      loadSpaces(formData.locationId);
    }
  }, [formData.locationId]);

  // Search customers when typing
  useEffect(() => {
    if (customerSearch.length > 2 && isStaff) {
      searchCustomers(customerSearch);
    }
  }, [customerSearch, isStaff]);

  // Get valid duration options for booking mode
  useEffect(() => {
    if (mode === 'booking' || mode === 'class' || mode === 'event') {
      setValidDurations(getValidDurations());
    }
  }, [mode]);

  // Validate times when they change
  useEffect(() => {
    if (formData.startAt && formData.endAt && (mode === 'booking' || mode === 'class' || mode === 'event')) {
      validateTimes();
    }
  }, [formData.startAt, formData.endAt, formData.customerTierId]);

  const validateTimes = () => {
    if (!formData.startAt || !formData.endAt) return;

    try {
      const start = typeof formData.startAt === 'string' ? parseISO(formData.startAt) : formData.startAt;
      const end = typeof formData.endAt === 'string' ? parseISO(formData.endAt) : formData.endAt;

      // Get customer tier (default to 'new' if not set)
      const customerTier = formData.customerTierId || 'new';

      // Validate the booking
      const result = TimeValidationService.validateBooking(
        start,
        end,
        customerTier as 'new' | 'member' | 'promo' | 'frequent'
      );

      if (!result.isValid) {
        setTimeValidationError(result.error || 'Invalid time selection');
      } else {
        setTimeValidationError(null);
      }
    } catch (error) {
      logger.error('Time validation error:', error);
    }
  };

  const handleQuickDuration = (minutes: number) => {
    if (formData.startAt) {
      const start = typeof formData.startAt === 'string' ? parseISO(formData.startAt) : formData.startAt;
      const newEnd = addMinutes(start, minutes);
      onChange({
        ...formData,
        endAt: newEnd.toISOString()
      });
    }
  };

  const loadLocations = async () => {
    try {
      const response = await http.get('/bookings/locations');
      setLocations(response.data.data || []);

      // Auto-select if only one location
      if (response.data.data?.length === 1) {
        onChange({ ...formData, locationId: response.data.data[0].id });
      }
    } catch (error) {
      logger.error('Failed to load locations:', error);
    }
  };

  const loadSpaces = async (locationId: string) => {
    try {
      const response = await http.get('/bookings/spaces', {
        params: { locationId }
      });
      setSpaces(response.data.data || []);
    } catch (error) {
      logger.error('Failed to load spaces:', error);
    }
  };

  const searchCustomers = async (query: string) => {
    setSearchingCustomer(true);
    try {
      const response = await http.get('/customers/search', {
        params: { q: query }
      });
      setCustomers(response.data.data || []);
      setShowCustomerDropdown(true);
    } catch (error) {
      logger.error('Failed to search customers:', error);
    } finally {
      setSearchingCustomer(false);
    }
  };

  const handleCustomerSelect = (customer: any) => {
    onChange({
      ...formData,
      customerId: customer.id,
      customerName: customer.name,
      customerEmail: customer.email,
      customerPhone: customer.phone
    });
    setCustomerSearch(customer.name);
    setShowCustomerDropdown(false);
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploadingPhotos(true);
    const uploadedUrls: string[] = [];

    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('photo', file);

        const response = await http.post('/upload/photo', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        if (response.data.url) {
          uploadedUrls.push(response.data.url);
        }
      }

      onChange({
        ...formData,
        photoUrls: [...(formData.photoUrls || []), ...uploadedUrls]
      });
    } catch (error) {
      logger.error('Failed to upload photos:', error);
    } finally {
      setUploadingPhotos(false);
    }
  };

  const removePhoto = (index: number) => {
    const newPhotos = [...(formData.photoUrls || [])];
    newPhotos.splice(index, 1);
    onChange({ ...formData, photoUrls: newPhotos });
  };

  // Helper to format date for input
  const formatDateForInput = (dateString: string) => {
    if (!dateString) return '';
    return dateString;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Location and Space Selection */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wider">
            <MapPin className="w-4 h-4" />
            Location
            <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.locationId}
            onChange={(e) => onChange({ ...formData, locationId: e.target.value, spaceIds: [] })}
            className="w-full px-4 py-3 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all"
          >
            <option value="">Select Location</option>
            {locations.map(loc => (
              <option key={loc.id} value={loc.id}>{loc.name}</option>
            ))}
          </select>
        </div>

        {spaces.length > 0 && (
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wider">
              <MapPin className="w-4 h-4" />
              Spaces
              {mode === 'event' || mode === 'maintenance' ? ' (Multiple)' : ''}
            </label>
            {mode === 'event' || mode === 'maintenance' ? (
              <div className="space-y-2 max-h-32 overflow-y-auto border border-[var(--border-primary)] rounded-lg p-2">
                {spaces.map(space => (
                  <label key={space.id} className="flex items-center gap-2 cursor-pointer hover:bg-[var(--bg-hover)] p-1 rounded">
                    <input
                      type="checkbox"
                      checked={formData.spaceIds.includes(space.id)}
                      onChange={(e) => {
                        const newSpaceIds = e.target.checked
                          ? [...formData.spaceIds, space.id]
                          : formData.spaceIds.filter((id: string) => id !== space.id);
                        onChange({ ...formData, spaceIds: newSpaceIds });
                      }}
                      className="rounded"
                    />
                    <span className="text-sm">{space.name}</span>
                  </label>
                ))}
              </div>
            ) : (
              <select
                value={formData.spaceIds[0] || ''}
                onChange={(e) => onChange({ ...formData, spaceIds: e.target.value ? [e.target.value] : [] })}
                className="w-full px-4 py-3 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all"
              >
                <option value="">Select Space</option>
                {spaces.map(space => (
                  <option key={space.id} value={space.id}>{space.name}</option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>

      {/* Time Selection */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wider">
            <Calendar className="w-4 h-4" />
            Start Time
            <span className="text-red-500">*</span>
          </label>
          <input
            type="datetime-local"
            value={formatDateForInput(formData.startAt)}
            onChange={(e) => onChange({ ...formData, startAt: e.target.value })}
            min={new Date().toISOString().slice(0, 16)}
            className="w-full px-4 py-3 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all"
          />
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wider">
            <Clock className="w-4 h-4" />
            End Time
            <span className="text-red-500">*</span>
          </label>
          <input
            type="datetime-local"
            value={formatDateForInput(formData.endAt)}
            onChange={(e) => onChange({ ...formData, endAt: e.target.value })}
            min={formData.startAt || new Date().toISOString().slice(0, 16)}
            className="w-full px-4 py-3 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all"
          />
        </div>
      </div>

      {/* Quick Duration Buttons (for booking modes only) */}
      {(mode === 'booking' || mode === 'event' || mode === 'class') && formData.startAt && !formData.endAt && (
        <div className="space-y-2">
          <label className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
            Quick Duration
          </label>
          <div className="flex gap-2 flex-wrap">
            {validDurations.slice(0, 5).map((minutes) => (
              <button
                key={minutes}
                type="button"
                onClick={() => handleQuickDuration(minutes)}
                className="px-3 py-1.5 text-sm bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg text-[var(--text-primary)] hover:bg-[var(--accent)] hover:text-white transition-colors"
              >
                {formatDuration(minutes)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Time Validation Error */}
      {timeValidationError && (
        <div className="p-4 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
                Invalid Time Selection
              </p>
              <p className="text-xs text-yellow-700 dark:text-yellow-300">
                {timeValidationError}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Conflict Warning */}
      {conflicts.length > 0 && (
        <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-red-900 dark:text-red-100">
                Time Conflict Detected
              </p>
              <p className="text-sm text-red-700 dark:text-red-300">
                This time slot conflicts with {conflicts.length} existing {conflicts.length === 1 ? 'booking' : 'bookings'}.
              </p>
              {suggestions.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-red-600 dark:text-red-400">Suggested alternatives:</p>
                  <div className="flex gap-2 mt-1">
                    {suggestions.slice(0, 3).map((suggestion, idx) => (
                      <Button
                        key={idx}
                        variant="outline"
                        size="sm"
                        onClick={() => onChange({
                          ...formData,
                          startAt: suggestion.startAt,
                          endAt: suggestion.endAt
                        })}
                      >
                        {suggestion.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mode-specific fields */}
      {mode === 'booking' && isStaff && (
        <div className="space-y-4 p-4 bg-[var(--bg-primary)] rounded-lg border border-[var(--border-primary)]">
          <h3 className="text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-2">
            <User className="w-4 h-4" />
            Customer Information
          </h3>

          <div className="relative">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-[var(--text-muted)]" />
              <input
                type="text"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                placeholder="Search existing customer or enter new..."
                className="flex-1 px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
              {searchingCustomer && (
                <div className="animate-spin">
                  <Clock className="w-4 h-4" />
                </div>
              )}
            </div>

            {showCustomerDropdown && customers.length > 0 && (
              <div className="absolute top-full mt-1 w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                {customers.map(customer => (
                  <button
                    key={customer.id}
                    onClick={() => handleCustomerSelect(customer)}
                    className="w-full text-left px-3 py-2 hover:bg-[var(--bg-hover)] flex items-center justify-between"
                  >
                    <div>
                      <div className="font-medium text-sm">{customer.name}</div>
                      <div className="text-xs text-[var(--text-muted)]">{customer.email}</div>
                    </div>
                    <div className="text-xs text-[var(--text-muted)]">
                      {customer.phone}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            <input
              type="text"
              value={formData.customerName || ''}
              onChange={(e) => onChange({ ...formData, customerName: e.target.value })}
              placeholder="Customer Name"
              className="px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg text-[var(--text-primary)] text-sm"
            />
            <input
              type="email"
              value={formData.customerEmail || ''}
              onChange={(e) => onChange({ ...formData, customerEmail: e.target.value })}
              placeholder="Email"
              className="px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg text-[var(--text-primary)] text-sm"
            />
            <input
              type="tel"
              value={formData.customerPhone || ''}
              onChange={(e) => onChange({ ...formData, customerPhone: e.target.value })}
              placeholder="Phone"
              className="px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg text-[var(--text-primary)] text-sm"
            />
          </div>
        </div>
      )}

      {/* Block/Maintenance Reason */}
      {(mode === 'block' || mode === 'maintenance') && (
        <div className="space-y-4 p-4 bg-[var(--bg-primary)] rounded-lg border border-[var(--border-primary)]">
          <h3 className="text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-2">
            <FileText className="w-4 h-4" />
            {mode === 'maintenance' ? 'Maintenance Details' : 'Block Reason'}
            <span className="text-red-500">*</span>
          </h3>

          {mode === 'maintenance' && (
            <div className="grid md:grid-cols-4 gap-2">
              {['cleaning', 'repair', 'inspection', 'other'].map(type => (
                <button
                  key={type}
                  onClick={() => onChange({ ...formData, maintenanceType: type })}
                  className={`px-3 py-2 rounded-lg border capitalize transition-all ${
                    formData.maintenanceType === type
                      ? 'bg-orange-500/10 border-orange-500/50 text-orange-600'
                      : 'border-[var(--border-primary)] hover:bg-[var(--bg-hover)]'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          )}

          <textarea
            value={formData.blockReason || ''}
            onChange={(e) => onChange({ ...formData, blockReason: e.target.value })}
            placeholder={mode === 'maintenance' ? 'Describe the maintenance work...' : 'Reason for blocking this time...'}
            className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg text-[var(--text-primary)] resize-none"
            rows={3}
          />

          {mode === 'maintenance' && (
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                <Camera className="w-4 h-4" />
                Attach Photos (optional)
              </label>
              <div className="flex gap-2 flex-wrap">
                {formData.photoUrls?.map((url: string, idx: number) => (
                  <div key={idx} className="relative group">
                    <img src={url} alt="" className="w-20 h-20 object-cover rounded-lg" />
                    <button
                      onClick={() => removePhoto(idx)}
                      className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <label className="w-20 h-20 border-2 border-dashed border-[var(--border-primary)] rounded-lg flex items-center justify-center cursor-pointer hover:bg-[var(--bg-hover)] transition-colors">
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                    disabled={uploadingPhotos}
                  />
                  {uploadingPhotos ? (
                    <div className="animate-spin">
                      <Clock className="w-5 h-5 text-[var(--text-muted)]" />
                    </div>
                  ) : (
                    <Plus className="w-5 h-5 text-[var(--text-muted)]" />
                  )}
                </label>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Event/Class Details */}
      {(mode === 'event' || mode === 'class') && (
        <div className="space-y-4 p-4 bg-[var(--bg-primary)] rounded-lg border border-[var(--border-primary)]">
          <h3 className="text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-2">
            <CalendarDays className="w-4 h-4" />
            {mode === 'event' ? 'Event Details' : 'Class Information'}
          </h3>

          <div className="grid md:grid-cols-2 gap-4">
            <input
              type="text"
              value={formData.eventName || ''}
              onChange={(e) => onChange({ ...formData, eventName: e.target.value })}
              placeholder={mode === 'event' ? 'Event Name' : 'Class Name'}
              className="px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg text-[var(--text-primary)]"
            />
            <div className="flex items-center gap-2">
              <UsersIcon className="w-4 h-4 text-[var(--text-muted)]" />
              <input
                type="number"
                value={formData.expectedAttendees || ''}
                onChange={(e) => onChange({ ...formData, expectedAttendees: parseInt(e.target.value) })}
                placeholder="Expected Attendees"
                className="flex-1 px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg text-[var(--text-primary)]"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.requiresDeposit || false}
              onChange={(e) => onChange({ ...formData, requiresDeposit: e.target.checked })}
              className="rounded"
            />
            <span className="text-sm">Require deposit</span>
          </label>
        </div>
      )}

      {/* Recurring Options */}
      {(mode === 'maintenance' || mode === 'class' || mode === 'block') && (
        <div className="space-y-3">
          <button
            onClick={() => setShowRecurring(!showRecurring)}
            className="flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wider hover:text-[var(--text-primary)] transition-colors"
          >
            <Repeat className="w-4 h-4" />
            Recurring Schedule
            <ChevronDown className={`w-4 h-4 transition-transform ${showRecurring ? 'rotate-180' : ''}`} />
          </button>

          {showRecurring && (
            <div className="p-4 bg-[var(--bg-primary)] rounded-lg border border-[var(--border-primary)] space-y-3">
              <div className="grid md:grid-cols-3 gap-3">
                <select
                  value={formData.recurringPattern?.frequency || 'weekly'}
                  onChange={(e) => onChange({
                    ...formData,
                    recurringPattern: {
                      ...formData.recurringPattern,
                      frequency: e.target.value
                    }
                  })}
                  className="px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg text-sm"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>

                <input
                  type="number"
                  value={formData.recurringPattern?.interval || 1}
                  onChange={(e) => onChange({
                    ...formData,
                    recurringPattern: {
                      ...formData.recurringPattern,
                      interval: parseInt(e.target.value)
                    }
                  })}
                  min="1"
                  placeholder="Interval"
                  className="px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg text-sm"
                />

                <input
                  type="date"
                  value={formData.recurringPattern?.endDate || ''}
                  onChange={(e) => onChange({
                    ...formData,
                    recurringPattern: {
                      ...formData.recurringPattern,
                      endDate: e.target.value
                    }
                  })}
                  placeholder="End Date"
                  className="px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg text-sm"
                />
              </div>

              {formData.recurringPattern?.frequency === 'weekly' && (
                <div className="flex gap-2">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => (
                    <button
                      key={day}
                      onClick={() => {
                        const days = formData.recurringPattern?.daysOfWeek || [];
                        const newDays = days.includes(idx)
                          ? days.filter((d: number) => d !== idx)
                          : [...days, idx];
                        onChange({
                          ...formData,
                          recurringPattern: {
                            ...formData.recurringPattern,
                            daysOfWeek: newDays
                          }
                        });
                      }}
                      className={`px-3 py-1 rounded-lg border text-xs transition-all ${
                        formData.recurringPattern?.daysOfWeek?.includes(idx)
                          ? 'bg-blue-500/10 border-blue-500/50 text-blue-600'
                          : 'border-[var(--border-primary)] hover:bg-[var(--bg-hover)]'
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Notes Section */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wider">
          <FileText className="w-4 h-4" />
          Internal Notes
          <span className="text-xs text-[var(--text-muted)] normal-case font-normal">(Staff only)</span>
        </label>
        <textarea
          value={formData.adminNotes || ''}
          onChange={(e) => onChange({ ...formData, adminNotes: e.target.value })}
          placeholder="Add any internal notes or special instructions..."
          className="w-full px-4 py-3 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg text-[var(--text-primary)] resize-none"
          rows={2}
        />
      </div>
    </div>
  );
}