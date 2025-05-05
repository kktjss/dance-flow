const express = require('express');
const router = express.Router();
const Project = require('./models/Project');

// Direct keyframe route handler
router.post('/:id/direct-keyframes', async (req, res) => {
    try {
        const projectId = req.params.id;
        console.log(`[DIRECT KF] Processing direct keyframe update for project ID: ${projectId}`);

        // Get the keyframe data from the request
        const { elementId, keyframes } = req.body;

        if (!elementId || !keyframes || !Array.isArray(keyframes)) {
            return res.status(400).json({
                message: 'Invalid data. Required: elementId and keyframes array',
                received: {
                    hasElementId: Boolean(elementId),
                    hasKeyframes: Boolean(keyframes),
                    keyframesIsArray: Array.isArray(keyframes)
                }
            });
        }

        console.log(`[DIRECT KF] Received ${keyframes.length} keyframes for element ${elementId}`);

        // First, get the current project to check existing keyframesJson
        const project = await Project.findById(projectId);

        if (!project) {
            console.log(`[DIRECT KF] Project with ID ${projectId} not found`);
            return res.status(404).json({ message: 'Project not found' });
        }

        // Parse existing keyframes or create new object
        let keyframesData = {};
        try {
            if (project.keyframesJson && project.keyframesJson !== '{}') {
                keyframesData = JSON.parse(project.keyframesJson);
                console.log(`[DIRECT KF] Parsed existing keyframesJson with ${Object.keys(keyframesData).length} elements`);
            } else {
                console.log(`[DIRECT KF] No existing keyframes, creating new object`);
            }
        } catch (err) {
            console.error(`[DIRECT KF] Error parsing existing keyframesJson: ${err.message}`);
            // Continue with empty object
        }

        // Add the new keyframes
        keyframesData[elementId] = keyframes;

        // Serialize to JSON
        const keyframesJson = JSON.stringify(keyframesData);
        console.log(`[DIRECT KF] Updated keyframesJson, length: ${keyframesJson.length}`);

        // DIRECT UPDATE ONLY TO THE keyframesJson FIELD
        console.log(`[DIRECT KF] Performing direct update on keyframesJson field`);

        try {
            // Use updateOne for a targeted update of just the keyframesJson field
            const updateResult = await Project.updateOne(
                { _id: projectId },
                { $set: { keyframesJson: keyframesJson } }
            );

            console.log(`[DIRECT KF] Update result:`, updateResult);

            if (updateResult.modifiedCount === 0) {
                console.error(`[DIRECT KF] Document not modified!`);
                return res.status(500).json({
                    message: 'Failed to update document',
                    updateResult
                });
            }

            // Verify the update worked
            const verifyProject = await Project.findById(projectId);

            if (!verifyProject.keyframesJson || verifyProject.keyframesJson === '{}') {
                console.error(`[DIRECT KF] Verification failed! keyframesJson is empty after update`);
                return res.status(500).json({
                    message: 'Verification failed - keyframesJson is empty after update',
                    beforeLength: keyframesJson.length,
                    afterLength: verifyProject.keyframesJson ? verifyProject.keyframesJson.length : 0
                });
            }

            let verifyCount = 0;
            try {
                const verifiedData = JSON.parse(verifyProject.keyframesJson);
                verifyCount = Object.values(verifiedData).reduce(
                    (sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0
                );
                console.log(`[DIRECT KF] Verification successful. Found ${verifyCount} keyframes in database`);
            } catch (e) {
                console.error(`[DIRECT KF] Failed to parse verified keyframesJson: ${e.message}`);
            }

            res.json({
                success: true,
                message: 'Keyframes directly updated in database',
                updated: {
                    elementId,
                    keyframeCount: keyframes.length
                },
                verification: {
                    keyframesJsonLength: verifyProject.keyframesJson.length,
                    totalKeyframes: verifyCount
                }
            });

        } catch (dbError) {
            console.error(`[DIRECT KF] Database error:`, dbError);
            res.status(500).json({
                message: 'Database error while updating keyframes',
                error: dbError.message
            });
        }
    } catch (error) {
        console.error(`[DIRECT KF] Error in direct keyframe update:`, error);
        res.status(500).json({
            message: 'Error processing direct keyframe update',
            error: error.message
        });
    }
});

module.exports = router; 