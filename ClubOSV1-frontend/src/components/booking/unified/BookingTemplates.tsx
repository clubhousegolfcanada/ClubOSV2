import React, { useState, useEffect } from 'react';
import { BookingMode } from './UnifiedBookingCard';
import {
  Sparkles,
  Clock,
  Users,
  Calendar,
  Heart,
  Star,
  Zap,
  TrendingUp,
  Save,
  X,
  Plus
} from 'lucide-react';
import { addHours, setHours, setMinutes, startOfWeek, addDays } from 'date-fns';
import { http } from '@/api/http';
import { useAuthState } from '@/state/useStore';
import logger from '@/services/logger';

interface BookingTemplatesProps {
  mode: BookingMode;
  onApplyTemplate: (template: BookingTemplate) => void;
  activeTemplate: string | null;
}

interface BookingTemplate {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  mode: BookingMode;
  data: any;
  isCustom?: boolean;
  usageCount?: number;
}

// Predefined templates for different modes
const defaultTemplates: BookingTemplate[] = [
  // Booking templates
  {
    id: 'quick-hour',
    name: 'Quick Hour',
    icon: <Zap className="w-4 h-4" />,
    description: '1 hour session starting in 30 min',
    mode: 'booking',
    data: {
      startAt: addMinutes(new Date(), 30),
      endAt: addMinutes(new Date(), 90),
      notes: 'Quick practice session'
    }
  },
  {
    id: 'evening-session',
    name: 'Evening Session',
    icon: <Clock className="w-4 h-4" />,
    description: 'Tonight 7-9 PM',
    mode: 'booking',
    data: {
      startAt: setMinutes(setHours(new Date(), 19), 0),
      endAt: setMinutes(setHours(new Date(), 21), 0),
      notes: 'Evening practice'
    }
  },
  {
    id: 'weekend-morning',
    name: 'Weekend Morning',
    icon: <Calendar className="w-4 h-4" />,
    description: 'Saturday 9-11 AM',
    mode: 'booking',
    data: {
      startAt: setMinutes(setHours(addDays(startOfWeek(new Date()), 6), 9), 0),
      endAt: setMinutes(setHours(addDays(startOfWeek(new Date()), 6), 11), 0),
      notes: 'Weekend practice'
    }
  },

  // Block templates
  {
    id: 'daily-cleaning',
    name: 'Daily Cleaning',
    icon: <Clock className="w-4 h-4" />,
    description: '6-7 AM daily maintenance',
    mode: 'block',
    data: {
      startAt: setMinutes(setHours(addDays(new Date(), 1), 6), 0),
      endAt: setMinutes(setHours(addDays(new Date(), 1), 7), 0),
      blockReason: 'Daily cleaning and sanitization',
      recurringPattern: {
        frequency: 'daily',
        interval: 1
      }
    }
  },
  {
    id: 'lunch-break',
    name: 'Lunch Break',
    icon: <Clock className="w-4 h-4" />,
    description: 'Staff lunch 12-1 PM',
    mode: 'block',
    data: {
      startAt: setMinutes(setHours(new Date(), 12), 0),
      endAt: setMinutes(setHours(new Date(), 13), 0),
      blockReason: 'Staff lunch break'
    }
  },

  // Maintenance templates
  {
    id: 'weekly-deep-clean',
    name: 'Weekly Deep Clean',
    icon: <Calendar className="w-4 h-4" />,
    description: 'Sunday morning maintenance',
    mode: 'maintenance',
    data: {
      startAt: setMinutes(setHours(addDays(startOfWeek(new Date()), 0), 6), 0),
      endAt: setMinutes(setHours(addDays(startOfWeek(new Date()), 0), 10), 0),
      blockReason: 'Weekly deep cleaning and equipment check',
      maintenanceType: 'cleaning',
      recurringPattern: {
        frequency: 'weekly',
        interval: 1,
        daysOfWeek: [0] // Sunday
      }
    }
  },
  {
    id: 'equipment-inspection',
    name: 'Equipment Check',
    icon: <TrendingUp className="w-4 h-4" />,
    description: 'Monthly equipment inspection',
    mode: 'maintenance',
    data: {
      blockReason: 'Monthly equipment inspection and calibration',
      maintenanceType: 'inspection',
      recurringPattern: {
        frequency: 'monthly',
        interval: 1
      }
    }
  },

  // Event templates
  {
    id: 'corporate-event',
    name: 'Corporate Event',
    icon: <Users className="w-4 h-4" />,
    description: '3-hour corporate booking',
    mode: 'event',
    data: {
      eventName: 'Corporate Team Building',
      expectedAttendees: 20,
      requiresDeposit: true,
      notes: 'Corporate event with catering'
    }
  },
  {
    id: 'tournament',
    name: 'Tournament',
    icon: <Star className="w-4 h-4" />,
    description: 'Full day tournament setup',
    mode: 'event',
    data: {
      eventName: 'Golf Tournament',
      expectedAttendees: 50,
      requiresDeposit: true,
      notes: 'Tournament with prizes and food'
    }
  },

  // Class templates
  {
    id: 'beginner-class',
    name: 'Beginner Class',
    icon: <Users className="w-4 h-4" />,
    description: 'Intro class for beginners',
    mode: 'class',
    data: {
      eventName: 'Introduction to Golf',
      expectedAttendees: 8,
      recurringPattern: {
        frequency: 'weekly',
        interval: 1
      },
      notes: 'Beginner-friendly class'
    }
  },
  {
    id: 'pro-lesson',
    name: 'Pro Lesson',
    icon: <Star className="w-4 h-4" />,
    description: 'Advanced training session',
    mode: 'class',
    data: {
      eventName: 'Pro Training Session',
      expectedAttendees: 4,
      notes: 'Advanced techniques and strategies'
    }
  }
];

