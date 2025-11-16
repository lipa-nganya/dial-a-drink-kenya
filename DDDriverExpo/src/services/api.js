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
  // CRITICAL: Check build profile/environment FIRST before checking __DEV__
  // This ensures production and cloud-dev builds use the correct API URL
  const buildProfile = Constants.expoConfig?.extra?.environment || process.env.EXPO_PUBLIC_ENV || process.env.EXPO_PUBLIC_BUILD_PROFILE;
  const bundleId = Constants.expoConfig?.ios?.bundleIdentifier || Constants.expoConfig?.android?.package;
  const appName = Constants.expoConfig?.name || '';
  const isLocalDevBuild = bundleId?.includes('.local') || appName?.includes('Local');
  const isExpoGo = Constants.executionEnvironment === 'storeClient'; // Running in Expo Go
  
  console.log('🔍 [API] Environment Detection:', {
    buildProfile,
    bundleId,
    appName,
    isLocalDevBuild,
    isExpoGo,
    __DEV__,
    expoConfig: Constants.expoConfig?.extra
  });
  
  // Priority 1: Check if explicitly in local-dev mode (from build profile or bundle ID)
  // ONLY use localhost/ngrok if explicitly configured as local-dev
  if (buildProfile === 'local' || isLocalDevBuild) {
    // Try to get ngrok URL from environment variable first (for physical devices)
    const ngrokEnvUrl = normalizeBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL);
    if (ngrokEnvUrl && (ngrokEnvUrl.includes('ngrok') || ngrokEnvUrl.includes('localhost'))) {
      console.log('🌐 [API] Local-dev mode - using ngrok URL from env:', `${ngrokEnvUrl}/api`);
      return `${ngrokEnvUrl}/api`;
    }
    
    // Fallback to hardcoded ngrok URL for local development
    const ngrokUrl = 'https://homiest-psychopharmacologic-anaya.ngrok-free.dev';
    console.log('🌐 [API] Local-dev mode detected - using ngrok URL:', `${ngrokUrl}/api`);
    return `${ngrokUrl}/api`;
  }
  
  // Priority 2: Check if running in Expo Go (development client)
  // Only use localhost if explicitly in Expo Go AND no build profile is set
  if (isExpoGo && !buildProfile) {
    const ngrokEnvUrl = normalizeBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL);
    if (ngrokEnvUrl && (ngrokEnvUrl.includes('ngrok') || ngrokEnvUrl.includes('localhost'))) {
      console.log('🌐 [API] Expo Go mode - using ngrok URL from env:', `${ngrokEnvUrl}/api`);
      return `${ngrokEnvUrl}/api`;
    }
    
    // Fallback for Expo Go
    const ngrokUrl = 'https://homiest-psychopharmacologic-anaya.ngrok-free.dev';
    console.log('🌐 [API] Expo Go mode - using ngrok URL:', `${ngrokUrl}/api`);
    return `${ngrokUrl}/api`;
  }

  // Priority 3: Environment variable (set at build time for cloud-dev/production)
  // This is set in eas.json for cloud-dev builds
  const envBase = normalizeBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL);
  if (envBase) {
    console.log('🌐 [API] Using URL from EXPO_PUBLIC_API_BASE_URL:', `${envBase}/api`);
    return `${envBase}/api`;
  }

  // Priority 4: App config extra.apiBaseUrl (set in app.config.js based on build profile)
  // This is the PRIMARY source for production and cloud-dev builds
  const configBase = normalizeBaseUrl(Constants.expoConfig?.extra?.apiBaseUrl);
  if (configBase) {
    console.log('🌐 [API] Using URL from app config extra.apiBaseUrl:', `${configBase}/api`);
    console.log('📱 [API] Build profile:', Constants.expoConfig?.extra?.environment || 'unknown');
    return `${configBase}/api`;
  }

  // Fallback for development (emulator only) - ONLY if __DEV__ is true AND no build profile
  if (__DEV__ && !buildProfile) {
    if (Platform.OS === 'android') {
      console.warn('⚠️ [API] Using emulator fallback URL (10.0.2.2). For physical device, set EXPO_PUBLIC_API_BASE_URL or use ngrok.');
      return 'http://10.0.2.2:5001/api';
    }
    
    if (Platform.OS === 'ios') {
      console.warn('⚠️ [API] Using localhost fallback. For physical device, set EXPO_PUBLIC_API_BASE_URL or use ngrok.');
      return 'http://localhost:5001/api';
    }
  }

  // Final fallback: Use cloud-dev API URL for production/cloud-dev builds
  const cloudApiUrl = 'https://dialadrink-backend-910510650031.us-central1.run.app';
  console.warn('⚠️ [API] No API URL configured, using cloud-dev fallback:', `${cloudApiUrl}/api`);
  console.error('📱 [API] Debug info:', {
    buildProfile,
    isLocalDevBuild,
    isExpoGo,
    __DEV__,
    envBase,
    configBase,
    expoConfig: Constants.expoConfig?.extra
  });
  return `${cloudApiUrl}/api`;
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

