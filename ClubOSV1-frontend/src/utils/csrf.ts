import { http } from '@/api/http';
import logger from '@/services/logger';

export async function getCSRFToken(): Promise<string> {
  try {
    // Use auth: false since this is for getting CSRF token
    const response = await http.get('csrf-token', { auth: false } as any);
    
    if (response.data?.csrfToken) {
      return response.data.csrfToken;
    }
    
    throw new Error('No CSRF token in response');
  } catch (error) {
    logger.error('Failed to get CSRF token:', error);
    return '';
  }
}

export function addCSRFToRequest(headers: HeadersInit = {}): HeadersInit {
  // First try to get from cookie
  const cookieToken = document.cookie
    .split('; ')
    .find(row => row.startsWith('csrf-token='))
    ?.split('=')[1];
  
  // Then try to get from meta tag
  const metaToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
  
  const token = cookieToken || metaToken;
  
  if (token) {
    return {
      ...headers,
      'X-CSRF-Token': token
    };
  }
  
  return headers;
}

// Initialize CSRF token on page load
export async function initializeCSRF(): Promise<void> {
  const token = await getCSRFToken();
  if (token) {
    // Store in meta tag for easy access
    let meta = document.querySelector('meta[name="csrf-token"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'csrf-token');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', token);
  }
}