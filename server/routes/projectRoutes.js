const express = require('express');
const router = express.Router();
const Project = require('../models/Project');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Team = require('../src/models/Team');
const ensureAuth = require('../middleware/auth');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Helper function for logging with timestamp
function logWithDetails(message, data = null) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);

    // Write to log file
    const logFile = path.join(logsDir, 'keyframes.log');
    if (data) {
        fs.appendFileSync(logFile, `${logMessage}\n${JSON.stringify(data, null, 2)}\n\n`);
    } else {
        fs.appendFileSync(logFile, `${logMessage}\n`);
    }
}

// Log all route registrations
console.log('[ROUTE SETUP] Registering project routes...');

// GET all projects (only returns projects that are either owned by the user or public)
router.get('/', ensureAuth, async (req, res) => {
    try {
        console.log('Fetching projects for user:', req.user.id);

        const projects = await Project.find({
            $or: [
                { owner: req.user.id },
                { isPrivate: false }
            ]
        }).select('-keyframesJson');

        console.log(`Found ${projects.length} projects for user`);

        res.json(projects);
    } catch (error) {
        console.error('Error fetching projects:', error);
        res.status(500).json({ message: 'Error fetching projects' });
    }
});

// Simple test endpoint to verify route functionality
router.get('/test', (req, res) => {
    console.log('[TEST ROUTE] Test endpoint called');
    res.json({ message: 'Test endpoint successful', timestamp: new Date().toISOString() });
});

// Special diagnostics route for save operations - MUST BE DEFINED BEFORE ANY PARAMETER ROUTES
router.post('/save-test', async (req, res) => {
    try {
        console.log('[SAVE TEST] Received save test request');
        const projectData = req.body;

        // Create detailed diagnostic info about the received project
        const diagnostics = {
            hasElements: Boolean(projectData.elements),
            elementCount: projectData.elements?.length || 0,
            elementsWithKeyframes: 0,
            totalKeyframes: 0,
            elementDetails: [],
            keyframesSample: null
        };

        // Analyze elements and keyframes
        if (projectData.elements && projectData.elements.length > 0) {
            projectData.elements.forEach((element, index) => {
                const keyframeCount = element.keyframes?.length || 0;

                if (keyframeCount > 0) {
                    diagnostics.elementsWithKeyframes++;
                    diagnostics.totalKeyframes += keyframeCount;

                    // Save a sample of the first keyframe we find
                    if (!diagnostics.keyframesSample && element.keyframes[0]) {
                        diagnostics.keyframesSample = element.keyframes[0];
                    }
                }

                // Collect element details
                diagnostics.elementDetails.push({
                    index,
                    id: element.id,
                    type: element.type,
                    keyframeCount,
                    hasKeyframesProperty: 'keyframes' in element,
                    keyframesType: element.keyframes ? typeof element.keyframes : 'undefined',
                    isKeyframesArray: Array.isArray(element.keyframes)
                });
            });
        }

        // Now process as the real save would, but just for diagnostics
        // CRITICAL: Extract and validate keyframes from all elements (from real save logic)
        const keyframesData = {};
        let totalKeyframes = 0;

        if (projectData.elements) {
            projectData.elements.forEach((element, index) => {
                if (element.id) {
                    if (element.keyframes && element.keyframes.length > 0) {
                        // Filter valid keyframes
                        const validKeyframes = element.keyframes.filter(kf => {
                            const isValid = kf &&
                                typeof kf.time === 'number' && !isNaN(kf.time) &&
                                kf.position &&
                                typeof kf.position.x === 'number' && !isNaN(kf.position.x) &&
                                typeof kf.position.y === 'number' && !isNaN(kf.position.y) &&
                                typeof kf.opacity === 'number' && !isNaN(kf.opacity);

                            return isValid;
                        });

                        if (validKeyframes.length > 0) {
                            keyframesData[element.id] = validKeyframes;
                            totalKeyframes += validKeyframes.length;
                        }
                    }
                }
            });
        }

        // Convert to JSON string (just like the real save would)
        let keyframesJson = null;
        try {
            if (totalKeyframes > 0) {
                keyframesJson = JSON.stringify(keyframesData);
            } else {
                keyframesJson = "{}";
            }
        } catch (jsonError) {
            console.error('[SAVE TEST] Error serializing keyframes to JSON:', jsonError);
        }

        // Add results to diagnostics
        diagnostics.extractedKeyframesData = {
            elementCount: Object.keys(keyframesData).length,
            totalKeyframes,
            sampleElementId: Object.keys(keyframesData)[0] || null,
            keyframesJson: keyframesJson,
            keyframesJsonLength: keyframesJson ? keyframesJson.length : 0
        };

        // Don't actually save to DB, just return the diagnostics
        console.log('[SAVE TEST] Sending diagnostics:', diagnostics);
        res.json(diagnostics);

    } catch (error) {
        console.error('[SAVE TEST] Error in save test:', error);
        res.status(500).json({ message: 'Error in save test', error: error.message });
    }
});

