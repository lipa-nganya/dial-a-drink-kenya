import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      const savedTheme = localStorage.getItem('admin_isDarkMode');
      return savedTheme ? JSON.parse(savedTheme) : true; // Default to dark mode
    } catch (error) {
      console.error("Failed to read theme from localStorage, defaulting to dark mode", error);
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('admin_isDarkMode', JSON.stringify(isDarkMode));
    } catch (error) {
      console.error("Failed to save theme to localStorage", error);
    }
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(prevMode => !prevMode);
  };

  const colors = useMemo(() => isDarkMode ? {
    background: '#0D0D0D',
    paper: '#121212',
    textPrimary: '#F5F5F5',
    textSecondary: '#B0B0B0',
    accent: '#00E0B8',
    accentText: '#00E0B8',
    error: '#FF3366',
    errorText: '#F5F5F5',
    border: '#333',
  } : {
    background: '#FFFFFF',
    paper: '#F5F5F5',
    textPrimary: '#000000',
    textSecondary: '#666666',
    accent: '#00E0B8',
    accentText: '#000000',
    error: '#FF3366',
    errorText: '#000000',
    border: '#E0E0E0',
  }, [isDarkMode]);

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme, colors }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

