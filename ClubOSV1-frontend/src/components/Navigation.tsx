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

  const navItems = [
    { href: '/', label: 'Dashboard', roles: ['admin', 'operator', 'support'] as UserRole[] },
    { href: '/commands', label: 'Commands', roles: ['admin', 'operator', 'support'] as UserRole[] },
    { href: '/operations', label: 'Operations', roles: ['admin', 'operator'] as UserRole[] },
    { href: '/tickets', label: 'Ticket Center', roles: ['admin', 'operator'] as UserRole[] },
  ].filter(item => hasAnyRole(user?.role, item.roles));

  return (
    <>
      {/* Mobile Navigation */}
      <nav className="mobile-nav bg-[var(--bg-secondary)] border-b border-[var(--border-secondary)]">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="logo text-xl font-semibold">
              ClubOS
            </Link>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="hamburger-btn p-2 rounded-md text-[var(--text-secondary)]"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
          
          {mobileMenuOpen && (
            <div className="mobile-menu pb-4">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`
                    block px-4 py-2 text-base font-medium
                    ${router.pathname === item.href
                      ? 'bg-[var(--accent)] text-white'
                      : 'text-[var(--text-secondary)]'
                    }
                  `}
                >
                  {item.label}
                </Link>
              ))}
              <div className="border-t border-[var(--border-secondary)] mt-2 pt-2">
                <button
                  onClick={toggleTheme}
                  className="block w-full text-left px-4 py-2 text-sm text-[var(--text-secondary)]"
                >
                  Theme: {theme.toUpperCase()}
                </button>
                {user && (
                  <button
                    onClick={logout}
                    className="block w-full text-left px-4 py-2 text-sm text-red-600"
                  >
                    Logout
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Desktop Navigation */}
      <nav className="desktop-nav bg-[var(--bg-secondary)] border-b border-[var(--border-secondary)]">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link href="/" className="logo text-xl font-semibold">
                ClubOS
              </Link>
              <div className="ml-10 flex items-baseline space-x-4">
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
            <div className="flex items-center space-x-4">
              {user && <RoleTag showLabel={false} />}
              <span className="text-sm text-[var(--text-muted)]">Golf Simulator Management</span>
              <div className="w-2 h-2 bg-[var(--status-success)] rounded-full animate-pulse" title="System Active"></div>
              <button
                onClick={toggleTheme}
                className="theme-toggle px-3 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] rounded-md text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent)] transition-all duration-200"
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
          </div>
        </div>
      </nav>

      <style jsx>{`
        .logo {
          background: linear-gradient(135deg, var(--accent) 0%, #20a0a0 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        
        /* Mobile navigation styles */
        .mobile-nav {
          display: none;
        }
        
        .desktop-nav {
          display: block;
        }
        
        @media (max-width: 767px) {
          .mobile-nav {
            display: block !important;
          }
          
          .desktop-nav {
            display: none !important;
          }
        }
        
        .hamburger-btn:hover {
          background-color: var(--bg-tertiary);
        }
        
        .mobile-menu {
          animation: slideDown 0.2s ease-out;
        }
        
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  );
};

export default Navigation;