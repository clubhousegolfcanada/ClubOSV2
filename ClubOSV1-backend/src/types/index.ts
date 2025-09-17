export interface UserRequest {
  id: string;
  requestDescription: string;
  location?: string;
  routePreference?: BotRoute;
  smartAssistEnabled: boolean;
  timestamp: string;
  status: RequestStatus;
  userId?: string;
  sessionId: string;
}

export interface ProcessedRequest extends UserRequest {
  botRoute: BotRoute;
  llmResponse?: LLMResponse;
  slackMessageId?: string;
  slackThreadTs?: string; // New field for Slack thread tracking
  processingTime: number;
  serverProcessingTime?: number; // Server-only processing time
  error?: string;
  isEmergency?: boolean; // Flag for emergency requests
  priority?: 'low' | 'medium' | 'high' | 'urgent' | 'normal'; // Request priority
  user?: any; // User info for notifications
  // requestDescription inherited from UserRequest - don't redeclare
}

export interface LLMResponse {
  route: BotRoute;
  confidence: number;
  reasoning: string;
  suggestedActions: string[];
  response: string;
  assistantId?: string;
  threadId?: string;
  structured?: any;
  metadata?: any;
  provider?: string;
}

export interface SlackMessage {
  channel: string;
  text: string;
  username: string;
  icon_emoji?: string;
  attachments?: SlackAttachment[];
  thread_ts?: string; // For threading messages
}

export interface SlackAttachment {
  color: string;
  title: string;
  text: string;
  fields?: SlackField[];
  footer?: string;
  ts?: string;
}

export interface SlackField {
  title: string;
  value: string;
  short: boolean;
}

// New interfaces for Slack reply tracking
export interface SlackMessageRecord {
  id: string;
  userId?: string;
  requestId?: string;
  slackThreadTs: string;
  slackChannel: string;
  slackMessageTs?: string;
  originalMessage: string;
  requestDescription?: string;
  location?: string;
  route?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SlackReply {
  id: string;
  slackThreadTs: string;
  slackUserId: string;
  slackUserName: string;
  message: string;
  timestamp: string;
}

// Updated Feedback interface
export interface Feedback {
  id: string;
  timestamp: string;
  userId?: string;
  userEmail?: string;
  requestDescription: string;
  location?: string;
  route?: string;
  response: string;
  confidence?: number;
  isUseful?: boolean;
  feedbackType?: string;
  feedbackSource: FeedbackSource; // New field
  slackThreadTs?: string; // New field
  slackUserName?: string; // New field
  slackUserId?: string; // New field
  slackChannel?: string; // New field
  originalRequestId?: string; // New field
  createdAt: string;
}

export type FeedbackSource = 'user' | 'slack_reply' | 'system';

export interface HistoryEntry {
  id: string;
  timestamp: string;
  request: UserRequest;
  response: ProcessedRequest;
  duration: number;
}

export interface BookingRequest {
  userId: string;
  simulatorId: string;
  startTime: string;
  duration: number;
  type: 'single' | 'recurring';
  recurringDays?: number[];
}

export interface AccessRequest {
  userId: string;
  accessType: 'door' | 'equipment' | 'system';
  location: string;
  reason?: string;
}

export type BotRoute = 'Auto' | 'Booking&Access' | 'Booking & Access' | 'Emergency' | 'TechSupport' | 'BrandTone' | 'Slack' | 'general';
export type RequestStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'fallback' | 'sent_to_slack';
export type UserRole = 'admin' | 'operator' | 'support' | 'kiosk' | 'customer' | 'contractor';

export interface User {
  id: string;
  email: string;
  password: string;
  name: string;
  phone?: string;
  role: UserRole;
  createdAt: string;
  updatedAt?: string;
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface ApiError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
}

export interface SystemConfig {
  llmEnabled?: boolean;
  slackFallbackEnabled?: boolean;
  maxRetries?: number;
  requestTimeout?: number;
  dataRetentionDays?: number;
  environment?: string;
  llmProvider?: string;
  features?: {
    smartAssist?: boolean;
    bookings?: boolean;
    tickets?: boolean;
    slack?: boolean;
  };
  limits?: {
    maxRequestsPerDay?: number;
    maxTokensPerRequest?: number;
  };
}

// Slack Events API types
export interface SlackEventWrapper {
  token: string;
  team_id: string;
  api_app_id: string;
  event: SlackEvent;
  type: 'event_callback' | 'url_verification';
  event_id: string;
  event_time: number;
  challenge?: string; // For URL verification
}

export interface SlackEvent {
  type: string;
  event_ts: string;
  user: string;
  text: string;
  ts: string;
  channel: string;
  thread_ts?: string;
}

export interface SlackEventMessage extends SlackEvent {
  type: 'message';
  subtype?: string;
  bot_id?: string;
}
// Add missing types for feedback and tickets
export interface FeedbackEntry {
  id: string;
  timestamp: string;
  userId?: string;
  userEmail?: string;
  requestDescription: string;
  location?: string;
  route?: string;
  response?: string;
  confidence?: number;
  isUseful: boolean;
  feedbackType?: string;
  feedbackSource?: string;
  slackThreadTs?: string;
  slackUserName?: string;
  slackUserId?: string;
  slackChannel?: string;
  originalRequestId?: string;
  createdAt: string;
}

export interface Ticket {
  id: string;
  title: string;
  description: string;
  category: 'facilities' | 'tech';
  status: 'open' | 'in-progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  location?: string;
  createdBy: {
    id: string;
    name: string;
    email: string;
    phone?: string;
  };
  assignedTo?: {
    id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  comments: any[];
}

// Add missing types for feedback and tickets
export interface FeedbackEntry {
  id: string;
  timestamp: string;
  userId?: string;
  userEmail?: string;
  requestDescription: string;
  location?: string;
  route?: string;
  response?: string;
  confidence?: number;
  isUseful: boolean;
  feedbackType?: string;
  feedbackSource?: string;
  slackThreadTs?: string;
  slackUserName?: string;
  slackUserId?: string;
  slackChannel?: string;
  originalRequestId?: string;
  createdAt: string;
}

export interface Ticket {
  id: string;
  title: string;
  description: string;
  category: 'facilities' | 'tech';
  status: 'open' | 'in-progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  location?: string;
  createdBy: {
    id: string;
    name: string;
    email: string;
    phone?: string;
  };
  assignedTo?: {
    id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  comments: any[];
}


// Contractor permission interface
export interface ContractorPermission {
  id: string;
  userId: string;
  location: string;
  canUnlockDoors: boolean;
  canSubmitChecklists: boolean;
  canViewHistory: boolean;
  activeFrom: Date;
  activeUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}
