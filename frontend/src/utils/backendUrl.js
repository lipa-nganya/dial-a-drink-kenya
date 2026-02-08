/**
 * Utility to get the backend URL based on the current hostname
 * This ensures consistent backend URL detection across the app
 */
export const getBackendUrl = () => {
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  
  // Local development
  const isLocalHost = ['localhost', '127.0.0.1'].includes(hostname) || hostname.endsWith('.local');
  const isLanHost = /^10\.|^192\.168\.|^172\.(1[6-9]|2[0-9]|3[0-1])/.test(hostname || '');
  
  if (isLocalHost || isLanHost) {
    return 'http://localhost:5001';
  }
  
  // Production sites (ruakadrinksdelivery.co.ke, drinksdeliverykenya.com)
  const isProductionSite = 
    hostname.includes('ruakadrinksdelivery.co.ke') ||
    hostname.includes('drinksdeliverykenya.com');
  if (isProductionSite) {
    return 'https://deliveryos-production-backend-805803410802.us-central1.run.app';
  }
  
  // Development sites (thewolfgang.tech)
  const isDevSite = hostname.includes('thewolfgang.tech');
  if (isDevSite) {
    return 'https://deliveryos-development-backend-lssctajjoq-uc.a.run.app';
  }
  
  // Fallback: Production backend URL (used for other hosted environments)
  return 'https://deliveryos-production-backend-805803410802.us-central1.run.app';
};

/**
 * Get the backend API base URL (with /api suffix)
 */
export const getBackendApiUrl = () => {
  return `${getBackendUrl()}/api`;
};














