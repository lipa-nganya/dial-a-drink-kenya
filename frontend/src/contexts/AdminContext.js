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

  // Play notification sound
  const playNotificationSound = () => {
    try {
      // Create a simple ping sound
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // Resume audio context if suspended (required for autoplay policies)
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Create a ping sound (short beep)
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
      const response = await api.get('/admin/stats');
      setPendingOrdersCount(response.data.pendingOrders || 0);
    } catch (error) {
      console.error('Error fetching pending orders count:', error);
    }
  };

  useEffect(() => {
    // Initialize socket connection for admin
    const isHosted =
      window.location.hostname.includes('onrender.com') ||
      window.location.hostname.includes('run.app');
    const socketUrl = isHosted
      ? 'https://dialadrink-backend-910510650031.us-central1.run.app'
      : 'http://localhost:5001';
    const newSocket = io(socketUrl);
    newSocket.emit('join-admin');
    
    // Listen for new orders
    newSocket.on('new-order', (data) => {
      console.log('New order received:', data);
      // Play ping sound
      playNotificationSound();
      // Refresh pending orders count
      fetchPendingOrdersCount();
    });

    setSocket(newSocket);

    // Fetch initial pending orders count
    fetchPendingOrdersCount();

    // Poll for pending orders count every 30 seconds as backup
    const pollInterval = setInterval(() => {
      fetchPendingOrdersCount();
    }, 30000);

    return () => {
      newSocket.close();
      clearInterval(pollInterval);
    };
  }, []);

  return (
    <AdminContext.Provider value={{ pendingOrdersCount, fetchPendingOrdersCount }}>
      {children}
    </AdminContext.Provider>
  );
};











