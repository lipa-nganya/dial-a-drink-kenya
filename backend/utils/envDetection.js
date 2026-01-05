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
  // CRITICAL: If NODE_ENV is explicitly set to 'development', always use development config
  // This prevents local from accidentally using production database
  if (process.env.NODE_ENV === 'development') {
    return 'development';
  }
  
  const env = getEnvironment();
  
  // If DATABASE_URL is set and we're in production/cloud, use cloud-dev config
  if (process.env.DATABASE_URL && isProduction()) {
    return 'cloud-dev';
  }
  
  // If NODE_ENV is explicitly set to 'production', use production config
  if (process.env.NODE_ENV === 'production') {
    return 'production';
  }
  
  // Default to development for local (when NODE_ENV is not set or is undefined)
  return 'development';
}

module.exports = {
  isCloudRun,
  isProduction,
  isLocal,
  getEnvironment,
  getDatabaseConfigName
};

