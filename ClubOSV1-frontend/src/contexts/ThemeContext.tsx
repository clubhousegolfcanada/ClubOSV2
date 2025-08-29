import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    // Check if user is a customer - force light mode for customers
    const userStr = localStorage.getItem('clubos_user');
    const user = userStr ? JSON.parse(userStr) : null;
    const isCustomer = user?.role === 'customer';
    
    if (isCustomer) {
      // Force light mode for customers
      setTheme('light');
      document.documentElement.setAttribute('data-theme', 'light');
      updateMetaTheme('light');
      localStorage.setItem('clubos-theme', 'light');
    } else {
      // Load saved theme or default to dark for non-customers
      const savedTheme = localStorage.getItem('clubos-theme') as Theme;
      const initialTheme = savedTheme || 'dark';
      setTheme(initialTheme);
      document.documentElement.setAttribute('data-theme', initialTheme);
      updateMetaTheme(initialTheme);
    }
  }, []);

  const updateMetaTheme = (theme: Theme) => {
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', theme === 'dark' ? '#0a0a0a' : '#ffffff');
    }
  };

  const toggleTheme = () => {
    // Check if user is a customer - prevent theme changes for customers
    const userStr = localStorage.getItem('clubos_user');
    const user = userStr ? JSON.parse(userStr) : null;
    const isCustomer = user?.role === 'customer';
    
    if (isCustomer) {
      // Don't allow theme changes for customers
      return;
    }
    
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('clubos-theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    updateMetaTheme(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
