import React from 'react';
import { useTheme } from '../contexts/ThemeContext';

const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  const handleThemeChange = (newTheme: 'light' | 'dark') => {
    if (theme === newTheme) return; // Already in this theme
    
    // toggleTheme handles all the logic including localStorage and class updates
    toggleTheme();
  };

  return (
    <div className="flex items-center justify-between w-full">
      <span className="text-xs text-[var(--text-muted)]">Theme</span>
      <div className="relative inline-block">
        <div className="flex bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] rounded-full p-0.5">
          <div 
            className="absolute inset-y-0.5 transition-all duration-200 rounded-full bg-[var(--accent)]"
            style={{
              width: '50%',
              left: theme === 'dark' ? '50%' : '0%'
            }}
          />
          <button
            type="button"
            onClick={() => handleThemeChange('light')}
            className="relative z-10 px-3 py-1 text-xs font-medium transition-colors min-w-[50px]"
          >
            <span className={theme === 'light' ? 'text-white' : 'text-[var(--text-secondary)]'}>
              Light
            </span>
          </button>
          <button
            type="button"
            onClick={() => handleThemeChange('dark')}
            className="relative z-10 px-3 py-1 text-xs font-medium transition-colors min-w-[50px]"
          >
            <span className={theme === 'dark' ? 'text-white' : 'text-[var(--text-secondary)]'}>
              Dark
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ThemeToggle;