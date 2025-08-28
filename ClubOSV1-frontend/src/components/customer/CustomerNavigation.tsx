import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuthState, useStore } from '@/state/useStore';
import ModeToggle from '@/components/ModeToggle';
import axios from 'axios';
import { 
  Home, 
  Calendar, 
  Users, 
  Trophy, 
  User,
  Menu,
  X,
  Settings,
  LogOut,
  Bell,
  MapPin,
  TrendingUp,
  BarChart3,
  Shield,
  ChevronDown,
  Package
} from 'lucide-react';

// Fix for double /api/ issue - ensure base URL doesn't end with /api
let API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
if (API_URL.endsWith('/api')) {
  API_URL = API_URL.slice(0, -4);
}

const CustomerNavigation: React.FC = () => {
  const router = useRouter();
  const { user, logout } = useAuthState();
  const { setViewMode } = useStore();
  const [notificationCount] = useState(0);
  const [availableBoxes, setAvailableBoxes] = useState(0);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleSwitchToOperator = () => {
    setViewMode('operator');
    router.push('/');
  };

  const handleLogout = () => {
    logout();
    setUserDropdownOpen(false);
  };

  // Fetch available boxes count
  useEffect(() => {
    const fetchBoxCount = async () => {
      try {
        const token = localStorage.getItem('clubos_token');
        if (token) {
          const response = await axios.get(`${API_URL}/api/boxes/available`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (response.data) {
            setAvailableBoxes(response.data.length || 0);
          }
        }
      } catch (error) {
        // Silently fail if endpoint doesn't exist
        console.log('Box endpoint not available');
      }
    };

    if (user) {
      fetchBoxCount();
      // Refresh every 30 seconds
      const interval = setInterval(fetchBoxCount, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fixed navigation items order - must be consistent
  const mainNavItems = [
    { icon: Home, label: 'Dashboard', path: '/customer', key: 'dashboard' },
    { icon: Calendar, label: 'Bookings', path: '/customer/bookings', key: 'bookings' },
    { icon: Trophy, label: 'Compete', path: '/customer/compete', key: 'compete' },
    { icon: BarChart3, label: 'Leaderboard', path: '/customer/leaderboard', key: 'leaderboard' },
    { icon: User, label: 'Profile', path: '/customer/profile', key: 'profile' }
  ];

  const currentPath = router.pathname;

  return (
    <>
      {/* Top Navigation Bar - Simplified for mobile */}
      <header className="fixed top-0 left-0 right-0 bg-[var(--bg-secondary)] border-b border-[var(--border-secondary)] z-50 lg:block hidden">
        <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 h-14" style={{ maxHeight: '56px' }}>
          {/* Logo/Title */}
          <div className="flex items-center">
            <div className="flex items-center gap-2">
              <span className="logo text-lg font-semibold">Clubhouse</span>
              <span className="text-[10px] text-[var(--text-muted)]">Customer</span>
            </div>
            
            {/* Desktop Navigation - Inline like operator nav */}
            <nav className="hidden lg:flex items-center space-x-4 ml-10">
              {mainNavItems.map((item) => (
                <button
                  key={item.key}
                  onClick={() => router.push(item.path)}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 flex items-center gap-1.5 ${
                    currentPath === item.path
                      ? 'bg-[var(--accent)] text-white'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                  }`}
                >
                  <item.icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* Right side actions - Minimalist approach */}
          <div className="flex items-center space-x-2">
            {/* Mobile Menu Button - Visible on mobile */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-md hover:bg-[var(--bg-tertiary)] transition-colors"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5 text-[var(--text-secondary)]" />
              ) : (
                <Menu className="w-5 h-5 text-[var(--text-secondary)]" />
              )}
            </button>

            {/* Box Notification - Show when boxes available */}
            {availableBoxes > 0 && (
              <button 
                onClick={() => router.push('/customer/profile?tab=boxes')}
                className="relative p-1.5 rounded-md hover:bg-[var(--bg-tertiary)] transition-colors group animate-shimmer"
              >
                <Package className="w-4 h-4 text-[var(--text-primary)] group-hover:text-[#0B3D3A]" />
                <span className="absolute -top-1 -right-1 bg-[#0B3D3A] text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
                  {availableBoxes}
                </span>
              </button>
            )}

            {/* Notifications - Smaller, cleaner */}
            <button className="relative p-1.5 rounded-md hover:bg-[var(--bg-tertiary)] transition-colors">
              <Bell className="w-4 h-4 text-[var(--text-secondary)]" />
              {notificationCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
                  {notificationCount}
                </span>
              )}
            </button>

            {/* User Menu with Dropdown */}
            <div className="hidden sm:flex items-center relative" ref={dropdownRef}>
              <button 
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center space-x-1.5 px-2 py-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] transition-all duration-200"
              >
                <div className="w-6 h-6 bg-[var(--accent)] rounded-full flex items-center justify-center">
                  <span className="text-xs font-medium text-white">
                    {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                  </span>
                </div>
                <span className="text-sm text-[var(--text-primary)] hidden lg:block">
                  {user?.name?.split(' ')[0]}
                </span>
                <ChevronDown 
                  className={`w-4 h-4 text-[var(--text-secondary)] transition-transform ${
                    userDropdownOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* Dropdown Menu */}
              {userDropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                  <div className="px-4 py-3 border-b border-gray-200">
                    <p className="text-sm font-medium text-gray-900">
                      {user?.name || 'User'}
                    </p>
                    <p className="text-xs text-gray-800 mt-0.5">
                      {user?.email}
                    </p>
                  </div>
                  
                  <div className="py-1">
                    <button
                      onClick={() => {
                        router.push('/customer/profile');
                        setUserDropdownOpen(false);
                      }}
                      className="w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 transition-colors"
                    >
                      <User className="w-4 h-4" />
                      Profile
                    </button>
                    
                    <button
                      onClick={() => {
                        router.push('/customer/settings');
                        setUserDropdownOpen(false);
                      }}
                      className="w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 transition-colors"
                    >
                      <Settings className="w-4 h-4" />
                      Settings
                    </button>
                    
                    {/* Mode Toggle for Admin and Operator */}
                    {(user?.role === 'admin' || user?.role === 'operator') && (
                      <div className="px-4 py-3 border-t border-gray-200">
                        <ModeToggle />
                      </div>
                    )}
                  </div>
                  
                  <div className="border-t border-gray-200 py-1">
                    <button
                      onClick={handleLogout}
                      className="w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Mode Toggle for Admin and Operator - Desktop */}
            {(user?.role === 'admin' || user?.role === 'operator') && (
              <div className="hidden sm:block">
                <ModeToggle />
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Dropdown Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed top-14 left-0 right-0 bg-white border-b border-gray-200 shadow-lg z-40">
          <div className="p-4">
            <div className="border-b border-gray-200 pb-3 mb-3">
              <p className="text-sm font-medium text-gray-900">
                {user?.name || 'User'}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {user?.email}
              </p>
            </div>
            
            <div className="space-y-2">
              <button
                onClick={() => {
                  router.push('/customer/profile');
                  setMobileMenuOpen(false);
                }}
                className="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md flex items-center gap-2 transition-colors"
              >
                <User className="w-4 h-4" />
                Profile
              </button>
              
              <button
                onClick={() => {
                  router.push('/customer/settings');
                  setMobileMenuOpen(false);
                }}
                className="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md flex items-center gap-2 transition-colors"
              >
                <Settings className="w-4 h-4" />
                Settings
              </button>
              
              {/* Mode Toggle for Admin and Operator */}
              {(user?.role === 'admin' || user?.role === 'operator') && (
                <div className="pt-3 pb-1 border-t border-gray-200">
                  <ModeToggle />
                </div>
              )}
              
              <button
                onClick={() => {
                  handleLogout();
                  setMobileMenuOpen(false);
                }}
                className="w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md flex items-center gap-2 transition-colors mt-3 border-t border-gray-200 pt-3"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation - Mobile Only */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 lg:hidden z-40 shadow-lg">
        <div className="flex items-center justify-around h-16">
          {mainNavItems.map((item) => {
            const isActive = currentPath === item.path;
            return (
              <button
                key={item.key}
                onClick={() => router.push(item.path)}
                className={`relative flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                  isActive
                    ? 'text-[#0B3D3A]'
                    : 'text-gray-800 hover:text-gray-900'
                }`}
              >
                <item.icon className={`w-5 h-5 mb-1 ${isActive ? 'transform scale-110' : ''}`} />
                <span className="text-[10px] font-medium">{item.label}</span>
                {/* Add box notification badge on Profile icon */}
                {item.key === 'profile' && availableBoxes > 0 && (
                  <span className="absolute top-2 right-2 bg-[#0B3D3A] text-white text-[9px] font-bold rounded-full min-w-[14px] h-3.5 px-1 flex items-center justify-center">
                    {availableBoxes}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>
      
      <style jsx>{`
        .logo {
          background: linear-gradient(135deg, var(--accent) 0%, #20a0a0 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
      `}</style>
    </>
  );
};

export default CustomerNavigation;