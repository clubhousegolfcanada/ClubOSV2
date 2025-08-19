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
  const [notificationCount] = useState(0);

  const handleSwitchToOperator = () => {
    setViewMode('operator');
    router.push('/');
  };

  const handleLogout = () => {
    localStorage.removeItem('clubos_token');
    localStorage.removeItem('clubos_user');
    localStorage.removeItem('clubos_view_mode');
    // Clear any cached auth state
    setViewMode('operator');
    router.push('/login');
  };

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