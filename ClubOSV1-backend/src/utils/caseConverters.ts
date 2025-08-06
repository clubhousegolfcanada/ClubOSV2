/**
 * Case Conversion Utilities
 * 
 * Standardizes conversion between database snake_case and API camelCase
 * to ensure consistency across the application
 */

/**
 * Convert snake_case to camelCase
 */
export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Convert camelCase to snake_case
 */
export function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

/**
 * Convert object keys from snake_case to camelCase
 */
export function snakeToCamelObject<T = any>(obj: any): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (obj instanceof Date) {
    return obj as any;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => snakeToCamelObject(item)) as any;
  }

  if (typeof obj === 'object') {
    const converted: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const camelKey = snakeToCamel(key);
        converted[camelKey] = snakeToCamelObject(obj[key]);
      }
    }
    return converted;
  }

  return obj;
}

/**
 * Convert object keys from camelCase to snake_case
 */
export function camelToSnakeObject<T = any>(obj: any): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (obj instanceof Date) {
    return obj as any;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => camelToSnakeObject(item)) as any;
  }

  if (typeof obj === 'object') {
    const converted: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const snakeKey = camelToSnake(key);
        converted[snakeKey] = camelToSnakeObject(obj[key]);
      }
    }
    return converted;
  }

  return obj;
}

/**
 * Convert database row to API response format
 * Handles common patterns like timestamps and nested objects
 */
export function dbToApi<T = any>(dbRow: any, options: {
  dateFields?: string[];
  nestedFields?: { [key: string]: string[] };
  excludeFields?: string[];
} = {}): T {
  if (!dbRow) return dbRow;

  const { dateFields = [], nestedFields = {}, excludeFields = [] } = options;
  
  // Convert to camelCase
  const converted = snakeToCamelObject(dbRow);
  
  // Handle date fields
  dateFields.forEach(field => {
    const camelField = snakeToCamel(field);
    if (converted[camelField] && !(converted[camelField] instanceof Date)) {
      converted[camelField] = new Date(converted[camelField]);
    }
  });
  
  // Handle nested fields (e.g., created_by_id, created_by_name -> createdBy: { id, name })
  Object.entries(nestedFields).forEach(([prefix, fields]) => {
    const camelPrefix = snakeToCamel(prefix);
    const nested: any = {};
    let hasData = false;
    
    fields.forEach(field => {
      const dbField = `${prefix}_${field}`;
      const camelDbField = snakeToCamel(dbField);
      if (converted[camelDbField] !== undefined) {
        nested[field] = converted[camelDbField];
        delete converted[camelDbField];
        hasData = true;
      }
    });
    
    if (hasData) {
      converted[camelPrefix] = nested;
    }
  });
  
  // Exclude fields
  excludeFields.forEach(field => {
    const camelField = snakeToCamel(field);
    delete converted[camelField];
  });
  
  return converted;
}

/**
 * Convert API request to database format
 */
export function apiToDb<T = any>(apiObj: any, options: {
  dateFields?: string[];
  flattenFields?: string[];
} = {}): T {
  if (!apiObj) return apiObj;

  const { dateFields = [], flattenFields = [] } = options;
  
  // Clone to avoid mutations
  const cloned = JSON.parse(JSON.stringify(apiObj));
  
  // Flatten nested fields (e.g., createdBy: { id, name } -> created_by_id, created_by_name)
  flattenFields.forEach(field => {
    if (cloned[field] && typeof cloned[field] === 'object') {
      const nested = cloned[field];
      const snakeField = camelToSnake(field);
      
      Object.entries(nested).forEach(([key, value]) => {
        cloned[`${snakeField}_${key}`] = value;
      });
      
      delete cloned[field];
    }
  });
  
  // Convert to snake_case
  const converted = camelToSnakeObject(cloned);
  
  // Handle date fields
  dateFields.forEach(field => {
    if (converted[field] && typeof converted[field] === 'string') {
      converted[field] = new Date(converted[field]);
    }
  });
  
  return converted;
}

/**
 * Standardize route path to kebab-case
 */
export function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase();
}

/**
 * Common field mappings for consistent transformation
 */
export const COMMON_DB_TO_API_OPTIONS = {
  dateFields: ['created_at', 'updated_at', 'deleted_at', 'resolved_at', 'last_login', 'start_time', 'end_time'],
  nestedFields: {
    'created_by': ['id', 'name', 'email', 'phone'],
    'assigned_to': ['id', 'name', 'email'],
    'updated_by': ['id', 'name', 'email']
  },
  excludeFields: ['password', 'password_hash']
};

export const COMMON_API_TO_DB_OPTIONS = {
  dateFields: ['createdAt', 'updatedAt', 'deletedAt', 'resolvedAt', 'lastLogin', 'startTime', 'endTime'],
  flattenFields: ['createdBy', 'assignedTo', 'updatedBy']
};