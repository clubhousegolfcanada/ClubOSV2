import React from 'react';
import {
  AlertTriangle, TrendingUp, AlertCircle, CheckCircle
} from 'lucide-react';
import type {
  PriorityConfigMap, StatusConfigMap, TicketPriority,
  TicketStatus, TimeUrgency, StatusConfig
} from '@/types/ticket.types';

// Priority configuration with icons and colors
export const priorityConfig: PriorityConfigMap = {
  urgent: {
    color: 'var(--status-error)',
    bg: 'bg-red-500/10',
    text: 'text-red-600',
    icon: <AlertTriangle className="w-3 h-3" />
  },
  high: {
    color: '#f97316',
    bg: 'bg-orange-500/10',
    text: 'text-orange-600',
    icon: <TrendingUp className="w-3 h-3" />
  },
  medium: {
    color: '#eab308',
    bg: 'bg-yellow-500/10',
    text: 'text-yellow-600',
    icon: <AlertCircle className="w-3 h-3" />
  },
  low: {
    color: 'var(--status-success)',
    bg: 'bg-green-500/10',
    text: 'text-green-600',
    icon: <CheckCircle className="w-3 h-3" />
  }
};

// Status configuration
export const statusConfigMap: StatusConfigMap = {
  'open': { bg: 'bg-yellow-500/10', text: 'text-yellow-600', label: 'Open' },
  'in-progress': { bg: 'bg-blue-500/10', text: 'text-blue-600', label: 'In Progress' },
  'resolved': { bg: 'bg-green-500/10', text: 'text-green-600', label: 'Resolved' },
  'closed': { bg: 'bg-gray-500/10', text: 'text-gray-600', label: 'Closed' },
  'archived': { bg: 'bg-gray-400/10', text: 'text-gray-500', label: 'Archived' }
};

// Get status configuration
export const getStatusConfig = (status: TicketStatus): StatusConfig => {
  return statusConfigMap[status] || statusConfigMap.open;
};

// Format time ago from date string
export const formatTimeAgo = (date: string): string => {
  const now = new Date();
  const then = new Date(date);
  const diff = now.getTime() - then.getTime();

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// Get time urgency based on age
export const getTimeUrgency = (date: string): TimeUrgency => {
  const hours = Math.floor((new Date().getTime() - new Date(date).getTime()) / 3600000);
  if (hours >= 72) return 'critical';
  if (hours >= 48) return 'high';
  if (hours >= 24) return 'medium';
  return 'normal';
};

// Get abbreviated location for mobile display
export const getLocationDisplay = (location: string | undefined, isMobile: boolean): string | null => {
  if (!location) return null;

  // On mobile, abbreviate long location names
  if (isMobile && location.length > 8) {
    // Special cases for known locations
    if (location === 'Bayers Lake') return 'BL';
    if (location === 'River Oaks') return 'RO';
    // Default: first 3 letters
    return location.substring(0, 3).toUpperCase();
  }
  return location;
};

// Location configuration for grouping
export const LOCATION_CONFIG: Record<string, string[]> = {
  'Nova Scotia': ['Bedford', 'Dartmouth', 'Halifax', 'Bayers Lake'],
  'Prince Edward Island': ['Stratford'],
  'Ontario': ['Truro'],
  'New Brunswick': ['River Oaks']
};

// Flatten locations for easy access
export const ALL_LOCATIONS = Object.values(LOCATION_CONFIG).flat();