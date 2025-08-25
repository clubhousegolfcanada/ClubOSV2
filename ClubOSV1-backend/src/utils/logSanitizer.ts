/**
 * Log Sanitizer Utility
 * Removes sensitive information from logs to prevent security breaches
 */

// List of field names that contain sensitive data
const SENSITIVE_FIELDS = [
  'password',
  'newPassword',
  'oldPassword',
  'currentPassword',
  'confirmPassword',
  'token',
  'secret',
  'key',
  'apiKey',
  'api_key',
  'authorization',
  'auth',
  'sessionId',
  'session_id',
  'refreshToken',
  'refresh_token',
  'accessToken',
  'access_token',
  'privateKey',
  'private_key',
  'clientSecret',
  'client_secret',
  'webhook_secret',
  'jwt',
  'bearer',
  'cookie',
  'ssn',
  'creditCard',
  'credit_card',
  'cvv',
  'pin'
];

// Patterns to detect sensitive data in strings
const SENSITIVE_PATTERNS = [
  /Bearer\s+[A-Za-z0-9\-._~+\/]+=*/gi,
  /Basic\s+[A-Za-z0-9\-._~+\/]+=*/gi,
  /eyJ[A-Za-z0-9\-._~+\/]+=*/g, // JWT tokens
];

/**
 * Deep sanitize an object, removing or redacting sensitive fields
 */
export function sanitizeData(data: any, depth = 0): any {
  // Prevent infinite recursion
  if (depth > 10) {
    return '[DEPTH_LIMIT_EXCEEDED]';
  }

  // Handle null/undefined
  if (data === null || data === undefined) {
    return data;
  }

  // Handle strings - check for sensitive patterns
  if (typeof data === 'string') {
    let sanitized = data;
    for (const pattern of SENSITIVE_PATTERNS) {
      sanitized = sanitized.replace(pattern, '[REDACTED_TOKEN]');
    }
    return sanitized;
  }

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item, depth + 1));
  }

  // Handle objects
  if (typeof data === 'object') {
    const sanitized: any = {};
    
    for (const [key, value] of Object.entries(data)) {
      // Check if the field name indicates sensitive data
      const lowerKey = key.toLowerCase();
      const isSensitive = SENSITIVE_FIELDS.some(field => 
        lowerKey.includes(field.toLowerCase())
      );

      if (isSensitive) {
        // Redact sensitive fields but keep the key to show it existed
        sanitized[key] = '[REDACTED]';
      } else if (key === 'headers' && typeof value === 'object') {
        // Special handling for headers - often contain auth tokens
        sanitized[key] = sanitizeHeaders(value);
      } else if (key === 'body' && typeof value === 'object') {
        // Recursively sanitize request/response bodies
        sanitized[key] = sanitizeData(value, depth + 1);
      } else if (typeof value === 'object') {
        // Recursively sanitize nested objects
        sanitized[key] = sanitizeData(value, depth + 1);
      } else {
        // Keep non-sensitive primitive values
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  // Return primitive values as-is
  return data;
}

/**
 * Special sanitization for HTTP headers
 */
function sanitizeHeaders(headers: any): any {
  if (!headers || typeof headers !== 'object') {
    return headers;
  }

  const sanitized: any = {};
  
  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();
    
    // Redact authorization and cookie headers
    if (lowerKey === 'authorization' || 
        lowerKey === 'cookie' || 
        lowerKey === 'x-api-key' ||
        lowerKey.includes('token') ||
        lowerKey.includes('secret')) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Sanitize error objects for logging
 */
export function sanitizeError(error: any): any {
  if (!error) return error;

  const sanitized: any = {
    message: error.message,
    code: error.code,
    statusCode: error.statusCode,
    stack: process.env.NODE_ENV === 'production' ? '[REDACTED]' : error.stack,
  };

  // If error has additional properties, sanitize them
  if (error.config) {
    sanitized.config = sanitizeData(error.config);
  }

  if (error.response) {
    sanitized.response = {
      status: error.response.status,
      statusText: error.response.statusText,
      // Don't log response data in production as it might contain sensitive info
      data: process.env.NODE_ENV === 'production' ? '[REDACTED]' : sanitizeData(error.response.data)
    };
  }

  if (error.request) {
    // Don't log full request details
    sanitized.request = {
      method: error.request.method,
      url: error.request.url || error.request.path,
      // Remove any query parameters that might contain sensitive data
      query: '[REDACTED]'
    };
  }

  return sanitized;
}

/**
 * Create a safe version of request object for logging
 */
export function sanitizeRequest(req: any): any {
  if (!req) return req;

  return {
    method: req.method,
    url: req.url,
    path: req.path,
    // Sanitize query parameters
    query: sanitizeData(req.query),
    // Sanitize body - this is critical for password fields
    body: sanitizeData(req.body),
    // Only log safe headers
    headers: sanitizeHeaders(req.headers),
    // Include user info if available (but not sensitive data)
    user: req.user ? {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role
    } : undefined,
    ip: req.ip,
    userAgent: req.get?.('user-agent')
  };
}

/**
 * Utility to check if a string might contain sensitive data
 */
export function mightContainSensitiveData(str: string): boolean {
  if (!str || typeof str !== 'string') return false;
  
  const lowerStr = str.toLowerCase();
  
  // Check for sensitive field names
  for (const field of SENSITIVE_FIELDS) {
    if (lowerStr.includes(field.toLowerCase())) {
      return true;
    }
  }
  
  // Check for patterns that look like tokens/passwords
  return SENSITIVE_PATTERNS.some(pattern => pattern.test(str));
}

// Export a pre-configured sanitizer for convenience
export const sanitize = sanitizeData;