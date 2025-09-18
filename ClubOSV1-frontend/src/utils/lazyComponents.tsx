import dynamic from 'next/dynamic';
import { ComponentType } from 'react';

// Loading component displayed while lazy loading
const LoadingComponent = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="animate-pulse flex flex-col items-center">
      <div className="h-8 w-8 bg-primary-600 rounded-full animate-bounce"></div>
      <p className="mt-4 text-gray-500">Loading...</p>
    </div>
  </div>
);

// Error component displayed if lazy loading fails
const ErrorComponent = ({ error }: { error?: Error }) => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="text-center">
      <p className="text-red-600">Failed to load component</p>
      {error && (
        <p className="text-sm text-gray-500 mt-2">{error.message}</p>
      )}
    </div>
  </div>
);

/**
 * Create a lazily loaded component with loading and error states
 */
export function lazyLoad<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  options?: {
    loading?: ComponentType;
    ssr?: boolean;
  }
) {
  return dynamic(importFn, {
    loading: options?.loading || LoadingComponent,
    ssr: options?.ssr ?? true,
  });
}

/**
 * Lazy load heavy components that are not immediately visible
 */
export const LazyComponents = {
  // Operations page components (admin only, heavy)
  V3PLS: lazyLoad(() => import('../components/operations/V3PLS'), { ssr: false }),
  WhiteLabelPlanner: lazyLoad(() => import('../components/operations/WhiteLabelPlanner'), { ssr: false }),
  ChecklistsAdmin: lazyLoad(() => import('../components/operations/ChecklistsAdminComponent'), { ssr: false }),
  Integrations: lazyLoad(() => import('../components/operations/Integrations'), { ssr: false }),

  // Heavy chart/analytics components
  Charts: lazyLoad(() => import('../components/analytics/Charts'), { ssr: false }),

  // Messages components (heavy, real-time)
  MessageWindow: lazyLoad(() => import('../components/messages/MessageWindow')),
  ConversationList: lazyLoad(() => import('../components/messages/ConversationList')),

  // Checklist components (heavy forms)
  ChecklistForm: lazyLoad(() => import('../components/checklists/ChecklistForm'), { ssr: false }),
  ChecklistPerformance: lazyLoad(() => import('../components/checklists/Performance'), { ssr: false }),

  // Customer app components (separate bundle)
  CustomerDashboard: lazyLoad(() => import('../components/customer/Dashboard')),
  CustomerProfile: lazyLoad(() => import('../components/customer/Profile')),
  CompetePage: lazyLoad(() => import('../components/customer/Compete')),

  // Modals (not needed on initial load)
  TicketModal: lazyLoad(() => import('../components/tickets/TicketModal'), { ssr: false }),
  PatternModal: lazyLoad(() => import('../components/patterns/PatternModal'), { ssr: false }),
};

/**
 * Preload a component in the background
 * Useful for components likely to be needed soon
 */
export function preloadComponent(componentName: keyof typeof LazyComponents) {
  const component = LazyComponents[componentName];
  if (component && typeof component.preload === 'function') {
    component.preload();
  }
}

/**
 * Hook to preload components based on user role
 */
export function usePreloadByRole(userRole?: string) {
  // Preload components based on user role
  if (userRole === 'admin') {
    // Admin likely to use operations
    preloadComponent('V3PLS');
  } else if (userRole === 'operator') {
    // Operator likely to use messages
    preloadComponent('MessageWindow');
  } else if (userRole === 'customer') {
    // Customer likely to view profile
    preloadComponent('CustomerProfile');
  }
}