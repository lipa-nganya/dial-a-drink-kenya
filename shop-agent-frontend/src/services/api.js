import axios from 'axios';

const DEFAULT_LOCAL_API_BASE = 'http://localhost:5001/api';
const DEFAULT_PRODUCTION_API_BASE = process.env.REACT_APP_API_URL || 'https://deliveryos-backend-p6bkgryxqa-uc.a.run.app/api';

const resolveApiBaseUrl = () => {
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const isLocalHost = ['localhost', '127.0.0.1'].includes(hostname) || hostname.endsWith('.local');
  const isLanHost = /^10\.|^192\.168\.|^172\.(1[6-9]|2[0-9]|3[0-1])/.test(hostname || '');
  
  if (isLocalHost || isLanHost) {
    return { url: DEFAULT_LOCAL_API_BASE, source: 'local-hostname' };
  }

  const explicitUrl = process.env.REACT_APP_API_URL;
  if (explicitUrl) {
    return { url: explicitUrl, source: 'env-explicit' };
  }

  return { url: DEFAULT_PRODUCTION_API_BASE, source: 'fallback-production' };
};

const getApiBaseUrl = () => {
  const { url } = resolveApiBaseUrl();
  return url;
};

const api = axios.create({
  baseURL: '',
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use((config) => {
  const apiBaseUrl = getApiBaseUrl();
  config.baseURL = apiBaseUrl;
  return config;
}, (error) => Promise.reject(error));

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('shopAgentToken');
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
      localStorage.removeItem('shopAgentToken');
      localStorage.removeItem('shopAgentUser');
      const currentPath = window.location.pathname;
      if (!currentPath.includes('/setup-pin') && !currentPath.includes('/login')) {
        window.location.replace('/login');
      }
    }
    return Promise.reject(error);
  }
);

export { api };


