/**
 * Shared UI Components Library
 * 
 * This is the central export for all shared UI components.
 * These components use CSS variables for theming and are designed
 * to be reusable across both customer and operator interfaces.
 */

export { default as Button } from './Button';
export type { ButtonProps } from './Button';

export { default as LoadingSpinner } from './LoadingSpinner';
export type { LoadingSpinnerProps } from './LoadingSpinner';

export { default as EmptyState } from './EmptyState';
export type { EmptyStateProps } from './EmptyState';

export { default as StatusBadge } from './StatusBadge';
export type { StatusBadgeProps, StatusType } from './StatusBadge';

export { default as PageHeader } from './PageHeader';
export type { PageHeaderProps } from './PageHeader';