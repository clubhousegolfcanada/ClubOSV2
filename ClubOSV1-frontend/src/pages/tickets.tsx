import TicketCenterOptimizedV3 from '@/components/TicketCenterOptimizedV3';
import { useAuthState } from '@/state/useStore';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, Archive, Plus, MapPin, Settings2, Wrench } from 'lucide-react';
import SubNavigation, { SubNavTab, SubNavAction } from '@/components/SubNavigation';
import OperatorLayout from '@/components/OperatorLayout';

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

  // Define tabs for SubNavigation
  const tabs: SubNavTab[] = [
    { id: 'active', label: 'Active', icon: AlertCircle },
    { id: 'resolved', label: 'Resolved', icon: CheckCircle },
    { id: 'archived', label: 'Archived', icon: Archive },
  ];

  // Define actions for SubNavigation
  const actions: SubNavAction[] = [
    {
      id: 'new-ticket',
      label: 'New Ticket',
      icon: Plus,
      onClick: () => router.push('/?ticketMode=true'),
      variant: 'primary',
      hideOnMobile: true
    }
  ];

  return (
    <OperatorLayout
      title="ClubOS - Ticket Center"
      description="Manage facilities and technical support tickets"
      subNavigation={
        <SubNavigation
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={(tabId) => setActiveTab(tabId as 'active' | 'resolved' | 'archived')}
          actions={actions}
          rightContent={
            <>
              {/* Location Filter Dropdown */}
              <div className="relative location-dropdown">
                <button
                  onClick={() => setShowLocationDropdown(!showLocationDropdown)}
                  className="flex items-center space-x-1 px-3 py-1.5 bg-[var(--bg-tertiary)] text-[var(--text-secondary)] rounded-md hover:bg-[var(--bg-hover)] transition-all text-sm font-medium"
                >
                  <MapPin className="w-4 h-4" />
                  <span className="hidden sm:inline">{selectedLocation === 'all' ? 'All Locations' : selectedLocation}</span>
                </button>
                {showLocationDropdown && (
                  <div className="absolute right-0 mt-1 w-48 bg-[var(--bg-secondary)] rounded-md shadow-lg z-50 border border-[var(--border-primary)]">
                    <button
                      onClick={() => { setSelectedLocation('all'); setShowLocationDropdown(false); }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-[var(--bg-hover)] ${selectedLocation === 'all' ? 'bg-[var(--bg-tertiary)] font-medium' : ''}`}
                    >
                      All Locations
                    </button>
                    {['Bedford', 'Dartmouth', 'Stratford', 'Bayers Lake', 'Truro'].map(location => (
                      <button
                        key={location}
                        onClick={() => { setSelectedLocation(location); setShowLocationDropdown(false); }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-[var(--bg-hover)] ${selectedLocation === location ? 'bg-[var(--bg-tertiary)] font-medium' : ''}`}
                      >
                        {location}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Category Filter Buttons */}
              <div className="flex items-center space-x-1 bg-[var(--bg-tertiary)] rounded-md p-0.5">
                <button
                  onClick={() => setCategoryFilter('all')}
                  className={`px-2.5 py-1 rounded text-sm font-medium transition-all ${
                        categoryFilter === 'all'
                          ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                      }`}
                >
                  All
                </button>
                <button
                  onClick={() => setCategoryFilter('facilities')}
                  className={`flex items-center space-x-1 px-2.5 py-1 rounded text-sm font-medium transition-all ${
                    categoryFilter === 'facilities'
                      ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Settings2 className="w-3.5 h-3.5" />
                  <span>Facilities</span>
                </button>
                <button
                  onClick={() => setCategoryFilter('tech')}
                  className={`flex items-center space-x-1 px-2.5 py-1 rounded text-sm font-medium transition-all ${
                    categoryFilter === 'tech'
                      ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>Tech</span>
                </button>
              </div>
            </>
          }
        />
      }
    >
      {/* Main Content - New modernized component */}
      <TicketCenterOptimizedV3
        activeTab={activeTab}
        selectedLocation={selectedLocation}
        categoryFilter={categoryFilter}
      />
    </OperatorLayout>
  );
}
