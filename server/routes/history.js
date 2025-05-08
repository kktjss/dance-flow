const express = require('express');
const router = express.Router();
const History = require('../models/History');
const auth = require('../middleware/auth');
const mongoose = require('mongoose');

// Get user's history
router.get('/', auth, async (req, res) => {
    try {
        console.log('[HISTORY] Fetching history for user:', req.user.id);
        console.log('[HISTORY] User object:', req.user);

        const userId = new mongoose.Types.ObjectId(req.user.id);
        console.log('[HISTORY] Converted userId to ObjectId:', userId);

        const history = await History.find({ userId })
            .sort({ timestamp: -1 })
            .populate('projectId', 'title')
            .limit(50);

        console.log('[HISTORY] Found history entries:', history.length);
        res.json(history);
    } catch (error) {
        console.error('[HISTORY] Error fetching history:', error);
        console.error('[HISTORY] Error details:', error.stack);
        res.status(500).json({ message: 'Error fetching history', error: error.message });
    }
});

// Add history entry
router.post('/', auth, async (req, res) => {
    try {
        const { projectId, action, description } = req.body;
        console.log('[HISTORY] Creating history entry:', {
            userId: req.user.id,
            projectId,
            action,
            description
        });

        const userId = new mongoose.Types.ObjectId(req.user.id);
        console.log('[HISTORY] Converted userId to ObjectId:', userId);

        const history = new History({
            userId,
            projectId,
            action,
            description
        });

        await history.save();
        console.log('[HISTORY] History entry created:', history._id);
        res.status(201).json(history);
    } catch (error) {
        console.error('[HISTORY] Error creating history entry:', error);
        console.error('[HISTORY] Error details:', error.stack);
        res.status(500).json({ message: 'Error creating history entry', error: error.message });
    }
});

module.exports = router; 