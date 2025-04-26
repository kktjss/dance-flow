const mongoose = require('mongoose');

const ElementSchema = new mongoose.Schema({
    id: { type: String, required: true },
    type: { type: String, required: true }, // rectangle, circle, image, text, etc.
    position: {
        x: { type: Number, required: true },
        y: { type: Number, required: true }
    },
    size: {
        width: { type: Number, required: true },
        height: { type: Number, required: true }
    },
    style: {
        color: { type: String, default: '#000000' },
        backgroundColor: { type: String, default: 'transparent' },
        borderColor: { type: String, default: '#000000' },
        borderWidth: { type: Number, default: 1 },
        opacity: { type: Number, default: 1 },
        zIndex: { type: Number, default: 0 }
    },
    content: { type: String, default: '' }, // For text or image URL
    animation: {
        startTime: { type: Number, default: 0 }, // Start time in seconds
        endTime: { type: Number, default: null }, // End time in seconds (null = forever)
        effects: [{
            type: { type: String }, // 'fade', 'move', 'scale', etc.
            startTime: { type: Number },
            endTime: { type: Number },
            params: { type: mongoose.Schema.Types.Mixed } // Effect-specific parameters
        }]
    }
});

const ProjectSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    duration: { type: Number, default: 60 }, // Duration in seconds
    audioUrl: { type: String, default: null },
    elements: [ElementSchema]
});

const Project = mongoose.model('Project', ProjectSchema);

module.exports = Project; 