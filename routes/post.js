const express = require('express');
const router = express.Router();
const prisma = require('../prisma/client');
const asyncHandler = require('express-async-handler')
const passport = require('passport');
const jwt = require('jsonwebtoken');

router.get('/', asyncHandler(async (req, res) => {
    // Get all posts
    const posts = await prisma.post.findMany();

    res.status(200).json(posts)
}))

router.get('/:postId', asyncHandler(async (req, res) => {
    // Get specific post by id
    const post = await prisma.post.findUnique({where: {id: Number(req.params.postId)}, include: {comments: true}})

    res.status(200).json(post)
}))

router.get('/:postId/comment', asyncHandler(async (req, res) => {
    // Get comments of specific post by its id
    const comments = await prisma.comment.findMany({where: {postId: Number(req.params.postId)}});

    res.status(200).json(comments);
}));

router.post('/', passport.authenticate('jwt', { session: false }), asyncHandler(async (req, res, next) => {
    const token = req.headers['authorization'].split(' ')[1]
    const decoded = jwt.verify(token, process.env.SECRET) // Contains ID and expiration date

    if (!req.body.content || !req.body.title) {
        const err = new Error('Post is missing title and/or text content');
        err.statusCode = 400;
        return next(err);
    }

    // Create post with data sent by client
    const post = await prisma.post.create({
        data: {
            title: req.body.title,
            authorId: decoded.id,
            content: req.body.content
        },
        include: {
            author: true
        }
    })

    res.status(200).json(post)
}))

router.post('/:postId/comment', asyncHandler(async (req, res, next) => {
    if (!req.body.content.length) {
        const error = new Error('Comment must not be empty')
        error.statusCode = 400;
        return next(error);
    }

    const post = await prisma.post.findUnique({where: {id: Number(req.params.postId)}})
    if (!post) {
        const error = new Error(`Post of id ${req.params.postId} not found`)
        error.statusCode = 404;
        return next(error)
    }

    // Create comment under post
    const comment = await prisma.comment.create({
        data: {
            content: req.body.content,
            author: req.body.author, // Defaults to 'Anonymous' if no value is provided
            postId: Number(req.params.postId)
        }
    })

    res.status(200).json(comment);
}));

router.put('/:postId', passport.authenticate('jwt', { session: false }), asyncHandler(async(req, res, next) => {
    const exists = await prisma.post.findUnique({where: {id: Number(req.params.postId)}})
    if (!exists) {
        const error = new Error(`Post of id ${req.params.postId} not found`)
        error.statusCode = 404;
        return next(error)
    }

    const post = await prisma.post.update({
        where: {id: Number(req.params.postId)},
        data: {
            title: req.body.title,
            subtitle: req.body.subtitle,
            content: req.body.content,
            updatedAt: new Date()
        }
    });

    res.status(200).json(post);
}))

router.delete('/:postId', passport.authenticate('jwt', { session: false }), asyncHandler(async (req, res, next) => {
    const exists = await prisma.post.findUnique({where: {id: Number(req.params.postId)}})
    if (!exists) {
        const error = new Error(`Post of id ${req.params.postId} not found`)
        error.statusCode = 404;
        return next(error)
    }

    await prisma.comment.deleteMany({where: {postId: Number(req.params.postId)}});
    const post = await prisma.post.delete({where: {id: Number(req.params.postId)}})

    res.status(200).json(post)
}))

module.exports = router;