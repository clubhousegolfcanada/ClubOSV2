/**
 * Types for API usage tracking
 */

export interface UsageRecord {
  id: string;
  userId?: string;
  apiKey?: string;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  requestSize: number;
  responseSize: number;
  timestamp: Date;
  ip: string;
  userAgent?: string;
  error?: string;
  metadata?: Record<string, any>;
}

export interface UsageStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalResponseTime: number;
  totalRequestSize: number;
  totalResponseSize: number;
  endpoints: Record<string, EndpointStats>;
  statusCodes: Record<number, number>;
  hourlyStats: HourlyStats[];
}

export interface EndpointStats {
  count: number;
  averageResponseTime: number;
  totalSize: number;
  errors: number;
}

export interface HourlyStats {
  hour: string;
  requests: number;
  errors: number;
  averageResponseTime: number;
}

export interface UserUsage {
  userId: string;
  period: 'hour' | 'day' | 'week' | 'month';
  stats: UsageStats;
  limits?: {
    requests: number;
    bandwidth: number;
  };
  usage?: {
    requests: number;
    bandwidth: number;
  };
}

export interface ApiKeyUsage {
  apiKey: string;
  name?: string;
  period: 'hour' | 'day' | 'week' | 'month';
  stats: UsageStats;
  limits?: {
    requests: number;
    bandwidth: number;
    endpoints?: string[];
  };
  usage?: {
    requests: number;
    bandwidth: number;
  };
}

export interface UsageAlert {
  id: string;
  type: 'rate_limit' | 'error_rate' | 'latency' | 'bandwidth';
  severity: 'warning' | 'critical';
  userId?: string;
  apiKey?: string;
  message: string;
  threshold: number;
  currentValue: number;
  timestamp: Date;
}

export interface UsageConfig {
  retentionDays: number;
  aggregationInterval: number; // minutes
  alertThresholds: {
    errorRate: number; // percentage
    latency: number; // milliseconds
    requestsPerHour: number;
    bandwidthPerDay: number; // bytes
  };
  rateLimits: {
    default: RateLimitConfig;
    perUser?: Record<string, RateLimitConfig>;
    perApiKey?: Record<string, RateLimitConfig>;
  };
}

export interface RateLimitConfig {
  requests: {
    perHour?: number;
    perDay?: number;
    perMonth?: number;
  };
  bandwidth: {
    perHour?: number;
    perDay?: number;
    perMonth?: number;
  };
  endpoints?: {
    pattern: string;
    limits: {
      perHour?: number;
      perDay?: number;
    };
  }[];
}
