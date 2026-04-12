const jwt = require('jsonwebtoken');
const config = require('../config/config');
const { APIError } = require('./errorHandler');

/**
 * Authentication middleware
 * Verifies JWT tokens and attaches user data to request
 */

const auth = async (req, res, next) => {
    try {
        // Get token from header
        const authHeader = req.headers.authorization;
        
        if (!authHeader) {
            throw new APIError('No authentication token provided', 401);
        }

        // Check if token format is valid
        if (!authHeader.startsWith('Bearer ')) {
            throw new APIError('Invalid token format', 401);
        }

        // Extract token
        const token = authHeader.split(' ')[1];

        try {
            // Verify token
            const decoded = jwt.verify(token, config.jwt.secret);
            
            // Attach user data to request
            req.user = decoded;
            
            next();
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                throw new APIError('Token has expired', 401);
            }
            if (error.name === 'JsonWebTokenError') {
                throw new APIError('Invalid token', 401);
            }
            throw error;
        }
    } catch (error) {
        next(error);
    }
};

/**
 * Role-based authorization middleware
 * Checks if authenticated user has required role
 */
const authorize = (roles = []) => {
    if (typeof roles === 'string') {
        roles = [roles];
    }

    return (req, res, next) => {
        if (!req.user) {
            throw new APIError('User not authenticated', 401);
        }

        if (roles.length && !roles.includes(req.user.role)) {
            throw new APIError('Unauthorized - Insufficient permissions', 403);
        }

        next();
    };
};

/**
 * Optional authentication middleware
 * Attaches user data if token is present but doesn't require it
 */
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next();
        }

        const token = authHeader.split(' ')[1];

        try {
            const decoded = jwt.verify(token, config.jwt.secret);
            req.user = decoded;
        } catch (error) {
            // Ignore token verification errors for optional auth
            console.warn('Optional auth token verification failed:', error.message);
        }

        next();
    } catch (error) {
        next(error);
    }
};

module.exports = {
    auth,
    authorize,
    optionalAuth
};
