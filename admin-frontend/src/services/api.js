import axios from 'axios';

const DEFAULT_LOCAL_API_BASE = 'http://localhost:5001/api';
const DEFAULT_PRODUCTION_API_BASE = process.env.REACT_APP_PRODUCTION_API_BASE || 'https://dialadrink-backend-910510650031.us-central1.run.app/api';

const resolveApiBaseUrl = () => {
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const isLocalHost = ['localhost', '127.0.0.1'].includes(hostname) || hostname.endsWith('.local');
  const isLanHost = /^10\.|^192\.168\.|^172\.(1[6-9]|2[0-9]|3[0-1])/.test(hostname || '');
  
  // CRITICAL: Always use localhost when running locally, regardless of REACT_APP_API_URL
  // This ensures local development always works, even if REACT_APP_API_URL is set for cloud-dev
  if (isLocalHost || isLanHost) {
    return { url: DEFAULT_LOCAL_API_BASE, source: 'local-hostname' };
  }

  // For cloud-dev deployments (run.app, onrender.com, etc.), use REACT_APP_API_URL if set
  const isManagedHost = hostname.includes('onrender.com') || hostname.includes('run.app');
  if (isManagedHost) {
    const explicitUrl = process.env.REACT_APP_API_URL;
    if (explicitUrl) {
      return { url: explicitUrl, source: 'cloud-dev-env' };
    }
    return { url: DEFAULT_PRODUCTION_API_BASE, source: 'cloud-dev-default' };
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

const { url: API_BASE_URL, source: apiSource } = resolveApiBaseUrl();

if (typeof window !== 'undefined') {
  // eslint-disable-next-line no-console
  console.log('=== ADMIN API CONFIGURATION ===');
  // eslint-disable-next-line no-console
  console.log('API_BASE_URL:', API_BASE_URL);
  // eslint-disable-next-line no-console
  console.log('API source:', apiSource);
  // eslint-disable-next-line no-console
  console.log('REACT_APP_API_URL:', process.env.REACT_APP_API_URL);
  // eslint-disable-next-line no-console
  console.log('Hostname:', window.location.hostname);
  // eslint-disable-next-line no-console
  console.log('==============================');
}

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

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

