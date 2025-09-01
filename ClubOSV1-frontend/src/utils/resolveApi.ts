/* eslint-disable no-restricted-syntax */
const RAW_BASE = process.env.NEXT_PUBLIC_API_URL || '';
/* eslint-enable no-restricted-syntax */
const BASE = RAW_BASE.replace(/\/+$/, ''); // trim trailing slashes
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