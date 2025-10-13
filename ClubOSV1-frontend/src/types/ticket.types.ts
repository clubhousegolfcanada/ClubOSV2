// Ticket System Type Definitions

export type TicketStatus = 'open' | 'in-progress' | 'resolved' | 'closed' | 'archived';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketCategory = 'facilities' | 'tech';

export interface TicketUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
}

export interface Comment {
  id: string;
  text: string;
  createdBy?: TicketUser;  // Made optional to handle missing data
  createdAt: string;
}

export interface Ticket {
  id: string;
  title: string;
  description: string;
  category: TicketCategory;
  status: TicketStatus;
  priority: TicketPriority;
  location?: string;
  photoUrls?: string[];
  createdBy?: TicketUser;  // Made optional to handle missing data
  assignedTo?: Omit<TicketUser, 'phone'>;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  comments?: Comment[];  // Made optional to match actual API behavior
}

export interface PriorityConfig {
  color: string;
  bg: string;
  text: string;
  icon: React.ReactNode;
}

export interface StatusConfig {
  bg: string;
  text: string;
  label: string;
}

export type PriorityConfigMap = Record<TicketPriority, PriorityConfig>;
export type StatusConfigMap = Record<TicketStatus, StatusConfig>;

export type TimeUrgency = 'normal' | 'medium' | 'high' | 'critical';

// Filter types
export type QuickFilter = 'all' | 'urgent' | 'my-tickets' | 'unassigned';
export type TabFilter = 'active' | 'resolved' | 'archived';

// API Response types
export interface TicketApiResponse {
  success: boolean;
  data?: Ticket | Ticket[];
  message?: string;
  error?: string;
}

export interface CommentApiResponse {
  success: boolean;
  data?: Comment;
  message?: string;
}

// Component prop interfaces
export interface TicketCardProps {
  ticket: Ticket;
  onSelect: () => void;
  onResolve: () => void;
  onArchive: () => void;
  onPhotoClick: (photo: string) => void;
  priorityConfig: PriorityConfigMap;
  getStatusConfig: (status: TicketStatus) => StatusConfig;
  formatTimeAgo: (date: string) => string;
  getTimeUrgency: (date: string) => TimeUrgency;
  isMobile: boolean;
}

export interface TicketDetailContentProps {
  ticket: Ticket;
  onUpdateStatus: (id: string, status: TicketStatus) => void;
  onAddComment: () => void;
  newComment: string;
  setNewComment: (comment: string) => void;
  priorityConfig: PriorityConfigMap;
  getStatusConfig: (status: TicketStatus) => StatusConfig;
}

export interface TicketDetailModalProps extends TicketDetailContentProps {
  onClose: () => void;
}