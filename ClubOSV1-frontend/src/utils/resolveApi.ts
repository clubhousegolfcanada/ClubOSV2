import logger from '@/services/logger';

/* eslint-disable no-restricted-syntax */
const RAW_BASE = process.env.NEXT_PUBLIC_API_URL || '';
/* eslint-enable no-restricted-syntax */

// Clean up the base URL
let BASE = RAW_BASE.replace(/\/+$/, ''); // trim trailing slashes

// CRITICAL FIX: Remove /api if it's already at the end of the URL
// This handles cases where Vercel env has the URL with /api already
if (BASE.endsWith('/api')) {
  BASE = BASE.slice(0, -4);
  // Only log in development with debug flag
  if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_DEBUG_API === 'true') {
    logger.debug('[resolveApi] Removed /api suffix from base URL');
  }
}

const PREFIX = '/api';

export function resolveApi(path: string): string {
  if (!path) throw new Error('empty api path');
  const normalized = '/' + path.replace(/^\/+/, '');
  if (normalized.startsWith(PREFIX + '/')) {
    throw new Error(`Do not include '${PREFIX}' in api path: '${normalized}'`);
  }
  return `${BASE}${PREFIX}${normalized}`;
}

export function getApiBase(): string {
  return `${BASE}${PREFIX}`;
}