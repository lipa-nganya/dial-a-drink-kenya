import axios from 'axios';

const DEFAULT_LOCAL_API_BASE = 'http://localhost:5001/api/zeus/v1';
const DEFAULT_PRODUCTION_API_BASE = process.env.REACT_APP_ZEUS_API_URL || 'https://dialadrink-backend-910510650031.us-central1.run.app/api/zeus/v1';

const resolveApiBaseUrl = () => {
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const isLocalHost = ['localhost', '127.0.0.1'].includes(hostname) || hostname.endsWith('.local');
  const isLanHost = /^10\.|^192\.168\.|^172\.(1[6-9]|2[0-9]|3[0-1])/.test(hostname || '');
  
  if (isLocalHost || isLanHost) {
    return DEFAULT_LOCAL_API_BASE;
  }

  const explicitUrl = process.env.REACT_APP_ZEUS_API_URL;
  if (explicitUrl) {
    return explicitUrl;
  }

  return DEFAULT_PRODUCTION_API_BASE;
};

const api = axios.create({
  baseURL: '',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Set baseURL at request time
api.interceptors.request.use((config) => {
  config.baseURL = resolveApiBaseUrl();
  return config;
}, (error) => Promise.reject(error));

// Add auth token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('zeusToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('zeusToken');
      localStorage.removeItem('zeusAdmin');
      const currentPath = window.location.pathname;
      if (!currentPath.includes('/login')) {
        window.location.replace('/login');
      }
    }
    return Promise.reject(error);
  }
);

export { api };







