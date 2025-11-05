import axios from 'axios';

// Determine API URL based on environment
const getApiUrl = () => {
  // If environment variable is set, use it
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  
  // If we're on Render frontend, use Render backend
  if (window.location.hostname.includes('onrender.com')) {
    return 'https://dialadrink-backend.onrender.com/api';
  }
  
  // Default to local development
  return 'http://localhost:5001/api';
};

// Use local backend for development, Render backend for production
const API_BASE_URL = window.location.hostname.includes('onrender.com') 
  ? 'https://dialadrink-backend.onrender.com/api'
  : 'http://localhost:5001/api';

// Debug logging
console.log('=== API CONFIGURATION ===');
console.log('API_BASE_URL:', API_BASE_URL);
console.log('REACT_APP_API_URL:', process.env.REACT_APP_API_URL);
console.log('Current hostname:', window.location.hostname);
console.log('Version: 3.0 - Dynamic URL based on hostname');
console.log('========================');

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add admin token if available
    const adminToken = localStorage.getItem('adminToken');
    if (adminToken) {
      config.headers.Authorization = `Bearer ${adminToken}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized access - clear token if it's an admin route
      if (error.config?.url?.includes('/admin/')) {
        console.error('Unauthorized access - admin token may be invalid');
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUser');
        // Redirect to admin login if on an admin page
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
