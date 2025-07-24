import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuthState } from '@/state/useStore';
import { hasAnyRole } from '@/utils/roleUtils';
import RoleTag from '@/components/RoleTag';
import { Menu, X } from 'lucide-react';

type UserRole = 'admin' | 'operator' | 'support';

const Navigation: React.FC = () => {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuthState();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const navItems = [
    { href: '/', label: 'Dashboard', roles: ['admin', 'operator', 'support'] as UserRole[] },
    { href: '/commands', label: 'Commands', roles: ['admin', 'operator', 'support'] as UserRole[] },
    { href: '/operations', label: 'Operations', roles: ['admin', 'operator'] as UserRole[] },
    { href: '/tickets', label: 'Ticket Center', roles: ['admin', 'operator'] as UserRole[] },
  ].filter(item => hasAnyRole(user?.role, item.roles));

  return (
    <nav className="bg-[var(--bg-secondary)] border-b border-[var(--border-secondary)]">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="logo text-xl font-semibold">
              ClubOS
            </Link>
            
            {/* Desktop Navigation */}
            {!isMobile && (
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
            )}
          </div>

          {/* Desktop Right Side */}
          {!isMobile && (
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
          )}

          {/* Mobile menu button */}
          {isMobile && (
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] focus:outline-none"
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          )}
        </div>

        {/* Mobile menu */}
        {isMobile && mobileMenuOpen && (
          <div className="pb-3">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`
                    block px-3 py-2 rounded-md text-base font-medium transition-all duration-200
                    ${router.pathname === item.href
                      ? 'bg-[var(--accent)] text-white'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                    }
                  `}
                >
                  {item.label}
                </Link>
              ))}
              <div className="border-t border-[var(--border-secondary)] pt-3 mt-3">
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-xs text-[var(--text-muted)]">Theme</span>
                  <button
                    onClick={toggleTheme}
                    className="px-2 py-1 bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] rounded text-xs font-medium uppercase text-[var(--text-secondary)]"
                  >
                    {theme}
                  </button>
                </div>
                {user && (
                  <>
                    <div className="px-3 py-2">
                      <RoleTag showLabel={true} />
                    </div>
                    <button
                      onClick={() => {
                        logout();
                        setMobileMenuOpen(false);
                      }}
                      className="w-full mt-2 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium transition-colors text-center"
                    >
                      Logout
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .logo {
          background: linear-gradient(135deg, var(--accent) 0%, #20a0a0 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
      `}</style>
    </nav>
  );
};

export default Navigation;