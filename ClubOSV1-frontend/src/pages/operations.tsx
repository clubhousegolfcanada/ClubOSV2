import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useAuthState } from '@/state/useStore';
import { Users, Zap, Brain, ClipboardList, Layers } from 'lucide-react';
import SubNavigation, { SubNavTab } from '@/components/SubNavigation';
import OperatorLayout from '@/components/OperatorLayout';

// Lazy load operation components for better performance
const OperationsUsers = lazy(() => import('@/components/operations/users/OperationsUsers').then(m => ({ default: m.OperationsUsers })));
const OperationsIntegrations = lazy(() => import('@/components/operations/integrations/OperationsIntegrations').then(m => ({ default: m.OperationsIntegrations })));
const OperationsPatternsEnhanced = lazy(() => import('@/components/operations/patterns/OperationsPatternsEnhanced').then(m => ({ default: m.OperationsPatternsEnhanced })));
const WhiteLabelPlanner = lazy(() => import('@/components/operations/white-label/WhiteLabelPlanner').then(m => ({ default: m.WhiteLabelPlanner })));
const ChecklistsAdminComponent = lazy(() => import('@/components/operations/checklists/ChecklistsAdminComponent').then(m => ({ default: m.ChecklistsAdminComponent })));

// Loading component
const TabLoading = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="animate-pulse text-gray-500">Loading...</div>
  </div>
);

type TabType = 'users' | 'integrations' | 'patterns' | 'checklists-admin' | 'white-label';

export default function Operations() {
  const { user } = useAuthState();
  // Default to patterns for operators, users for admins
  const [activeTab, setActiveTab] = useState<TabType>('patterns');

  // SECURITY: Block customer role from accessing operations
  useEffect(() => {
    if (user) {
      if (user.role === 'customer') {
        // Redirect customers to their dashboard
        window.location.href = '/customer/';
        return;
      }
      if (!['admin', 'operator'].includes(user.role)) {
        // Redirect other non-authorized users to login
        window.location.href = '/login';
      }
      // Set initial tab based on role
      if (user.role === 'admin') {
        setActiveTab('users');
      } else if (user.role === 'operator') {
        setActiveTab('patterns');
      }
    }
  }, [user]);

  // Listen for tab change events
  useEffect(() => {
    const handleTabChange = (event: CustomEvent) => {
      const tab = event.detail as TabType;
      if (tab && ['users', 'integrations', 'patterns', 'checklists-admin', 'white-label'].includes(tab)) {
        setActiveTab(tab);
      }
    };

    window.addEventListener('operations-tab-change', handleTabChange as EventListener);
    return () => {
      window.removeEventListener('operations-tab-change', handleTabChange as EventListener);
    };
  }, []);

  if (!user || !['admin', 'operator'].includes(user.role)) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Access Denied</h2>
          <p className="text-[var(--text-secondary)]">You don&apos;t have permission to view this page.</p>
        </div>
      </div>
    );
  }

  // Convert icons to LucideIcon types for SubNavigation
  const tabConfigs = [
    { id: 'users', label: 'Users', icon: Users, adminOnly: true },
    { id: 'integrations', label: 'Integrations & AI', icon: Zap, adminOnly: true },
    { id: 'patterns', label: 'V3-PLS', icon: Brain, adminOnly: false },
    { id: 'checklists-admin', label: 'Checklists Admin', icon: ClipboardList, adminOnly: true },
    { id: 'white-label', label: 'White Label', icon: Layers, adminOnly: true }
  ];

  const visibleTabConfigs = tabConfigs.filter(tab => !tab.adminOnly || user.role === 'admin');

  // Convert to SubNavTab format
  const tabs: SubNavTab[] = visibleTabConfigs.map(tab => ({
    id: tab.id,
    label: tab.label,
    icon: tab.icon
  }));

  const getTabDescription = () => {
    switch (activeTab) {
      case 'users':
        return 'Manage operators, customers, roles, and access permissions';
      case 'integrations':
        return 'Manage integrations, AI automations, and knowledge base';
      case 'patterns':
        return 'V3 Pattern Learning System - AI-powered message automation';
      case 'checklists-admin':
        return 'Manage checklist templates and assignments for all locations';
      case 'white-label':
        return 'White Label Planning Tool - Document and plan platform transformation';
      default:
        return '';
    }
  };

  const renderTabContent = () => {
    // Wrap lazy-loaded components in Suspense
    const content = (() => {
      switch (activeTab) {
        case 'users':
          return user.role === 'admin' ? <OperationsUsers /> : null;
        case 'integrations':
          return user.role === 'admin' ? <OperationsIntegrations /> : null;
        case 'patterns':
          return <OperationsPatternsEnhanced />;
        case 'checklists-admin':
          return user.role === 'admin' ? <ChecklistsAdminComponent /> : null;
        case 'white-label':
          return user.role === 'admin' ? <WhiteLabelPlanner /> : null;
        default:
          return user.role === 'admin' ? <OperationsUsers /> : <OperationsPatternsEnhanced />;
      }
    })();

    return (
      <Suspense fallback={<TabLoading />}>
        {content}
      </Suspense>
    );
  };

  return (
    <OperatorLayout
      title="Operations - ClubOS"
      description="Manage system operations, integrations, and configurations"
      subNavigation={
        <SubNavigation
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={(tabId) => setActiveTab(tabId as TabType)}
        />
      }
    >
      {/* Tab description for context */}
      <div className="mb-4">
        <p className="text-sm text-[var(--text-muted)]">{getTabDescription()}</p>
      </div>

      {/* Tab content */}
      {renderTabContent()}

      <style jsx>{`
        :root {
          --bg-primary: var(--bg-primary);
          --bg-secondary: #ffffff;
          --text-primary: #1a1a1a;
          --text-secondary: #666666;
          --text-muted: #999999;
          --border: #e5e5e5;
          --accent: var(--accent);
          --accent-hover: #084a45;
          --success: #10b981;
          --warning: #f59e0b;
          --error: #ef4444;
          --info: #3b82f6;
        }

        .primary {
          color: var(--accent);
        }

        .primary-hover {
          color: var(--accent-hover);
        }

        .bg-primary {
          background-color: var(--accent);
        }

        .bg-primary-hover {
          background-color: var(--accent-hover);
        }

        .border-primary {
          border-color: var(--accent);
        }

        .text-primary {
          color: var(--accent);
        }

        /* Responsive adjustments */
        @media (max-width: 640px) {
          nav {
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
          }
          nav::-webkit-scrollbar {
            display: none;
          }
        }
      `}</style>
    </OperatorLayout>
  );
}