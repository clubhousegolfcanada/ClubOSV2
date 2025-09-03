import React, { ReactNode } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import logger from '@/services/logger';

interface SectionBoundaryProps {
  children: ReactNode;
  section: string;
  compact?: boolean;
}

/**
 * Dashboard-specific error boundary with compact fallback
 */
export const DashboardErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary
    fallback={
      <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
        <div className="flex items-start">
          <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 mr-3" />
          <div>
            <p className="text-yellow-800 font-medium">Dashboard temporarily unavailable</p>
            <p className="text-yellow-700 text-sm mt-1">Please refresh the page to try again.</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-3 text-sm text-yellow-600 hover:text-yellow-700 underline"
            >
              Refresh now
            </button>
          </div>
        </div>
      </div>
    }
    onError={(error) => {
      logger.error('Dashboard error', error);
    }}
  >
    {children}
  </ErrorBoundary>
);

/**
 * Customer section error boundary
 */
export const CustomerErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary
    fallback={
      <div className="p-6 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start">
          <AlertTriangle className="w-5 h-5 text-blue-600 mt-0.5 mr-3" />
          <div>
            <p className="text-blue-800 font-medium">This section is temporarily unavailable</p>
            <p className="text-blue-700 text-sm mt-1">We're working on it. Please try again in a moment.</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-3 inline-flex items-center text-sm text-blue-600 hover:text-blue-700"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Refresh page
            </button>
          </div>
        </div>
      </div>
    }
    onError={(error) => {
      logger.error('Customer section error', error);
    }}
  >
    {children}
  </ErrorBoundary>
);

/**
 * Messages/Chat error boundary
 */
export const MessagesErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary
    fallback={
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <p className="text-gray-700 text-sm">Messages temporarily unavailable. Please refresh to reconnect.</p>
      </div>
    }
    onError={(error) => {
      logger.error('Messages error', error);
    }}
  >
    {children}
  </ErrorBoundary>
);

/**
 * Operations/Admin error boundary
 */
export const OperationsErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary
    fallback={
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-start">
          <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 mr-3" />
          <div>
            <p className="text-red-800 font-medium">Operations panel error</p>
            <p className="text-red-700 text-sm mt-1">Critical section failed to load. Please contact support if this persists.</p>
            <div className="mt-3 space-x-3">
              <button
                onClick={() => window.location.reload()}
                className="text-sm text-red-600 hover:text-red-700 underline"
              >
                Refresh
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="text-sm text-red-600 hover:text-red-700 underline"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    }
    onError={(error) => {
      logger.error('Operations error - CRITICAL', error);
    }}
  >
    {children}
  </ErrorBoundary>
);

/**
 * Generic section boundary with customizable section name
 */
export const SectionErrorBoundary: React.FC<SectionBoundaryProps> = ({ 
  children, 
  section, 
  compact = false 
}) => (
  <ErrorBoundary
    fallback={
      compact ? (
        <div className="p-3 bg-gray-50 rounded text-sm text-gray-600">
          {section} unavailable
        </div>
      ) : (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <p className="text-gray-700">{section} is temporarily unavailable.</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 text-sm text-blue-600 hover:text-blue-700 underline"
          >
            Refresh to try again
          </button>
        </div>
      )
    }
    onError={(error) => {
      logger.error(`${section} error`, error);
    }}
  >
    {children}
  </ErrorBoundary>
);