// Direct keyframe test route - for updating keyframes directly
// IMPORTANT: Route must be defined BEFORE other /:id routes
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

// Debug route to inspect project data - MUST BE DEFINED BEFORE THE /:id ROUTE
router.get('/:id/debug', async (req, res) => {
    try {
        const projectId = req.params.id;
        console.log(`[DEBUG ROUTE] GET request received for project ID: ${projectId}`);
        logWithDetails(`DEBUG: Getting raw project data for ID: ${projectId}`);

        // Get raw project without any transformations
        const project = await Project.findById(projectId);

        if (!project) {
            console.log(`[DEBUG ROUTE] Project with ID ${projectId} not found`);
            return res.status(404).json({ message: 'Project not found' });
        }

        // Convert to object if needed
        const projectObj = project.toObject ? project.toObject() : project;

        // Basic debug info
        const debugInfo = {
            projectId: projectObj._id,
            projectName: projectObj.name,
            elementCount: projectObj.elements?.length || 0,
            hasKeyframesJson: Boolean(projectObj.keyframesJson),
            keyframesJsonLength: projectObj.keyframesJson ? projectObj.keyframesJson.length : 0,
            lastUpdated: projectObj.updatedAt,
            rawProject: projectObj
        };

        // Analyze keyframes data
        if (projectObj.keyframesJson) {
            try {
                // Try to parse to validate and analyze
                const keyframesData = JSON.parse(projectObj.keyframesJson);
                const elementIds = Object.keys(keyframesData);

                // Calculate total keyframes
                let totalKeyframes = 0;
                for (const elementId in keyframesData) {
                    if (Array.isArray(keyframesData[elementId])) {
                        totalKeyframes += keyframesData[elementId].length;
                    }
                }

                console.log(`[DEBUG ROUTE] keyframesJson is valid JSON with ${elementIds.length} element entries`);
                console.log(`[DEBUG ROUTE] Total keyframes in keyframesJson: ${totalKeyframes}`);

                // Add keyframe details to debug info
                debugInfo.keyframeData = {
                    elementCount: elementIds.length,
                    elementIds: elementIds,
                    totalKeyframes: totalKeyframes
                };

                // Element-by-element analysis
                debugInfo.elements = [];
                if (projectObj.elements && projectObj.elements.length > 0) {
                    projectObj.elements.forEach(element => {
                        const elementKeyframes = keyframesData[element.id] || [];

                        debugInfo.elements.push({
                            elementId: element.id,
                            elementType: element.type,
                            keyframeCount: elementKeyframes.length,
                            keyframeSample: elementKeyframes.length > 0 ? elementKeyframes[0] : null
                        });
                    });
                }
            } catch (err) {
                console.error(`[DEBUG ROUTE] keyframesJson is NOT valid JSON: ${err.message}`);
                debugInfo.parseError = err.message;
            }
        }

        // Check localStorage in DB if available
        try {
            const localStorageKey = `project-keyframes-${projectId}`;
            const localStorage = await mongoose.connection.db.collection('localStorage').findOne({ key: localStorageKey });

            if (localStorage && localStorage.value) {
                debugInfo.localStorage = {
                    exists: true,
                    dataLength: localStorage.value.length,
                    sample: localStorage.value.substring(0, 200) + '...'
                };

                // Try to parse localStorage data
                try {
                    const localStorageData = JSON.parse(localStorage.value);
                    debugInfo.localStorage.elementCount = Object.keys(localStorageData).length;
                    debugInfo.localStorage.totalKeyframes = Object.values(localStorageData).reduce(
                        (sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0
                    );
                } catch (e) {
                    debugInfo.localStorage.parseError = e.message;
                }
            } else {
                debugInfo.localStorage = { exists: false };
            }
        } catch (err) {
            debugInfo.localStorage = { error: err.message };
        }

        // Log results
        logWithDetails(`DEBUG results for project ${projectId}:`, debugInfo);
        console.log(`[DEBUG ROUTE] Sending debug response for project ${projectId}`);

        // Send debug info to client
        res.json(debugInfo);
    } catch (error) {
        console.error('[DEBUG ROUTE] Error fetching project debug info:', error);
        res.status(500).json({ message: 'Error fetching project debug info', error: error.message });
    }
});

// POST method for the debug route - Analyze a project object sent by client
router.post('/:id/debug', async (req, res) => {
    try {
        const projectId = req.params.id;
        console.log(`[DEBUG ROUTE] POST request received for project ID: ${projectId}`);

        // Get project data from request body
        const projectData = req.body;

        // Create detailed diagnostic info about the received project
        const diagnostics = {
            projectId,
            hasElements: Boolean(projectData.elements),
            elementCount: projectData.elements?.length || 0,
            elementsWithKeyframes: 0,
            totalKeyframes: 0,
            elementDetails: [],
            keyframesSample: null
        };

        // Analyze elements and keyframes
        if (projectData.elements && projectData.elements.length > 0) {
            projectData.elements.forEach((element, index) => {
                const keyframeCount = element.keyframes?.length || 0;

                if (keyframeCount > 0) {
                    diagnostics.elementsWithKeyframes++;
                    diagnostics.totalKeyframes += keyframeCount;

                    // Save a sample of the first keyframe we find
                    if (!diagnostics.keyframesSample && element.keyframes[0]) {
                        diagnostics.keyframesSample = element.keyframes[0];
                    }
                }

                // Collect element details
                diagnostics.elementDetails.push({
                    index,
                    id: element.id,
                    type: element.type,
                    keyframeCount,
                    hasKeyframesProperty: 'keyframes' in element,
                    keyframesType: element.keyframes ? typeof element.keyframes : 'undefined',
                    isKeyframesArray: Array.isArray(element.keyframes)
                });
            });
        }

        // Now process as the real save would, but just for diagnostics
        // CRITICAL: Extract and validate keyframes from all elements (from real save logic)
        const keyframesData = {};
        let totalKeyframes = 0;

        if (projectData.elements) {
            projectData.elements.forEach((element, index) => {
                if (element.id) {
                    if (element.keyframes && element.keyframes.length > 0) {
                        console.log(`[DEBUG ROUTE] Processing keyframes for element ${element.id}: ${element.keyframes.length} keyframes`);

                        // Filter valid keyframes
                        const validKeyframes = element.keyframes.filter(kf => {
                            const isValid = kf &&
                                typeof kf.time === 'number' && !isNaN(kf.time) &&
                                kf.position &&
                                typeof kf.position.x === 'number' && !isNaN(kf.position.x) &&
                                typeof kf.position.y === 'number' && !isNaN(kf.position.y) &&
                                typeof kf.opacity === 'number' && !isNaN(kf.opacity);

                            if (!isValid) {
                                console.log(`[DEBUG ROUTE] Invalid keyframe found:`, kf);
                            }

                            return isValid;
                        });

                        if (validKeyframes.length > 0) {
                            keyframesData[element.id] = validKeyframes;
                            totalKeyframes += validKeyframes.length;
                            console.log(`[DEBUG ROUTE] Added ${validKeyframes.length} valid keyframes for element ${element.id}`);
                        }
                    }
                }
            });
        }

        // Convert to JSON string (just like the real save would)
        let keyframesJson = null;
        try {
            if (totalKeyframes > 0) {
                keyframesJson = JSON.stringify(keyframesData);
                console.log(`[DEBUG ROUTE] Serialized ${totalKeyframes} keyframes to JSON string (${keyframesJson.length} chars)`);
            } else {
                keyframesJson = "{}";
                console.log(`[DEBUG ROUTE] No valid keyframes to serialize, using empty object`);
            }
        } catch (jsonError) {
            console.error('[DEBUG ROUTE] Error serializing keyframes to JSON:', jsonError);
        }

        // Add results to diagnostics
        diagnostics.extractedKeyframesData = {
            elementCount: Object.keys(keyframesData).length,
            totalKeyframes,
            sampleElementId: Object.keys(keyframesData)[0] || null,
            keyframesJsonLength: keyframesJson ? keyframesJson.length : 0
        };

        // Don't actually save to DB, just return the diagnostics
        console.log('[DEBUG ROUTE] Sending save diagnostics');
        res.json(diagnostics);

    } catch (error) {
        console.error('[DEBUG ROUTE] Error in save diagnostics:', error);
        res.status(500).json({ message: 'Error in save diagnostics', error: error.message });
    }
});

// GET a single project by ID (with access control)
router.get('/:id', ensureAuth, async (req, res) => {
    try {
        console.log('Fetching project:', req.params.id, 'for user:', req.user.id);

        const project = await Project.findById(req.params.id);

        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        // Check if user has access
        if (project.isPrivate && project.owner.toString() !== req.user.id) {
            console.log('Access denied: Project is private and user is not owner');
            return res.status(403).json({ message: 'Access denied' });
        }

        console.log('Project access granted');
        res.json(project);
    } catch (error) {
        console.error('Error fetching project:', error);
        res.status(500).json({ message: 'Error fetching project' });
    }
});

// POST create a new project
router.post('/', ensureAuth, async (req, res) => {
    try {
        console.log('Creating project for user:', req.user.id);
        console.log('Request body:', JSON.stringify(req.body, null, 2));
        console.log('User from auth:', req.user);

        // Remove _id if it's null to prevent Mongoose issues
        const projectData = { ...req.body };
        if (projectData._id === null) {
            delete projectData._id;
        }

        const project = new Project({
            ...projectData,
            owner: req.user.id,
            isPrivate: req.body.isPrivate !== undefined ? req.body.isPrivate : true
        });

        console.log('Project object before save:', JSON.stringify(project, null, 2));

        await project.save();
        console.log('Project created:', project._id);

        res.status(201).json(project);
    } catch (error) {
        console.error('Error creating project:', error);
        console.error('Error details:', error.stack);
        console.error('Validation errors:', error.errors);
        res.status(500).json({
            message: 'Error creating project',
            error: error.message,
            details: error.errors || error.stack
        });
    }
});

// PUT update project
router.put('/:id', ensureAuth, async (req, res) => {
    try {
        console.log('Updating project:', req.params.id, 'for user:', req.user.id);

        const project = await Project.findById(req.params.id);

        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        // Check if user is owner
        if (project.owner.toString() !== req.user.id) {
            console.log('Access denied: User is not project owner');
            return res.status(403).json({ message: 'Access denied' });
        }

        // Update project
        Object.assign(project, req.body);
        await project.save();

        console.log('Project updated successfully');
        res.json(project);
    } catch (error) {
        console.error('Error updating project:', error);
        res.status(500).json({ message: 'Error updating project' });
    }
});

// DELETE a project
router.delete('/:id', ensureAuth, async (req, res) => {
    try {
        console.log('Deleting project:', req.params.id, 'for user:', req.user.id);

        const project = await Project.findById(req.params.id);

        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        // Check if user is owner
        if (project.owner.toString() !== req.user.id) {
            console.log('Access denied: User is not project owner');
            return res.status(403).json({ message: 'Access denied' });
        }

        await project.remove();
        console.log('Project deleted successfully');

        res.json({ message: 'Project deleted' });
    } catch (error) {
        console.error('Error deleting project:', error);
        res.status(500).json({ message: 'Error deleting project' });
    }
});

module.exports = router; 