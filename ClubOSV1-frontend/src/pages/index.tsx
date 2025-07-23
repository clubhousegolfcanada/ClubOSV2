import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import RequestForm from '@/components/RequestForm';
import ExternalTools from '@/components/ExternalTools';
import RoleSwitcher from '@/components/RoleSwitcher';
import { useAuthState, useSettingsState } from '@/state/useStore';

export default function Dashboard() {
  const { user } = useAuthState();
  const { preferences } = useSettingsState();
  const [isEmbedded, setIsEmbedded] = useState(false);

  useEffect(() => {
    // Detect if running in iframe
    const checkIfEmbedded = () => {
      try {
        const embedded = window !== window.parent || window.location !== window.parent.location;
        setIsEmbedded(embedded);
        
        if (embedded) {
          document.body.classList.add('embedded-mode');
          
          // Send height updates to parent
          const sendHeight = () => {
            const height = document.body.scrollHeight;
            window.parent.postMessage({ 
              type: 'clubos-resize', 
              height: height 
            }, '*');
          };
          
          // Send height on load and resize
          sendHeight();
          window.addEventListener('resize', sendHeight);
          
          // Observer for content changes
          const observer = new MutationObserver(sendHeight);
          observer.observe(document.body, { 
            childList: true, 
            subtree: true, 
            attributes: true 
          });
          
          return () => {
            window.removeEventListener('resize', sendHeight);
            observer.disconnect();
          };
        }
      } catch (e) {
        // Not embedded
      }
    };
    
    checkIfEmbedded();
  }, []);

  return (
    <>
      <Head>
        <title>ClubOS - Dashboard</title>
        <meta name="description" content="ClubOS Dashboard - AI-powered golf simulator management" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/* Allow embedding */}
        <meta httpEquiv="X-Frame-Options" content="SAMEORIGIN" />
      </Head>

      <div className={`min-h-screen bg-[var(--bg-primary)] ${isEmbedded ? 'embedded-dashboard' : ''}`}>
        <div className={isEmbedded ? "w-full px-4 py-8" : "container mx-auto px-4 py-8"}>
          {/* Header - Hide role switcher in embedded mode */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-3xl font-bold text-[var(--text-primary)]">
                Welcome back, {user?.name || 'User'}
              </h1>
              {!isEmbedded && <RoleSwitcher />}
            </div>
            <p className="text-[var(--text-secondary)]">
              AI-powered assistant for facility management
            </p>
          </div>

          {/* Main Content Grid */}
          {isEmbedded ? (
            // Full width in embedded mode
            <div className="w-full">
              <RequestForm />
            </div>
          ) : (
            // Grid layout in normal mode
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
          )}

          {/* Quick Tips - Hide in embedded mode for space */}
          {!isEmbedded && (
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
          )}
        </div>
      </div>
    </>
  );
}
