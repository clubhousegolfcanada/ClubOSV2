import React from 'react';
import Head from 'next/head';

interface OperatorLayoutProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  showHeader?: boolean;
  headerTitle?: string;
  headerSubtitle?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | '7xl' | 'full';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  className?: string;
  subNavigation?: React.ReactNode;
}

export const OperatorLayout: React.FC<OperatorLayoutProps> = ({
  children,
  title = 'ClubOS',
  description,
  showHeader = false,
  headerTitle,
  headerSubtitle,
  maxWidth = '7xl',
  padding = 'md',
  className = '',
  subNavigation
}) => {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  // Consistent padding values
  const paddingClasses = {
    none: '',
    sm: 'px-3 py-2 sm:px-4 sm:py-3',
    md: 'px-4 py-4 sm:px-6 sm:py-4',
    lg: 'px-4 py-4 sm:px-6 lg:px-8 sm:py-6'
  };

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
    '6xl': 'max-w-6xl',
    '7xl': 'max-w-7xl',
    full: 'w-full'
  };

  // Calculate padding based on navigation elements
  // Desktop: Account for remote actions bar at bottom
  // Mobile: Account for bottom nav (64px) + optional sub-nav (48px) + remote actions FAB
  const getPaddingBottom = () => {
    if (isMobile) {
      // Mobile: bottom nav (64px) + optional sub-nav (48px) + remote actions FAB (56px) + extra space
      return subNavigation ? 'pb-32' : 'pb-24';
    } else {
      // Desktop: remote actions bar (48px) + extra space
      return 'pb-16';
    }
  };

  // Clone subNavigation element and add mobileBottom prop if it's SubNavigation component
  const enhancedSubNavigation = React.useMemo(() => {
    if (!subNavigation) return null;
    if (React.isValidElement(subNavigation) && subNavigation.type &&
        (subNavigation.type as any).name === 'SubNavigation') {
      return React.cloneElement(subNavigation as React.ReactElement<any>, {
        mobileBottom: true
      });
    }
    return subNavigation;
  }, [subNavigation]);

  return (
    <>
      <Head>
        <title>{title}</title>
        {description && <meta name="description" content={description} />}
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0" />
      </Head>

      <div className="min-h-screen bg-[var(--bg-primary)]">
        {/* SubNavigation - Rendered here for desktop, will be repositioned for mobile */}
        {enhancedSubNavigation}

        {/* Optional Header - Consistent styling when used */}
        {showHeader && (headerTitle || headerSubtitle) && (
          <div className="bg-gradient-to-r from-[var(--accent)] to-[#084a45] text-white">
            <div className={`${maxWidthClasses[maxWidth]} mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4`}>
              {headerTitle && (
                <h1 className="text-xl sm:text-2xl font-bold">{headerTitle}</h1>
              )}
              {headerSubtitle && (
                <p className="text-xs sm:text-sm text-white/80 mt-1">{headerSubtitle}</p>
              )}
            </div>
          </div>
        )}

        {/* Main Content - Consistent spacing */}
        <main className={getPaddingBottom()}>
          <div className={`${maxWidthClasses[maxWidth]} mx-auto ${paddingClasses[padding]} ${className}`}>
            {children}
          </div>
        </main>
      </div>
    </>
  );
};

export default OperatorLayout;