import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(true); // Default to dark

  useEffect(() => {
    // Load theme preference from AsyncStorage
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('driver_theme');
        if (savedTheme !== null) {
          setIsDarkMode(savedTheme === 'dark');
        }
      } catch (error) {
        console.error('Error loading theme:', error);
      }
    };
    loadTheme();
  }, []);

  useEffect(() => {
    // Save theme preference to AsyncStorage
    const saveTheme = async () => {
      try {
        await AsyncStorage.setItem('driver_theme', isDarkMode ? 'dark' : 'light');
      } catch (error) {
        console.error('Error saving theme:', error);
      }
    };
    saveTheme();
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
        border: '#333',
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
        border: '#E0E0E0',
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

