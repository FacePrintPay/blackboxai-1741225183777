const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { APIError, asyncHandler } = require('../middleware/errorHandler');
const config = require('../config/config');

// In-memory storage for payment records (replace with database in production)
const payments = new Map();

// Simulate payment processing with a delay
const processPayment = async (amount, currency, paymentMethod) => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            // Simulate payment success/failure (90% success rate)
            const success = Math.random() < 0.9;
            
            if (success) {
                resolve({
                    id: Date.now().toString(),
                    amount,
                    currency,
                    status: 'succeeded',
                    paymentMethod,
                    processingFee: amount * 0.029 + 0.30, // Simulate 2.9% + $0.30 fee
                    timestamp: new Date()
                });
            } else {
                reject(new Error('Payment processing failed'));
            }
        }, 1000); // Simulate network delay
    });
};

// POST /api/payment/create - Create a payment intent
router.post('/create', auth, asyncHandler(async (req, res) => {
    const { amount, currency = 'USD', paymentMethod } = req.body;

    // Validate input
    if (!amount || amount <= 0) {
        throw new APIError('Valid amount is required', 400);
    }

    if (!paymentMethod) {
        throw new APIError('Payment method is required', 400);
    }

    // Create payment record
    const payment = {
        id: Date.now().toString(),
        userId: req.user.id,
        amount,
        currency,
        paymentMethod,
        status: 'pending',
        createdAt: new Date()
    };

    // Store payment record
    payments.set(payment.id, payment);

    res.status(201).json({
        success: true,
        data: {
            paymentId: payment.id,
            amount,
            currency,
            status: payment.status
        }
    });
}));

// POST /api/payment/process/:id - Process a payment
router.post('/process/:id', auth, asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    // Get payment record
    const payment = payments.get(id);
    if (!payment) {
        throw new APIError('Payment not found', 404);
    }

    // Verify user owns this payment
    if (payment.userId !== req.user.id) {
        throw new APIError('Unauthorized', 403);
    }

    // Check if payment can be processed
    if (payment.status !== 'pending') {
        throw new APIError(`Payment cannot be processed (status: ${payment.status})`, 400);
    }

    try {
        // Process payment
        const result = await processPayment(
            payment.amount,
            payment.currency,
            payment.paymentMethod
        );

        // Update payment record
        const updatedPayment = {
            ...payment,
            status: result.status,
            processingFee: result.processingFee,
            processedAt: result.timestamp,
            updatedAt: new Date()
        };

        payments.set(id, updatedPayment);

        res.json({
            success: true,
            data: {
                paymentId: id,
                amount: payment.amount,
                currency: payment.currency,
                status: result.status,
                processingFee: result.processingFee,
                timestamp: result.timestamp
            }
        });
    } catch (error) {
        // Update payment record with failed status
        const failedPayment = {
            ...payment,
            status: 'failed',
            error: error.message,
            updatedAt: new Date()
        };

        payments.set(id, failedPayment);

        throw new APIError('Payment processing failed', 400);
    }
}));

// GET /api/payment/:id - Get payment details
router.get('/:id', auth, asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    const payment = payments.get(id);
    if (!payment) {
        throw new APIError('Payment not found', 404);
    }

    // Verify user owns this payment
    if (payment.userId !== req.user.id) {
        throw new APIError('Unauthorized', 403);
    }

    res.json({
        success: true,
        data: payment
    });
}));

// GET /api/payment/user/history - Get user's payment history
router.get('/user/history', auth, asyncHandler(async (req, res) => {
    // Filter payments for user
    const userPayments = Array.from(payments.values())
        .filter(payment => payment.userId === req.user.id)
        .sort((a, b) => b.createdAt - a.createdAt);

    res.json({
        success: true,
        data: {
            payments: userPayments
        }
    });
}));

// POST /api/payment/:id/refund - Refund a payment
router.post('/:id/refund', auth, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { amount, reason } = req.body;

    const payment = payments.get(id);
    if (!payment) {
        throw new APIError('Payment not found', 404);
    }

    // Verify user owns this payment
    if (payment.userId !== req.user.id) {
        throw new APIError('Unauthorized', 403);
    }

    // Check if payment can be refunded
    if (payment.status !== 'succeeded') {
        throw new APIError('Only succeeded payments can be refunded', 400);
    }

    if (payment.refunded) {
        throw new APIError('Payment has already been refunded', 400);
    }

    // Validate refund amount
    const refundAmount = amount || payment.amount;
    if (refundAmount > payment.amount) {
        throw new APIError('Refund amount cannot exceed payment amount', 400);
    }

    // Process refund (simulate with delay)
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Update payment record with refund information
    const updatedPayment = {
        ...payment,
        refunded: true,
        refundAmount,
        refundReason: reason,
        refundedAt: new Date(),
        status: 'refunded',
        updatedAt: new Date()
    };

    payments.set(id, updatedPayment);

    res.json({
        success: true,
        data: {
            paymentId: id,
            refundAmount,
            status: 'refunded',
            timestamp: updatedPayment.refundedAt
        }
    });
}));

// POST /api/payment/webhook - Handle payment webhooks
router.post('/webhook', asyncHandler(async (req, res) => {
    const event = req.body;

    // Verify webhook signature (implementation depends on payment provider)
    // This is a simplified example
    if (!event || !event.type) {
        throw new APIError('Invalid webhook payload', 400);
    }

    // Process different event types
    switch (event.type) {
        case 'payment.succeeded':
            console.log('Payment succeeded:', event.data);
            break;
        case 'payment.failed':
            console.log('Payment failed:', event.data);
            break;
        case 'refund.succeeded':
            console.log('Refund succeeded:', event.data);
            break;
        default:
            console.log('Unhandled event type:', event.type);
    }

    res.json({ received: true });
}));

module.exports = router;
