/**
 * Standardized API Response Helper
 * All backend responses should use this format for consistency with the Android app
 */

/**
 * Send a successful response
 * @param {Response} res - Express response object
 * @param {*} data - Response data
 * @param {string} message - Optional success message
 * @param {number} statusCode - HTTP status code (default: 200)
 */
function sendSuccess(res, data, message = null, statusCode = 200) {
  // CRITICAL: Ensure Content-Type is set correctly and data is not double-serialized
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  
  const response = {
    success: true,
    data: data
  };
  
  if (message) {
    response.message = message;
  }
  
  // Use res.json() - Express handles JSON serialization automatically
  // DO NOT call JSON.stringify() here - that would cause double-serialization
  return res.status(statusCode).json(response);
}

/**
 * Send an error response
 * @param {Response} res - Express response object
 * @param {string} error - Error message
 * @param {number} statusCode - HTTP status code (default: 400)
 */
function sendError(res, error, statusCode = 400) {
  return res.status(statusCode).json({
    success: false,
    error: error
  });
}

module.exports = {
  sendSuccess,
  sendError
};
