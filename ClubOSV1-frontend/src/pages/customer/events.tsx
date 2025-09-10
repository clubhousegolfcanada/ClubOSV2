import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuthState } from '@/state/useStore';
import CustomerNavigation from '@/components/customer/CustomerNavigation';
import { TabNavigation } from '@/components/customer/TabNavigation';
import Head from 'next/head';
import { Trophy, Download, MapPin, Smartphone, Crown, Medal, Award, Star, Coins } from 'lucide-react';

export default function CustomerEvents() {
  const router = useRouter();
  const { user } = useAuthState();
  const [loading, setLoading] = useState(true);
  const [activeLeaderboard, setActiveLeaderboard] = useState<'pro' | 'house' | 'alltime'>('pro');
  const [alltimeLoading, setAlltimeLoading] = useState(false);
  
  // Competitive ranking tiers
  const getRankTier = (rank: number) => {
    if (rank <= 10) return { name: 'Grand Master', color: 'text-red-600', bg: 'bg-red-50' };
    if (rank <= 25) return { name: 'Master', color: 'text-purple-600', bg: 'bg-purple-50' };
    if (rank <= 50) return { name: 'Diamond', color: 'text-blue-600', bg: 'bg-blue-50' };
    if (rank <= 100) return { name: 'Platinum', color: 'text-cyan-600', bg: 'bg-cyan-50' };
    if (rank <= 200) return { name: 'Gold', color: 'text-yellow-600', bg: 'bg-yellow-50' };
    if (rank <= 500) return { name: 'Silver', color: 'text-[var(--text-secondary)]', bg: 'bg-[var(--bg-tertiary)]' };
    return { name: 'Bronze', color: 'text-orange-600', bg: 'bg-orange-50' };
  };

  useEffect(() => {
    // Check authentication
    if (!user) {
      router.push('/login');
    } else {
      setLoading(false);
    }
  }, [user, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--accent)] mx-auto mb-4"></div>
          <p className="text-[var(--text-muted)]">Loading tournaments...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Leaderboard - Clubhouse Golf</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </Head>

      <div className="min-h-screen bg-[var(--bg-primary)] customer-app">
        <CustomerNavigation />
        
        <main className="pb-24 lg:pb-8">
          {/* Header - Consistent minimalist style */}
          <div className="bg-[var(--bg-secondary)] border-b border-[var(--border-secondary)] px-4 py-3">
            <div className="max-w-7xl mx-auto">
              <h1 className="text-xl font-bold text-[var(--text-primary)]">
                Tournaments
              </h1>
              <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                Compete in tournaments and track your progress
              </p>
            </div>
          </div>

          {/* Tabs */}
          <TabNavigation
            tabs={[
              { key: 'pro', label: 'Pro League' },
              { key: 'house', label: 'House League' },
              { key: 'alltime', label: 'All Time' }
            ]}
            activeTab={activeLeaderboard}
            onTabChange={(tab) => setActiveLeaderboard(tab as 'pro' | 'house' | 'alltime')}
            sticky={true}
          />
          
          {/* Leaderboard Content */}
          <div className="max-w-7xl mx-auto">
            {activeLeaderboard === 'alltime' ? (
              // All Time Competitive Rankings
              <div className="max-w-5xl mx-auto px-4 py-6">
                <div className="bg-[var(--bg-secondary)] rounded-lg shadow-sm border border-[var(--border-primary)]">
                  {/* Header */}
                  <div className="px-6 py-4 border-b border-[var(--border-primary)] bg-gradient-to-r from-[var(--accent)] to-[var(--accent-hover)]">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      <Trophy className="w-6 h-6" />
                      All Time Rankings
                    </h2>
                    <p className="text-white/80 text-sm mt-1">Official competitive standings across all Clubhouse Golf locations</p>
                  </div>
                  
                  {/* Coming Soon Content */}
                  <div className="p-12 text-center">
                    <div className="max-w-2xl mx-auto">
                      <Trophy className="w-16 h-16 text-[var(--accent)] mx-auto mb-4" />
                      <h3 className="text-2xl font-bold text-[var(--text-primary)] mb-4">
                        Competitive Rankings Coming Soon
                      </h3>
                      <p className="text-[var(--text-secondary)] mb-6">
                        The official Clubhouse Golf competitive ranking system is launching soon. 
                        Track your progress from Bronze to Grand Master as you compete against players across all locations.
                      </p>
                      
                      {/* Tier Preview */}
                      <div className="bg-[var(--bg-tertiary)] rounded-lg p-6 mb-8">
                        <h4 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wider mb-4">
                          Competitive Tiers
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="bg-[var(--bg-secondary)] rounded-lg p-3 border border-[var(--border-primary)]">
                            <div className="text-orange-600 font-bold">Bronze</div>
                            <div className="text-xs text-[var(--text-muted)]">Entry Level</div>
                          </div>
                          <div className="bg-[var(--bg-secondary)] rounded-lg p-3 border border-[var(--border-primary)]">
                            <div className="text-[var(--text-secondary)] font-bold">Silver</div>
                            <div className="text-xs text-[var(--text-muted)]">Top 500</div>
                          </div>
                          <div className="bg-[var(--bg-secondary)] rounded-lg p-3 border border-[var(--border-primary)]">
                            <div className="text-yellow-600 font-bold">Gold</div>
                            <div className="text-xs text-[var(--text-muted)]">Top 200</div>
                          </div>
                          <div className="bg-[var(--bg-secondary)] rounded-lg p-3 border border-[var(--border-primary)]">
                            <div className="text-cyan-600 font-bold">Platinum</div>
                            <div className="text-xs text-[var(--text-muted)]">Top 100</div>
                          </div>
                          <div className="bg-[var(--bg-secondary)] rounded-lg p-3 border border-[var(--border-primary)]">
                            <div className="text-blue-600 font-bold">Diamond</div>
                            <div className="text-xs text-[var(--text-muted)]">Top 50</div>
                          </div>
                          <div className="bg-[var(--bg-secondary)] rounded-lg p-3 border border-[var(--border-primary)]">
                            <div className="text-purple-600 font-bold">Master</div>
                            <div className="text-xs text-[var(--text-muted)]">Top 25</div>
                          </div>
                          <div className="bg-[var(--bg-secondary)] rounded-lg p-3 border border-[var(--border-primary)] md:col-span-2">
                            <div className="text-red-600 font-bold">Grand Master</div>
                            <div className="text-xs text-[var(--text-muted)]">Top 10 Elite Players</div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-sm text-[var(--text-muted)]">
                        ClubCoin rewards, seasonal championships, and exclusive prizes for top performers.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : activeLeaderboard === 'pro' ? (
              <iframe
                src="https://tm-short.me/pZY461g"
                title="Pro League Leaderboard"
                className="w-full h-full"
                style={{ 
                  border: 'none',
                  minHeight: '600px'
                }}
                allow="fullscreen"
              />
            ) : activeLeaderboard === 'house' ? (
              <iframe
                src="https://tm-short.me/Tqjb7AS"
                title="House League Leaderboard"
                className="w-full h-full"
                style={{ 
                  border: 'none',
                  minHeight: '600px'
                }}
                allow="fullscreen"
              />
            ) : null}
          </div>
        </main>
      </div>
    </>
  );
}