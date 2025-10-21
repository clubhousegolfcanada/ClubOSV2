import React, { useState, useEffect, useMemo } from 'react';
import { useAuthState } from '@/state/useStore';
import { http } from '@/api/http';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import StatusBadge from '@/components/ui/StatusBadge';
import { useNotifications } from '@/state/hooks';
import {
  Terminal,
  Calendar,
  Clock,
  MapPin,
  Users,
  DollarSign,
  Ban,
  Wrench,
  CalendarDays,
  X,
  Check,
  AlertCircle,
  User,
  Mail,
  Phone,
  Tag,
  FileText,
  Camera,
  QrCode,
  Sparkles,
  ChevronRight,
  Zap,
  Shield,
  Timer,
  TrendingUp
} from 'lucide-react';
import BookingModeSelector from './BookingModeSelector';
import SmartBookingForm from './SmartBookingForm';
import ConflictDetector from './ConflictDetector';
import PricingCalculator from './PricingCalculator';
import BookingTemplates from './BookingTemplates';
import BookingConfirmation from './BookingConfirmation';
import logger from '@/services/logger';

export type BookingMode = 'booking' | 'block' | 'maintenance' | 'event' | 'class';

interface UnifiedBookingCardProps {
  // Pre-filled data from calendar selection
  initialStartTime?: Date;
  initialEndTime?: Date;
  initialSpaceId?: string;
  initialSpaceName?: string;
  initialLocationId?: string;

  // Callbacks
  onSuccess?: (result: any) => void;
  onCancel?: () => void;

  // Configuration
  defaultMode?: BookingMode;
  allowModeSwitch?: boolean;
  compactView?: boolean;
}

interface BookingFormData {
  // Common fields
  locationId: string;
  spaceIds: string[];
  startAt: string;
  endAt: string;

  // Booking-specific
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerId?: string;

  // Block/Maintenance specific
  blockReason?: string;
  maintenanceType?: 'cleaning' | 'repair' | 'inspection' | 'other';
  recurringPattern?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    interval: number;
    endDate?: string;
    daysOfWeek?: number[];
  };

  // Event/Class specific
  eventName?: string;
  expectedAttendees?: number;
  requiresDeposit?: boolean;

  // Pricing
  promoCode?: string;
  customPrice?: number;
  paymentMethod?: 'card' | 'cash' | 'invoice' | 'gift_card';

  // Additional
  adminNotes?: string;
  photoUrls?: string[];
  sendConfirmation?: boolean;
  generateQrCode?: boolean;
}

