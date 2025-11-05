import axios from 'axios';
import { Platform } from 'react-native';

// Configuration for API base URL
// IMPORTANT: Choose the correct method based on how you're testing:

// OPTION 1: Android Emulator (default)
// Use 10.0.2.2 which maps to localhost on host machine
// Only works when running in Android Emulator!

// OPTION 2: Physical Device via Ngrok (recommended)
// 1. Start ngrok: ngrok http 5001
// 2. Copy the HTTPS URL
// 3. Replace the URL below

// OPTION 3: Physical Device via Local Network
// 1. Find your computer's IP: ifconfig | grep "inet " | grep -v 127.0.0.1
// 2. Replace 192.168.1.XXX below with your actual IP
// 3. Ensure phone and computer are on same WiFi

// OPTION 4: Physical Device via USB + ADB
// Run: adb reverse tcp:5001 tcp:5001
// Then use 'http://localhost:5001/api' below

const getBaseURL = () => {
  // ==========================================
  // CHANGE THIS URL BASED ON YOUR SETUP:
  // ==========================================
  
  // Option 1: Use Ngrok (for physical device - currently active)
  // Your ngrok URL: https://homiest-psychopharmacologic-anaya.ngrok-free.dev
  return 'https://homiest-psychopharmacologic-anaya.ngrok-free.dev/api';
  
  // Option 2: Android Emulator (uncomment if using emulator):
  // if (Platform.OS === 'android' && __DEV__) {
  //   return 'http://10.0.2.2:5001/api';
  // }
  
  // Option 3: Physical Device - Local Network (uncomment and update with your IP):
  // return 'http://192.168.1.66:5001/api'; // Your local IP is 192.168.1.66
  
  // Option 4: Physical Device - USB ADB (uncomment):
  // return 'http://localhost:5001/api';
  
  // Option 5: iOS Simulator:
  // if (Platform.OS === 'ios' && __DEV__) {
  //   return 'http://localhost:5001/api';
  // }
  
  // Production URL (uncomment when deploying):
  // return 'https://your-production-url.com/api';
};

const api = axios.create({
  baseURL: getBaseURL(),
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true', // Skip ngrok warning page
  },
});

// Request interceptor for adding auth tokens if needed
api.interceptors.request.use(
  (config) => {
    // Add any auth tokens here if needed
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      // Server responded with error
      console.error('API Error:', error.response.data);
    } else if (error.request) {
      // Request made but no response
      console.error('Network Error:', error.request);
    } else {
      // Something else happened
      console.error('Error:', error.message);
    }
    return Promise.reject(error);
  }
);

export default api;

