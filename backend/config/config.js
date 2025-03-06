require('dotenv').config();

module.exports = {
    // Server configuration
    server: {
        port: process.env.PORT || 3000,
        env: process.env.NODE_ENV || 'development'
    },

    // JWT configuration
    jwt: {
        secret: process.env.JWT_SECRET || 'your-secret-key',
        expiresIn: '24h'
    },

    // File upload configuration
    upload: {
        maxSize: 5 * 1024 * 1024, // 5MB
        allowedTypes: ['image/jpeg', 'image/png', 'application/pdf']
    },

    // Weather API configuration
    weather: {
        apiKey: process.env.WEATHER_API_KEY,
        cacheTime: 30 * 60 // 30 minutes in seconds
    },

    // Elasticsearch configuration
    elasticsearch: {
        node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
        auth: {
            username: process.env.ELASTICSEARCH_USERNAME,
            password: process.env.ELASTICSEARCH_PASSWORD
        }
    },

    // ArXiv API configuration
    arxiv: {
        baseUrl: 'http://export.arxiv.org/api/query',
        maxResults: 25,
        sortBy: 'lastUpdatedDate',
        sortOrder: 'descending'
    },

    // Payment gateway configuration (example for Stripe)
    payment: {
        stripeSecretKey: process.env.STRIPE_SECRET_KEY,
        webhookSecret: process.env.STRIPE_WEBHOOK_SECRET
    },

    // Cache configuration
    cache: {
        stdTTL: 600, // Time to live in seconds (10 minutes)
        checkperiod: 120 // Cleanup expired keys every 2 minutes
    },

    // CORS configuration
    cors: {
        origin: process.env.CORS_ORIGIN || '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization']
    }
};
