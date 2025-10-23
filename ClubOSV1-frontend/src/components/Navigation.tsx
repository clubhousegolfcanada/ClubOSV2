import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState, useEffect, useRef } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuthState } from '@/state/useStore';
import { hasAnyRole } from '@/utils/roleUtils';
import RoleTag from '@/components/RoleTag';
import ModeToggle from '@/components/ModeToggle';
import ThemeToggle from '@/components/ThemeToggle';
import { ChevronDown, ChevronRight, User, Settings, LogOut, MessageCircle, Calendar, CreditCard, Users } from 'lucide-react';
import packageJson from '../../package.json';
import { tokenManager } from '@/utils/tokenManager';

type UserRole = 'admin' | 'operator' | 'support' | 'kiosk' | 'customer' | 'contractor';

interface NavigationProps {
  unreadMessages?: number;
}

const Navigation: React.FC<NavigationProps> = ({ unreadMessages = 0 }) => {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuthState();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isEmbedded, setIsEmbedded] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [mobileUserMenuOpen, setMobileUserMenuOpen] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<'active' | 'warning' | 'expired'>('active');
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Check if embedded and mobile
  useEffect(() => {
    setMounted(true);
    const checkEmbedded = () => {
      try {
        setIsEmbedded(window !== window.parent);
      } catch (e) {
        setIsEmbedded(false);
      }
    };
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    checkEmbedded();
    checkMobile();

    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setMobileUserMenuOpen(false);
  }, [router.pathname]);

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

  // Monitor session status
  useEffect(() => {
    if (!mounted) return;
    
    const checkSessionStatus = () => {
      const token = tokenManager.getToken();
      if (!token) {
        setSessionStatus('expired');
        return;
      }

      const timeUntilExpiry = tokenManager.getTimeUntilExpiration(token);
      const fiveMinutes = 5 * 60 * 1000; // 5 minutes in ms

      if (timeUntilExpiry <= 0) {
        setSessionStatus('expired');
      } else if (timeUntilExpiry < fiveMinutes) {
        setSessionStatus('warning');
      } else {
        setSessionStatus('active');
      }
    };

    // Check immediately
    checkSessionStatus();

    // Check every 10 seconds
    const interval = setInterval(checkSessionStatus, 10000);

    return () => clearInterval(interval);
  }, [mounted]);

  const navItems = user?.role === 'kiosk' 
    ? [
        // Kiosk users only see ClubOS Boy
        { href: '/clubosboy', label: 'ClubOS Boy', roles: ['kiosk'] as UserRole[] },
      ]
    : user?.role === 'contractor'
    ? [
        // Contractor users only see Checklists
        { href: '/checklists', label: 'Checklists', roles: ['contractor'] as UserRole[] },
      ]
    : user?.role === 'customer'
    ? [
        // Customer navigation
        { href: '/customer', label: 'Dashboard', roles: ['customer'] as UserRole[], icon: 'home' },
        { href: '/customer/bookings', label: 'Bookings', roles: ['customer'] as UserRole[], icon: 'calendar' },
        { href: '/customer/compete', label: 'Compete', roles: ['customer'] as UserRole[], icon: 'trophy' },
        { href: '/customer/leaderboard', label: 'Leaderboard', roles: ['customer'] as UserRole[], icon: 'chart' },
        { href: '/customer/profile', label: 'Profile', roles: ['customer'] as UserRole[], icon: 'user' },
      ]
    : [
        // All other roles see the full navigation
        { href: '/', label: 'Dashboard', roles: ['admin', 'operator', 'support'] as UserRole[] },
        { href: '/bookings', label: 'Bookings', roles: ['admin', 'operator'] as UserRole[] },
        { href: '/messages', label: 'Messages', roles: ['admin', 'operator', 'support'] as UserRole[] },
        { href: '/tickets', label: 'Tickets', roles: ['admin', 'operator'] as UserRole[] },
        { href: '/commands', label: 'Commands', roles: ['admin', 'operator', 'support'] as UserRole[] },
        { href: '/checklists', label: 'Checklists', roles: ['admin', 'operator', 'support'] as UserRole[] },
        { href: '/operations', label: 'Operations', roles: ['admin', 'operator'] as UserRole[] },
      ].filter(item => hasAnyRole(user?.role, item.roles));

  // For non-customer mobile users (operators), render bottom navigation
  const shouldRenderBottomNav = isMobile && user?.role !== 'customer' && user?.role !== 'kiosk' && user?.role !== 'contractor';

  // If mobile operator, render bottom navigation similar to customer nav
  if (shouldRenderBottomNav) {
    return (
      <>
        {/* Bottom Navigation Bar for Mobile Operators */}
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 lg:hidden z-40 shadow-lg pb-safe">
          <div className="flex items-center justify-around h-16">
            {navItems.slice(0, 5).map((item) => {
              const isActive = router.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative flex flex-col items-center justify-center flex-1 h-full min-h-[44px] transition-colors ${
                    isActive
                      ? 'text-[var(--accent)]'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {/* Use icons for mobile bottom nav */}
                  {item.href === '/' && <div className="w-6 h-6 flex items-center justify-center"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg></div>}
                  {item.href === '/bookings' && <div className="w-6 h-6 flex items-center justify-center"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></div>}
                  {item.href === '/messages' && (
                    <div className="relative w-6 h-6 flex items-center justify-center">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                      {unreadMessages > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-4 px-1 flex items-center justify-center">
                          {unreadMessages}
                        </span>
                      )}
                    </div>
                  )}
                  {item.href === '/tickets' && <div className="w-6 h-6 flex items-center justify-center"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg></div>}
                  {item.href === '/commands' && <div className="w-6 h-6 flex items-center justify-center"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg></div>}
                  {item.href === '/checklists' && <div className="w-6 h-6 flex items-center justify-center"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg></div>}
                  {item.href === '/operations' && <div className="w-6 h-6 flex items-center justify-center"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg></div>}
                  <span className={`text-xs font-medium mt-0.5 ${isActive ? 'transform scale-110' : ''}`}>
                    {item.label === 'Dashboard' ? 'Home' : item.label}
                  </span>
                </Link>
              );
            })}

            {/* More menu for additional items and user menu */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="relative flex flex-col items-center justify-center flex-1 h-full min-h-[44px] text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
              </svg>
              <span className="text-xs font-medium mt-0.5">More</span>
              <div
                className={`absolute bottom-1 right-6 w-2 h-2 rounded-full ${
                  sessionStatus === 'active'
                    ? 'bg-[var(--status-success)]'
                    : sessionStatus === 'warning'
                    ? 'bg-yellow-500'
                    : 'bg-[var(--status-error)]'
                }`}
              />
            </button>
          </div>
        </nav>

        {/* Mobile Menu Overlay */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="fixed inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
            <div className="fixed bottom-16 left-0 right-0 bg-white border-t border-gray-200 shadow-lg animate-slideUp">
              <div className="p-4">
                {navItems.length > 5 && (
                  <>
                    <div className="mb-3">
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Additional Pages</p>
                      {navItems.slice(5).map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          className="block px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          {item.label}
                        </Link>
                      ))}
                    </div>
                    <div className="border-t border-gray-200 pt-3" />
                  </>
                )}

                {/* User info and options */}
                <div className="mb-3">
                  <p className="text-sm font-medium text-gray-900">{user?.name || user?.email?.split('@')[0]}</p>
                  <p className="text-xs text-gray-500">{user?.email}</p>
                </div>

                <div className="space-y-2">
                  <button
                    onClick={() => {
                      router.push(user?.role === 'admin' ? '/settings' : '/profile');
                      setMobileMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md"
                  >
                    {user?.role === 'admin' ? 'Settings' : 'Profile & Settings'}
                  </button>

                  <div className="px-3 py-2">
                    <ThemeToggle />
                  </div>

                  {(user?.role === 'admin' || user?.role === 'operator') && (
                    <div className="pt-2 pb-2 border-t border-gray-200">
                      <div className="px-2">
                        <ModeToggle />
                      </div>
                    </div>
                  )}

                  <button
                    onClick={async () => {
                      await logout();
                      setMobileMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-md"
                  >
                    Logout
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <style jsx>{`
          @keyframes slideUp {
            from {
              transform: translateY(100%);
            }
            to {
              transform: translateY(0);
            }
          }
          .animate-slideUp {
            animation: slideUp 0.3s ease-out;
          }
        `}</style>
      </>
    );
  }

  // Default desktop and non-operator mobile rendering
  return (
    /* Navigation with improved spacing - v1.16.6 */
    <nav className={`bg-[var(--bg-secondary)] border-b border-[var(--border-secondary)] ${user?.role !== 'customer' ? 'py-2' : ''} ${isEmbedded ? 'embedded-nav' : ''}`}>
      <div className={`${isEmbedded ? 'px-4' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'}`}>
        <div className="flex items-center justify-between h-12" style={{ maxHeight: '48px' }}>
          {/* Logo with tagline - Compressed */}
          <div className="flex items-center">
            <div className="flex items-center gap-2">
              <Link href={user?.role === 'customer' ? '/customer' : '/'} className="logo text-lg font-semibold" aria-label="ClubOS Home">
                ClubOS
              </Link>
              <span className="text-[10px] text-[var(--text-muted)] hidden md:block">
                v{packageJson.version}
              </span>
            </div>
            
            {/* Desktop Navigation */}
            <div className="hidden md:block ml-10">
              <div className="flex items-baseline space-x-4">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`
                      px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 flex items-center gap-2
                      ${router.pathname === item.href
                        ? 'bg-[var(--accent)] text-white'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                      }
                    `}
                  >
                    {item.label}
                    {item.href === '/messages' && unreadMessages > 0 && (
                      <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    )}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Desktop Right Side */}
          <div className="hidden md:flex items-center space-x-3">
            {/* Desktop Booking Button - Show for all users */}
            {user && (
              <button
                onClick={() => window.open('https://clubhouse247golf.skedda.com/booking', '_blank')}
                className="p-2 text-[var(--accent)] hover:bg-[var(--bg-tertiary)] rounded-md transition-all"
                title="Book a simulator"
              >
                <Calendar className="w-5 h-5" />
              </button>
            )}
            
            {/* Desktop Payment/Returns Button - Admin and Operator only */}
            {user && ['admin', 'operator'].includes(user.role) && (
              <button
                onClick={() => window.open('https://dashboard.stripe.com', '_blank')}
                className="p-2 text-[var(--accent)] hover:bg-[var(--bg-tertiary)] rounded-md transition-all"
                title="Process returns"
              >
                <CreditCard className="w-5 h-5" />
              </button>
            )}
            
            <div 
              className={`w-2 h-2 rounded-full ${
                sessionStatus === 'active' 
                  ? 'bg-[var(--status-success)] animate-pulse' 
                  : sessionStatus === 'warning' 
                  ? 'bg-yellow-500 animate-pulse' 
                  : 'bg-[var(--status-error)]'
              }`} 
              title={
                sessionStatus === 'active' 
                  ? 'Session Active' 
                  : sessionStatus === 'warning' 
                  ? 'Session Expiring Soon' 
                  : 'Session Expired'
              }
            ></div>
            
            {/* User Dropdown */}
            {user && (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition-all duration-200"
                >
                  <RoleTag showLabel={false} />
                  <span className="text-sm font-medium text-[var(--text-primary)]">
                    {user.name || user.email?.split('@')[0]}
                  </span>
                  <ChevronDown 
                    className={`w-4 h-4 text-[var(--text-secondary)] transition-transform ${
                      userDropdownOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {/* Dropdown Menu */}
                {userDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-lg shadow-lg z-50">
                    <div className="px-4 py-3 border-b border-[var(--border-secondary)]">
                      <p className="text-sm font-medium text-[var(--text-primary)]">
                        {user.name || 'User'}
                      </p>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">
                        {user.email}
                      </p>
                    </div>
                    
                    <div className="py-1">
                      {/* Combined Profile & Settings */}
                      <button
                        onClick={() => {
                          router.push(user.role === 'admin' ? '/settings' : '/profile');
                          setUserDropdownOpen(false);
                        }}
                        className="w-full px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] flex items-center gap-2 transition-colors"
                      >
                        <Settings className="w-4 h-4" />
                        {user.role === 'admin' ? 'Settings' : 'Profile & Settings'}
                      </button>
                      
                      <div className="px-4 py-2">
                        <ThemeToggle />
                      </div>
                      
                      {/* Mode Toggle for Admin and Operator - Fixed positioning */}
                      {(user.role === 'admin' || user.role === 'operator') && (
                        <div className="px-4 py-3 border-t border-[var(--border-secondary)] mt-1">
                          <ModeToggle />
                        </div>
                      )}
                    </div>
                    
                    <div className="border-t border-[var(--border-secondary)] py-1">
                      <button
                        onClick={async () => {
                          await logout();
                          setUserDropdownOpen(false);
                        }}
                        className="w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="flex md:hidden items-center gap-2">
            {/* Mobile Booking Button */}
            {user && (
              <button
                onClick={() => window.open('https://clubhouse247golf.skedda.com/booking', '_blank')}
                className="p-2 text-[var(--accent)] hover:bg-[var(--bg-tertiary)] rounded-md transition-all"
                title="Book a simulator"
              >
                <Calendar className="w-5 h-5" />
              </button>
            )}
            {/* Mobile Payment/Returns Button */}
            {user && ['admin', 'operator'].includes(user.role) && (
              <button
                onClick={() => {
                  // Detect if on mobile device
                  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                  
                  if (isMobile) {
                    // Try to open Stripe Dashboard app using URL scheme
                    // Use simple URL scheme for all mobile platforms
                    // This avoids Play Store prompts on Android
                    window.location.href = 'stripe://dashboard';
                    
                    // Fallback to web after delay if app doesn't open
                    setTimeout(() => {
                      if (!document.hidden) {
                        window.location.href = 'https://dashboard.stripe.com';
                      }
                    }, 2500);
                  } else {
                    // On desktop, open web dashboard
                    window.open('https://dashboard.stripe.com', '_blank');
                  }
                }}
                className="p-2 text-[var(--accent)] hover:bg-[var(--bg-tertiary)] rounded-md transition-all"
                title="Process returns"
              >
                <CreditCard className="w-5 h-5" />
              </button>
            )}
            {/* Mobile Messages Button */}
            {user && ['admin', 'operator', 'support'].includes(user.role) && (
              <button
                onClick={() => router.push('/messages')}
                className="relative p-2 text-[var(--accent)] hover:bg-[var(--bg-tertiary)] rounded-md transition-all"
              >
                <MessageCircle className="w-5 h-5" />
                {unreadMessages > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                    {unreadMessages}
                  </span>
                )}
              </button>
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="inline-flex items-center justify-center p-3 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--accent)] transition-all duration-200 touch-manipulation"
              aria-expanded={mobileMenuOpen}
              aria-label="Main menu"
            >
              <svg 
                className="h-6 w-6" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
                aria-hidden="true"
              >
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu with smooth transition */}
      <div 
        className={`md:hidden transition-all duration-500 ease-in-out overflow-hidden ${
          mobileMenuOpen ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
        aria-label="Mobile navigation menu"
        role="navigation"
      >
        {/* Navigation items - always visible */}
        <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex items-center justify-between px-4 py-3 rounded-md text-base font-medium transition-all duration-200 touch-manipulation
                ${router.pathname === item.href
                  ? 'bg-[var(--accent)] text-white'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                }
              `}
            >
              <div className="flex items-center gap-2">
                {item.label}
              </div>
              {item.href === '/messages' && unreadMessages > 0 && (
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              )}
            </Link>
          ))}
        </div>
        <div className="pt-4 pb-3 border-t border-[var(--border-secondary)]">
          <div className="px-4 relative">
            {user && (
              <>
                {/* Collapsible User Menu */}
                <button
                  onClick={() => setMobileUserMenuOpen(!mobileUserMenuOpen)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-md text-base font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all duration-200 touch-manipulation"
                >
                  <div className="flex items-center gap-3">
                    <RoleTag showLabel={false} />
                    <span>{user.name || user.email?.split('@')[0]}</span>
                  </div>
                  <ChevronDown 
                    className={`w-5 h-5 transition-transform duration-300 ${
                      mobileUserMenuOpen ? 'rotate-180' : 'rotate-0'
                    }`}
                  />
                </button>
                
                {/* Collapsible Content with proper animations and z-index */}
                <div 
                  className={`relative z-50 transition-all duration-300 ease-in-out overflow-hidden ${
                    mobileUserMenuOpen 
                      ? 'max-h-[500px] opacity-100' 
                      : 'max-h-0 opacity-0'
                  }`}
                >
                  <div className={`space-y-2 mt-3 bg-[var(--bg-primary)] border border-[var(--border-secondary)] rounded-lg p-3 shadow-lg transition-transform duration-300 ${
                    mobileUserMenuOpen ? 'transform translate-y-0' : 'transform -translate-y-2'
                  }`}>
                    <div className="text-xs text-[var(--text-muted)] px-2">
                      {user.email}
                    </div>
                    <Link
                      href={user.role === 'admin' ? '/settings' : '/profile'}
                      className="block px-3 py-2 rounded-md text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all duration-200"
                    >
                      {user.role === 'admin' ? 'Settings' : 'Profile & Settings'}
                    </Link>
                    <div className="px-3 py-2">
                      <ThemeToggle />
                    </div>
                    {/* Mode Toggle for Admin and Operator */}
                    {(user.role === 'admin' || user.role === 'operator') && (
                      <div className="pt-3 pb-1 border-t border-[var(--border-secondary)] mt-2">
                        <div className="px-2">
                          <ModeToggle />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Logout Button - Always visible */}
                <button
                  onClick={() => logout()}
                  className="w-full mt-3 px-4 py-3 rounded-md text-base font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200 touch-manipulation flex items-center gap-2"
                >
                  <LogOut className="w-5 h-5" />
                  Logout
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .logo {
          background: linear-gradient(135deg, var(--accent) 0%, #20a0a0 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        
        /* Ensure mobile menu is visible when JS fails */
        @media (max-width: 768px) {
          .embedded-nav {
            position: sticky;
            top: 0;
            z-index: 50;
          }
        }
        
        /* Touch target optimization */
        @media (hover: none) and (pointer: coarse) {
          button, a {
            -webkit-tap-highlight-color: transparent;
          }
        }
      `}</style>
    </nav>
  );
};

export default Navigation;
