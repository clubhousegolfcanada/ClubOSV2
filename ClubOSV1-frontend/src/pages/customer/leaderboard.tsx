import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuthState } from '@/state/useStore';
import CustomerNavigation from '@/components/customer/CustomerNavigation';
import { TabNavigation } from '@/components/customer/TabNavigation';
import Head from 'next/head';
import { Trophy } from 'lucide-react';
import { LeaderboardList } from '@/components/customer/LeaderboardList';



export default function CustomerLeaderboard() {
  const router = useRouter();
  const { user } = useAuthState();
  const [activeTab, setActiveTab] = useState<'pro' | 'house' | 'closest' | 'alltime'>('alltime');
  const [refreshKey, setRefreshKey] = useState(0);

  // TrackMan embed URLs
  const embedUrls = {
    pro: 'https://tm-short.me/pZY461g', // Pro League
    house: 'https://tm-short.me/Tqjb7AS', // House League
    closest: 'https://tm-short.me/IsUwwGi', // Closest to the Pin
    alltime: null // All-time will be custom implementation
  };

  const handleRefresh = async () => {
    // Trigger component refresh by changing key
    setRefreshKey(prev => prev + 1);
  };

  // Check authentication on mount
  useEffect(() => {
    if (!user) {
      router.push('/login');
    }
  }, [user, router]);

  if (!user) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--accent)]"></div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Leaderboard - Clubhouse Golf</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
      </Head>

      <div className="min-h-screen bg-[var(--bg-primary)] customer-app">
        <CustomerNavigation />
        
        <main className="pb-20 lg:pb-8">
          {/* Header - Consistent minimalist style */}
          <div className="bg-[var(--bg-secondary)] border-b border-[var(--border-secondary)] px-4 py-3">
            <div className="max-w-7xl mx-auto">
              <h1 className="text-xl font-bold text-[var(--text-primary)]">
                Leaderboard
              </h1>
              <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                Install the TrackMan app and go to any Clubhouse to enter
              </p>
            </div>
          </div>

          {/* Tabs */}
          <TabNavigation
            tabs={[
              { key: 'pro', label: 'Pro League' },
              { key: 'house', label: 'House League' },
              { key: 'closest', label: 'Closest to Pin' },
              { key: 'alltime', label: 'All Time' }
            ]}
            activeTab={activeTab}
            onTabChange={(tab) => setActiveTab(tab as 'pro' | 'house' | 'closest' | 'alltime')}
            sticky={true}
          />

          {/* Content Area */}
          <div className="max-w-7xl mx-auto">
            {activeTab === 'alltime' ? (
              // All-time leaderboard using unified component
              <LeaderboardList 
                key={refreshKey}
                userId={user?.id}
                userToken={user?.token}
                onRefresh={handleRefresh}
                showSearch={true}
                virtualScroll={true}
              />
            ) : (
              // TrackMan embed for Pro and House leagues
              <div className="relative w-full h-[60vh] sm:h-[70vh] md:h-[75vh]">
                {embedUrls[activeTab] ? (
                  <iframe
                    src={embedUrls[activeTab]}
                    className="absolute inset-0 w-full h-full"
                    frameBorder="0"
                    allowFullScreen
                    loading="lazy"
                    title={`${
                      activeTab === 'pro' ? 'Pro League' : 
                      activeTab === 'house' ? 'House League' : 
                      'Closest to the Pin'
                    } Leaderboard`}
                  />
                ) : (
                  <div className="p-8 text-center">
                    <Trophy className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-[var(--text-primary)] mb-2">
                      {activeTab === 'pro' ? 'Pro League' : 'House League'}
                    </h3>
                    <p className="text-[var(--text-muted)] mb-4">
                      TrackMan leaderboard will appear here
                    </p>
                    <p className="text-sm text-[var(--text-muted)]">
                      Contact support to configure the {activeTab === 'pro' ? 'Pro' : 'House'} League embed URL
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
}