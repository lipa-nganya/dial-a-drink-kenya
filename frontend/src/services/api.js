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
  return 'http://localhost:4001/api';
};

// Use local backend for development, Render backend for production
const API_BASE_URL = window.location.hostname.includes('onrender.com') 
  ? 'https://dialadrink-backend.onrender.com/api'
  : 'http://localhost:4001/api';

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
    // Add any auth tokens here if needed
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
      // Handle unauthorized access
      console.error('Unauthorized access');
    }
    return Promise.reject(error);
  }
);

export { api };
