import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useAuthState } from '@/state/useStore';
import { LayoutDashboard, Users, Brain, Zap, BarChart3 } from 'lucide-react';

// Import new operation components
import { OperationsDashboard } from '@/components/operations/dashboard/OperationsDashboard';
import { OperationsUsers } from '@/components/operations/users/OperationsUsers';
import { OperationsAICenter } from '@/components/operations/ai/OperationsAICenter';
import { OperationsIntegrations } from '@/components/operations/integrations/OperationsIntegrations';
import { OperationsAnalytics } from '@/components/operations/analytics/OperationsAnalytics';

type TabType = 'dashboard' | 'users' | 'ai' | 'integrations' | 'analytics';

export default function Operations() {
  const { user } = useAuthState();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');

  // Check if user has permission to view this page
  useEffect(() => {
    if (user && !['admin', 'operator'].includes(user.role)) {
      // Redirect non-admin/operator users
      window.location.href = '/';
    }
  }, [user]);

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
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
    { id: 'users', label: 'Users', icon: <Users className="h-4 w-4" />, adminOnly: true },
    { id: 'ai', label: 'AI Center', icon: <Brain className="h-4 w-4" />, adminOnly: true },
    { id: 'integrations', label: 'Integrations', icon: <Zap className="h-4 w-4" />, adminOnly: true },
    { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="h-4 w-4" /> }
  ];

  const visibleTabs = tabs.filter(tab => !tab.adminOnly || user.role === 'admin');

  const getTabDescription = () => {
    switch (activeTab) {
      case 'dashboard':
        return 'System overview and real-time status monitoring';
      case 'users':
        return 'Manage users, roles, and access permissions';
      case 'ai':
        return 'Configure AI automations, knowledge base, and prompt templates';
      case 'integrations':
        return 'Manage external service connections and API configurations';
      case 'analytics':
        return 'View system analytics, usage reports, and performance metrics';
      default:
        return '';
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <OperationsDashboard />;
      case 'users':
        return user.role === 'admin' ? <OperationsUsers /> : null;
      case 'ai':
        return user.role === 'admin' ? <OperationsAICenter /> : null;
      case 'integrations':
        return user.role === 'admin' ? <OperationsIntegrations /> : null;
      case 'analytics':
        return <OperationsAnalytics />;
      default:
        return <OperationsDashboard />;
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