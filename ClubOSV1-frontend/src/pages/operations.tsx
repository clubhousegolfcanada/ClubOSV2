import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useAuthState } from '@/state/useStore';
import { Users, Zap, BarChart3, Brain } from 'lucide-react';

// Import operation components
import { OperationsUsers } from '@/components/operations/users/OperationsUsers';
import { OperationsIntegrations } from '@/components/operations/integrations/OperationsIntegrations';
import { OperationsAnalytics } from '@/components/operations/analytics/OperationsAnalytics';
import { OperationsPatterns } from '@/components/operations/patterns/OperationsPatterns';

type TabType = 'users' | 'integrations' | 'analytics' | 'patterns';

export default function Operations() {
  const { user } = useAuthState();
  // Default to analytics for operators, users for admins
  const [activeTab, setActiveTab] = useState<TabType>('analytics');

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
        setActiveTab('analytics');
      }
    }
  }, [user]);

  // Listen for tab change events
  useEffect(() => {
    const handleTabChange = (event: CustomEvent) => {
      const tab = event.detail as TabType;
      if (tab && ['users', 'integrations', 'analytics', 'patterns'].includes(tab)) {
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
          <p className="text-[var(--text-secondary)]">You don't have permission to view this page.</p>
        </div>
      </div>
    );
  }

  const tabs: { id: TabType; label: string; icon: React.ReactNode; adminOnly?: boolean }[] = [
    { id: 'users', label: 'Users', icon: <Users className="h-4 w-4" />, adminOnly: true },
    { id: 'integrations', label: 'Integrations & AI', icon: <Zap className="h-4 w-4" />, adminOnly: true },
    { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="h-4 w-4" />, adminOnly: false },
    { id: 'patterns', label: 'V3-PLS', icon: <Brain className="h-4 w-4" />, adminOnly: false }
  ];

  const visibleTabs = tabs.filter(tab => !tab.adminOnly || user.role === 'admin');

  const getTabDescription = () => {
    switch (activeTab) {
      case 'users':
        return 'Manage operators, customers, roles, and access permissions';
      case 'integrations':
        return 'Manage integrations, AI automations, and knowledge base';
      case 'analytics':
        return 'View system analytics, usage reports, and performance metrics';
      case 'patterns':
        return 'V3 Pattern Learning System - AI-powered message automation';
      default:
        return '';
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'users':
        return user.role === 'admin' ? <OperationsUsers /> : null;
      case 'integrations':
        return user.role === 'admin' ? <OperationsIntegrations /> : null;
      case 'analytics':
        return <OperationsAnalytics />;
      case 'patterns':
        return <OperationsPatterns />;
      default:
        return user.role === 'admin' ? <OperationsUsers /> : <OperationsAnalytics />;
    }
  };

  return (
    <>
      <Head>
        <title>Operations - ClubOS</title>
      </Head>

      <div className="min-h-screen bg-[var(--bg-primary)]">
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="px-4 sm:px-6 lg:px-8 py-6">
            <div className="max-w-7xl mx-auto">
              <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-primary)]">
                Operations Center
              </h1>
              <p className="text-[var(--text-secondary)] text-sm mt-1">
                {getTabDescription()}
              </p>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
              <nav className="flex space-x-1 sm:space-x-4 overflow-x-auto pb-px">
                {visibleTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      flex items-center space-x-2 px-3 sm:px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap
                      ${activeTab === tab.id
                        ? 'border-primary text-primary'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }
                    `}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                  </button>
                ))}
              </nav>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 sm:px-6 lg:px-8 py-6">
          <div className="max-w-7xl mx-auto">
            {renderTabContent()}
          </div>
        </div>
      </div>

      <style jsx>{`
        :root {
          --bg-primary: #fafafa;
          --bg-secondary: #ffffff;
          --text-primary: #1a1a1a;
          --text-secondary: #666666;
          --text-muted: #999999;
          --border: #e5e5e5;
          --accent: #0B3D3A;
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
    </>
  );
}