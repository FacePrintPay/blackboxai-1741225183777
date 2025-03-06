const express = require('express');
const router = express.Router();
const axios = require('axios');
const NodeCache = require('node-cache');
const config = require('../config/config');
const { APIError, asyncHandler } = require('../middleware/errorHandler');

// Initialize cache
const cache = new NodeCache({
    stdTTL: config.cache.stdTTL,
    checkperiod: config.cache.checkperiod
});

// Helper function to format weather data
const formatWeatherData = (data) => {
    return {
        location: {
            city: data.name,
            country: data.sys.country,
            coordinates: {
                lat: data.coord.lat,
                lon: data.coord.lon
            }
        },
        weather: {
            main: data.weather[0].main,
            description: data.weather[0].description,
            icon: `http://openweathermap.org/img/w/${data.weather[0].icon}.png`
        },
        temperature: {
            current: Math.round(data.main.temp),
            feelsLike: Math.round(data.main.feels_like),
            min: Math.round(data.main.temp_min),
            max: Math.round(data.main.temp_max)
        },
        humidity: data.main.humidity,
        wind: {
            speed: data.wind.speed,
            direction: data.wind.deg
        },
        clouds: data.clouds.all,
        timestamp: new Date(data.dt * 1000)
    };
};

// Helper function to generate cache key
const generateCacheKey = (query) => {
    return `weather:${query.toLowerCase()}`;
};

// GET /api/weather - Get weather data by city or coordinates
router.get('/', asyncHandler(async (req, res) => {
    const { city, lat, lon } = req.query;

    // Validate input
    if (!city && (!lat || !lon)) {
        throw new APIError('City name or coordinates (lat/lon) are required', 400);
    }

    // Generate cache key based on query parameters
    const cacheKey = city 
        ? generateCacheKey(city)
        : generateCacheKey(`${lat},${lon}`);

    // Check cache first
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
        return res.json({
            success: true,
            cached: true,
            data: cachedData
        });
    }

    // Build API URL
    let url = 'https://api.openweathermap.org/data/2.5/weather';
    const params = {
        appid: config.weather.apiKey,
        units: 'metric' // Use metric units
    };

    if (city) {
        params.q = city;
    } else {
        params.lat = lat;
        params.lon = lon;
    }

    try {
        // Make API request
        const response = await axios.get(url, { params });
        
        // Format weather data
        const weatherData = formatWeatherData(response.data);

        // Store in cache
        cache.set(cacheKey, weatherData);

        // Return formatted data
        res.json({
            success: true,
            cached: false,
            data: weatherData
        });
    } catch (error) {
        if (error.response) {
            // OpenWeatherMap API error
            if (error.response.status === 404) {
                throw new APIError('Location not found', 404);
            }
            if (error.response.status === 401) {
                throw new APIError('Invalid API key', 401);
            }
            throw new APIError(
                error.response.data.message || 'Weather service error',
                error.response.status
            );
        }
        throw error;
    }
}));

// GET /api/weather/forecast - Get 5-day weather forecast
router.get('/forecast', asyncHandler(async (req, res) => {
    const { city, lat, lon } = req.query;

    // Validate input
    if (!city && (!lat || !lon)) {
        throw new APIError('City name or coordinates (lat/lon) are required', 400);
    }

    // Generate cache key
    const cacheKey = city 
        ? generateCacheKey(`forecast:${city}`)
        : generateCacheKey(`forecast:${lat},${lon}`);

    // Check cache
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
        return res.json({
            success: true,
            cached: true,
            data: cachedData
        });
    }

    // Build API URL
    let url = 'https://api.openweathermap.org/data/2.5/forecast';
    const params = {
        appid: config.weather.apiKey,
        units: 'metric'
    };

    if (city) {
        params.q = city;
    } else {
        params.lat = lat;
        params.lon = lon;
    }

    try {
        // Make API request
        const response = await axios.get(url, { params });
        
        // Format forecast data
        const forecastData = {
            location: {
                city: response.data.city.name,
                country: response.data.city.country,
                coordinates: {
                    lat: response.data.city.coord.lat,
                    lon: response.data.city.coord.lon
                }
            },
            forecast: response.data.list.map(item => ({
                timestamp: new Date(item.dt * 1000),
                temperature: {
                    current: Math.round(item.main.temp),
                    feelsLike: Math.round(item.main.feels_like),
                    min: Math.round(item.main.temp_min),
                    max: Math.round(item.main.temp_max)
                },
                weather: {
                    main: item.weather[0].main,
                    description: item.weather[0].description,
                    icon: `http://openweathermap.org/img/w/${item.weather[0].icon}.png`
                },
                humidity: item.main.humidity,
                wind: {
                    speed: item.wind.speed,
                    direction: item.wind.deg
                },
                clouds: item.clouds.all
            }))
        };

        // Store in cache
        cache.set(cacheKey, forecastData);

        // Return formatted data
        res.json({
            success: true,
            cached: false,
            data: forecastData
        });
    } catch (error) {
        if (error.response) {
            if (error.response.status === 404) {
                throw new APIError('Location not found', 404);
            }
            if (error.response.status === 401) {
                throw new APIError('Invalid API key', 401);
            }
            throw new APIError(
                error.response.data.message || 'Weather service error',
                error.response.status
            );
        }
        throw error;
    }
}));

// GET /api/weather/cache/clear - Clear weather cache (admin only)
router.get('/cache/clear', asyncHandler(async (req, res) => {
    // Clear all cache
    cache.flushAll();
    
    res.json({
        success: true,
        message: 'Weather cache cleared successfully'
    });
}));

module.exports = router;
