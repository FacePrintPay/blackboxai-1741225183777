const express = require('express');
const router = express.Router();
const { Client } = require('@elastic/elasticsearch');
const config = require('../config/config');
const { APIError, asyncHandler } = require('../middleware/errorHandler');

// Initialize Elasticsearch client
const client = new Client({
    node: config.elasticsearch.node,
    auth: {
        username: config.elasticsearch.auth.username,
        password: config.elasticsearch.auth.password
    }
});

// Index names
const INDICES = {
    PAPERS: 'papers',
    BLOG_POSTS: 'blog_posts'
};

// Helper function to check if index exists
const indexExists = async (indexName) => {
    try {
        const { body } = await client.indices.exists({ index: indexName });
        return body;
    } catch (error) {
        console.error(`Error checking index ${indexName}:`, error);
        return false;
    }
};

// Helper function to create index if it doesn't exist
const createIndexIfNotExists = async (indexName, mappings) => {
    const exists = await indexExists(indexName);
    if (!exists) {
        try {
            await client.indices.create({
                index: indexName,
                body: {
                    mappings
                }
            });
            console.log(`Index ${indexName} created successfully`);
        } catch (error) {
            console.error(`Error creating index ${indexName}:`, error);
            throw new APIError('Failed to create search index', 500);
        }
    }
};

// Initialize indices with mappings
const initializeIndices = async () => {
    // Papers index mapping
    await createIndexIfNotExists(INDICES.PAPERS, {
        properties: {
            title: { type: 'text' },
            authors: { type: 'keyword' },
            abstract: { type: 'text' },
            categories: { type: 'keyword' },
            published: { type: 'date' }
        }
    });

    // Blog posts index mapping
    await createIndexIfNotExists(INDICES.BLOG_POSTS, {
        properties: {
            title: { type: 'text' },
            content: { type: 'text' },
            author: { type: 'keyword' },
            tags: { type: 'keyword' },
            createdAt: { type: 'date' }
        }
    });
};

// Initialize indices on startup
initializeIndices().catch(console.error);

// GET /api/search - Search across all indices
router.get('/', asyncHandler(async (req, res) => {
    const { q, type, from = 0, size = 10 } = req.query;

    if (!q) {
        throw new APIError('Search query is required', 400);
    }

    // Determine which indices to search
    let indices = [];
    if (!type || type === 'all') {
        indices = Object.values(INDICES);
    } else if (INDICES[type.toUpperCase()]) {
        indices = [INDICES[type.toUpperCase()]];
    } else {
        throw new APIError('Invalid search type', 400);
    }

    try {
        const { body } = await client.search({
            index: indices,
            body: {
                from,
                size,
                query: {
                    multi_match: {
                        query: q,
                        fields: ['title^2', 'content', 'abstract', 'authors^1.5'],
                        fuzziness: 'AUTO'
                    }
                },
                highlight: {
                    fields: {
                        title: {},
                        content: {},
                        abstract: {}
                    }
                },
                sort: [
                    { _score: 'desc' },
                    { createdAt: 'desc' }
                ]
            }
        });

        const results = body.hits.hits.map(hit => ({
            id: hit._id,
            type: hit._index,
            score: hit._score,
            data: hit._source,
            highlights: hit.highlight
        }));

        res.json({
            success: true,
            data: {
                total: body.hits.total.value,
                results,
                from,
                size
            }
        });
    } catch (error) {
        console.error('Elasticsearch error:', error);
        throw new APIError('Search operation failed', 500);
    }
}));

// POST /api/search/index - Index a document
router.post('/index', asyncHandler(async (req, res) => {
    const { type, document } = req.body;

    if (!type || !document) {
        throw new APIError('Type and document are required', 400);
    }

    if (!INDICES[type.toUpperCase()]) {
        throw new APIError('Invalid document type', 400);
    }

    try {
        const { body } = await client.index({
            index: INDICES[type.toUpperCase()],
            body: {
                ...document,
                indexed_at: new Date()
            }
        });

        res.status(201).json({
            success: true,
            data: {
                id: body._id,
                type,
                result: body.result
            }
        });
    } catch (error) {
        console.error('Elasticsearch indexing error:', error);
        throw new APIError('Failed to index document', 500);
    }
}));

// DELETE /api/search/:type/:id - Delete a document
router.delete('/:type/:id', asyncHandler(async (req, res) => {
    const { type, id } = req.params;

    if (!INDICES[type.toUpperCase()]) {
        throw new APIError('Invalid document type', 400);
    }

    try {
        const { body } = await client.delete({
            index: INDICES[type.toUpperCase()],
            id
        });

        res.json({
            success: true,
            data: {
                id,
                type,
                result: body.result
            }
        });
    } catch (error) {
        if (error.meta?.statusCode === 404) {
            throw new APIError('Document not found', 404);
        }
        console.error('Elasticsearch deletion error:', error);
        throw new APIError('Failed to delete document', 500);
    }
}));

// POST /api/search/bulk - Bulk index documents
router.post('/bulk', asyncHandler(async (req, res) => {
    const { type, documents } = req.body;

    if (!type || !Array.isArray(documents)) {
        throw new APIError('Type and array of documents are required', 400);
    }

    if (!INDICES[type.toUpperCase()]) {
        throw new APIError('Invalid document type', 400);
    }

    try {
        const operations = documents.flatMap(doc => [
            { index: { _index: INDICES[type.toUpperCase()] } },
            { ...doc, indexed_at: new Date() }
        ]);

        const { body } = await client.bulk({ body: operations });

        res.status(201).json({
            success: true,
            data: {
                items: body.items,
                errors: body.errors
            }
        });
    } catch (error) {
        console.error('Elasticsearch bulk indexing error:', error);
        throw new APIError('Failed to bulk index documents', 500);
    }
}));

module.exports = router;
