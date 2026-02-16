import axios from 'axios';

const DEFAULT_LOCAL_API_BASE = 'http://localhost:5001/api';
const DEFAULT_DEV_API_BASE = 'https://deliveryos-development-backend-805803410802.us-central1.run.app/api';
const DEFAULT_PRODUCTION_API_BASE =
  process.env.REACT_APP_PRODUCTION_API_BASE ||
  'https://deliveryos-production-backend-805803410802.us-central1.run.app/api';

const resolveApiBaseUrl = () => {
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const isLocalHost = ['localhost', '127.0.0.1'].includes(hostname) || hostname.endsWith('.local');
  const isLanHost = /^10\.|^192\.168\.|^172\.(1[6-9]|2[0-9]|3[0-1])/.test(hostname || '');
  
  // CRITICAL: Always use localhost when running locally, regardless of REACT_APP_API_URL
  // This ensures local development always works, even if REACT_APP_API_URL is set for cloud-dev
  if (isLocalHost || isLanHost) {
    return { url: DEFAULT_LOCAL_API_BASE, source: 'local-hostname' };
  }

  // Cloud Run dev deployments (run.app)
  const isCloudRunDev = hostname.includes('run.app');
  if (isCloudRunDev) {
    const explicitUrl = process.env.REACT_APP_API_URL;
    if (explicitUrl) {
      return { url: explicitUrl, source: 'cloud-run-dev-env' };
    }
    return { url: DEFAULT_PRODUCTION_API_BASE, source: 'cloud-run-dev-default' };
  }

  // Production sites (ruakadrinksdelivery.co.ke, drinksdeliverykenya.com)
  const isProductionSite = 
    hostname.includes('ruakadrinksdelivery.co.ke') ||
    hostname.includes('drinksdeliverykenya.com');
  if (isProductionSite) {
    // Production sites always use production backend
    return {
      url: DEFAULT_PRODUCTION_API_BASE,
      source: 'production-site',
    };
  }

  // Netlify deployments
  // Distinguish between development and production Netlify sites
  const isNetlify = hostname.includes('thewolfgang.tech') || hostname.includes('netlify.app');
  if (isNetlify) {
    // Development site: dialadrink.thewolfgang.tech or dialadrink-admin.thewolfgang.tech (uses dev backend)
    const isDevSite =
      hostname.includes('dialadrink.thewolfgang.tech') ||
      hostname.includes('dialadrink-admin.thewolfgang.tech');
    if (isDevSite) {
      // Use development backend
      return { url: DEFAULT_DEV_API_BASE, source: 'netlify-dev' };
    }
    // Production Netlify sites (e.g. dial-a-drink-admin.netlify.app) use production backend
    return {
      url: DEFAULT_PRODUCTION_API_BASE,
      source: 'netlify-prod-forced',
    };
  }

  // Other managed hosts (onrender.com, etc.)
  const isManagedHost = hostname.includes('onrender.com');
  if (isManagedHost) {
    const explicitUrl = process.env.REACT_APP_API_URL;
    if (explicitUrl) {
      return { url: explicitUrl, source: 'managed-host-env' };
    }
    return { url: DEFAULT_PRODUCTION_API_BASE, source: 'managed-host-default' };
  }

  // Fallback: Use REACT_APP_API_URL if set (for other hosted environments)
  // But only if NOT running locally and NOT a production site (already handled above)
  // IMPORTANT: Production sites should NEVER use REACT_APP_API_URL - they must use production backend
  const explicitUrl = process.env.REACT_APP_API_URL;
  if (explicitUrl && !isProductionSite) {
    return { url: explicitUrl, source: 'env-explicit' };
  }

  // Final fallback: production URL
  return { url: DEFAULT_PRODUCTION_API_BASE, source: 'fallback-production' };
};

// CRITICAL: Resolve API URL at runtime, not module load time
// This ensures the hostname is checked when the code runs, not when it's bundled
const getApiBaseUrl = () => {
  const { url } = resolveApiBaseUrl();
  return url;
};

// Create axios instance with empty baseURL - we'll set it in the interceptor
// This prevents baseURL from being evaluated at build time
const api = axios.create({
  baseURL: '', // Empty string - will be set by interceptor
  headers: {
    'Content-Type': 'application/json'
  }
});

// CRITICAL: First interceptor - ALWAYS set baseURL at request time
// This must be the FIRST interceptor to ensure baseURL is always set correctly
api.interceptors.request.use((config) => {
  // Always resolve URL at request time to ensure correct hostname detection
  // This runs on EVERY request, so hostname is always checked at runtime
  const apiBaseUrl = getApiBaseUrl();
  config.baseURL = apiBaseUrl;
  
  // Debug logging in development
  if (typeof window !== 'undefined' && window.location.hostname.includes('thewolfgang.tech')) {
    console.log('[API Interceptor] Setting baseURL to:', apiBaseUrl, 'for request:', config.url);
  }
  
  return config;
}, (error) => Promise.reject(error));

if (typeof window !== 'undefined') {
  // eslint-disable-next-line no-console
  console.log('=== ADMIN API CONFIGURATION ===');
  // eslint-disable-next-line no-console
  console.log('API_BASE_URL:', getApiBaseUrl());
  // eslint-disable-next-line no-console
  const { source: apiSource } = resolveApiBaseUrl();
  // eslint-disable-next-line no-console
  console.log('API source:', apiSource);
  // eslint-disable-next-line no-console
  console.log('REACT_APP_API_URL:', process.env.REACT_APP_API_URL);
  // eslint-disable-next-line no-console
  console.log('Hostname:', window.location.hostname);
  // eslint-disable-next-line no-console
  console.log('==============================');
}

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('adminToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.warn('Unauthorized access - admin token may be invalid or expired');
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminUser');
      // Only redirect if not already on login or setup-password page
      const currentPath = window.location.pathname;
      if (!currentPath.includes('/login') && !currentPath.includes('/setup-password')) {
        // Use replace to avoid adding to history
        window.location.replace('/login');
      }
    }
    return Promise.reject(error);
  }
);

export { api };

