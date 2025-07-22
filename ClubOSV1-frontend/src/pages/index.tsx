import React, { useEffect } from 'react';
import Head from 'next/head';
import RequestForm from '@/components/RequestForm';
import ExternalTools from '@/components/ExternalTools';
import RoleSwitcher from '@/components/RoleSwitcher';
import { useAuthState, useSettingsState } from '@/state/useStore';
import { Shield, Users, Zap, Brain } from 'lucide-react';

type StatCard = {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
};

export default function Dashboard() {
  const { user } = useAuthState();
  const { preferences } = useSettingsState();
  // Use a default value for usage count since it doesn't exist in the store
  const usageCount = 0;

  const stats: StatCard[] = [
    {
      title: 'Requests Today',
      value: usageCount,
      icon: Zap,
      color: 'var(--status-success)'
    },
    {
      title: 'Active Users',
      value: '12',
      icon: Users,
      color: 'var(--status-info)'
    },
    {
      title: 'System Status',
      value: 'Online',
      icon: Shield,
      color: 'var(--status-success)'
    },
    {
      title: 'AI Confidence',
      value: '94%',
      icon: Brain,
      color: 'var(--status-warning)'
    }
  ];

  return (
    <>
      <Head>
        <title>ClubOS - Dashboard</title>
        <meta name="description" content="ClubOS Dashboard - AI-powered golf simulator management" />
      </Head>

      <div className="min-h-screen bg-[var(--bg-primary)]">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-3xl font-bold text-[var(--text-primary)]">
                Welcome back, {user?.name || 'User'}
              </h1>
              <RoleSwitcher />
            </div>
            <p className="text-[var(--text-secondary)]">
              AI-powered assistant for facility management
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.title} className="card hover:shadow-lg transition-shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-[var(--text-secondary)] mb-1">{stat.title}</p>
                      <p className="text-2xl font-bold text-[var(--text-primary)]">{stat.value}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-[var(--bg-tertiary)]" style={{ color: stat.color }}>
                      <Icon className="w-6 h-6" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Request Form - Takes up 2 columns on large screens */}
            <div className="lg:col-span-2">
              <RequestForm />
            </div>
            
            {/* External Tools - Takes up 1 column on large screens */}
            <div className="lg:col-span-1">
              <ExternalTools />
            </div>
          </div>

          {/* Quick Tips */}
          <div className="mt-8 card bg-[var(--accent)]/10 border-[var(--accent)]/20">
            <h3 className="text-lg font-semibold mb-3 text-[var(--text-primary)]">
              💡 Quick Tips
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <h4 className="font-medium text-[var(--accent)] mb-1">Smart Routing</h4>
                <p className="text-sm text-[var(--text-secondary)]">
                  Let AI automatically route your request to the right specialist bot
                </p>
              </div>
              <div>
                <h4 className="font-medium text-[var(--accent)] mb-1">Location Context</h4>
                <p className="text-sm text-[var(--text-secondary)]">
                  Include location details for more accurate assistance
                </p>
              </div>
              <div>
                <h4 className="font-medium text-[var(--accent)] mb-1">Keyboard Shortcuts</h4>
                <p className="text-sm text-[var(--text-secondary)]">
                  Press Ctrl+Enter to submit, Esc to reset
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
