import Head from 'next/head';
import TicketCenterOptimizedV3 from '@/components/TicketCenterOptimizedV3';
import { useAuthState } from '@/state/useStore';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, Archive, Plus, MapPin, Settings2, Wrench } from 'lucide-react';

type TicketCategory = 'all' | 'facilities' | 'tech';

export default function TicketCenter() {
  const { user } = useAuthState();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'active' | 'resolved' | 'archived'>('active');
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<TicketCategory>('all');
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showLocationDropdown && !(event.target as Element).closest('.location-dropdown')) {
        setShowLocationDropdown(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showLocationDropdown]);

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
              <nav className="flex justify-between items-center">
                {/* Left: Status Tabs */}
                <div className="flex items-center space-x-2">
                  <div className="flex space-x-1 sm:space-x-4 pb-px">
                    <button
                      onClick={() => setActiveTab('active')}
                      className={`
                        flex items-center space-x-2 px-2 sm:px-3 py-2 text-sm font-medium border-b-2 transition-all whitespace-nowrap
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
                        flex items-center space-x-2 px-2 sm:px-3 py-2 text-sm font-medium border-b-2 transition-all whitespace-nowrap
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
                        flex items-center space-x-2 px-2 sm:px-3 py-2 text-sm font-medium border-b-2 transition-all whitespace-nowrap
                        ${activeTab === 'archived'
                          ? 'border-[var(--accent)] text-[var(--accent)]'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }
                      `}
                    >
                      <Archive className="w-4 h-4" />
                      <span>Archived</span>
                    </button>
                  </div>

                  {/* New Ticket Button */}
                  <div className="border-l border-gray-200 pl-2 ml-2">
                    <button
                      onClick={() => router.push('/?ticketMode=true')}
                      className="flex items-center space-x-1 px-3 py-1.5 bg-[var(--accent)] text-white rounded-md hover:bg-opacity-90 transition-all text-sm font-medium"
                    >
                      <Plus className="w-4 h-4" />
                      <span className="hidden sm:inline">New Ticket</span>
                    </button>
                  </div>
                </div>

                {/* Right: Filters */}
                <div className="flex items-center space-x-2 py-1">
                  {/* Location Filter Dropdown */}
                  <div className="relative location-dropdown">
                    <button
                      onClick={() => setShowLocationDropdown(!showLocationDropdown)}
                      className="flex items-center space-x-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-all text-sm font-medium"
                    >
                      <MapPin className="w-4 h-4" />
                      <span className="hidden sm:inline">{selectedLocation === 'all' ? 'All Locations' : selectedLocation}</span>
                    </button>
                    {showLocationDropdown && (
                      <div className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg z-50 border border-gray-200">
                        <button
                          onClick={() => { setSelectedLocation('all'); setShowLocationDropdown(false); }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 ${selectedLocation === 'all' ? 'bg-gray-50 font-medium' : ''}`}
                        >
                          All Locations
                        </button>
                        {['Bedford', 'Dartmouth', 'Stratford', 'Bayers Lake', 'Truro'].map(location => (
                          <button
                            key={location}
                            onClick={() => { setSelectedLocation(location); setShowLocationDropdown(false); }}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 ${selectedLocation === location ? 'bg-gray-50 font-medium' : ''}`}
                          >
                            {location}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Category Filter Buttons */}
                  <div className="flex items-center space-x-1 bg-gray-100 rounded-md p-0.5">
                    <button
                      onClick={() => setCategoryFilter('all')}
                      className={`px-2.5 py-1 rounded text-sm font-medium transition-all ${
                        categoryFilter === 'all'
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setCategoryFilter('facilities')}
                      className={`px-2.5 py-1 rounded text-sm font-medium transition-all ${
                        categoryFilter === 'facilities'
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Facilities
                    </button>
                    <button
                      onClick={() => setCategoryFilter('tech')}
                      className={`px-2.5 py-1 rounded text-sm font-medium transition-all ${
                        categoryFilter === 'tech'
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Tech
                    </button>
                  </div>
                </div>
              </nav>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-4">
          {/* Main Content - New modernized component */}
          <TicketCenterOptimizedV3
            activeTab={activeTab}
            selectedLocation={selectedLocation}
            categoryFilter={categoryFilter}
          />
        </div>
      </div>
    </>
  );
}
