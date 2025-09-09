import React from 'react';
import CustomerNavigation from './CustomerNavigation';
import Head from 'next/head';

interface PageLayoutProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  showHeader?: boolean;
  headerTitle?: string;
  headerSubtitle?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | '7xl' | 'full';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  className?: string;
}

export const PageLayout: React.FC<PageLayoutProps> = ({
  children,
  title = 'Clubhouse Golf',
  description,
  showHeader = false,
  headerTitle,
  headerSubtitle,
  maxWidth = '7xl',
  padding = 'md',
  className = ''
}) => {
  // Consistent padding values
  const paddingClasses = {
    none: '',
    sm: 'px-3 py-2 sm:px-4 sm:py-3',
    md: 'px-3 py-3 sm:px-4 sm:py-4',
    lg: 'px-4 py-4 sm:px-6 sm:py-6'
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

  return (
    <>
      <Head>
        <title>{title}</title>
        {description && <meta name="description" content={description} />}
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      </Head>

      <div className="min-h-screen bg-[var(--bg-primary)] customer-app">
        <CustomerNavigation />
        
        {/* Optional Header - Consistent styling when used */}
        {showHeader && (headerTitle || headerSubtitle) && (
          <div className="bg-gradient-to-r from-[var(--accent)] to-[#084a45] text-white">
            <div className={`${maxWidthClasses[maxWidth]} mx-auto px-3 sm:px-4 py-3 sm:py-4`}>
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
        <main className="pb-20 lg:pb-8">
          <div className={`${maxWidthClasses[maxWidth]} mx-auto ${paddingClasses[padding]} ${className}`}>
            {children}
          </div>
        </main>
      </div>
    </>
  );
};

export default PageLayout;