export default function UnifiedBookingCard({
  initialStartTime,
  initialEndTime,
  initialSpaceId,
  initialSpaceName,
  initialLocationId,
  onSuccess,
  onCancel,
  defaultMode = 'booking',
  allowModeSwitch = true,
  compactView = false
}: UnifiedBookingCardProps) {
  const { user } = useAuthState();
  const { notify } = useNotifications();

  // State management
  const [mode, setMode] = useState<BookingMode>(defaultMode);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationData, setConfirmationData] = useState<any>(null);

  // Form data with intelligent defaults
  const [formData, setFormData] = useState<BookingFormData>(() => ({
    locationId: initialLocationId || '',
    spaceIds: initialSpaceId ? [initialSpaceId] : [],
    startAt: formatDateForInput(initialStartTime),
    endAt: formatDateForInput(initialEndTime),
    sendConfirmation: true,
    generateQrCode: mode === 'event' || mode === 'class'
  }));

  // UI state
  const [showTemplates, setShowTemplates] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);

  // Pricing state
  const [pricing, setPricing] = useState({
    basePrice: 0,
    discountAmount: 0,
    depositAmount: 0,
    taxAmount: 0,
    totalAmount: 0,
    breakdown: [] as any[]
  });

  // Role-based permissions
  const isStaff = user?.role === 'admin' || user?.role === 'operator' || user?.role === 'support';
  const isAdmin = user?.role === 'admin';
  const canBlock = isStaff;
  const canSetMaintenance = isAdmin;
  const canCreateEvents = isStaff;

  // Smart mode detection based on context
  useEffect(() => {
    if (!allowModeSwitch) return;

    // Auto-detect best mode based on selection
    if (formData.spaceIds.length > 3) {
      // Multiple spaces selected - likely event or maintenance
      if (isAdmin) setMode('maintenance');
      else if (isStaff) setMode('event');
    } else if (initialStartTime && initialEndTime) {
      const duration = (new Date(initialEndTime).getTime() - new Date(initialStartTime).getTime()) / (1000 * 60 * 60);
      if (duration > 4 && isStaff) {
        // Long duration - might be event or block
        setMode('event');
      }
    }
  }, [formData.spaceIds, initialStartTime, initialEndTime, isAdmin, isStaff, allowModeSwitch]);

  // Helper function to format date for input
  function formatDateForInput(date: Date | undefined): string {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  // Mode-specific configuration
  const modeConfig = useMemo(() => {
    switch (mode) {
      case 'booking':
        return {
          title: 'NEW BOOKING',
          icon: Calendar,
          color: 'text-green-400',
          submitText: 'Confirm Booking',
          submitIcon: Check,
          fields: ['customer', 'pricing', 'promo', 'notes']
        };
      case 'block':
        return {
          title: 'BLOCK TIME',
          icon: Ban,
          color: 'text-red-400',
          submitText: 'Block Time',
          submitIcon: Shield,
          fields: ['reason', 'recurring', 'notes']
        };
      case 'maintenance':
        return {
          title: 'SCHEDULE MAINTENANCE',
          icon: Wrench,
          color: 'text-orange-400',
          submitText: 'Schedule Maintenance',
          submitIcon: Wrench,
          fields: ['type', 'reason', 'recurring', 'photos', 'notes']
        };
      case 'event':
        return {
          title: 'CREATE EVENT',
          icon: CalendarDays,
          color: 'text-purple-400',
          submitText: 'Create Event',
          submitIcon: Sparkles,
          fields: ['event', 'attendees', 'pricing', 'deposit', 'notes']
        };
      case 'class':
        return {
          title: 'SCHEDULE CLASS',
          icon: Users,
          color: 'text-blue-400',
          submitText: 'Schedule Class',
          submitIcon: TrendingUp,
          fields: ['class', 'instructor', 'capacity', 'recurring', 'pricing', 'notes']
        };
      default:
        return {
          title: 'BOOKING SYSTEM',
          icon: Terminal,
          color: 'text-gray-400',
          submitText: 'Submit',
          submitIcon: Check,
          fields: []
        };
    }
  }, [mode]);

  // Handle form submission
  const handleSubmit = async () => {
    try {
      setSubmitting(true);

      // Validate based on mode
      if (!formData.locationId) {
        notify('error', 'Please select a location');
        return;
      }

      if (!formData.startAt || !formData.endAt) {
        notify('error', 'Please select start and end times');
        return;
      }

      // Mode-specific validation
      switch (mode) {
        case 'booking':
          if (!formData.customerName && !formData.customerId) {
            notify('error', 'Please select or enter customer information');
            return;
          }
          break;
        case 'block':
        case 'maintenance':
          if (!formData.blockReason) {
            notify('error', 'Please provide a reason');
            return;
          }
          break;
        case 'event':
        case 'class':
          if (!formData.eventName) {
            notify('error', 'Please provide an event/class name');
            return;
          }
          break;
      }

      // Prepare submission data based on mode
      const submitData: any = {
        locationId: formData.locationId,
        spaceIds: formData.spaceIds,
        startAt: formData.startAt,
        endAt: formData.endAt,
        adminNotes: formData.adminNotes
      };

      // Add mode-specific data
      if (mode === 'booking') {
        Object.assign(submitData, {
          customerName: formData.customerName,
          customerEmail: formData.customerEmail,
          customerPhone: formData.customerPhone,
          customerId: formData.customerId,
          promoCode: formData.promoCode,
          customPrice: formData.customPrice,
          totalAmount: pricing.totalAmount
        });
      } else if (mode === 'block' || mode === 'maintenance') {
        Object.assign(submitData, {
          isAdminBlock: true,
          blockReason: formData.blockReason,
          maintenanceType: formData.maintenanceType,
          recurringPattern: formData.recurringPattern,
          photoUrls: formData.photoUrls
        });
      } else if (mode === 'event' || mode === 'class') {
        Object.assign(submitData, {
          eventName: formData.eventName,
          expectedAttendees: formData.expectedAttendees,
          requiresDeposit: formData.requiresDeposit,
          recurringPattern: formData.recurringPattern,
          customPrice: formData.customPrice,
          totalAmount: pricing.totalAmount
        });
      }

      // Submit to API
      const response = await http.post('/bookings', submitData);

      if (response.data.success) {
        // Show confirmation
        setConfirmationData(response.data.data);
        setShowConfirmation(true);

        // Notify success
        notify('success', getModeSuccessMessage());

        // Call parent callback
        if (onSuccess) {
          onSuccess(response.data.data);
        }
      }
    } catch (error: any) {
      logger.error('Booking submission error:', error);
      notify('error', error.response?.data?.error || 'Failed to complete booking');
    } finally {
      setSubmitting(false);
    }
  };

  const getModeSuccessMessage = () => {
    switch (mode) {
      case 'booking': return 'Booking created successfully!';
      case 'block': return 'Time blocked successfully!';
      case 'maintenance': return 'Maintenance scheduled!';
      case 'event': return 'Event created successfully!';
      case 'class': return 'Class scheduled successfully!';
      default: return 'Action completed successfully!';
    }
  };

  // Apply template
  const handleApplyTemplate = (template: any) => {
    setFormData(prev => ({
      ...prev,
      ...template.data
    }));
    setActiveTemplate(template.id);
    notify('success', `Template "${template.name}" applied`);
  };

  // If showing confirmation, render that instead
  if (showConfirmation && confirmationData) {
    return (
      <BookingConfirmation
        data={confirmationData}
        mode={mode}
        onClose={() => {
          setShowConfirmation(false);
          if (onCancel) onCancel();
        }}
        onNewBooking={() => {
          setShowConfirmation(false);
          setFormData({
            locationId: formData.locationId,
            spaceIds: [],
            startAt: '',
            endAt: '',
            sendConfirmation: true,
            generateQrCode: false
          });
        }}
      />
    );
  }

  return (
    <div className={`w-full ${compactView ? 'max-w-2xl' : 'max-w-5xl'} mx-auto`}>
      {/* Terminal-style header with mode indicator */}
      <div className="bg-gray-900 text-white px-4 py-3 rounded-t-xl border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <modeConfig.icon className={`w-5 h-5 ${modeConfig.color}`} />
            <span className="font-mono text-sm tracking-wider">{modeConfig.title}</span>
            <span className="text-xs text-gray-400 font-mono">v2.0</span>
            {conflicts.length > 0 && (
              <StatusBadge status="error" text={`${conflicts.length} conflicts`} />
            )}
          </div>
          <div className="flex items-center gap-2">
            {showTemplates && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowTemplates(!showTemplates)}
                icon={Sparkles}
                className="text-gray-400 hover:text-white"
              >
                Templates
              </Button>
            )}
            {onCancel && (
              <button
                onClick={onCancel}
                className="p-1 hover:bg-gray-800 rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mode selector bar */}
      {allowModeSwitch && (
        <BookingModeSelector
          currentMode={mode}
          onModeChange={setMode}
          availableModes={
            isAdmin ? ['booking', 'block', 'maintenance', 'event', 'class'] :
            isStaff ? ['booking', 'block', 'event'] :
            ['booking']
          }
        />
      )}

      {/* Templates bar (if active) */}
      {showTemplates && (
        <BookingTemplates
          mode={mode}
          onApplyTemplate={handleApplyTemplate}
          activeTemplate={activeTemplate}
        />
      )}

      {/* Main card body */}
      <div className="bg-[var(--bg-secondary)] border-x border-b border-[var(--border-primary)] rounded-b-xl">
        {/* Conflict detector */}
        {(formData.locationId && formData.startAt && formData.endAt) && (
          <ConflictDetector
            locationId={formData.locationId}
            spaceIds={formData.spaceIds}
            startAt={formData.startAt}
            endAt={formData.endAt}
            onConflictsDetected={setConflicts}
            onSuggestionsFound={setSuggestions}
          />
        )}

        {/* Smart form */}
        <SmartBookingForm
          mode={mode}
          formData={formData}
          onChange={setFormData}
          conflicts={conflicts}
          suggestions={suggestions}
        />

        {/* Pricing calculator */}
        {(mode === 'booking' || mode === 'event' || mode === 'class') && (
          <PricingCalculator
            mode={mode}
            formData={formData}
            onPricingUpdate={setPricing}
          />
        )}

        {/* Action bar */}
        <div className="p-6 border-t border-[var(--border-primary)] bg-[var(--bg-primary)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
              <Timer className="w-4 h-4" />
              <span>Available until hold expires (5:00)</span>
            </div>
            <div className="flex gap-3">
              {onCancel && (
                <Button
                  variant="outline"
                  onClick={onCancel}
                  disabled={submitting}
                >
                  Cancel
                </Button>
              )}
              <Button
                variant="primary"
                onClick={handleSubmit}
                loading={submitting}
                disabled={submitting || conflicts.length > 0}
                icon={modeConfig.submitIcon}
              >
                {submitting ? 'Processing...' : modeConfig.submitText}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}