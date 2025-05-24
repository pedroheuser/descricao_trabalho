const express = require('express');
const { body, validationResult } = require('express-validator');
const crypto = require('crypto');
const Code = require('../models/Code');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/test', (req, res) => {
    res.json({ 
        message: 'Sistema de códigos funcionando!',
        timestamp: new Date().toISOString()
    });
});

router.get('/public/explore', async (req, res) => {
    try {
        const { page = 1, limit = 20, search } = req.query;
        const skip = (page - 1) * limit;

        let query = { isPublic: true };
        
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { tags: { $in: [new RegExp(search, 'i')] } }
            ];
        }

        const codes = await Code.find(query)
            .populate('author', 'username')
            .sort({ updatedAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Code.countDocuments(query);

        res.json({
            success: true,
            data: {
                codes,
                pagination: {
                    current: parseInt(page),
                    total: Math.ceil(total / limit),
                    count: codes.length,
                    totalCodes: total
                }
            }
        });

    } catch (error) {
        console.error('Erro ao buscar códigos públicos:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

router.get('/shared/:token', async (req, res) => {
    try {
        const code = await Code.findByShareToken(req.params.token);

        if (!code) {
            return res.status(404).json({
                success: false,
                message: 'Link de compartilhamento inválido ou expirado'
            });
        }

        await code.incrementViews();

        res.json({
            success: true,
            data: {
                code: {
                    id: code._id,
                    title: code.title,
                    content: code.content,
                    description: code.description,
                    language: code.language,
                    tags: code.tags,
                    author: {
                        username: code.author.username
                    },
                    createdAt: code.createdAt,
                    updatedAt: code.updatedAt,
                    stats: code.stats
                },
                permissions: {
                    canEdit: code.allowEditing,
                    canDelete: false,
                    canShare: false
                }
            }
        });

    } catch (error) {
        console.error('Erro ao acessar código compartilhado:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

router.post('/', authenticateToken, [
    body('title')
        .isLength({ min: 1, max: 100 })
        .withMessage('Título deve ter entre 1 e 100 caracteres'),
    body('content')
        .isLength({ min: 1, max: 50000 })
        .withMessage('Código deve ter entre 1 e 50.000 caracteres'),
    body('description')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Descrição não pode ter mais de 500 caracteres')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Dados inválidos',
                errors: errors.array()
            });
        }

        const { title, content, description, tags, isPublic } = req.body;

        const code = new Code({
            title,
            content,
            description: description || '',
            author: req.user.id,
            isPublic: isPublic || false,
            tags: tags || []
        });

        code.addVersion(content, 'Versão inicial');

        await code.save();

        const savedCode = await Code.findById(code._id).populate('author', 'username');

        res.status(201).json({
            success: true,
            message: 'Código salvo com sucesso!',
            data: {
                code: savedCode
            }
        });

    } catch (error) {
        console.error('Erro ao salvar código:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

router.get('/', authenticateToken, async (req, res) => {
    try {
        const { page = 1, limit = 10, search } = req.query;
        const skip = (page - 1) * limit;

        let query = { author: req.user.id };
        
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { tags: { $in: [new RegExp(search, 'i')] } }
            ];
        }

        const codes = await Code.find(query)
            .populate('author', 'username')
            .sort({ updatedAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Code.countDocuments(query);

        res.json({
            success: true,
            data: {
                codes,
                pagination: {
                    current: parseInt(page),
                    total: Math.ceil(total / limit),
                    count: codes.length,
                    totalCodes: total
                }
            }
        });

    } catch (error) {
        console.error('Erro ao listar códigos:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

router.post('/:id/run', optionalAuth, async (req, res) => {
    try {
        const code = await Code.findById(req.params.id);

        if (!code) {
            return res.status(404).json({
                success: false,
                message: 'Código não encontrado'
            });
        }

        const isOwner = req.user && code.author.toString() === req.user.id;
        const isPublic = code.isPublic;

        if (!isOwner && !isPublic) {
            return res.status(403).json({
                success: false,
                message: 'Acesso negado'
            });
        }

        await code.incrementRuns();

        res.json({
            success: true,
            message: 'Execução registrada',
            data: {
                stats: code.stats
            }
        });

    } catch (error) {
        console.error('Erro ao registrar execução:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

router.post('/:id/share', authenticateToken, [
    body('allowEditing')
        .optional()
        .isBoolean()
        .withMessage('allowEditing deve ser true ou false'),
    body('expiresIn')
        .optional()
        .isInt({ min: 1, max: 365 })
        .withMessage('expiresIn deve ser entre 1 e 365 dias')
], async (req, res) => {
    try {
        const code = await Code.findById(req.params.id);

        if (!code) {
            return res.status(404).json({
                success: false,
                message: 'Código não encontrado'
            });
        }

        if (code.author.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Acesso negado'
            });
        }

        const { allowEditing = false, expiresIn } = req.body;

        const shareToken = crypto.randomBytes(32).toString('hex');

        let shareExpiresAt = null;
        if (expiresIn) {
            shareExpiresAt = new Date();
            shareExpiresAt.setDate(shareExpiresAt.getDate() + expiresIn);
        }

        code.shareToken = shareToken;
        code.shareExpiresAt = shareExpiresAt;
        code.allowEditing = allowEditing;

        await code.save();

        const shareUrl = `${req.protocol}://${req.get('host')}/api/codes/shared/${shareToken}`;

        res.json({
            success: true,
            message: 'Link de compartilhamento gerado!',
            data: {
                shareUrl,
                shareToken,
                allowEditing,
                expiresAt: shareExpiresAt
            }
        });

    } catch (error) {
        console.error('Erro ao compartilhar código:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

router.get('/:id', optionalAuth, async (req, res) => {
    try {
        const code = await Code.findById(req.params.id).populate('author', 'username');

        if (!code) {
            return res.status(404).json({
                success: false,
                message: 'Código não encontrado'
            });
        }

        const isOwner = req.user && code.author._id.toString() === req.user.id;
        const isPublic = code.isPublic;

        if (!isOwner && !isPublic) {
            return res.status(403).json({
                success: false,
                message: 'Acesso negado'
            });
        }

        if (!isOwner) {
            await code.incrementViews();
        }

        res.json({
            success: true,
            data: {
                code,
                permissions: {
                    canEdit: isOwner,
                    canDelete: isOwner,
                    canShare: isOwner
                }
            }
        });

    } catch (error) {
        console.error('Erro ao buscar código:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

module.exports = router;