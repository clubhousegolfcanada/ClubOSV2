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
  MessageCircle,
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
      {/* Top Navigation Bar */}
      <header className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-50 shadow-sm">
        <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 h-16">
          {/* Logo/Title */}
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              {mobileMenuOpen ? <X className="w-5 h-5 text-gray-700" /> : <Menu className="w-5 h-5 text-gray-700" />}
            </button>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-[#0B3D3A] rounded-lg flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <span className="font-semibold text-lg text-gray-900 hidden sm:block">Clubhouse 24/7</span>
                <span className="text-xs text-gray-500 hidden sm:block">Golf Experience</span>
              </div>
            </div>
          </div>

          {/* Right side actions */}
          <div className="flex items-center space-x-3">
            {/* Notifications */}
            <button className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors">
              <Bell className="w-5 h-5 text-gray-700" />
              {notificationCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs font-medium rounded-full w-5 h-5 flex items-center justify-center">
                  {notificationCount}
                </span>
              )}
            </button>

            {/* User Avatar */}
            <div className="hidden sm:flex items-center space-x-2">
              <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-gray-700">
                  {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                </span>
              </div>
              <span className="text-sm text-gray-700 font-medium hidden lg:block">
                {user?.name?.split(' ')[0]}
              </span>
            </div>

            {/* Switch to Operator (if allowed) */}
            {user?.role !== 'customer' && (
              <button
                onClick={handleSwitchToOperator}
                className="hidden sm:flex items-center px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium text-gray-700"
              >
                <Shield className="w-4 h-4 mr-1.5" />
                Operator View
              </button>
            )}
          </div>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center justify-center space-x-8 px-8 pb-3">
          {mainNavItems.map((item) => (
            <button
              key={item.path}
              onClick={() => router.push(item.path)}
              className={`flex items-center space-x-2 px-1 py-1 border-b-2 transition-all ${
                currentPath === item.path
                  ? 'border-[#0B3D3A] text-[#0B3D3A]'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
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
                  key={item.path}
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
                  router.push('/customer/locations');
                  setMobileMenuOpen(false);
                }}
                className="flex items-center space-x-3 w-full px-3 py-2.5 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <MapPin className="w-5 h-5" />
                <span className="font-medium">Locations</span>
              </button>

              <button
                onClick={() => {
                  router.push('/customer/messages');
                  setMobileMenuOpen(false);
                }}
                className="flex items-center space-x-3 w-full px-3 py-2.5 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <MessageCircle className="w-5 h-5" />
                <span className="font-medium">Messages</span>
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

              {user?.role !== 'customer' && (
                <>
                  <div className="border-t border-gray-200 my-4" />
                  <button
                    onClick={() => {
                      handleSwitchToOperator();
                      setMobileMenuOpen(false);
                    }}
                    className="flex items-center space-x-3 w-full px-3 py-2.5 rounded-lg bg-[#0B3D3A]/10 text-[#0B3D3A]"
                  >
                    <Shield className="w-5 h-5" />
                    <span className="font-medium">Switch to Operator</span>
                  </button>
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
          {mainNavItems.slice(0, 5).map((item) => (
            <button
              key={item.path}
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
    </>
  );
};

export default CustomerNavigation;