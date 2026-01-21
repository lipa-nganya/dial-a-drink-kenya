import React, { createContext, useContext } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  // Always use light mode for customer site
  const isDarkMode = false;

  // Theme color mappings - always light mode
  const getThemeColors = () => {
    return {
      background: '#FFFFFF',
      paper: '#F5F5F5',
      textPrimary: '#000000',
      textSecondary: '#666666',
      accent: '#00E0B8', // Green stays green (but text should be black)
      accentText: '#000000', // Black text instead of green
      error: '#FF3366', // Red stays red
      errorText: '#000000', // Black text on red background
      errorBackground: '#FF3366', // Red background
    };
  };

  const colors = getThemeColors();

  const value = {
    isDarkMode,
    toggleTheme: () => {}, // No-op function for compatibility
    colors,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

