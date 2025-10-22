import Head from 'next/head';
import { ChecklistSystem } from '@/components/ChecklistSystem';
import { useAuthState } from '@/state/useStore';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { Clipboard, BarChart3 } from 'lucide-react';

export default function Checklists() {
  const { user } = useAuthState();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'checklist' | 'tracker'>('checklist');

  // SECURITY: Block customer role from accessing checklists
  useEffect(() => {
    if (user) {
      if (user.role === 'customer') {
        router.push('/customer/');
        return;
      }
      // Allow operator roles and contractors
      if (!['admin', 'operator', 'support', 'contractor'].includes(user.role)) {
        router.push('/login');
        return;
      }
    }
  }, [user, router]);

  // Don't render until we know the user's role
  if (!user || !['admin', 'operator', 'support', 'contractor'].includes(user.role)) {
    return null;
  }

  return (
    <>
      <Head>
        <title>ClubOS - Checklists</title>
        <meta name="description" content="Complete cleaning and tech maintenance checklists" />
      </Head>

      <div className="min-h-screen bg-[var(--bg-primary)]">
        {/* Sub Navigation - Operations Style */}
        <div className="bg-white border-b border-gray-200">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
              <nav className="flex space-x-1 sm:space-x-4 overflow-x-auto pb-px">
                <button
                  onClick={() => setActiveTab('checklist')}
                  className={`
                    flex items-center space-x-2 px-3 sm:px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap
                    ${activeTab === 'checklist'
                      ? 'border-[var(--accent)] text-[var(--accent)]'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  <Clipboard className="w-4 h-4" />
                  <span>Checklists</span>
                </button>
                <button
                  onClick={() => setActiveTab('tracker')}
                  className={`
                    flex items-center space-x-2 px-3 sm:px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap
                    ${activeTab === 'tracker'
                      ? 'border-[var(--accent)] text-[var(--accent)]'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>Completion Tracker</span>
                </button>
              </nav>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="max-w-7xl mx-auto">
            <ChecklistSystem activeTab={activeTab} />
          </div>
        </div>
      </div>
    </>
  );
}