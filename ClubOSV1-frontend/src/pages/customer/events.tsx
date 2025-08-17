import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuthState } from '@/state/useStore';
import CustomerNavigation from '@/components/customer/CustomerNavigation';
import Head from 'next/head';
import { Trophy, Calendar, Users, Target, ChevronRight, Info, ExternalLink } from 'lucide-react';

export default function CustomerEvents() {
  const router = useRouter();
  const { user } = useAuthState();
  const [loading, setLoading] = useState(true);

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
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0B3D3A] mx-auto mb-4"></div>
          <p className="text-gray-500">Loading events...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Events - Clubhouse 24/7</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </Head>

      <div className="min-h-screen bg-[#fafafa]">
        <CustomerNavigation />
        
        <main className="pb-20 lg:pb-8 pt-16 lg:pt-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Header Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                    <Trophy className="w-7 h-7 text-[#0B3D3A] mr-2" />
                    Events & Tournaments
                  </h1>
                  <p className="mt-1 text-gray-600">
                    Compete with friends and win prizes in our TrackMan tournaments
                  </p>
                </div>
              </div>
            </div>

            {/* How to Join Section */}
            <div className="bg-gradient-to-br from-[#0B3D3A] to-[#084a45] rounded-xl shadow-sm p-6 mb-6 text-white">
              <div className="flex items-center mb-4">
                <Info className="w-5 h-5 mr-2" />
                <h2 className="text-lg font-semibold">How to Join Events</h2>
              </div>
              <div className="space-y-3">
                <div className="flex items-start">
                  <div className="flex-shrink-0 w-8 h-8 bg-white/20 rounded-full flex items-center justify-center mr-3">
                    <span className="text-sm font-bold">1</span>
                  </div>
                  <div>
                    <p className="font-medium">Book a Box at Clubhouse</p>
                    <p className="text-sm text-white/80">Reserve your time slot at any Clubhouse 24/7 location</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="flex-shrink-0 w-8 h-8 bg-white/20 rounded-full flex items-center justify-center mr-3">
                    <span className="text-sm font-bold">2</span>
                  </div>
                  <div>
                    <p className="font-medium">Create a TrackMan Account</p>
                    <p className="text-sm text-white/80">Sign up for free to track your scores and compete</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="flex-shrink-0 w-8 h-8 bg-white/20 rounded-full flex items-center justify-center mr-3">
                    <span className="text-sm font-bold">3</span>
                  </div>
                  <div>
                    <p className="font-medium">Play & Compete</p>
                    <p className="text-sm text-white/80">Your scores automatically update on the leaderboard</p>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-white/20">
                <div className="flex flex-col sm:flex-row gap-3">
                  <button 
                    onClick={() => window.open('https://clubhouse247golf.skedda.com/booking', '_blank')}
                    className="flex-1 bg-white text-[#0B3D3A] py-2.5 px-4 rounded-lg font-medium hover:bg-gray-100 transition-colors flex items-center justify-center"
                  >
                    <Calendar className="w-4 h-4 mr-2" />
                    Book a Box
                  </button>
                  <button 
                    onClick={() => window.open('https://trackman.com', '_blank')}
                    className="flex-1 bg-white/10 backdrop-blur text-white py-2.5 px-4 rounded-lg font-medium hover:bg-white/20 transition-colors flex items-center justify-center border border-white/20"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    TrackMan Sign Up
                  </button>
                </div>
              </div>
            </div>

            {/* Live Leaderboard Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                      <Target className="w-5 h-5 text-[#0B3D3A] mr-2" />
                      Live Tournament Leaderboard
                    </h2>
                    <p className="text-sm text-gray-600 mt-1">
                      Real-time scores from all Clubhouse 24/7 locations
                    </p>
                  </div>
                  <div className="hidden sm:flex items-center space-x-2">
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-2"></div>
                      <span className="text-sm text-gray-600">Live</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* TrackMan Leaderboard Embed */}
              <div className="relative bg-gray-50" style={{ minHeight: '600px' }}>
                <iframe
                  src="https://tm-short.me/pZY461g"
                  title="TrackMan Tournament Leaderboard"
                  className="w-full"
                  style={{ height: '800px', border: 'none' }}
                  allow="fullscreen"
                />
              </div>
            </div>

            {/* Quick Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Active Players</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">48</p>
                  </div>
                  <Users className="w-8 h-8 text-[#0B3D3A]/20" />
                </div>
              </div>
              
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Today's Leader</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">-5</p>
                  </div>
                  <Trophy className="w-8 h-8 text-[#0B3D3A]/20" />
                </div>
              </div>
              
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Prize Pool</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">$500</p>
                  </div>
                  <Target className="w-8 h-8 text-[#0B3D3A]/20" />
                </div>
              </div>
            </div>

            {/* Upcoming Events */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Upcoming Events</h3>
              <div className="space-y-3">
                <div className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900">Weekend Warriors Tournament</h4>
                      <p className="text-sm text-gray-600 mt-1">Saturday, Feb 3 • 2:00 PM - 8:00 PM</p>
                      <div className="flex items-center mt-2">
                        <span className="text-xs bg-[#0B3D3A]/10 text-[#0B3D3A] px-2 py-1 rounded-full">All Locations</span>
                        <span className="text-xs text-gray-500 ml-2">• 32 registered</span>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 mt-1" />
                  </div>
                </div>
                
                <div className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900">Monthly Long Drive Challenge</h4>
                      <p className="text-sm text-gray-600 mt-1">Sunday, Feb 4 • All Day</p>
                      <div className="flex items-center mt-2">
                        <span className="text-xs bg-[#0B3D3A]/10 text-[#0B3D3A] px-2 py-1 rounded-full">Bedford & Dartmouth</span>
                        <span className="text-xs text-gray-500 ml-2">• 18 registered</span>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 mt-1" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}