/**
 * HTML Sanitization utilities for preventing XSS attacks in frontend
 */

import DOMPurify from 'dompurify';

/**
 * Sanitize HTML content while preserving safe formatting tags
 * Used for AI responses and user-generated content
 * @param html - The potentially dangerous HTML string
 * @returns Sanitized HTML string safe for dangerouslySetInnerHTML
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';

  // Configure DOMPurify for AI response formatting
  const config: DOMPurify.Config = {
    ALLOWED_TAGS: [
      'b', 'i', 'em', 'strong', 'a', 'p', 'br', 'div', 'span',
      'ul', 'ol', 'li', 'code', 'pre', 'blockquote',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6'
    ],
    ALLOWED_ATTR: ['href', 'class', 'id', 'style'],
    ALLOW_DATA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
    SAFE_FOR_TEMPLATES: true,
    WHOLE_DOCUMENT: false,
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
    FORCE_BODY: true,
    SANITIZE_DOM: true,
    KEEP_CONTENT: true,
    IN_PLACE: false,
    // Prevent javascript: protocol
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i
  };

  // Sanitize the HTML
  const cleaned = DOMPurify.sanitize(html, config);

  return cleaned;
}

/**
 * Sanitize HTML for response display with measurement formatting
 * Preserves <strong> tags for measurements while preventing XSS
 * @param html - HTML string with measurement formatting
 * @returns Sanitized HTML safe for rendering
 */
export function sanitizeResponseHtml(html: string): string {
  if (!html) return '';

  // More restrictive config for response display
  const config: DOMPurify.Config = {
    ALLOWED_TAGS: ['strong', 'b', 'br', 'p', 'span'],
    ALLOWED_ATTR: [], // No attributes needed for measurement display
    ALLOW_DATA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
    SAFE_FOR_TEMPLATES: true,
    FORCE_BODY: true,
    SANITIZE_DOM: true,
    KEEP_CONTENT: true
  };

  return DOMPurify.sanitize(html, config);
}

/**
 * Escape HTML entities to prevent injection
 * Use this for plain text that should never contain HTML
 * @param text - Text to escape
 * @returns Escaped text safe for display
 */
export function escapeHtml(text: string): string {
  if (!text) return '';

  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Sanitize user input before sending to backend
 * Removes any HTML tags and dangerous characters
 * @param input - User input string
 * @returns Clean string safe for backend processing
 */
export function sanitizeInput(input: string): string {
  if (!input) return '';

  // Remove all HTML tags
  const cleaned = DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [],
    KEEP_CONTENT: true
  });

  // Additional cleanup for common injection attempts
  return cleaned
    .replace(/[<>]/g, '') // Remove any remaining angle brackets
    .trim();
}