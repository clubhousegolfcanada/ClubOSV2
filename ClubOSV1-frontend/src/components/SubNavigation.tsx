import React from 'react';
import { LucideIcon } from 'lucide-react';

export interface SubNavTab {
  id: string;
  label: string;
  icon?: LucideIcon;
  badge?: string | number;
}

export interface SubNavAction {
  id: string;
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  hideOnMobile?: boolean;
  mobileLabel?: string;
}

interface SubNavigationProps {
  tabs?: SubNavTab[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  actions?: SubNavAction[];
  rightContent?: React.ReactNode;
  className?: string;
  mobileBottom?: boolean; // For mobile, render at bottom above main nav
}

export const SubNavigation: React.FC<SubNavigationProps> = ({
  tabs = [],
  activeTab,
  onTabChange,
  actions = [],
  rightContent,
  className = '',
  mobileBottom = false
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

  const getActionStyles = (variant?: string) => {
    switch (variant) {
      case 'primary':
        return 'bg-[var(--accent)] text-white hover:bg-opacity-90';
      case 'danger':
        return 'bg-red-500/10 hover:bg-red-500/20 text-red-500';
      default:
        return 'bg-gray-100 text-gray-700 hover:bg-gray-200';
    }
  };

  // Mobile bottom positioning styles - above bottom nav
  const positionStyles = isMobile && mobileBottom
    ? 'fixed bottom-16 left-0 right-0 z-30 lg:relative lg:bottom-auto'
    : '';

  return (
    <div className={`bg-white border-b border-gray-200 ${positionStyles} ${className}`}>
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <nav className="flex justify-between items-center">
            {/* Left: Tabs and Primary Actions */}
            <div className="flex items-center space-x-2">
              {/* Tab Navigation */}
              {tabs.length > 0 && (
                <div className="flex space-x-1 sm:space-x-4 pb-px">
                  {tabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => onTabChange?.(tab.id)}
                        className={`
                          flex items-center space-x-2 px-2 sm:px-3 py-2 text-sm font-medium border-b-2 transition-all whitespace-nowrap
                          ${activeTab === tab.id
                            ? 'border-[var(--accent)] text-[var(--accent)]'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                          }
                        `}
                      >
                        {Icon && <Icon className="w-4 h-4" />}
                        <span>{tab.label}</span>
                        {tab.badge && (
                          <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">
                            {tab.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Primary Actions (left side) */}
              {actions.filter(a => a.variant === 'primary').length > 0 && (
                <div className="border-l border-gray-200 pl-2 ml-2">
                  {actions.filter(a => a.variant === 'primary').map((action) => {
                    const Icon = action.icon;
                    const label = action.hideOnMobile && window.innerWidth < 640
                      ? (action.mobileLabel || '')
                      : action.label;

                    return (
                      <button
                        key={action.id}
                        onClick={action.onClick}
                        className={`
                          flex items-center space-x-1 px-3 py-1.5 rounded-md transition-all text-sm font-medium
                          ${getActionStyles(action.variant)}
                        `}
                      >
                        {Icon && <Icon className="w-4 h-4" />}
                        {label && <span className="hidden sm:inline">{label}</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right: Secondary Actions and Custom Content */}
            <div className="flex items-center space-x-2 py-1">
              {/* Secondary Actions */}
              {actions.filter(a => a.variant !== 'primary').map((action) => {
                const Icon = action.icon;
                const label = action.hideOnMobile && window.innerWidth < 640
                  ? (action.mobileLabel || '')
                  : action.label;

                return (
                  <button
                    key={action.id}
                    onClick={action.onClick}
                    className={`
                      flex items-center space-x-1 px-3 py-1.5 rounded-md transition-all text-sm font-medium
                      ${getActionStyles(action.variant)}
                    `}
                  >
                    {Icon && <Icon className="w-4 h-4" />}
                    {label && <span className="hidden sm:inline">{label}</span>}
                  </button>
                );
              })}

              {/* Custom Right Content */}
              {rightContent}
            </div>
          </nav>
        </div>
      </div>
    </div>
  );
};

export default SubNavigation;