import axios from 'axios';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';

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
  const bundleId = Constants.expoConfig?.ios?.bundleIdentifier || Constants.expoConfig?.android?.package;
  const appName = Constants.expoConfig?.name || '';
  const isLocalBuild = bundleId?.includes('.local') || appName?.includes('Local');
  
  const localBackendUrl = 'https://homiest-psychopharmacologic-anaya.ngrok-free.dev';
  const cloudBackendUrl = 'https://deliveryos-backend-p6bkgryxqa-uc.a.run.app';
  
  // ABSOLUTE PRIORITY: If bundle ID contains .local or app name contains "Local", ALWAYS use local backend
  // This check MUST happen first and cannot be overridden
  if (isLocalBuild) {
    console.log('🌐 [API] Local build detected (bundleId:', bundleId, 'appName:', appName, ') - FORCING local backend:', `${localBackendUrl}/api`);
    return `${localBackendUrl}/api`;
  }
  
  // Check update channel
  let updateChannel = null;
  try {
    if (Updates && Updates.channel) {
      updateChannel = Updates.channel;
    }
  } catch (e) {
    // Updates module not available
  }
  
  if (updateChannel === 'local' || updateChannel === 'local-dev') {
    console.log('🌐 [API] Local channel detected (', updateChannel, ') - using local backend:', `${localBackendUrl}/api`);
    return `${localBackendUrl}/api`;
  }
  
  // Check environment variable (from OTA update)
  const envBase = normalizeBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL);
  if (envBase) {
    if (envBase.includes('ngrok') || envBase.includes('localhost') || envBase.includes('127.0.0.1')) {
      console.log('🌐 [API] Using local backend from env:', `${envBase}/api`);
      return `${envBase}/api`;
    }
    // If env has cloud URL but bundle is local, override it
    if (isLocalBuild && envBase.includes('run.app')) {
      console.log('🌐 [API] Local build detected but env has cloud URL - OVERRIDING to local backend:', `${localBackendUrl}/api`);
      return `${localBackendUrl}/api`;
    }
  }
  
  // Check app config (from build time)
  const configBase = normalizeBaseUrl(Constants.expoConfig?.extra?.apiBaseUrl);
  if (configBase) {
    // If app config has cloud URL but bundle is local, override it
    if (isLocalBuild && configBase.includes('run.app')) {
      console.log('🌐 [API] Local build detected but app config has cloud URL - OVERRIDING to local backend:', `${localBackendUrl}/api`);
      return `${localBackendUrl}/api`;
    }
    console.log('🌐 [API] Using backend from app config:', `${configBase}/api`);
    return `${configBase}/api`;
  }
  
  // Default to cloud backend ONLY if not a local build
  if (isLocalBuild) {
    console.log('🌐 [API] Local build detected but no URL found - using local backend default:', `${localBackendUrl}/api`);
    return `${localBackendUrl}/api`;
  }
  
  console.log('🌐 [API] Using cloud backend default:', `${cloudBackendUrl}/api`);
  return `${cloudBackendUrl}/api`;
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

