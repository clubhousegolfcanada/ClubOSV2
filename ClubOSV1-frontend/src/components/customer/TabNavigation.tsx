import React from 'react';

export interface Tab {
  key: string;
  label: string;
  badge?: number | string;
  badgeColor?: 'red' | 'green' | 'blue' | 'yellow' | 'gray';
}

interface TabNavigationProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  variant?: 'underline' | 'pill';
  sticky?: boolean;
  className?: string;
}

export const TabNavigation: React.FC<TabNavigationProps> = ({
  tabs,
  activeTab,
  onTabChange,
  variant = 'underline',
  sticky = true,
  className = ''
}) => {
  const badgeColors = {
    red: 'bg-red-500 text-white',
    green: 'bg-green-500 text-white',
    blue: 'bg-blue-500 text-white',
    yellow: 'bg-yellow-500 text-white',
    gray: 'bg-gray-500 text-white'
  };

  if (variant === 'pill') {
    return (
      <div className={`${sticky ? 'sticky top-14 z-30' : ''} bg-[var(--bg-secondary)] border-b border-[var(--border-primary)] ${className}`}>
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2">
          <div className="inline-flex rounded-lg border border-[var(--border-primary)] bg-[var(--bg-tertiary)] p-0.5">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => onTabChange(tab.key)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                  activeTab === tab.key
                    ? 'bg-[#0B3D3A] text-white'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {tab.label}
                {tab.badge !== undefined && tab.badge !== 0 && (
                  <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] text-xs font-bold rounded-full px-1 ${
                    badgeColors[tab.badgeColor || 'red']
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Default underline variant
  return (
    <div className={`${sticky ? 'sticky top-14 z-30' : ''} bg-[var(--bg-secondary)] border-b border-[var(--border-primary)] ${className}`}>
      <div className="max-w-7xl mx-auto px-3 sm:px-4">
        <div className="flex gap-1 sm:gap-4 overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={`py-3 px-3 border-b-2 text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 flex items-center gap-2 ${
                activeTab === tab.key
                  ? 'border-[#0B3D3A] text-[#0B3D3A]'
                  : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge !== 0 && (
                <span className={`inline-flex items-center justify-center min-w-[20px] h-5 text-xs font-bold rounded-full px-1.5 ${
                  badgeColors[tab.badgeColor || 'red']
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TabNavigation;