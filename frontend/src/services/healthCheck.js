import { api } from './api';

/**
 * Health Check Service
 * Periodically pings the backend to keep it warm and prevent cold starts
 */

const HEALTH_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds
let healthCheckInterval = null;

/**
 * Ping the backend health endpoint
 */
const pingBackend = async () => {
  try {
    const response = await api.get('/health');
    console.log('✅ Health check ping successful:', response.data?.message || 'OK');
    return true;
  } catch (error) {
    console.warn('⚠️ Health check ping failed:', error.message);
    return false;
  }
};

/**
 * Start the health check service
 * Pings the backend every 5 minutes to keep it warm
 */
export const startHealthCheck = () => {
  // Don't start multiple intervals
  if (healthCheckInterval) {
    console.log('Health check service already running');
    return;
  }

  console.log('🏥 Starting health check service (ping every 5 minutes)');
  
  // Ping immediately on start
  pingBackend();

  // Then ping every 5 minutes
  healthCheckInterval = setInterval(() => {
    pingBackend();
  }, HEALTH_CHECK_INTERVAL);
};

/**
 * Stop the health check service
 */
export const stopHealthCheck = () => {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
    console.log('🏥 Health check service stopped');
  }
};

/**
 * Check if the health check service is running
 */
export const isHealthCheckRunning = () => {
  return healthCheckInterval !== null;
};
