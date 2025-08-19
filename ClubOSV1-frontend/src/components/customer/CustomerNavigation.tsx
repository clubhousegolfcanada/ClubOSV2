import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { useAuthState, useStore } from '@/state/useStore';
import ModeToggle from '@/components/ModeToggle';
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
  Shield
} from 'lucide-react';

const CustomerNavigation: React.FC = () => {
  const router = useRouter();
  const { user } = useAuthState();
  const { setViewMode } = useStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationCount] = useState(3);

  const handleSwitchToOperator = () => {
    setViewMode('operator');
    router.push('/');
  };

  const handleLogout = () => {
    localStorage.removeItem('clubos_token');
    localStorage.removeItem('clubos_user');
    router.push('/login');
  };

  // Fixed navigation items order - must be consistent
  const mainNavItems = [
    { icon: Home, label: 'Dashboard', path: '/customer', key: 'dashboard' },
    { icon: Users, label: 'Friends', path: '/customer/friends', key: 'friends' },
    { icon: Calendar, label: 'Bookings', path: '/customer/bookings', key: 'bookings' },
    { icon: TrendingUp, label: 'Wallet', path: '/customer/wallet', key: 'wallet' },
    { icon: User, label: 'Profile', path: '/customer/profile', key: 'profile' }
  ];

  const currentPath = router.pathname;

  return (
    <>
      {/* Top Navigation Bar - Modernized to match operator style */}
      <header className="fixed top-0 left-0 right-0 bg-[var(--bg-secondary)] border-b border-[var(--border-secondary)] z-50">
        <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 h-14" style={{ maxHeight: '56px' }}>
          {/* Logo/Title - Compressed like operator */}
          <div className="flex items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--accent)] transition-all duration-200 mr-2"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div className="flex items-center gap-2">
              <span className="logo text-lg font-semibold">Clubhouse</span>
              <span className="text-[10px] text-[var(--text-muted)] hidden md:block">Customer</span>
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
            {/* Notifications - Smaller, cleaner */}
            <button className="relative p-1.5 rounded-md hover:bg-[var(--bg-tertiary)] transition-colors">
              <Bell className="w-4 h-4 text-[var(--text-secondary)]" />
              {notificationCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
                  {notificationCount}
                </span>
              )}
            </button>

            {/* User Menu - Compact */}
            <div className="hidden sm:flex items-center">
              <button className="flex items-center space-x-1.5 px-2 py-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] transition-all duration-200">
                <div className="w-6 h-6 bg-[var(--accent)] rounded-full flex items-center justify-center">
                  <span className="text-xs font-medium text-white">
                    {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                  </span>
                </div>
                <span className="text-sm text-[var(--text-primary)] hidden lg:block">
                  {user?.name?.split(' ')[0]}
                </span>
              </button>
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

      {/* Mobile Slide-out Menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-black bg-opacity-25" onClick={() => setMobileMenuOpen(false)} />
          <div className="fixed left-0 top-0 bottom-0 w-72 bg-white shadow-xl">
            {/* Profile Section */}
            <div className="p-6 bg-gradient-to-br from-[#0B3D3A] to-[#084a45]">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-lg">
                    {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                  </span>
                </div>
                <div>
                  <p className="font-semibold text-white">{user?.name || 'Guest'}</p>
                  <p className="text-sm text-white/70">{user?.email}</p>
                </div>
              </div>
            </div>

            {/* Navigation Items */}
            <nav className="p-4 space-y-1">
              {mainNavItems.map((item) => (
                <button
                  key={item.key}
                  onClick={() => {
                    router.push(item.path);
                    setMobileMenuOpen(false);
                  }}
                  className={`flex items-center space-x-3 w-full px-3 py-2.5 rounded-lg transition-colors ${
                    currentPath === item.path
                      ? 'bg-[#0B3D3A]/10 text-[#0B3D3A]'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </button>
              ))}

              <div className="border-t border-gray-200 my-4" />

              {/* Additional Menu Items */}
              <button
                onClick={() => {
                  router.push('/customer/stats');
                  setMobileMenuOpen(false);
                }}
                className="flex items-center space-x-3 w-full px-3 py-2.5 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <BarChart3 className="w-5 h-5" />
                <span className="font-medium">My Stats</span>
              </button>

              <button
                onClick={() => {
                  // Open Google Maps search for Clubhouse 24/7 Golf simulators
                  window.open('https://www.google.com/maps/search/Clubhouse+24%2F7+Golf', '_blank');
                  setMobileMenuOpen(false);
                }}
                className="flex items-center space-x-3 w-full px-3 py-2.5 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <MapPin className="w-5 h-5" />
                <span className="font-medium">Locations</span>
              </button>

              <button
                onClick={() => {
                  router.push('/customer/settings');
                  setMobileMenuOpen(false);
                }}
                className="flex items-center space-x-3 w-full px-3 py-2.5 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <Settings className="w-5 h-5" />
                <span className="font-medium">Settings</span>
              </button>

              {/* Mode Toggle for Admin and Operator */}
              {(user?.role === 'admin' || user?.role === 'operator') && (
                <>
                  <div className="border-t border-gray-200 my-4" />
                  <div className="px-3">
                    <ModeToggle />
                  </div>
                </>
              )}

              <div className="border-t border-gray-200 my-4" />

              <button
                onClick={() => {
                  handleLogout();
                  setMobileMenuOpen(false);
                }}
                className="flex items-center space-x-3 w-full px-3 py-2.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-5 h-5" />
                <span className="font-medium">Sign Out</span>
              </button>
            </nav>
          </div>
        </div>
      )}

      {/* Bottom Navigation - Mobile Only */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 lg:hidden z-40 shadow-lg">
        <div className="flex items-center justify-around h-16">
          {mainNavItems.map((item) => (
            <button
              key={item.key}
              onClick={() => router.push(item.path)}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                currentPath === item.path
                  ? 'text-[#0B3D3A]'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <item.icon className={`w-5 h-5 mb-1 ${currentPath === item.path ? 'transform scale-110' : ''}`} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          ))}
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