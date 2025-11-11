import axios from 'axios';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

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

const normalizeBaseUrl = (value) => {
  if (!value) {
    return '';
  }
  return value.replace(/\/+$/, '');
};

const getBaseURL = () => {
  const envBase = normalizeBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL);
  if (envBase) {
    return `${envBase}/api`;
  }

  const configBase = normalizeBaseUrl(Constants.expoConfig?.extra?.apiBaseUrl);
  if (configBase) {
    return `${configBase}/api`;
  }

  if (Platform.OS === 'android' && __DEV__) {
    return 'http://10.0.2.2:5001/api';
  }

  if (Platform.OS === 'ios' && __DEV__) {
    return 'http://localhost:5001/api';
  }

  console.warn(
    '[DDDriverExpo] No API base URL configured. Set EXPO_PUBLIC_API_BASE_URL or extra.apiBaseUrl in app.json.'
  );
  return 'http://localhost:5001/api';
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

