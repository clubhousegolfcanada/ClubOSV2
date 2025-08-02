import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState, useEffect, useRef } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuthState } from '@/state/useStore';
import { hasAnyRole } from '@/utils/roleUtils';
import RoleTag from '@/components/RoleTag';
import { ChevronDown, ChevronRight, User, Settings, LogOut, MessageCircle } from 'lucide-react';
import packageJson from '../../package.json';
import { tokenManager } from '@/utils/tokenManager';

type UserRole = 'admin' | 'operator' | 'support' | 'kiosk';

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
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Check if embedded
  useEffect(() => {
    setMounted(true);
    const checkEmbedded = () => {
      try {
        setIsEmbedded(window !== window.parent);
      } catch (e) {
        setIsEmbedded(false);
      }
    };
    checkEmbedded();
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
      const token = localStorage.getItem('clubos_token');
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
    : [
        // All other roles see the full navigation
        { href: '/', label: 'Dashboard', roles: ['admin', 'operator', 'support'] as UserRole[] },
        { href: '/messages', label: 'Messages', roles: ['admin', 'operator', 'support'] as UserRole[] },
        { href: '/commands', label: 'Commands', roles: ['admin', 'operator', 'support'] as UserRole[] },
        { href: '/tickets', label: 'Tickets', roles: ['admin', 'operator'] as UserRole[] },
        { href: '/checklists', label: 'Checklists', roles: ['admin', 'operator'] as UserRole[] },
        { href: '/operations', label: 'Operations', roles: ['admin', 'operator'] as UserRole[] },
        { href: '/clubosboy', label: 'ClubOS Boy', roles: ['admin', 'operator', 'support'] as UserRole[] },
      ].filter(item => hasAnyRole(user?.role, item.roles));

  return (
    <nav className={`bg-[var(--bg-secondary)] border-b border-[var(--border-secondary)] ${isEmbedded ? 'embedded-nav' : ''}`}>
      <div className={`${isEmbedded ? 'px-4' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'}`}>
        <div className="flex items-center justify-between h-14" style={{ maxHeight: '56px' }}>
          {/* Logo with tagline - Compressed */}
          <div className="flex items-center">
            <div className="flex items-center gap-2">
              <Link href="/" className="logo text-lg font-semibold" aria-label="ClubOS Home">
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
                      <button
                        onClick={() => {
                          // Navigate to profile
                          router.push('/profile');
                          setUserDropdownOpen(false);
                        }}
                        className="w-full px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] flex items-center gap-2 transition-colors"
                      >
                        <User className="w-4 h-4" />
                        Profile
                      </button>
                      
                      {user.role === 'admin' && (
                        <button
                          onClick={() => {
                            router.push('/settings');
                            setUserDropdownOpen(false);
                          }}
                          className="w-full px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] flex items-center gap-2 transition-colors"
                        >
                          <Settings className="w-4 h-4" />
                          Settings
                        </button>
                      )}
                      
                      <button
                        onClick={toggleTheme}
                        className="w-full px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] flex items-center justify-between transition-colors"
                      >
                        <span>Theme</span>
                        <span className="text-xs bg-[var(--bg-tertiary)] px-2 py-1 rounded">
                          {theme.toUpperCase()}
                        </span>
                      </button>
                    </div>
                    
                    <div className="border-t border-[var(--border-secondary)] py-1">
                      <button
                        onClick={() => {
                          logout();
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
        className={`md:hidden transition-all duration-300 ease-in-out overflow-hidden ${
          mobileMenuOpen ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
        }`}
        aria-label="Mobile navigation menu"
        role="navigation"
      >
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
          <div className="px-4">
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
                    className={`w-5 h-5 transition-transform ${
                      mobileUserMenuOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                
                {/* Collapsible Content */}
                <div 
                  className={`transition-all duration-300 ease-in-out overflow-hidden ${
                    mobileUserMenuOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                  }`}
                >
                  <div className="pl-4 space-y-1 mt-2">
                    <div className="text-xs text-[var(--text-muted)] px-4 py-1">
                      {user.email}
                    </div>
                    <button
                      onClick={toggleTheme}
                      className="block w-full text-left px-4 py-2 rounded-md text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all duration-200"
                    >
                      Theme: {theme.toUpperCase()}
                    </button>
                    <Link
                      href="/profile"
                      className="block px-4 py-2 rounded-md text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all duration-200"
                    >
                      Profile
                    </Link>
                    {user.role === 'admin' && (
                      <Link
                        href="/settings"
                        className="block px-4 py-2 rounded-md text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all duration-200"
                      >
                        Settings
                      </Link>
                    )}
                  </div>
                </div>
                
                {/* Logout Button - Always visible */}
                <button
                  onClick={logout}
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
