const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const auth = require('../middleware/auth');

// Set up storage for uploaded files
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../public/models');

        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Generate unique filename
        const uniqueId = uuidv4();
        const fileExt = path.extname(file.originalname);
        cb(null, `${uniqueId}${fileExt}`);
    }
});

// Create multer instance with file size limits
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
    },
    fileFilter: (req, file, cb) => {
        // Only accept .glb files
        if (file.mimetype === 'model/gltf-binary' || path.extname(file.originalname).toLowerCase() === '.glb') {
            return cb(null, true);
        }
        cb(new Error('Only .glb files are allowed'));
    }
});

// Models database (in-memory for simplicity, replace with actual DB in production)
let models = [];

// Get all models
router.get('/', auth, (req, res) => {
    try {
        // In a real app, you would query your database here
        res.json(models.map(model => ({
            ...model,
            url: `/models/${model.filename}` // Add URL for client-side use
        })));
    } catch (error) {
        console.error('Error fetching models:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Upload a new model
router.post('/upload', auth, upload.single('model'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const modelName = req.body.name || path.parse(req.file.originalname).name;

        // Create model record
        const newModel = {
            id: uuidv4(),
            name: modelName,
            filename: req.file.filename,
            originalName: req.file.originalname,
            size: req.file.size,
            userId: req.user.id,
            createdAt: new Date().toISOString(),
            url: `/models/${req.file.filename}`
        };

        // Save to database (in-memory for now)
        models.push(newModel);

        res.status(201).json(newModel);
    } catch (error) {
        console.error('Error uploading model:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get a specific model
router.get('/:id', auth, (req, res) => {
    try {
        const model = models.find(m => m.id === req.params.id);

        if (!model) {
            return res.status(404).json({ message: 'Model not found' });
        }

        res.json({
            ...model,
            url: `/models/${model.filename}`
        });
    } catch (error) {
        console.error('Error fetching model:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Delete a model
router.delete('/:id', auth, (req, res) => {
    try {
        const modelIndex = models.findIndex(m => m.id === req.params.id);

        if (modelIndex === -1) {
            return res.status(404).json({ message: 'Model not found' });
        }

        const model = models[modelIndex];

        // Check if user owns this model
        if (model.userId !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized to delete this model' });
        }

        // Delete file from disk
        const filePath = path.join(__dirname, '../public/models', model.filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        // Remove from database
        models.splice(modelIndex, 1);

        res.json({ message: 'Model deleted successfully' });
    } catch (error) {
        console.error('Error deleting model:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router; 