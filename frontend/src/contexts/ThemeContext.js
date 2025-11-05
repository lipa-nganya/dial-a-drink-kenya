import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Check localStorage for saved theme preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      return savedTheme === 'dark';
    }
    // Default to dark mode
    return true;
  });

  useEffect(() => {
    // Save theme preference to localStorage
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(prev => !prev);
  };

  // Theme color mappings
  const getThemeColors = () => {
    if (isDarkMode) {
      return {
        background: '#0D0D0D',
        paper: '#121212',
        textPrimary: '#F5F5F5',
        textSecondary: '#B0B0B0',
        accent: '#00E0B8', // Green
        accentText: '#00E0B8', // Green text
        error: '#FF3366', // Red stays red
        errorText: '#F5F5F5', // White text on red background
        errorBackground: '#FF3366', // Red background
      };
    } else {
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
    }
  };

  const colors = getThemeColors();

  const value = {
    isDarkMode,
    toggleTheme,
    colors,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

