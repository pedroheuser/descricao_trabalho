const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();
const path = require('path');
const codeRoutes = require('./routes/codes');

const User = require('./models/User');
const Code = require('./models/Code');

const authRoutes = require('./routes/auth');

const app = express();

/* app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            ...helmet.contentSecurityPolicy.getDefaultDirectives(),
            "script-src": ["'self'", "'unsafe-inline'"],
        },
    },
})); */

app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:8080', 'http://127.0.0.1:3000', 'file://'],
    credentials: true
}));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: {
        error: 'Muitas tentativas. Tente novamente em 15 minutos.'
    }
});
app.use('/api/', limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

mongoose.connect(process.env.MONGODB_URI)
.then(() => {
    console.log('✅ Conectado ao MongoDB com sucesso!');
})
.catch((error) => {
    console.error('❌ Erro ao conectar no MongoDB:', error);
    process.exit(1);
});

app.get('/api/test', (req, res) => {
    res.json({ 
        message: 'Backend funcionando!', 
        timestamp: new Date().toISOString() 
    });
});

app.get('/api/test-models', async (req, res) => {
    try {
        const userCount = await User.countDocuments();
        const codeCount = await Code.countDocuments();
        
        res.json({ 
            message: 'Modelos funcionando!',
            collections: {
                users: userCount,
                codes: codeCount
            },
            timestamp: new Date().toISOString() 
        });
    } catch (error) {
        res.status(500).json({ 
            error: 'Erro ao testar modelos', 
            details: error.message 
        });
    }
});
app.use('/api/auth', authRoutes);

app.get('/test-auth', (req, res) => {
    res.sendFile(path.join(__dirname, 'test-auth.html'));
});

app.get('/test-codes', (req, res) => {
    res.sendFile(path.join(__dirname, 'test-codes.html'));
});
app.get('/shared/:token', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/shared.html'));
});

app.use('/api/codes', codeRoutes);

app.use(express.static(path.join(__dirname, '../frontend')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});




app.use('*', (req, res) => {
    res.status(404).json({ 
        error: 'Rota não encontrada' 
    });
});

app.use((error, req, res, next) => {
    console.error('Erro no servidor:', error);
    res.status(500).json({ 
        error: 'Erro interno do servidor' 
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`📍 Acesse: http://localhost:${PORT}/api/test`);
});