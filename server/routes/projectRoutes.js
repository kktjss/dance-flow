const express = require('express');
const router = express.Router();
const Project = require('../models/Project');

// Get all projects
router.get('/', async (req, res) => {
    try {
        const projects = await Project.find({}, 'name description createdAt updatedAt');
        res.json(projects);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get single project by ID
router.get('/:id', async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }
        res.json(project);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Create new project
router.post('/', async (req, res) => {
    const project = new Project({
        name: req.body.name,
        description: req.body.description,
        duration: req.body.duration || 60,
        audioUrl: req.body.audioUrl,
        elements: req.body.elements || []
    });

    try {
        const newProject = await project.save();
        res.status(201).json(newProject);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Update project
router.put('/:id', async (req, res) => {
    try {
        req.body.updatedAt = Date.now();
        const updatedProject = await Project.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );
        if (!updatedProject) {
            return res.status(404).json({ message: 'Project not found' });
        }
        res.json(updatedProject);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Delete project
router.delete('/:id', async (req, res) => {
    try {
        const project = await Project.findByIdAndDelete(req.params.id);
        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }
        res.json({ message: 'Project deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router; 