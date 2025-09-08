/**
 * Sanitization utilities for preventing XSS attacks
 */

import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitize HTML content to prevent XSS attacks
 * @param dirty - The potentially dangerous HTML string
 * @returns Sanitized HTML string
 */
export function sanitizeHtml(dirty: string): string {
  // Configure DOMPurify for strict sanitization
  const config = {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
    ALLOWED_ATTR: ['href'],
    ALLOW_DATA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
    SAFE_FOR_TEMPLATES: true,
    WHOLE_DOCUMENT: false,
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
    FORCE_BODY: true,
    SANITIZE_DOM: true,
    KEEP_CONTENT: true,
    IN_PLACE: false
  };

  return DOMPurify.sanitize(dirty, config);
}

/**
 * Sanitize plain text to prevent injection attacks
 * @param text - The potentially dangerous text
 * @returns Escaped text safe for display
 */
export function sanitizeText(text: string): string {
  if (!text) return '';
  
  // HTML entity encoding
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Sanitize pattern response templates
 * @param template - The response template with potential variables
 * @returns Sanitized template preserving variable placeholders
 */
export function sanitizePatternTemplate(template: string): string {
  if (!template) return '';
  
  // Preserve template variables while sanitizing
  const variablePattern = /\{\{[^}]+\}\}/g;
  const variables: string[] = [];
  
  // Extract variables
  let match;
  while ((match = variablePattern.exec(template)) !== null) {
    variables.push(match[0]);
  }
  
  // Replace variables with placeholders
  let sanitizeTarget = template;
  variables.forEach((variable, index) => {
    sanitizeTarget = sanitizeTarget.replace(variable, `__VAR_${index}__`);
  });
  
  // Sanitize the template
  const sanitized = sanitizeText(sanitizeTarget);
  
  // Restore variables
  let result = sanitized;
  variables.forEach((variable, index) => {
    result = result.replace(`__VAR_${index}__`, variable);
  });
  
  return result;
}

/**
 * Validate and sanitize JSON strings
 * @param jsonString - Potentially malicious JSON string
 * @returns Parsed and re-stringified safe JSON or null if invalid
 */
export function sanitizeJson(jsonString: string): string | null {
  try {
    const parsed = JSON.parse(jsonString);
    // Re-stringify to remove any potential injection
    return JSON.stringify(parsed);
  } catch {
    return null;
  }
}

/**
 * Sanitize SQL identifiers (table names, column names)
 * @param identifier - The SQL identifier to sanitize
 * @returns Sanitized identifier or null if invalid
 */
export function sanitizeSqlIdentifier(identifier: string): string | null {
  // Only allow alphanumeric characters and underscores
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
    return null;
  }
  return identifier;
}

/**
 * Sanitize file paths to prevent directory traversal
 * @param filePath - The potentially dangerous file path
 * @returns Sanitized file path or null if dangerous
 */
export function sanitizeFilePath(filePath: string): string | null {
  // Remove any directory traversal attempts
  const dangerous = ['..', '~', './', '../', '..\\', '.\\'];
  
  for (const pattern of dangerous) {
    if (filePath.includes(pattern)) {
      return null;
    }
  }
  
  // Remove any null bytes
  if (filePath.includes('\0')) {
    return null;
  }
  
  return filePath;
}