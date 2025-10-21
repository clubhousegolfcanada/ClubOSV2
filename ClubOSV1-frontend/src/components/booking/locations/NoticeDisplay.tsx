'use client';

import React, { useState, useEffect } from 'react';
import logger from '@/services/logger';
import { AlertCircle, Info, AlertTriangle, X, Clock } from 'lucide-react';
import { locationNoticeService } from '../../../services/booking/locationNoticeService';

interface Notice {
  id: string;
  title?: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  showUntil?: string;
}

interface NoticeDisplayProps {
  locationId: string;
  showOnlyBookingPage?: boolean;
  showOnlyConfirmations?: boolean;
  compact?: boolean;
  dismissible?: boolean;
}

export const NoticeDisplay: React.FC<NoticeDisplayProps> = ({
  locationId,
  showOnlyBookingPage = false,
  showOnlyConfirmations = false,
  compact = false,
  dismissible = true
}) => {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissedNotices, setDismissedNotices] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadNotices();
    // Refresh notices every 5 minutes
    const interval = setInterval(loadNotices, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [locationId]);

  useEffect(() => {
    // Load dismissed notices from localStorage
    const stored = localStorage.getItem('dismissedNotices');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setDismissedNotices(new Set(parsed));
      } catch (e) {
        logger.error('Failed to parse dismissed notices:', e);
      }
    }
  }, []);

  const loadNotices = async () => {
    if (!locationId || locationId === 'all') {
      setNotices([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await locationNoticeService.getLocationNotices(locationId);

      // Filter based on display context
      let filtered = data;
      if (showOnlyBookingPage) {
        filtered = data.filter(n => n.showOnBookingPage);
      } else if (showOnlyConfirmations) {
        filtered = data.filter(n => n.showInConfirmations);
      }

      // Only show active notices
      filtered = filtered.filter(n => n.isActive);

      setNotices(filtered);
    } catch (error) {
      logger.error('Error loading notices:', error);
      setNotices([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = (noticeId: string) => {
    const newDismissed = new Set(dismissedNotices);
    newDismissed.add(noticeId);
    setDismissedNotices(newDismissed);

    // Save to localStorage
    localStorage.setItem('dismissedNotices', JSON.stringify(Array.from(newDismissed)));
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertCircle className={compact ? 'w-4 h-4' : 'w-5 h-5'} />;
      case 'warning':
        return <AlertTriangle className={compact ? 'w-4 h-4' : 'w-5 h-5'} />;
      default:
        return <Info className={compact ? 'w-4 h-4' : 'w-5 h-5'} />;
    }
  };

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case 'critical':
        return {
          bg: 'bg-red-50 dark:bg-red-900/20',
          border: 'border-red-200 dark:border-red-800',
          icon: 'text-red-600 dark:text-red-400',
          text: 'text-red-800 dark:text-red-200'
        };
      case 'warning':
        return {
          bg: 'bg-yellow-50 dark:bg-yellow-900/20',
          border: 'border-yellow-200 dark:border-yellow-800',
          icon: 'text-yellow-600 dark:text-yellow-400',
          text: 'text-yellow-800 dark:text-yellow-200'
        };
      default:
        return {
          bg: 'bg-blue-50 dark:bg-blue-900/20',
          border: 'border-blue-200 dark:border-blue-800',
          icon: 'text-blue-600 dark:text-blue-400',
          text: 'text-blue-800 dark:text-blue-200'
        };
    }
  };

  // Filter out dismissed notices
  const visibleNotices = notices.filter(n => !dismissedNotices.has(n.id));

  if (loading) {
    return null; // Silent loading for better UX
  }

  if (visibleNotices.length === 0) {
    return null;
  }

  // Sort by severity: critical first, then warning, then info
  const sortedNotices = [...visibleNotices].sort((a, b) => {
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });

  if (compact) {
    // Compact mode for inline display
    return (
      <div className="space-y-2">
        {sortedNotices.map(notice => {
          const styles = getSeverityStyles(notice.severity);
          return (
            <div
              key={notice.id}
              className={`px-3 py-2 rounded-lg border ${styles.bg} ${styles.border}`}
            >
              <div className="flex items-start gap-2">
                <span className={styles.icon}>
                  {getSeverityIcon(notice.severity)}
                </span>
                <div className="flex-1 text-sm">
                  {notice.title && (
                    <p className={`font-medium ${styles.text}`}>{notice.title}</p>
                  )}
                  <p className={styles.text}>{notice.message}</p>
                </div>
                {dismissible && (
                  <button
                    onClick={() => handleDismiss(notice.id)}
                    className="p-0.5 hover:bg-white/50 dark:hover:bg-black/20 rounded"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Full display mode
  return (
    <div className="space-y-3">
      {sortedNotices.map(notice => {
        const styles = getSeverityStyles(notice.severity);
        return (
          <div
            key={notice.id}
            className={`p-4 rounded-lg border ${styles.bg} ${styles.border} ${
              notice.severity === 'critical' ? 'animate-pulse' : ''
            }`}
          >
            <div className="flex items-start gap-3">
              <span className={`flex-shrink-0 mt-0.5 ${styles.icon}`}>
                {getSeverityIcon(notice.severity)}
              </span>

              <div className="flex-1">
                {notice.title && (
                  <h4 className={`font-semibold mb-1 ${styles.text}`}>
                    {notice.title}
                  </h4>
                )}
                <p className={styles.text}>{notice.message}</p>

                {notice.showUntil && (
                  <div className="mt-2 flex items-center gap-1 text-xs opacity-70">
                    <Clock className="w-3 h-3" />
                    <span>
                      Notice expires {new Date(notice.showUntil).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>

              {dismissible && (
                <button
                  onClick={() => handleDismiss(notice.id)}
                  className={`flex-shrink-0 p-1 rounded hover:bg-white/50 dark:hover:bg-black/20 transition-colors ${styles.text}`}
                  aria-label="Dismiss notice"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};