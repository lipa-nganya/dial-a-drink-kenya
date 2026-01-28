/**
 * Environment detection utility
 * Properly detects if running locally, in Cloud Run, or other environments
 */

/**
 * Check if running in Cloud Run
 */
function isCloudRun() {
  return !!(process.env.K_SERVICE || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT);
}

/**
 * Check if running in production (Cloud Run or Render)
 */
function isProduction() {
  // Explicit production flag
  if (process.env.NODE_ENV === 'production') {
    return true;
  }
  
  // Cloud Run is always production
  if (isCloudRun()) {
    return true;
  }
  
  // Render is production
  if (process.env.RENDER) {
    return true;
  }
  
  return false;
}

/**
 * Check if running locally (development)
 */
function isLocal() {
  return !isProduction();
}

/**
 * Get the current environment name
 * Returns: 'development', 'cloud-dev', or 'production'
 */
function getEnvironment() {
  if (isCloudRun()) {
    // Cloud Run can be 'cloud-dev' or 'production' based on NODE_ENV
    return process.env.NODE_ENV === 'production' ? 'production' : 'cloud-dev';
  }
  
  if (process.env.RENDER) {
    return 'production';
  }
  
  // Default to development for local
  return 'development';
}

/**
 * Get database config name to use
 * This matches the keys in config.js
 */
function getDatabaseConfigName() {
  // CRITICAL: If we're in Cloud Run, always use cloud-dev or production config (not development)
  // This ensures DATABASE_URL is used instead of localhost fallback
  if (isCloudRun()) {
    // If DATABASE_URL is set, use production or cloud-dev config
    if (process.env.DATABASE_URL) {
      return process.env.NODE_ENV === 'production' ? 'production' : 'cloud-dev';
    }
    // Fallback to production config if DATABASE_URL not set
    return 'production';
  }

  // Outside Cloud Run:
  // If a DATABASE_URL is present, prefer cloud-dev so we never fall back to localhost
  if (process.env.DATABASE_URL) {
    return 'cloud-dev';
  }

  // Explicit production flag
  if (process.env.NODE_ENV === 'production') {
    return 'production';
  }

  // Local development defaults
  if (process.env.NODE_ENV === 'development' && isLocal()) {
    return 'development';
  }

  if (process.env.DATABASE_URL && isProduction()) {
    return 'cloud-dev';
  }

  return 'development';
}

/**
 * Get redirect URL for payment callbacks
 */
function getRedirectUrl() {
  // Priority 1: Explicit redirect URL
  if (process.env.PESAPAL_REDIRECT_URL) {
    return process.env.PESAPAL_REDIRECT_URL;
  }
  
  // Priority 2: ngrok URL
  const ngrokUrl = process.env.NGROK_URL;
  if (ngrokUrl) {
    return ngrokUrl;
  }
  
  // Priority 3: Production URL (Netlify)
  if (isProduction()) {
    return 'https://dialadrink.thewolfgang.tech';
  }
  
  // Default for local development
  return 'http://localhost:3000';
}

module.exports = {
  isCloudRun,
  isProduction,
  isLocal,
  getEnvironment,
  getDatabaseConfigName,
  getRedirectUrl
};

