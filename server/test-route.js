const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Project = require('./models/Project');

// Simple test endpoint for database operations
router.post('/test-save-keyframes', async (req, res) => {
    try {
        console.log('[TEST ROUTE] Test-save-keyframes endpoint called');

        const { projectId, elementId, keyframes } = req.body;

        if (!projectId || !elementId || !keyframes || !Array.isArray(keyframes)) {
            return res.status(400).json({
                message: 'Missing required data',
                received: {
                    hasProjectId: Boolean(projectId),
                    hasElementId: Boolean(elementId),
                    hasKeyframes: Boolean(keyframes),
                    keyframesIsArray: Array.isArray(keyframes)
                }
            });
        }

        console.log(`[TEST ROUTE] Received request to save ${keyframes.length} keyframes for element ${elementId} in project ${projectId}`);

        // Create keyframes data structure
        const keyframesData = {
            [elementId]: keyframes
        };

        // Convert to JSON string
        const keyframesJson = JSON.stringify(keyframesData);
        console.log(`[TEST ROUTE] Created keyframesJson with length ${keyframesJson.length}`);

        // DIRECT DATABASE UPDATE using low-level MongoDB operations
        try {
            // Use the MongoDB driver directly to update the document
            const result = await mongoose.connection.db.collection('projects').updateOne(
                { _id: new mongoose.Types.ObjectId(projectId) },
                { $set: { keyframesJson: keyframesJson } }
            );

            console.log('[TEST ROUTE] Direct MongoDB update result:', result);

            if (result.matchedCount === 0) {
                return res.status(404).json({ message: 'Project not found' });
            }

            if (result.modifiedCount === 0) {
                return res.status(500).json({ message: 'Document not modified' });
            }

            // Verify the update
            const updatedProject = await mongoose.connection.db.collection('projects').findOne(
                { _id: new mongoose.Types.ObjectId(projectId) }
            );

            if (!updatedProject || !updatedProject.keyframesJson) {
                return res.status(500).json({ message: 'Verification failed' });
            }

            console.log('[TEST ROUTE] Success! Updated keyframesJson length:', updatedProject.keyframesJson.length);

            res.json({
                success: true,
                message: 'Keyframes updated successfully',
                keyframesJsonLength: updatedProject.keyframesJson.length
            });

        } catch (dbError) {
            console.error('[TEST ROUTE] Database operation error:', dbError);
            res.status(500).json({ message: 'Database error', error: dbError.message });
        }
    } catch (error) {
        console.error('[TEST ROUTE] Error in test-save-keyframes:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

module.exports = router; 