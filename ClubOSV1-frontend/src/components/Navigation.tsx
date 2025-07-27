import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState, useEffect, useRef } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuthState } from '@/state/useStore';
import { hasAnyRole } from '@/utils/roleUtils';
import RoleTag from '@/components/RoleTag';
import { ChevronDown, User, Settings, LogOut } from 'lucide-react';

type UserRole = 'admin' | 'operator' | 'support' | 'kiosk';

const Navigation: React.FC = () => {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuthState();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isEmbedded, setIsEmbedded] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Check if embedded
  useEffect(() => {
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

  const navItems = user?.role === 'kiosk' 
    ? [
        // Kiosk users only see ClubOS Boy
        { href: '/clubosboy', label: 'ClubOS Boy', roles: ['kiosk'] as UserRole[], icon: '🤖' },
      ]
    : [
        // All other roles see the full navigation
        { href: '/', label: 'Dashboard', roles: ['admin', 'operator', 'support'] as UserRole[] },
        { href: '/commands', label: 'Commands', roles: ['admin', 'operator', 'support'] as UserRole[] },
        { href: '/operations', label: 'Operations', roles: ['admin', 'operator'] as UserRole[] },
        { href: '/cleaning', label: 'Cleaning', roles: ['admin', 'operator'] as UserRole[] },
        { href: '/tickets', label: 'Ticket Center', roles: ['admin', 'operator'] as UserRole[] },
        { href: '/clubosboy', label: 'ClubOS Boy', roles: ['admin', 'operator', 'support'] as UserRole[], icon: '🤖' },
      ].filter(item => hasAnyRole(user?.role, item.roles));

  return (
    <nav className={`bg-[var(--bg-secondary)] border-b border-[var(--border-secondary)] ${isEmbedded ? 'embedded-nav' : ''}`}>
      <div className={`${isEmbedded ? 'px-4' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'}`}>
        <div className="flex items-center justify-between h-16">
          {/* Logo with tagline */}
          <div className="flex items-center">
            <div className="flex flex-col">
              <Link href="/" className="logo text-xl font-semibold" aria-label="ClubOS Home">
                ClubOS
              </Link>
              <span className="text-[10px] text-[var(--text-muted)] -mt-1 hidden md:block">
                Golf Simulator Management
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
                      px-3 py-2 rounded-md text-sm font-medium transition-all duration-200
                      ${router.pathname === item.href
                        ? 'bg-[var(--accent)] text-white'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                      }
                    `}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Desktop Right Side */}
          <div className="hidden md:flex items-center space-x-3">
            <div className="w-2 h-2 bg-[var(--status-success)] rounded-full animate-pulse" title="System Active"></div>
            
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
          <div className="flex md:hidden">
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
          mobileMenuOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
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
                block px-4 py-3 rounded-md text-base font-medium transition-all duration-200 touch-manipulation
                ${router.pathname === item.href
                  ? 'bg-[var(--accent)] text-white'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                }
              `}
            >
              {item.label}
            </Link>
          ))}
        </div>
        <div className="pt-4 pb-3 border-t border-[var(--border-secondary)]">
          <div className="px-4 space-y-3">
            {user && (
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <RoleTag showLabel={true} />
                  <span className="ml-3 text-sm text-[var(--text-secondary)]">{user.email}</span>
                </div>
              </div>
            )}
            <button
              onClick={toggleTheme}
              className="block w-full text-left px-4 py-3 rounded-md text-base font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all duration-200 touch-manipulation"
            >
              Theme: {theme.toUpperCase()}
            </button>
            {user && (
              <>
                <Link
                  href="/profile"
                  className="block px-4 py-3 rounded-md text-base font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all duration-200 touch-manipulation"
                >
                  Profile
                </Link>
                {user.role === 'admin' && (
                  <Link
                    href="/settings"
                    className="block px-4 py-3 rounded-md text-base font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all duration-200 touch-manipulation"
                  >
                    Settings
                  </Link>
                )}
                <button
                  onClick={logout}
                  className="block w-full text-left px-4 py-3 rounded-md text-base font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200 touch-manipulation"
                >
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
