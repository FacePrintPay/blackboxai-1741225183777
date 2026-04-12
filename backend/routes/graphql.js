const express = require('express');
const router = express.Router();
const { graphqlHTTP } = require('express-graphql');
const { 
    GraphQLSchema, 
    GraphQLObjectType, 
    GraphQLString, 
    GraphQLList, 
    GraphQLNonNull, 
    GraphQLID,
    GraphQLInt
} = require('graphql');
const { auth } = require('../middleware/auth');

// In-memory storage for blog posts and comments (replace with database in production)
let posts = new Map();
let comments = new Map();

// GraphQL Types
const CommentType = new GraphQLObjectType({
    name: 'Comment',
    description: 'This represents a comment on a blog post',
    fields: () => ({
        id: { type: GraphQLNonNull(GraphQLID) },
        content: { type: GraphQLNonNull(GraphQLString) },
        author: { type: GraphQLNonNull(GraphQLString) },
        postId: { type: GraphQLNonNull(GraphQLID) },
        createdAt: { type: GraphQLNonNull(GraphQLString) },
        post: {
            type: PostType,
            resolve: (comment) => posts.get(comment.postId)
        }
    })
});

const PostType = new GraphQLObjectType({
    name: 'Post',
    description: 'This represents a blog post',
    fields: () => ({
        id: { type: GraphQLNonNull(GraphQLID) },
        title: { type: GraphQLNonNull(GraphQLString) },
        content: { type: GraphQLNonNull(GraphQLString) },
        author: { type: GraphQLNonNull(GraphQLString) },
        createdAt: { type: GraphQLNonNull(GraphQLString) },
        updatedAt: { type: GraphQLNonNull(GraphQLString) },
        comments: {
            type: GraphQLList(CommentType),
            resolve: (post) => {
                return Array.from(comments.values())
                    .filter(comment => comment.postId === post.id);
            }
        }
    })
});

// Query Type
const RootQueryType = new GraphQLObjectType({
    name: 'Query',
    description: 'Root Query',
    fields: () => ({
        post: {
            type: PostType,
            description: 'A Single Blog Post',
            args: {
                id: { type: GraphQLNonNull(GraphQLID) }
            },
            resolve: (parent, args) => posts.get(args.id)
        },
        posts: {
            type: GraphQLList(PostType),
            description: 'List of All Blog Posts',
            args: {
                limit: { type: GraphQLInt },
                offset: { type: GraphQLInt }
            },
            resolve: (parent, args) => {
                let allPosts = Array.from(posts.values());
                
                // Sort by creation date (newest first)
                allPosts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                
                // Apply pagination if args provided
                if (args.offset !== undefined && args.limit !== undefined) {
                    allPosts = allPosts.slice(args.offset, args.offset + args.limit);
                }
                
                return allPosts;
            }
        },
        comment: {
            type: CommentType,
            description: 'A Single Comment',
            args: {
                id: { type: GraphQLNonNull(GraphQLID) }
            },
            resolve: (parent, args) => comments.get(args.id)
        },
        comments: {
            type: GraphQLList(CommentType),
            description: 'List of All Comments',
            args: {
                postId: { type: GraphQLID }
            },
            resolve: (parent, args) => {
                let allComments = Array.from(comments.values());
                if (args.postId) {
                    allComments = allComments.filter(comment => comment.postId === args.postId);
                }
                return allComments;
            }
        }
    })
});

// Mutation Type
const RootMutationType = new GraphQLObjectType({
    name: 'Mutation',
    description: 'Root Mutation',
    fields: () => ({
        addPost: {
            type: PostType,
            description: 'Add a new blog post',
            args: {
                title: { type: GraphQLNonNull(GraphQLString) },
                content: { type: GraphQLNonNull(GraphQLString) }
            },
            resolve: (parent, args, context) => {
                if (!context.user) {
                    throw new Error('Authentication required');
                }

                const post = {
                    id: Date.now().toString(),
                    title: args.title,
                    content: args.content,
                    author: context.user.email,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };

                posts.set(post.id, post);
                return post;
            }
        },
        updatePost: {
            type: PostType,
            description: 'Update an existing blog post',
            args: {
                id: { type: GraphQLNonNull(GraphQLID) },
                title: { type: GraphQLString },
                content: { type: GraphQLString }
            },
            resolve: (parent, args, context) => {
                if (!context.user) {
                    throw new Error('Authentication required');
                }

                const post = posts.get(args.id);
                if (!post) {
                    throw new Error('Post not found');
                }

                if (post.author !== context.user.email) {
                    throw new Error('Not authorized to update this post');
                }

                const updatedPost = {
                    ...post,
                    title: args.title || post.title,
                    content: args.content || post.content,
                    updatedAt: new Date().toISOString()
                };

                posts.set(args.id, updatedPost);
                return updatedPost;
            }
        },
        deletePost: {
            type: PostType,
            description: 'Delete a blog post',
            args: {
                id: { type: GraphQLNonNull(GraphQLID) }
            },
            resolve: (parent, args, context) => {
                if (!context.user) {
                    throw new Error('Authentication required');
                }

                const post = posts.get(args.id);
                if (!post) {
                    throw new Error('Post not found');
                }

                if (post.author !== context.user.email) {
                    throw new Error('Not authorized to delete this post');
                }

                posts.delete(args.id);
                
                // Delete associated comments
                for (const [commentId, comment] of comments) {
                    if (comment.postId === args.id) {
                        comments.delete(commentId);
                    }
                }

                return post;
            }
        },
        addComment: {
            type: CommentType,
            description: 'Add a comment to a blog post',
            args: {
                postId: { type: GraphQLNonNull(GraphQLID) },
                content: { type: GraphQLNonNull(GraphQLString) }
            },
            resolve: (parent, args, context) => {
                if (!context.user) {
                    throw new Error('Authentication required');
                }

                if (!posts.has(args.postId)) {
                    throw new Error('Post not found');
                }

                const comment = {
                    id: Date.now().toString(),
                    content: args.content,
                    author: context.user.email,
                    postId: args.postId,
                    createdAt: new Date().toISOString()
                };

                comments.set(comment.id, comment);
                return comment;
            }
        },
        deleteComment: {
            type: CommentType,
            description: 'Delete a comment',
            args: {
                id: { type: GraphQLNonNull(GraphQLID) }
            },
            resolve: (parent, args, context) => {
                if (!context.user) {
                    throw new Error('Authentication required');
                }

                const comment = comments.get(args.id);
                if (!comment) {
                    throw new Error('Comment not found');
                }

                if (comment.author !== context.user.email) {
                    throw new Error('Not authorized to delete this comment');
                }

                comments.delete(args.id);
                return comment;
            }
        }
    })
});

// Create Schema
const schema = new GraphQLSchema({
    query: RootQueryType,
    mutation: RootMutationType
});

// Mount GraphQL endpoint
router.use('/', 
    auth, // Protect all GraphQL operations with authentication
    (req, res, next) => {
        // Add user context to GraphQL resolvers
        graphqlHTTP({
            schema: schema,
            graphiql: true, // Enable GraphiQL interface for testing
            context: { user: req.user }
        })(req, res, next);
    }
);

module.exports = router;
