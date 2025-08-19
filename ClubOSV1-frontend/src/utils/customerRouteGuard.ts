import { UserRole } from '@/state/useStore';
import { NextRouter } from 'next/router';

/**
 * SECURITY: Whitelist of routes that customers are allowed to access
 * All other routes are automatically blocked for customer role
 */
const CUSTOMER_ALLOWED_ROUTES = [
  '/customer/',
  '/customer/index',
  '/customer/profile',
  '/customer/bookings',
  '/customer/events',
  '/customer/friends',
  '/customer/wallet',
  '/login',
  '/logout'
];

/**
 * Check if a customer is allowed to access a specific route
 */
export const isCustomerAllowedRoute = (path: string): boolean => {
  // Normalize the path (remove query strings and hash)
  const normalizedPath = path.split('?')[0].split('#')[0];
  
  // Check if the path is in the whitelist
  return CUSTOMER_ALLOWED_ROUTES.some(allowedPath => {
    // Exact match or starts with the allowed path (for nested routes)
    return normalizedPath === allowedPath || 
           normalizedPath.startsWith(allowedPath + '/') ||
           (allowedPath.endsWith('/') && normalizedPath === allowedPath.slice(0, -1));
  });
};

/**
 * Route guard for customer role - use in useEffect on every page
 * This ensures customers can ONLY access whitelisted pages
 */
export const enforceCustomerRouteGuard = (
  user: { role: UserRole } | null | undefined,
  router: NextRouter,
  isLoading?: boolean
): void => {
  // Don't do anything while loading
  if (isLoading) return;
  
  // If no user, redirect to login (unless already on login page)
  if (!user && router.pathname !== '/login') {
    router.push('/login');
    return;
  }
  
  // If user exists
  if (user) {
    // If user is a customer
    if (user.role === 'customer') {
      // Check if current route is allowed for customers
      if (!isCustomerAllowedRoute(router.pathname)) {
        // Not allowed - redirect to customer dashboard
        console.warn(`🔒 SECURITY: Customer attempted to access restricted route: ${router.pathname}`);
        router.push('/customer/');
        return;
      }
    }
    // For non-customer roles, we can add additional checks here if needed
    // For example, checking if support staff can access admin pages, etc.
  }
};

/**
 * Route guard for operator-only pages
 * This blocks customers and other non-operator roles
 */
export const enforceOperatorRouteGuard = (
  user: { role: UserRole } | null | undefined,
  router: NextRouter,
  allowedRoles: UserRole[] = ['admin', 'operator', 'support']
): void => {
  if (!user) {
    router.push('/login');
    return;
  }
  
  if (user.role === 'customer') {
    console.warn(`🔒 SECURITY: Customer attempted to access operator route: ${router.pathname}`);
    router.push('/customer/');
    return;
  }
  
  if (!allowedRoles.includes(user.role)) {
    console.warn(`🔒 SECURITY: Unauthorized role ${user.role} attempted to access: ${router.pathname}`);
    router.push('/login');
    return;
  }
};

/**
 * Get redirect path based on user role
 */
export const getRoleBasedRedirect = (role: UserRole): string => {
  switch (role) {
    case 'customer':
      return '/customer/';
    case 'admin':
    case 'operator':
    case 'support':
      return '/';
    case 'kiosk':
      return '/kiosk';
    default:
      return '/login';
  }
};