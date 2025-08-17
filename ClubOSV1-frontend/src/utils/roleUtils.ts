import { UserRole } from '@/state/useStore';

/**
 * Check if a user has a specific role
 */
export const hasRole = (userRole: UserRole | null | undefined, role: UserRole): boolean => {
  return userRole === role;
};

/**
 * Check if a user has any of the specified roles
 */
export const hasAnyRole = (userRole: UserRole | null | undefined, roles: UserRole[]): boolean => {
  return userRole ? roles.includes(userRole) : false;
};

/**
 * Check if a user has minimum role level based on hierarchy
 * admin > operator > support
 */
export const hasMinimumRole = (userRole: UserRole | null | undefined, minimumRole: UserRole): boolean => {
  if (!userRole) return false;
  
  const roleHierarchy: Record<UserRole, number> = {
    'kiosk': 0,
    'customer': 0,
    'support': 1,
    'operator': 2,
    'admin': 3
  };

  const userLevel = roleHierarchy[userRole];
  const requiredLevel = roleHierarchy[minimumRole];

  return userLevel >= requiredLevel;
};

/**
 * Get roles that can access a specific feature
 */
export const getAllowedRoles = (feature: string): UserRole[] => {
  const roleMap: Record<string, UserRole[]> = {
    'unlock': ['admin'],
    'llm_request': ['admin', 'operator'],
    'bookings': ['admin', 'operator', 'support'],
    'history': ['admin', 'operator', 'support'],
    'slack_message': ['admin', 'operator', 'support'],
    'settings': ['admin'],
    'analytics': ['admin', 'operator'],
    'emergency': ['admin', 'operator'],
    'tech_support': ['admin', 'operator', 'support'],
    'brand_tone': ['admin', 'operator', 'support'],
  };

  return roleMap[feature] || ['admin'];
};

/**
 * Check if a route is accessible by a user
 */
export const canAccessRoute = (userRole: UserRole | null | undefined, route: string): boolean => {
  const allowedRoles = getAllowedRoles(route);
  return hasAnyRole(userRole, allowedRoles);
};

/**
 * Get display name for a role
 */
export const getRoleDisplayName = (role: UserRole): string => {
  const displayNames: Record<UserRole, string> = {
    'admin': 'Administrator',
    'operator': 'Operator',
    'support': 'Support',
    'kiosk': 'Kiosk',
    'customer': 'Customer'
  };
  
  return displayNames[role] || role;
};

/**
 * Get role color for UI
 */
export const getRoleColor = (role: UserRole): string => {
  const colors: Record<UserRole, string> = {
    'admin': 'bg-red-500',
    'operator': 'bg-blue-500',
    'support': 'bg-green-500',
    'kiosk': 'bg-purple-500',
    'customer': 'bg-indigo-500'
  };
  
  return colors[role] || 'bg-gray-500';
};

/**
 * Get role badge styles
 */
export const getRoleBadgeStyles = (role: UserRole): string => {
  const baseStyles = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium';
  const roleStyles: Record<UserRole, string> = {
    'admin': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    'operator': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    'support': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    'kiosk': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    'customer': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200'
  };
  
  return `${baseStyles} ${roleStyles[role] || 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'}`;
};

/**
 * Helper to determine if a feature should be disabled
 */
export const isFeatureDisabled = (userRole: UserRole | null | undefined, feature: string): boolean => {
  return !canAccessRoute(userRole, feature);
};

/**
 * Get tooltip text for restricted features
 */
export const getRestrictedTooltip = (feature: string): string => {
  const allowedRoles = getAllowedRoles(feature);
  const roleNames = allowedRoles.map(getRoleDisplayName).join(', ');
  return `Requires ${roleNames} access`;
};
