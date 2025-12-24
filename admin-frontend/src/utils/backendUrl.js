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
  
  // Production backend URL (used for all hosted environments)
  return 'https://deliveryos-backend-p6bkgryxqa-uc.a.run.app';
};

/**
 * Get the backend API base URL (with /api suffix)
 */
export const getBackendApiUrl = () => {
  return `${getBackendUrl()}/api`;
};










