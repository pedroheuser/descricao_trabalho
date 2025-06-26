const mongoose = require('mongoose');

const CodeSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100,
        default: 'Untitled.js'
    },
    
    content: {
        type: String,
        required: true,
        maxlength: 50000 // limitando em 50KB  
    },
    
    
    description: {
        type: String,
        trim: true,
        maxlength: 500,
        default: ''
    },
    
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',            
        required: true
    },
    
    isPublic: {
        type: Boolean,
        default: false          
    },
    
    allowEditing: {
        type: Boolean,
        default: false
    },
    
    language: {
        type: String,
        default: 'javascript',
        enum: ['javascript', 'js']
    },
    
    tags: [{
        type: String,
        trim: true,
        maxlength: 20
    }],
    
    versions: [{
        content: String,
        createdAt: {
            type: Date,
            default: Date.now
        },
        note: {
            type: String,
            maxlength: 200
        }
    }],
    
    stats: {
        views: {
            type: Number,
            default: 0
        },
        forks: {
            type: Number,
            default: 0
        },
        runs: {
            type: Number,
            default: 0
        }
    },
    
    shareToken: {
        type: String,
        unique: true,
        sparse: true
    },

    shareExpiresAt: {
        type: Date
    },
    
    lastRun: {
        type: Date
    },
    
    createdAt: {
        type: Date,
        default: Date.now
    },
    
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    collection: 'codes'
});

CodeSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

CodeSchema.pre('save', function(next) {
    if (this.versions && this.versions.length > 10) {
        this.versions = this.versions.slice(-10); 
    }
    next();
});

CodeSchema.methods.addVersion = function(content, note = '') {
    this.versions.push({
        content: content,
        note: note,
        createdAt: new Date()
    });
    
    if (this.versions.length > 10) {
        this.versions = this.versions.slice(-10);
    }
};

CodeSchema.methods.incrementViews = function() {
    this.stats.views += 1;
    return this.save();
};

CodeSchema.methods.incrementRuns = function() {
    this.stats.runs += 1;
    this.lastRun = new Date();
    return this.save();
};

CodeSchema.statics.findPublicCodes = function(limit = 20) {
    return this.find({ isPublic: true })
               .populate('author', 'username')  
               .sort({ updatedAt: -1 })         
               .limit(limit);
};

CodeSchema.statics.findByShareToken = function(token) {
    return this.findOne({ 
        shareToken: token,
        $or: [
            { shareExpiresAt: null },
            { shareExpiresAt: { $gt: new Date() } }
        ]
    }).populate('author', 'username');
};

CodeSchema.index({ author: 1, createdAt: -1 });
CodeSchema.index({ isPublic: 1, updatedAt: -1 });
CodeSchema.index({ shareToken: 1 });
CodeSchema.index({ tags: 1 });

const Code = mongoose.model('Code', CodeSchema);
module.exports = Code;