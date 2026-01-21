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
  const localBackendUrl = 'https://homiest-psychopharmacologic-anaya.ngrok-free.dev';
  const cloudBackendUrl = 'https://deliveryos-backend-p6bkgryxqa-uc.a.run.app';
  
  try {
    // METHOD 1: Check explicit environment variable set by OTA update
    // This is the most reliable - set EXPO_PUBLIC_USE_LOCAL_BACKEND=true when publishing to local branch
    const useLocalBackend = process.env.EXPO_PUBLIC_USE_LOCAL_BACKEND === 'true' || 
                            process.env.EXPO_PUBLIC_ENV === 'local' ||
                            process.env.EXPO_PUBLIC_BUILD_PROFILE === 'local-dev';
    
    if (useLocalBackend) {
      console.log('🌐 [API] METHOD 1: Environment variable indicates LOCAL backend');
      return `${localBackendUrl}/api`;
    }
    
    // METHOD 2: Check bundle ID - if it contains .local, ALWAYS use local
    const bundleId = Constants?.expoConfig?.ios?.bundleIdentifier || Constants?.expoConfig?.android?.package || '';
    const appName = Constants?.expoConfig?.name || '';
    
    if (bundleId?.includes('.local') || appName?.includes('Local')) {
      console.log('🌐 [API] METHOD 2: Bundle ID/App Name indicates LOCAL build (bundleId:', bundleId, 'appName:', appName, ')');
      return `${localBackendUrl}/api`;
    }
    
    // METHOD 3: Check update channel/branch
    let updateChannel = null;
    let updateBranch = null;
    try {
      if (Updates) {
        updateChannel = Updates.channel || null;
        updateBranch = Updates.branch || null;
      }
    } catch (e) {
      // Updates not available
  }
  
    if (updateChannel === 'local' || updateChannel === 'local-dev' || updateBranch === 'local') {
      console.log('🌐 [API] METHOD 3: Update channel/branch indicates LOCAL (channel:', updateChannel, 'branch:', updateBranch, ')');
      return `${localBackendUrl}/api`;
    }
    
    // METHOD 4: Check environment variable for API URL
    const envBase = normalizeBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL);
    if (envBase) {
      if (envBase.includes('ngrok') || envBase.includes('localhost') || envBase.includes('127.0.0.1')) {
        console.log('🌐 [API] METHOD 4: Environment variable has LOCAL URL:', envBase);
        return `${envBase}/api`;
  }
      if (envBase.includes('run.app')) {
        console.log('🌐 [API] METHOD 4: Environment variable has CLOUD URL:', envBase);
        return `${envBase}/api`;
      }
  }

    // METHOD 5: Check app config
    const configBase = normalizeBaseUrl(Constants?.expoConfig?.extra?.apiBaseUrl);
  if (configBase) {
      console.log('🌐 [API] METHOD 5: Using app config URL:', configBase);
    return `${configBase}/api`;
  }

    // DEFAULT: For local testing, default to LOCAL backend if we can't determine
    // This is safer for local development
    console.log('🌐 [API] DEFAULT: Could not determine backend, defaulting to LOCAL for safety');
    return `${localBackendUrl}/api`;
    
  } catch (error) {
    console.error('❌ [API] Error determining base URL:', error);
    // Always fallback to local for safety
    console.log('🌐 [API] ERROR FALLBACK: Using LOCAL backend');
    return `${localBackendUrl}/api`;
  }
};

// Note: baseURL is now calculated on every request to ensure we always get the latest value
// This prevents issues where channel/branch detection might change or be delayed

const api = axios.create({
  baseURL: '', // Will be set dynamically on first request
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true', // Skip ngrok warning page
  },
});

// Request interceptor: Set baseURL dynamically and add auth tokens if needed
api.interceptors.request.use(
  (config) => {
    // Always recalculate baseURL to ensure we get the latest value
    // This prevents caching issues if channel/branch changes
    const currentBaseURL = getBaseURL();
    config.baseURL = currentBaseURL;
    
    // Log the actual URL being used for debugging
    const fullUrl = `${config.baseURL}${config.url}`;
    console.log('🌐 [API] Request:', {
      method: config.method?.toUpperCase(),
      url: config.url,
      baseURL: config.baseURL,
      fullUrl: fullUrl
    });
    
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

