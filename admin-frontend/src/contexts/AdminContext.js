import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';
import io from 'socket.io-client';

const AdminContext = createContext();

export const useAdmin = () => {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
};

export const AdminProvider = ({ children }) => {
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const [socket, setSocket] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);

  // Load user info from localStorage or fetch from API
  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    const savedUser = localStorage.getItem('adminUser');
    
    setIsAuthenticated(!!token);
    
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        console.error('Error parsing saved user:', e);
      }
    }
    
    // If we have a token but no user, fetch user info
    if (token && !savedUser) {
      fetchUserInfo();
    }
  }, []);

  const fetchUserInfo = async () => {
    try {
      const response = await api.get('/admin/me');
      setUser(response.data);
      localStorage.setItem('adminUser', JSON.stringify(response.data));
    } catch (error) {
      console.error('Error fetching user info:', error);
    }
  };

  // Play notification sound
  const playNotificationSound = () => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.05);
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
      
      console.log('🔔 Ping sound played');
    } catch (error) {
      console.warn('Could not play notification sound:', error);
    }
  };

  // Fetch pending orders count
  const fetchPendingOrdersCount = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) {
        console.warn('No admin token found, skipping stats fetch');
        setIsAuthenticated(false);
        return;
      }
      const response = await api.get('/admin/stats');
      setPendingOrdersCount(response.data.pendingOrders || 0);
    } catch (error) {
      if (error.response?.status === 401) {
        console.warn('Unauthorized access - admin token may be invalid or expired');
        // Token is invalid, clear it and update state
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUser');
        setIsAuthenticated(false);
        setUser(null);
        // Redirect to login if not already there
        if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/setup-password')) {
          window.location.href = '/login';
        }
      } else {
        console.error('Error fetching pending orders count:', error);
      }
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token || !isAuthenticated) return;

    // Initialize socket connection for admin
    // Use the same backend URL resolution logic as API calls
    const getBackendUrl = () => {
      const hostname = window.location.hostname;
      const isLocalHost = ['localhost', '127.0.0.1'].includes(hostname) || hostname.endsWith('.local');
      const isLanHost = /^10\.|^192\.168\.|^172\.(1[6-9]|2[0-9]|3[0-1])/.test(hostname || '');
      
      // CRITICAL: Always use localhost when running locally, regardless of REACT_APP_API_URL
      // This ensures local development always works, even if REACT_APP_API_URL is set for cloud-dev
      if (isLocalHost || isLanHost) {
        return 'http://localhost:5001';
      }

      // For cloud-dev deployments, use REACT_APP_API_URL if set
      const isManagedHost = hostname.includes('onrender.com') || hostname.includes('run.app');
      if (isManagedHost) {
        const apiUrl = process.env.REACT_APP_API_URL;
        if (apiUrl) {
          // Extract base URL from API URL (remove /api suffix)
          return apiUrl.replace('/api', '');
        }
        return 'https://dialadrink-backend-910510650031.us-central1.run.app';
      }

      // Fallback: Use REACT_APP_API_URL if set (for other hosted environments)
      const apiUrl = process.env.REACT_APP_API_URL;
      if (apiUrl) {
        return apiUrl.replace('/api', '');
      }

      // Final fallback
      return 'https://dialadrink-backend-910510650031.us-central1.run.app';
    };
    const socketUrl = getBackendUrl();
    const newSocket = io(socketUrl);
    newSocket.emit('join-admin');
    
    // Listen for new orders
    newSocket.on('new-order', (data) => {
      console.log('New order received:', data);
      playNotificationSound();
      fetchPendingOrdersCount();
    });

    setSocket(newSocket);

    // Fetch initial pending orders count
    fetchPendingOrdersCount();

    // Poll for pending orders count every 30 seconds as backup
    const pollInterval = setInterval(() => {
      // Check token still exists before polling
      if (localStorage.getItem('adminToken')) {
        fetchPendingOrdersCount();
      } else {
        clearInterval(pollInterval);
      }
    }, 30000);

    return () => {
      newSocket.close();
      clearInterval(pollInterval);
    };
  }, [isAuthenticated]);

  const logout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    setIsAuthenticated(false);
    setUser(null);
    if (socket) {
      socket.close();
      setSocket(null);
    }
  };

  const setUserInfo = (userData) => {
    setUser(userData);
    localStorage.setItem('adminUser', JSON.stringify(userData));
  };

  // Update isAuthenticated when token changes
  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    setIsAuthenticated(!!token);
  }, []);

  return (
    <AdminContext.Provider value={{ 
      pendingOrdersCount, 
      fetchPendingOrdersCount,
      isAuthenticated,
      setIsAuthenticated,
      logout,
      user,
      setUserInfo
    }}>
      {children}
    </AdminContext.Provider>
  );
};

