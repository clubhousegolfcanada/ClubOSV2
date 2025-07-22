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
  processingTime: number;
  serverProcessingTime?: number; // Server-only processing time
  error?: string;
}

export interface LLMResponse {
  route: BotRoute;
  confidence: number;
  reasoning: string;
  suggestedActions: string[];
  response: string;
}

export interface SlackMessage {
  channel: string;
  text: string;
  username: string;
  icon_emoji?: string;
  attachments?: SlackAttachment[];
}

export interface SlackAttachment {
  color: string;
  title: string;
  text: string;
  fields?: SlackField[];
  footer?: string;
  ts?: number;
}

export interface SlackField {
  title: string;
  value: string;
  short: boolean;
}

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

export type BotRoute = 'Auto' | 'Booking&Access' | 'Emergency' | 'TechSupport' | 'BrandTone';
export type RequestStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'fallback';
export type UserRole = 'admin' | 'operator' | 'support';

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
  llmEnabled: boolean;
  slackFallbackEnabled: boolean;
  maxRetries: number;
  requestTimeout: number;
  dataRetentionDays: number;
}
