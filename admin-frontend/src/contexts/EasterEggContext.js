import React, { createContext, useContext, useState, useEffect } from 'react';

const EasterEggContext = createContext();

export const useEasterEgg = () => {
  const context = useContext(EasterEggContext);
  if (!context) {
    throw new Error('useEasterEgg must be used within an EasterEggProvider');
  }
  return context;
};

export const EasterEggProvider = ({ children }) => {
  const [isEasterEggActive, setIsEasterEggActive] = useState(() => {
    // Load from localStorage on init
    const saved = localStorage.getItem('saveTheFishesEasterEgg');
    return saved === 'true';
  });

  useEffect(() => {
    // Save to localStorage when state changes
    localStorage.setItem('saveTheFishesEasterEgg', isEasterEggActive.toString());
  }, [isEasterEggActive]);

  useEffect(() => {
    let sequence = '';
    let timeout = null;

    const handleKeyPress = (event) => {
      // Only handle if not typing in an input field
      if (
        event.target.tagName === 'INPUT' ||
        event.target.tagName === 'TEXTAREA' ||
        event.target.isContentEditable
      ) {
        sequence = ''; // Reset if typing in input
        return;
      }

      const key = event.key.toLowerCase();

      // Reset sequence if it's been too long
      if (timeout) {
        clearTimeout(timeout);
      }
      timeout = setTimeout(() => {
        sequence = '';
      }, 1000);

      // Handle Enter key (check for sequence + Enter)
      if (key === 'enter') {
        if (sequence === 'xx') {
          setIsEasterEggActive(true);
          sequence = '';
          if (timeout) clearTimeout(timeout);
          console.log('🐟 Save the Fishes easter egg activated!');
          return;
        } else if (sequence === 'xy') {
          setIsEasterEggActive(false);
          sequence = '';
          if (timeout) clearTimeout(timeout);
          console.log('🐟 Save the Fishes easter egg deactivated!');
          return;
        } else {
          // Enter pressed but sequence doesn't match
          sequence = '';
          return;
        }
      }

      // Handle letter keys (x or y)
      if (key === 'x' || key === 'y') {
        sequence += key;
        // Keep only last 2 characters
        if (sequence.length > 2) {
          sequence = sequence.slice(-2);
        }
      } else {
        // Any other key resets the sequence
        sequence = '';
      }
    };

    window.addEventListener('keydown', handleKeyPress);

    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      if (timeout) clearTimeout(timeout);
    };
  }, []);

  return (
    <EasterEggContext.Provider value={{ isEasterEggActive, setIsEasterEggActive }}>
      {children}
    </EasterEggContext.Provider>
  );
};

