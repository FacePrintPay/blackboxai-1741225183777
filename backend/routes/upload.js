const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { auth } = require('../middleware/auth');
const { APIError, asyncHandler } = require('../middleware/errorHandler');
const config = require('../config/config');

// Configure multer for file upload
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads');
        try {
            await fs.mkdir(uploadDir, { recursive: true });
            cb(null, uploadDir);
        } catch (error) {
            cb(error);
        }
    },
    filename: (req, file, cb) => {
        // Generate unique filename with timestamp and original extension
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
        cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

// File filter function
const fileFilter = (req, file, cb) => {
    // Check if file type is allowed
    if (config.upload.allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new APIError(
            `File type not allowed. Allowed types: ${config.upload.allowedTypes.join(', ')}`,
            400
        ));
    }
};

// Configure multer upload
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: config.upload.maxSize // Max file size in bytes
    }
});

// Helper function to get file metadata
const getFileMetadata = (file) => {
    return {
        filename: file.filename,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        path: `/uploads/${file.filename}`, // Public URL path
        uploadedAt: new Date()
    };
};

// POST /api/upload/single - Upload single file
router.post('/single', 
    auth, // Protect route with authentication
    asyncHandler(async (req, res) => {
        // Use multer upload middleware
        upload.single('file')(req, res, async (err) => {
            if (err) {
                if (err instanceof multer.MulterError) {
                    // Multer error (e.g., file too large)
                    throw new APIError(err.message, 400);
                }
                throw err;
            }

            if (!req.file) {
                throw new APIError('No file uploaded', 400);
            }

            // Return file metadata
            res.status(201).json({
                success: true,
                data: getFileMetadata(req.file)
            });
        });
    })
);

// POST /api/upload/multiple - Upload multiple files
router.post('/multiple',
    auth,
    asyncHandler(async (req, res) => {
        // Use multer upload middleware for multiple files
        upload.array('files', 10)(req, res, async (err) => {
            if (err) {
                if (err instanceof multer.MulterError) {
                    throw new APIError(err.message, 400);
                }
                throw err;
            }

            if (!req.files || req.files.length === 0) {
                throw new APIError('No files uploaded', 400);
            }

            // Return metadata for all uploaded files
            res.status(201).json({
                success: true,
                data: req.files.map(file => getFileMetadata(file))
            });
        });
    })
);

// DELETE /api/upload/:filename - Delete uploaded file
router.delete('/:filename',
    auth,
    asyncHandler(async (req, res) => {
        const { filename } = req.params;
        const filepath = path.join(__dirname, '../uploads', filename);

        try {
            // Check if file exists
            await fs.access(filepath);
            
            // Delete file
            await fs.unlink(filepath);

            res.json({
                success: true,
                message: 'File deleted successfully'
            });
        } catch (error) {
            if (error.code === 'ENOENT') {
                throw new APIError('File not found', 404);
            }
            throw error;
        }
    })
);

// GET /api/upload/files - List all uploaded files
router.get('/files',
    auth,
    asyncHandler(async (req, res) => {
        const uploadDir = path.join(__dirname, '../uploads');

        try {
            // Read upload directory
            const files = await fs.readdir(uploadDir);
            
            // Get metadata for each file
            const filesMetadata = await Promise.all(
                files.map(async (filename) => {
                    const filepath = path.join(uploadDir, filename);
                    const stats = await fs.stat(filepath);
                    
                    return {
                        filename,
                        size: stats.size,
                        uploadedAt: stats.mtime,
                        path: `/uploads/${filename}`
                    };
                })
            );

            res.json({
                success: true,
                data: filesMetadata
            });
        } catch (error) {
            if (error.code === 'ENOENT') {
                // Upload directory doesn't exist yet
                res.json({
                    success: true,
                    data: []
                });
                return;
            }
            throw error;
        }
    })
);

// Error handling middleware for multer errors
router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        // Handle multer-specific errors
        let status = 400;
        let message = error.message;

        switch (error.code) {
            case 'LIMIT_FILE_SIZE':
                message = `File too large. Maximum size allowed is ${config.upload.maxSize} bytes`;
                break;
            case 'LIMIT_FILE_COUNT':
                message = 'Too many files uploaded';
                break;
            case 'LIMIT_UNEXPECTED_FILE':
                message = 'Unexpected field name in upload';
                break;
        }

        res.status(status).json({
            error: {
                message,
                code: error.code
            }
        });
    } else {
        // Pass other errors to main error handler
        next(error);
    }
});

module.exports = router;
