import axios from 'axios';

const DEFAULT_LOCAL_API_BASE = 'http://localhost:5001/api';
const DEFAULT_PRODUCTION_API_BASE = process.env.REACT_APP_PRODUCTION_API_BASE || 'https://dialadrink-backend-910510650031.us-central1.run.app/api';

const resolveApiBaseUrl = () => {
  const explicitUrl = process.env.REACT_APP_API_URL;
  if (explicitUrl) {
    return { url: explicitUrl, source: 'env' };
  }

  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const isLocalHost = ['localhost', '127.0.0.1'].includes(hostname) || hostname.endsWith('.local');
  const isLanHost = /^10\.|^192\.168\.|^172\.(1[6-9]|2[0-9]|3[0-1])/.test(hostname || '');

  if (isLocalHost || isLanHost || process.env.NODE_ENV === 'development') {
    return { url: DEFAULT_LOCAL_API_BASE, source: 'local-default' };
  }

  const isManagedHost = hostname.includes('onrender.com') || hostname.includes('run.app');
  if (isManagedHost) {
    return { url: DEFAULT_PRODUCTION_API_BASE, source: 'managed-host' };
  }

  return { url: DEFAULT_PRODUCTION_API_BASE, source: 'fallback-production' };
};

const { url: API_BASE_URL, source: apiSource } = resolveApiBaseUrl();

if (typeof window !== 'undefined') {
  // eslint-disable-next-line no-console
  console.log('=== API CONFIGURATION ===');
  // eslint-disable-next-line no-console
  console.log('API_BASE_URL:', API_BASE_URL);
  // eslint-disable-next-line no-console
  console.log('API source:', apiSource);
  // eslint-disable-next-line no-console
  console.log('REACT_APP_API_URL:', process.env.REACT_APP_API_URL);
  // eslint-disable-next-line no-console
  console.log('Hostname:', window.location.hostname);
  // eslint-disable-next-line no-console
  console.log('========================');
}

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
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
