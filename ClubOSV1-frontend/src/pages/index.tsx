import React from 'react';
import Head from 'next/head';
import RequestForm from '@/components/RequestForm';
import ExternalTools from '@/components/ExternalTools';
import RoleSwitcher from '@/components/RoleSwitcher';
import { useAuthState, useSettingsState } from '@/state/useStore';

export default function Dashboard() {
  const { user } = useAuthState();
  const { preferences } = useSettingsState();

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
