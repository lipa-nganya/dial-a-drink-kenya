import axios from 'axios';

const DEFAULT_LOCAL_API_BASE = 'http://localhost:5001/api';
const DEFAULT_PRODUCTION_API_BASE = process.env.REACT_APP_PRODUCTION_API_BASE || 'https://deliveryos-backend-805803410802.us-central1.run.app/api';

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

  // Production sites (check FIRST before other checks)
  // These are production customer-facing sites that should use the new production backend
  if (hostname === 'ruakadrinksdelivery.co.ke' || 
      hostname === 'www.ruakadrinksdelivery.co.ke' ||
      hostname.includes('ruakadrinksdelivery.co.ke') ||
      hostname === 'drinksdeliverykenya.com' ||
      hostname === 'www.drinksdeliverykenya.com' ||
      hostname.includes('drinksdeliverykenya.com')) {
    // Production sites - use production backend
    return { url: 'https://deliveryos-backend-805803410802.us-central1.run.app/api', source: 'production-site' };
  }

  // Netlify deployments
  // Distinguish between development and production Netlify sites
  const isNetlify = hostname.includes('thewolfgang.tech') || hostname.includes('netlify.app');
  if (isNetlify) {
    // Development site: dialadrink.thewolfgang.tech (uses dev backend on project 910510650031)
    const isDevSite = hostname.includes('dialadrink.thewolfgang.tech') || hostname.includes('dialadrink-admin.thewolfgang.tech');
    if (isDevSite) {
      // Use development backend
      return { url: DEFAULT_PRODUCTION_API_BASE, source: 'netlify-dev' };
    } else {
      // Production Netlify site - use production backend
      return { url: 'https://deliveryos-backend-805803410802.us-central1.run.app/api', source: 'netlify-prod-forced' };
    }
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
  // But only if NOT running locally (already handled above)
  const explicitUrl = process.env.REACT_APP_API_URL;
  if (explicitUrl) {
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
    'Content-Type': 'application/json',
  },
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
  console.log('=== API CONFIGURATION ===');
  // eslint-disable-next-line no-console
  console.log('API_BASE_URL:', getApiBaseUrl());
  // eslint-disable-next-line no-console
  const { source: apiSource } = resolveApiBaseUrl();
  // eslint-disable-next-line no-console
  console.log('API source:', apiSource);
  // eslint-disable-next-line no-console
  console.log('Hostname:', window.location.hostname);
  // Note: REACT_APP_API_URL is ignored for Netlify deployments
  // eslint-disable-next-line no-console
  console.log('========================');
}

// Second interceptor - add auth token
api.interceptors.request.use(
  (config) => {
    // baseURL should already be set by the first interceptor
    const adminToken = localStorage.getItem('adminToken');
    if (adminToken) {
      config.headers.Authorization = `Bearer ${adminToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (error.config?.url?.includes('/admin/')) {
        console.error('Unauthorized access - admin token may be invalid');
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUser');
        if (window.location.pathname.startsWith('/admin')) {
          window.location.href = '/admin/login';
        }
      } else {
        console.error('Unauthorized access');
      }
    }
    return Promise.reject(error);
  }
);

export { api };
