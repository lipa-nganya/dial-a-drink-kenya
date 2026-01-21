import React, { createContext, useContext, useState, useEffect } from 'react';

const MobileViewContext = createContext();

export const useMobileView = () => {
  const context = useContext(MobileViewContext);
  if (!context) {
    throw new Error('useMobileView must be used within MobileViewProvider');
  }
  return context;
};

export const MobileViewProvider = ({ children }) => {
  const [isMobileView, setIsMobileView] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);

  useEffect(() => {
    // Detect if device is mobile
    const checkMobile = () => {
      const isMobile = window.innerWidth < 960; // md breakpoint
      setIsMobileDevice(isMobile);
      
      // Auto-disable mobile view on desktop
      if (!isMobile && isMobileView) {
        setIsMobileView(false);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, [isMobileView]);

  // Apply/remove mobile view class to body
  useEffect(() => {
    if (isMobileView) {
      document.body.classList.add('mobile-view-active');
    } else {
      document.body.classList.remove('mobile-view-active');
    }
    
    return () => {
      document.body.classList.remove('mobile-view-active');
    };
  }, [isMobileView]);

  const toggleMobileView = () => {
    setIsMobileView(prev => !prev);
  };

  const enableMobileView = () => {
    setIsMobileView(true);
  };

  const disableMobileView = () => {
    setIsMobileView(false);
  };

  return (
    <MobileViewContext.Provider
      value={{
        isMobileView,
        isMobileDevice,
        toggleMobileView,
        enableMobileView,
        disableMobileView,
      }}
    >
      {children}
    </MobileViewContext.Provider>
  );
};

