/**
 * Standard API response envelope used by backend
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  code?: string;
}

/**
 * Paginated API response
 */
export interface PaginatedResponse<T> {
  success: boolean;
  data: {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
    totalPages?: number;
  };
  message?: string;
}

/**
 * User model
 */
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'operator' | 'customer';
  phone?: string;
  avatar?: string;
  createdAt?: string;
  updatedAt?: string;
  token?: string; // Only present during login
  status?: 'active' | 'pending' | 'suspended';
}

/**
 * Ticket model
 */
export interface Ticket {
  id: string;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignedTo?: string;
  customerId?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  tags?: string[];
  category?: string;
}

/**
 * Message model
 */
export interface Message {
  id: string;
  content: string;
  senderId: string;
  receiverId?: string;
  channelId?: string;
  type: 'text' | 'image' | 'file' | 'system';
  status?: 'sent' | 'delivered' | 'read';
  createdAt: string;
  updatedAt?: string;
  attachments?: Attachment[];
}

/**
 * Attachment model
 */
export interface Attachment {
  id: string;
  filename: string;
  url: string;
  size: number;
  mimeType: string;
}

/**
 * Challenge model
 */
export interface Challenge {
  id: string;
  name: string;
  description?: string;
  type: 'head_to_head' | 'tournament' | 'season' | 'daily';
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  startDate?: string;
  endDate?: string;
  creatorId: string;
  participants: string[];
  winnerId?: string;
  prize?: {
    type: 'cc' | 'points' | 'badge';
    amount?: number;
    description?: string;
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * Event model
 */
export interface Event {
  id: string;
  title: string;
  description?: string;
  type: 'tournament' | 'lesson' | 'social' | 'maintenance';
  startTime: string;
  endTime: string;
  location?: string;
  maxParticipants?: number;
  currentParticipants?: number;
  price?: number;
  status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

/**
 * Booking model
 */
export interface Booking {
  id: string;
  userId: string;
  eventId?: string;
  type: 'tee_time' | 'lesson' | 'equipment' | 'event';
  date: string;
  time: string;
  duration?: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  notes?: string;
  price?: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Notification model
 */
export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  category?: 'system' | 'booking' | 'challenge' | 'message' | 'event';
  read: boolean;
  actionUrl?: string;
  createdAt: string;
}

/**
 * Analytics data point
 */
export interface AnalyticsDataPoint {
  date: string;
  value: number;
  label?: string;
  metadata?: Record<string, any>;
}

/**
 * Dashboard stats
 */
export interface DashboardStats {
  totalCustomers: number;
  activeTickets: number;
  todayRevenue: number;
  upcomingEvents: number;
  recentActivity: ActivityItem[];
  trends?: {
    customers: AnalyticsDataPoint[];
    revenue: AnalyticsDataPoint[];
    tickets: AnalyticsDataPoint[];
  };
}

/**
 * Activity item for dashboards
 */
export interface ActivityItem {
  id: string;
  type: 'ticket' | 'booking' | 'message' | 'event' | 'user';
  action: string;
  description: string;
  userId?: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

/**
 * Auth response types
 */
export interface LoginResponse {
  success: boolean;
  data: {
    user: User;
    token: string;
    refreshToken?: string;
    expiresIn?: number;
  };
  message?: string;
}

export interface SignupResponse {
  success: boolean;
  data?: {
    user?: User;
    token?: string; // Only if auto-approved
    message?: string;
  };
  message?: string;
}

/**
 * Error response from API
 */
export interface ErrorResponse {
  success: false;
  error: string;
  message?: string;
  code?: string;
  details?: any;
  errors?: Record<string, string[]>; // For validation errors
}