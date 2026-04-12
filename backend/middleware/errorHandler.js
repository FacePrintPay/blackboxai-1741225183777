/**
 * Global error handling middleware
 * Processes errors and returns standardized error responses
 */

const config = require('../config/config');

// Custom error class for API errors
class APIError extends Error {
    constructor(message, status = 500, details = null) {
        super(message);
        this.name = 'APIError';
        this.status = status;
        this.details = details;
    }
}

// Error handler middleware
const errorHandler = (err, req, res, next) => {
    // Log error for debugging
    console.error('Error:', {
        message: err.message,
        stack: config.server.env === 'development' ? err.stack : undefined,
        details: err.details
    });

    // Determine if error is a known API error or unknown error
    const isAPIError = err instanceof APIError;
    
    // Set status code
    const statusCode = err.status || 500;

    // Prepare error response
    const errorResponse = {
        error: {
            message: isAPIError ? err.message : 'Internal Server Error',
            status: statusCode,
            ...(err.details && { details: err.details }),
            ...(config.server.env === 'development' && { stack: err.stack })
        }
    };

    // Send error response
    res.status(statusCode).json(errorResponse);
};

// Async handler wrapper to catch promise rejections
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
    errorHandler,
    APIError,
    asyncHandler
};
