import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { useAuthState, useStore } from '@/state/useStore';
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
  MessageCircle
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

  const mainNavItems = [
    { icon: Home, label: 'Home', path: '/customer' },
    { icon: Calendar, label: 'Bookings', path: '/customer/bookings' },
    { icon: Users, label: 'Friends', path: '/customer/friends' },
    { icon: Trophy, label: 'Events', path: '/customer/events' },
    { icon: User, label: 'Profile', path: '/customer/profile' }
  ];

  const currentPath = router.pathname;

  return (
    <>
      {/* Top Navigation Bar - Mobile */}
      <header className="fixed top-0 left-0 right-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 z-50">
        <div className="flex items-center justify-between px-4 h-16">
          {/* Logo/Title */}
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-blue-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">C</span>
              </div>
              <span className="font-semibold text-lg hidden sm:block">Clubhouse 24/7</span>
            </div>
          </div>

          {/* Right side actions */}
          <div className="flex items-center space-x-2">
            {/* Notifications */}
            <button className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
              <Bell className="w-5 h-5" />
              {notificationCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {notificationCount}
                </span>
              )}
            </button>

            {/* Switch to Operator (if allowed) */}
            {user?.role !== 'customer' && (
              <button
                onClick={handleSwitchToOperator}
                className="hidden sm:flex items-center px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
              >
                Switch to Operator
              </button>
            )}
          </div>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center justify-center space-x-1 px-4 pb-2">
          {mainNavItems.map((item) => (
            <button
              key={item.path}
              onClick={() => router.push(item.path)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                currentPath === item.path
                  ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <item.icon className="w-4 h-4" />
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          ))}
        </nav>
      </header>

      {/* Mobile Slide-out Menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setMobileMenuOpen(false)} />
          <div className="fixed left-0 top-0 bottom-0 w-72 bg-white dark:bg-gray-900 shadow-xl">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-lg">
                    {user?.name?.charAt(0) || 'C'}
                  </span>
                </div>
                <div>
                  <p className="font-semibold">{user?.name || 'Guest'}</p>
                  <p className="text-sm text-gray-500">{user?.email}</p>
                </div>
              </div>
            </div>

            <nav className="p-4 space-y-1">
              {mainNavItems.map((item) => (
                <button
                  key={item.path}
                  onClick={() => {
                    router.push(item.path);
                    setMobileMenuOpen(false);
                  }}
                  className={`flex items-center space-x-3 w-full px-3 py-2.5 rounded-lg transition-colors ${
                    currentPath === item.path
                      ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </button>
              ))}

              <div className="border-t border-gray-200 dark:border-gray-700 my-4" />

              {/* Additional Menu Items */}
              <button
                onClick={() => router.push('/customer/stats')}
                className="flex items-center space-x-3 w-full px-3 py-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <TrendingUp className="w-5 h-5" />
                <span className="font-medium">My Stats</span>
              </button>

              <button
                onClick={() => router.push('/customer/locations')}
                className="flex items-center space-x-3 w-full px-3 py-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <MapPin className="w-5 h-5" />
                <span className="font-medium">Locations</span>
              </button>

              <button
                onClick={() => router.push('/customer/messages')}
                className="flex items-center space-x-3 w-full px-3 py-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <MessageCircle className="w-5 h-5" />
                <span className="font-medium">Messages</span>
              </button>

              <button
                onClick={() => router.push('/customer/settings')}
                className="flex items-center space-x-3 w-full px-3 py-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <Settings className="w-5 h-5" />
                <span className="font-medium">Settings</span>
              </button>

              {user?.role !== 'customer' && (
                <button
                  onClick={handleSwitchToOperator}
                  className="flex items-center space-x-3 w-full px-3 py-2.5 rounded-lg bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
                >
                  <User className="w-5 h-5" />
                  <span className="font-medium">Switch to Operator</span>
                </button>
              )}

              <button
                onClick={handleLogout}
                className="flex items-center space-x-3 w-full px-3 py-2.5 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <LogOut className="w-5 h-5" />
                <span className="font-medium">Sign Out</span>
              </button>
            </nav>
          </div>
        </div>
      )}

      {/* Bottom Navigation - Mobile Only */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 lg:hidden z-40">
        <div className="flex items-center justify-around h-16">
          {mainNavItems.slice(0, 5).map((item) => (
            <button
              key={item.path}
              onClick={() => router.push(item.path)}
              className={`flex flex-col items-center justify-center flex-1 h-full ${
                currentPath === item.path
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              <item.icon className="w-5 h-5 mb-1" />
              <span className="text-xs">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </>
  );
};

export default CustomerNavigation;