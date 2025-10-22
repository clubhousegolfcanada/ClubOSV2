import Head from 'next/head';
import TicketCenterOptimizedV3 from '@/components/TicketCenterOptimizedV3';
import { useAuthState } from '@/state/useStore';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, Archive } from 'lucide-react';

export default function TicketCenter() {
  const { user } = useAuthState();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'active' | 'resolved' | 'archived'>('active');

  // SECURITY: Block customer role from accessing tickets
  useEffect(() => {
    if (user) {
      if (user.role === 'customer') {
        router.push('/customer/');
        return;
      }
      // Only allow operator roles
      if (!['admin', 'operator', 'support'].includes(user.role)) {
        router.push('/login');
        return;
      }
    }
  }, [user, router]);

  return (
    <>
      <Head>
        <title>ClubOS - Ticket Center</title>
        <meta name="description" content="Manage facilities and technical support tickets" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0" />
      </Head>

      <div className="min-h-screen bg-[var(--bg-primary)] pb-12">
        {/* Sub Navigation - Operations Style */}
        <div className="bg-white border-b border-gray-200">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
              <nav className="flex space-x-1 sm:space-x-4 overflow-x-auto pb-px">
                <button
                  onClick={() => setActiveTab('active')}
                  className={`
                    flex items-center space-x-2 px-3 sm:px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap
                    ${activeTab === 'active'
                      ? 'border-[var(--accent)] text-[var(--accent)]'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  <AlertCircle className="w-4 h-4" />
                  <span>Active</span>
                </button>
                <button
                  onClick={() => setActiveTab('resolved')}
                  className={`
                    flex items-center space-x-2 px-3 sm:px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap
                    ${activeTab === 'resolved'
                      ? 'border-[var(--accent)] text-[var(--accent)]'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Resolved</span>
                </button>
                <button
                  onClick={() => setActiveTab('archived')}
                  className={`
                    flex items-center space-x-2 px-3 sm:px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap
                    ${activeTab === 'archived'
                      ? 'border-[var(--accent)] text-[var(--accent)]'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  <Archive className="w-4 h-4" />
                  <span>Archived</span>
                </button>
              </nav>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-4">
          {/* Main Content - New modernized component */}
          <TicketCenterOptimizedV3 activeTab={activeTab} />
        </div>
      </div>
    </>
  );
}
