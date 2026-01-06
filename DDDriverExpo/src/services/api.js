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
  try {
    const bundleId = Constants?.expoConfig?.ios?.bundleIdentifier || Constants?.expoConfig?.android?.package || '';
    const appName = Constants?.expoConfig?.name || '';
    const isLocalBuild = bundleId?.includes('.local') || appName?.includes('Local');
    
    const localBackendUrl = 'https://homiest-psychopharmacologic-anaya.ngrok-free.dev';
    const cloudBackendUrl = 'https://deliveryos-backend-p6bkgryxqa-uc.a.run.app';
    
    // PRIORITY 1: Check update channel FIRST (this is set by OTA updates and takes precedence)
    // This is the most reliable way to determine which backend to use for OTA updates
    let updateChannel = null;
    let updateBranch = null;
    try {
      if (Updates) {
        try {
          updateChannel = Updates.channel || null;
        } catch (e) {
          console.log('⚠️ [API] Could not read Updates.channel:', e.message);
        }
        try {
          updateBranch = Updates.branch || null;
        } catch (e) {
          console.log('⚠️ [API] Could not read Updates.branch:', e.message);
        }
        console.log('🔍 [API] Update info:', {
          channel: updateChannel,
          branch: updateBranch
        });
      }
    } catch (e) {
      console.log('⚠️ [API] Updates module not available:', e.message);
    }
    
    // Check if channel or branch indicates local
    const isLocalChannel = updateChannel === 'local' || updateChannel === 'local-dev';
    const isLocalBranch = updateBranch === 'local';
    
    if (isLocalChannel || isLocalBranch) {
      console.log('🌐 [API] PRIORITY 1: Local detected (channel:', updateChannel, 'branch:', updateBranch, ') - FORCING local backend:', `${localBackendUrl}/api`);
      return `${localBackendUrl}/api`;
    }
    
    // PRIORITY 2: If bundle ID contains .local or app name contains "Local", ALWAYS use local backend
    // This check is for native builds with local bundle ID
    if (isLocalBuild) {
      console.log('🌐 [API] PRIORITY 2: Local build detected (bundleId:', bundleId, 'appName:', appName, ') - FORCING local backend:', `${localBackendUrl}/api`);
      return `${localBackendUrl}/api`;
    }
    
    // PRIORITY 3: Check environment variable (from OTA update)
    const envBase = normalizeBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL);
    if (envBase) {
      if (envBase.includes('ngrok') || envBase.includes('localhost') || envBase.includes('127.0.0.1')) {
        console.log('🌐 [API] PRIORITY 3: Using local backend from env:', `${envBase}/api`);
        return `${envBase}/api`;
      }
      // If env has cloud URL but channel/branch is local, override it
      if ((isLocalChannel || isLocalBranch) && envBase.includes('run.app')) {
        console.log('🌐 [API] PRIORITY 3: Local channel/branch but env has cloud URL - OVERRIDING to local backend:', `${localBackendUrl}/api`);
        return `${localBackendUrl}/api`;
      }
    }
    
    // PRIORITY 4: Check app config (from build time) - but ONLY if channel is not local
    const configBase = normalizeBaseUrl(Constants?.expoConfig?.extra?.apiBaseUrl);
    if (configBase) {
      // If channel/branch is local but app config has cloud URL, override it
      if ((isLocalChannel || isLocalBranch) && configBase.includes('run.app')) {
        console.log('🌐 [API] PRIORITY 4: Local channel/branch but app config has cloud URL - OVERRIDING to local backend:', `${localBackendUrl}/api`);
        return `${localBackendUrl}/api`;
      }
      // If bundle is local but app config has cloud URL, override it
      if (isLocalBuild && configBase.includes('run.app')) {
        console.log('🌐 [API] PRIORITY 4: Local build but app config has cloud URL - OVERRIDING to local backend:', `${localBackendUrl}/api`);
        return `${localBackendUrl}/api`;
      }
      console.log('🌐 [API] PRIORITY 4: Using backend from app config:', `${configBase}/api`);
      return `${configBase}/api`;
    }
    
    // Default: If channel/branch is local or build is local, use local backend
    if (isLocalChannel || isLocalBranch || isLocalBuild) {
      console.log('🌐 [API] Default: Local detected (channel:', updateChannel, 'branch:', updateBranch, 'isLocalBuild:', isLocalBuild, ') - using local backend:', `${localBackendUrl}/api`);
      return `${localBackendUrl}/api`;
    }
    
    console.log('🌐 [API] Default: Using cloud backend:', `${cloudBackendUrl}/api`);
    return `${cloudBackendUrl}/api`;
  } catch (error) {
    console.error('❌ [API] Error determining base URL:', error);
    // Fallback to local backend if error occurs (safer for local development)
    const fallbackUrl = 'https://homiest-psychopharmacologic-anaya.ngrok-free.dev';
    console.log('🌐 [API] Using fallback local backend due to error:', `${fallbackUrl}/api`);
    return `${fallbackUrl}/api`;
  }
};

// Create axios instance with lazy baseURL initialization
// This ensures Constants and Updates are available when getBaseURL() is called
let baseURL = null;
const getBaseURLLazy = () => {
  if (!baseURL) {
    baseURL = getBaseURL();
  }
  return baseURL;
};

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
    // Set baseURL on first request (lazy initialization)
    if (!config.baseURL || config.baseURL === '') {
      config.baseURL = getBaseURLLazy();
    }
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

