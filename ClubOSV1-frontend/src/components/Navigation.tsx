import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuthState } from '@/state/useStore';
import { hasAnyRole } from '@/utils/roleUtils';
import RoleTag from '@/components/RoleTag';

type UserRole = 'admin' | 'operator' | 'support';

const Navigation: React.FC = () => {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuthState();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isEmbedded, setIsEmbedded] = useState(false);

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

  const navItems = [
    { href: '/', label: 'Dashboard', roles: ['admin', 'operator', 'support'] as UserRole[] },
    { href: '/commands', label: 'Commands', roles: ['admin', 'operator', 'support'] as UserRole[] },
    { href: '/operations', label: 'Operations', roles: ['admin', 'operator'] as UserRole[] },
    { href: '/tickets', label: 'Ticket Center', roles: ['admin', 'operator'] as UserRole[] },
  ].filter(item => hasAnyRole(user?.role, item.roles));

  return (
    <nav className={`bg-[var(--bg-secondary)] border-b border-[var(--border-secondary)] ${isEmbedded ? 'embedded-nav' : ''}`}>
      <div className={`${isEmbedded ? 'px-4' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'}`}>
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="logo text-xl font-semibold" aria-label="ClubOS Home">
              ClubOS
            </Link>
            
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
          <div className="hidden md:flex items-center space-x-4">
            {user && <RoleTag showLabel={false} />}
            <span className="text-sm text-[var(--text-muted)]">Golf Simulator Management</span>
            <div className="w-2 h-2 bg-[var(--status-success)] rounded-full animate-pulse" title="System Active"></div>
            <button
              onClick={toggleTheme}
              className="theme-toggle px-3 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] rounded-md text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent)] transition-all duration-200"
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            >
              {theme.toUpperCase()}
            </button>
            {user && (
              <button
                onClick={logout}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-md text-xs font-medium transition-colors"
              >
                Logout
              </button>
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
              <div className="flex items-center">
                <RoleTag showLabel={true} />
                <span className="ml-3 text-sm text-[var(--text-secondary)]">{user.email}</span>
              </div>
            )}
            <button
              onClick={toggleTheme}
              className="block w-full text-left px-4 py-3 rounded-md text-base font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all duration-200 touch-manipulation"
            >
              Theme: {theme.toUpperCase()}
            </button>
            {user && (
              <button
                onClick={logout}
                className="block w-full text-left px-4 py-3 rounded-md text-base font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200 touch-manipulation"
              >
                Logout
              </button>
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
