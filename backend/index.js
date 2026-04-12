require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

// Initialize express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Import routes
const arxivRoutes = require('./routes/arxiv');
const graphqlRoutes = require('./routes/graphql');
const weatherRoutes = require('./routes/weather');
const authRoutes = require('./routes/authentication');
const uploadRoutes = require('./routes/upload');
const searchRoutes = require('./routes/search');
const paymentRoutes = require('./routes/payment');

// Mount routes
app.use('/api/arxiv', arxivRoutes);
app.use('/api/graphql', graphqlRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/payment', paymentRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.status || 500).json({
        error: {
            message: err.message || 'Internal Server Error',
            status: err.status || 500
        }
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date() });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Health check available at http://localhost:${PORT}/health`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
    console.error('Unhandled Promise Rejection:', err);
    // In production, you might want to do some cleanup here
    // process.exit(1);
});
