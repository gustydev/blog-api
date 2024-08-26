const prisma = require('../prisma/client');
const asyncHandler = require('express-async-handler');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const { body, param, validationResult } = require("express-validator");

exports.getPosts = asyncHandler(async (req, res) => {
    const { page, limit, filter, sort = 'desc' } = req.query;

    const posts = await prisma.post.findMany({
        skip: (page - 1) * limit || undefined,
        take: Number(limit) || undefined,
        orderBy: {
            updatedAt: sort
        },
        where: {
            content: { contains: filter }
        }
    });

    res.status(200).json(posts);
});

exports.getPostById = asyncHandler(async (req, res) => {
    const post = await prisma.post.findUnique({
        where: { id: Number(req.params.postId) },
        include: { comments: true },
    });
    res.status(200).json(post);
});

exports.getCommentsByPostId = asyncHandler(async (req, res) => {
    const { page, limit, filter, sort = 'asc' } = req.query;

    const comments = await prisma.comment.findMany({
        skip: (page - 1) * limit || undefined,
        take: Number(limit) || undefined,
        orderBy: {
            updatedAt: sort
        },
        where: { 
            postId: Number(req.params.postId),
            content: { contains: filter }
         },
    });

    res.status(200).json(comments);
});

exports.createPost = [
    body('content').trim().isLength({min: 1}).withMessage('Post is missing text content'),
    body('title').trim().isLength({min: 1}).withMessage('Post is missing a title'),

    passport.authenticate('jwt', { session: false }), asyncHandler(async (req, res, next) => {
        const errors = validationResult(req);

        if (errors.isEmpty()) {
            const token = req.headers['authorization'].split(' ')[1];
            const decoded = jwt.verify(token, process.env.SECRET);
            
            const post = await prisma.post.create({
                data: {
                    title: req.body.title,
                    authorId: decoded.id,
                    content: req.body.content,
                },
                include: {
                    author: true,
                },
            });
        
            res.status(200).json(post);
        } else {
            const messages = [];
            for (e in errors.array()) {
                messages.push(errors.array()[e].msg)
            }

            return res.status(400).json({
                errors: {
                    messages,
                    statusCode: 400
                }
            })
        }
    })
];

exports.createComment = [
    body('content').trim().isLength({min: 1}).withMessage('Comment must not be empty'),
    param('postId').custom(async (value, {req}) => {
        const post = await prisma.post.findUnique({
            where: { id: Number(value) },
        });
        
        if (!post) {
            throw new Error(`Post of id ${req.params.postId} not found`);
        }
    }),

    asyncHandler(async (req, res, next) => {
        const errors = validationResult(req);

        if (errors.isEmpty()) {
            const comment = await prisma.comment.create({
                data: {
                    content: req.body.content,
                    author: req.body.author,
                    postId: Number(req.params.postId),
                },
            });
        
            res.status(200).json(comment);
        } else {
            const messages = [];
            for (e in errors.array()) {
                messages.push(errors.array()[e].msg)
            }

            return res.status(400).json({
                errors: {
                    messages,
                    statusCode: 400
                }
            })
        }
    })
];


exports.updatePost = [
    body('content').trim().isLength({min: 1}).withMessage('Post is missing text content'),
    body('title').trim().isLength({min: 1}).withMessage('Post is missing a title'),
    param('postId').custom(async (value, {req}) => {
        const exists = await prisma.post.findUnique({
            where: { id: Number(value) },
        });

        if (!exists) {
            throw new Error(`Post of id ${req.params.postId} not found`);
        }
    }),

    passport.authenticate('jwt', { session: false }), asyncHandler(async (req, res, next) => {
        const errors = validationResult(req);

        if (errors.isEmpty()) {
            const post = await prisma.post.update({
                where: { id: Number(req.params.postId) },
                data: {
                    title: req.body.title,
                    subtitle: req.body.subtitle,
                    content: req.body.content,
                    updatedAt: new Date(),
                },
            });
        
            res.status(200).json(post);
        } else {
            const messages = [];
            for (e in errors.array()) {
                messages.push(errors.array()[e].msg)
            }

            return res.status(400).json({
                errors: {
                    messages,
                    statusCode: 400
                }
            })
        }
    })
];


exports.deletePost = [
    param('postId').custom(async (value, {req}) => {
        const exists = await prisma.post.findUnique({
            where: { id: Number(value) },
        });

        if (!exists) {
            throw new Error(`Post of id ${req.params.postId} not found`);
        }
    }),

    passport.authenticate('jwt', { session: false }), asyncHandler(async (req, res, next) => {
        const errors = validationResult(req);

        if (errors.isEmpty()) {
            await prisma.comment.deleteMany({
                where: { postId: Number(req.params.postId) },
            });
            const post = await prisma.post.delete({
                where: { id: Number(req.params.postId) },
            });
    
            res.status(200).json(post);
        } else {
            return res.status(404).json({
                error: {
                    message: errors.array()[0].msg,
                    statusCode: 404
                }
            })
        }
    })
];