// Helper to add minutes to current time
function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60000);
}

export default function BookingTemplates({
  mode,
  onApplyTemplate,
  activeTemplate
}: BookingTemplatesProps) {
  const { user } = useAuthState();
  const [templates, setTemplates] = useState<BookingTemplate[]>(defaultTemplates);
  const [customTemplates, setCustomTemplates] = useState<BookingTemplate[]>([]);
  const [showCreateNew, setShowCreateNew] = useState(false);
  const [loading, setLoading] = useState(false);

  // Load custom templates on mount
  useEffect(() => {
    if (user) {
      loadCustomTemplates();
    }
  }, [user]);

  const loadCustomTemplates = async () => {
    try {
      setLoading(true);
      const response = await http.get('/api/bookings/templates', {
        params: { userId: user?.id }
      });

      if (response.data.templates) {
        const custom = response.data.templates.map((t: any) => ({
          ...t,
          isCustom: true,
          icon: <Heart className="w-4 h-4" />
        }));
        setCustomTemplates(custom);
      }
    } catch (error) {
      logger.debug('No custom templates found');
    } finally {
      setLoading(false);
    }
  };

  const saveAsTemplate = async (name: string, data: any) => {
    try {
      const response = await http.post('/api/bookings/templates', {
        name,
        mode,
        data,
        userId: user?.id
      });

      if (response.data.template) {
        const newTemplate: BookingTemplate = {
          ...response.data.template,
          isCustom: true,
          icon: <Heart className="w-4 h-4" />
        };
        setCustomTemplates([...customTemplates, newTemplate]);
        setShowCreateNew(false);
      }
    } catch (error) {
      logger.error('Failed to save template:', error);
    }
  };

  const deleteTemplate = async (templateId: string) => {
    try {
      await http.delete(`/api/bookings/templates/${templateId}`);
      setCustomTemplates(customTemplates.filter(t => t.id !== templateId));
    } catch (error) {
      logger.error('Failed to delete template:', error);
    }
  };

  // Filter templates by current mode
  const modeTemplates = [...templates, ...customTemplates].filter(t => t.mode === mode);

  if (modeTemplates.length === 0 && !showCreateNew) {
    return null;
  }

  return (
    <div className="bg-[var(--bg-primary)] border-x border-[var(--border-primary)] px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-500" />
          <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
            Quick Templates
          </span>
        </div>
        {user && (
          <button
            onClick={() => setShowCreateNew(!showCreateNew)}
            className="text-xs text-purple-500 hover:text-purple-600 flex items-center gap-1"
          >
            <Plus className="w-3 h-3" />
            Save Current
          </button>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {modeTemplates.map((template) => (
          <button
            key={template.id}
            onClick={() => onApplyTemplate(template)}
            className={`
              flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg border transition-all
              ${activeTemplate === template.id
                ? 'bg-purple-50 dark:bg-purple-950/20 border-purple-300 dark:border-purple-700 ring-2 ring-purple-500 ring-offset-1 ring-offset-[var(--bg-primary)]'
                : 'bg-white dark:bg-gray-800 border-[var(--border-primary)] hover:border-purple-300 dark:hover:border-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950/20'
              }
            `}
          >
            <div className={`
              ${activeTemplate === template.id
                ? 'text-purple-600 dark:text-purple-400'
                : 'text-[var(--text-muted)]'
              }
            `}>
              {template.icon}
            </div>
            <div className="text-left">
              <div className={`text-sm font-medium ${
                activeTemplate === template.id
                  ? 'text-purple-900 dark:text-purple-100'
                  : 'text-[var(--text-primary)]'
              }`}>
                {template.name}
              </div>
              <div className="text-xs text-[var(--text-muted)]">
                {template.description}
              </div>
            </div>
            {template.isCustom && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteTemplate(template.id);
                }}
                className="ml-2 p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded transition-colors"
              >
                <X className="w-3 h-3 text-red-500" />
              </button>
            )}
            {template.usageCount && template.usageCount > 0 && (
              <div className="ml-auto">
                <span className="text-xs text-[var(--text-muted)] bg-[var(--bg-secondary)] px-1.5 py-0.5 rounded">
                  {template.usageCount}x
                </span>
              </div>
            )}
          </button>
        ))}

        {loading && (
          <div className="flex items-center justify-center px-4">
            <div className="animate-spin">
              <Clock className="w-4 h-4 text-[var(--text-muted)]" />
            </div>
          </div>
        )}
      </div>

      {showCreateNew && (
        <div className="mt-3 p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-purple-900 dark:text-purple-100">
              Save as Template
            </span>
            <button
              onClick={() => setShowCreateNew(false)}
              className="p-1 hover:bg-purple-100 dark:hover:bg-purple-900/20 rounded"
            >
              <X className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </button>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const name = formData.get('templateName') as string;
              if (name) {
                // This would save the current form state as a template
                // For now, we'll just show the UI
                setShowCreateNew(false);
              }
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              name="templateName"
              placeholder="Template name..."
              className="flex-1 px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-purple-200 dark:border-purple-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              autoFocus
            />
            <button
              type="submit"
              className="px-3 py-1.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-1"
            >
              <Save className="w-3 h-3" />
              Save
            </button>
          </form>
        </div>
      )}
    </div>
  );
}