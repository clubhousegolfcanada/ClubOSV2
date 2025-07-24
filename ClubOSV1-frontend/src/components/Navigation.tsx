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
  const [isMobile, setIsMobile] = useState(false);

  // Force mobile detection on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      console.log('Navigation: Window width:', window.innerWidth, 'Mobile:', mobile);
    };
    
    // Check immediately
    checkMobile();
    
    // Check on resize
    window.addEventListener('resize', checkMobile);
    
    // Also check after a short delay (for iframe load timing)
    setTimeout(checkMobile, 100);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const navItems = [
    { href: '/', label: 'Dashboard', roles: ['admin', 'operator', 'support'] as UserRole[] },
    { href: '/commands', label: 'Commands', roles: ['admin', 'operator', 'support'] as UserRole[] },
    { href: '/operations', label: 'Operations', roles: ['admin', 'operator'] as UserRole[] },
    { href: '/tickets', label: 'Ticket Center', roles: ['admin', 'operator'] as UserRole[] },
  ].filter(item => hasAnyRole(user?.role, item.roles));

  // Force render mobile nav on small screens
  if (isMobile) {
    return (
      <nav className="bg-[var(--bg-secondary)] border-b border-[var(--border-secondary)]" style={{ width: '100%' }}>
        <div style={{ padding: '0 1rem', maxWidth: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '4rem' }}>
            <Link href="/" className="logo text-xl font-semibold">
              ClubOS
            </Link>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              style={{
                padding: '0.5rem',
                borderRadius: '0.375rem',
                backgroundColor: 'transparent',
                color: 'var(--text-secondary)',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              <svg style={{ width: '1.5rem', height: '1.5rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
          
          {mobileMenuOpen && (
            <div style={{ paddingBottom: '1rem' }}>
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  style={{
                    display: 'block',
                    padding: '0.5rem 1rem',
                    fontSize: '1rem',
                    fontWeight: '500',
                    color: router.pathname === item.href ? 'white' : 'var(--text-secondary)',
                    backgroundColor: router.pathname === item.href ? 'var(--accent)' : 'transparent',
                    textDecoration: 'none',
                    borderRadius: '0.25rem',
                    marginBottom: '0.25rem'
                  }}
                >
                  {item.label}
                </Link>
              ))}
              <div style={{ borderTop: '1px solid var(--border-secondary)', marginTop: '0.5rem', paddingTop: '0.5rem' }}>
                <button
                  onClick={toggleTheme}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '0.5rem 1rem',
                    fontSize: '0.875rem',
                    color: 'var(--text-secondary)',
                    backgroundColor: 'transparent',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  Theme: {theme.toUpperCase()}
                </button>
                {user && (
                  <button
                    onClick={logout}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '0.5rem 1rem',
                      fontSize: '0.875rem',
                      color: '#dc2626',
                      backgroundColor: 'transparent',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    Logout
                  </button>
                )}
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
  }

  // Desktop navigation
  return (
    <nav className="bg-[var(--bg-secondary)] border-b border-[var(--border-secondary)]">
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