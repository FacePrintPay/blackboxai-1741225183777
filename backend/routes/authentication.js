const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const config = require('../config/config');
const { APIError, asyncHandler } = require('../middleware/errorHandler');

// In-memory user storage (replace with database in production)
const users = new Map();

// Helper function to generate JWT token
const generateToken = (user) => {
    return jwt.sign(
        { 
            id: user.id, 
            email: user.email,
            role: user.role 
        },
        config.jwt.secret,
        { expiresIn: config.jwt.expiresIn }
    );
};

// Validate email format
const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

// Validate password strength
const isValidPassword = (password) => {
    return password.length >= 8 && // at least 8 characters
           /[A-Z]/.test(password) && // at least one uppercase letter
           /[a-z]/.test(password) && // at least one lowercase letter
           /[0-9]/.test(password) && // at least one number
           /[^A-Za-z0-9]/.test(password); // at least one special character
};

// POST /api/auth/register - User registration
router.post('/register', asyncHandler(async (req, res) => {
    const { email, password, name } = req.body;

    // Validate input
    if (!email || !password || !name) {
        throw new APIError('Email, password, and name are required', 400);
    }

    // Validate email format
    if (!isValidEmail(email)) {
        throw new APIError('Invalid email format', 400);
    }

    // Validate password strength
    if (!isValidPassword(password)) {
        throw new APIError(
            'Password must be at least 8 characters long and contain uppercase, lowercase, number, and special character',
            400
        );
    }

    // Check if user already exists
    if (users.has(email)) {
        throw new APIError('User already exists', 409);
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user object
    const user = {
        id: Date.now().toString(),
        email,
        name,
        password: hashedPassword,
        role: 'user',
        createdAt: new Date(),
        updatedAt: new Date()
    };

    // Store user
    users.set(email, user);

    // Generate token
    const token = generateToken(user);

    // Return user data and token
    res.status(201).json({
        success: true,
        data: {
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role
            },
            token
        }
    });
}));

// POST /api/auth/login - User login
router.post('/login', asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
        throw new APIError('Email and password are required', 400);
    }

    // Check if user exists
    const user = users.get(email);
    if (!user) {
        throw new APIError('Invalid credentials', 401);
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
        throw new APIError('Invalid credentials', 401);
    }

    // Generate token
    const token = generateToken(user);

    // Return user data and token
    res.json({
        success: true,
        data: {
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role
            },
            token
        }
    });
}));

// GET /api/auth/me - Get current user profile
router.get('/me', asyncHandler(async (req, res) => {
    // This route will be protected by auth middleware
    const user = users.get(req.user.email);
    
    if (!user) {
        throw new APIError('User not found', 404);
    }

    res.json({
        success: true,
        data: {
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role
            }
        }
    });
}));

// PUT /api/auth/change-password - Change password
router.put('/change-password', asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword) {
        throw new APIError('Current password and new password are required', 400);
    }

    // Validate new password strength
    if (!isValidPassword(newPassword)) {
        throw new APIError(
            'New password must be at least 8 characters long and contain uppercase, lowercase, number, and special character',
            400
        );
    }

    // Get user
    const user = users.get(req.user.email);
    if (!user) {
        throw new APIError('User not found', 404);
    }

    // Verify current password
    const isValidCurrentPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidCurrentPassword) {
        throw new APIError('Current password is incorrect', 401);
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    user.password = hashedPassword;
    user.updatedAt = new Date();
    users.set(req.user.email, user);

    res.json({
        success: true,
        message: 'Password updated successfully'
    });
}));

module.exports = router;
