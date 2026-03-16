import React, { createContext, useContext, useMemo } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const isDarkMode = false;
  const toggleTheme = () => {};

  const colors = useMemo(() => ({
    background: '#FFFFFF',
    paper: '#F5F5F5',
    textPrimary: '#000000',
    textSecondary: '#666666',
    accent: '#00E0B8',
    accentText: '#000000',
    error: '#FF3366',
    errorText: '#000000',
    border: '#E0E0E0',
  }), []);

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme, colors }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

