const express = require('express');
const router = express.Router();
const Project = require('../models/Project');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

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

// GET all projects
router.get('/', async (req, res) => {
    try {
        console.log('[GET ALL PROJECTS] Fetching all projects');

        // Find all projects, excluding keyframesJson field
        const projects = await Project.find({}, { keyframesJson: 0 });

        console.log(`[GET ALL PROJECTS] Found ${projects.length} projects`);
        res.json(projects);
    } catch (error) {
        console.error('[GET ALL PROJECTS] Error fetching projects:', error);
        res.status(500).json({ message: 'Error fetching projects', error: error.message });
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

// GET a single project by ID
router.get('/:id', async (req, res) => {
    try {
        const projectId = req.params.id;
        console.log(`[GET PROJECT] Fetching project with ID: ${projectId}`);

        // Get the project from the database
        const project = await Project.findById(projectId);

        if (!project) {
            console.log(`[GET PROJECT] Project with ID ${projectId} not found`);
            return res.status(404).json({ message: 'Project not found' });
        }

        console.log(`[GET PROJECT] Found project: ${project.name}`);

        // Convert to plain object to modify
        const projectToReturn = project.toObject();

        // Process keyframes back into elements
        let totalKeyframes = 0;
        if (projectToReturn.keyframesJson) {
            try {
                // Parse the keyframes JSON string
                const keyframesData = JSON.parse(projectToReturn.keyframesJson);
                console.log(`[GET PROJECT] Parsed keyframes data with ${Object.keys(keyframesData).length} element entries`);

                // Verify the parsed keyframes
                Object.keys(keyframesData).forEach(elementId => {
                    if (!Array.isArray(keyframesData[elementId])) {
                        console.error(`[GET PROJECT] Invalid keyframes format for element ${elementId}: not an array`);
                        keyframesData[elementId] = [];
                    } else {
                        const validKeyframes = keyframesData[elementId].filter(kf =>
                            kf &&
                            typeof kf.time === 'number' && !isNaN(kf.time) &&
                            kf.position &&
                            typeof kf.position.x === 'number' && !isNaN(kf.position.x) &&
                            typeof kf.position.y === 'number' && !isNaN(kf.position.y) &&
                            typeof kf.opacity === 'number' && !isNaN(kf.opacity)
                        );

                        if (validKeyframes.length !== keyframesData[elementId].length) {
                            console.warn(`[GET PROJECT] Filtered out ${keyframesData[elementId].length - validKeyframes.length} invalid keyframes for element ${elementId}`);
                        }

                        keyframesData[elementId] = validKeyframes;
                    }

                    totalKeyframes += keyframesData[elementId].length;
                });

                // Attach keyframes to elements
                let attachedKeyframes = 0;
                projectToReturn.elements.forEach(element => {
                    if (element.id && keyframesData[element.id]) {
                        element.keyframes = keyframesData[element.id];
                        attachedKeyframes += element.keyframes.length;
                        console.log(`[GET PROJECT] Attached ${element.keyframes.length} keyframes to element ${element.id}`);
                    } else {
                        console.log(`[GET PROJECT] No keyframes found for element ${element.id}, creating empty array`);
                        element.keyframes = [];
                    }
                });

                console.log(`[GET PROJECT] Total attached keyframes: ${attachedKeyframes}/${totalKeyframes}`);

                // For diagnostic purposes, check if all keyframes were attached
                if (attachedKeyframes < totalKeyframes) {
                    console.warn(`[GET PROJECT] Not all keyframes were attached! Stored: ${totalKeyframes}, Attached: ${attachedKeyframes}`);
                }
            } catch (parseError) {
                console.error('[GET PROJECT] Error parsing keyframes JSON:', parseError);
                // Ensure all elements have an empty keyframes array
                if (projectToReturn.elements) {
                    projectToReturn.elements.forEach(element => {
                        element.keyframes = [];
                    });
                }
            }
        } else {
            console.log('[GET PROJECT] No keyframes data found in project');
            // Ensure all elements have an empty keyframes array
            if (projectToReturn.elements) {
                projectToReturn.elements.forEach(element => {
                    element.keyframes = [];
                });
            }
        }

        // Remove keyframesJson from response
        delete projectToReturn.keyframesJson;

        // Validate the project structure before returning
        if (!projectToReturn.elements) {
            console.warn('[GET PROJECT] Project has no elements array, initializing empty array');
            projectToReturn.elements = [];
        }

        console.log(`[GET PROJECT] Returning project with ${projectToReturn.elements.length} elements and ${projectToReturn.elements.reduce((sum, el) => sum + (el.keyframes?.length || 0), 0)} total keyframes`);

        res.json(projectToReturn);
    } catch (error) {
        console.error('[GET PROJECT] Error fetching project:', error);
        res.status(500).json({ message: 'Error fetching project', error: error.message });
    }
});

// POST create a new project
router.post('/', async (req, res) => {
    try {
        console.log('[CREATE PROJECT] Processing new project creation request');

        // Get the project data from the request body
        const projectData = req.body;
        console.log(`[CREATE PROJECT] New project has ${projectData.elements?.length || 0} elements`);

        // Validate project data
        if (!projectData) {
            console.error('[CREATE PROJECT] Invalid project data - missing data');
            return res.status(400).json({ message: 'Invalid project data' });
        }

        // Ensure elements array exists
        if (!projectData.elements) {
            console.log('[CREATE PROJECT] No elements array provided, initializing empty array');
            projectData.elements = [];
        }

        // CRITICAL: Extract and validate keyframes from all elements
        const keyframesData = {};
        let totalKeyframes = 0;

        projectData.elements.forEach((element, index) => {
            if (element.id) {
                // Initialize keyframes array if it doesn't exist
                if (!element.keyframes) {
                    console.log(`[CREATE PROJECT] Element ${element.id} has no keyframes array, creating empty array`);
                    element.keyframes = [];
                } else if (!Array.isArray(element.keyframes)) {
                    console.error(`[CREATE PROJECT] Element ${element.id} has non-array keyframes: ${typeof element.keyframes}`);
                    element.keyframes = [];
                }

                // Validate each keyframe and collect valid ones
                if (element.keyframes && element.keyframes.length > 0) {
                    console.log(`[CREATE PROJECT] Element ${element.id} has ${element.keyframes.length} keyframes`);

                    // Filter valid keyframes
                    const validKeyframes = element.keyframes.filter(kf => {
                        const isValid = kf &&
                            typeof kf.time === 'number' && !isNaN(kf.time) &&
                            kf.position &&
                            typeof kf.position.x === 'number' && !isNaN(kf.position.x) &&
                            typeof kf.position.y === 'number' && !isNaN(kf.position.y) &&
                            typeof kf.opacity === 'number' && !isNaN(kf.opacity);

                        if (!isValid) {
                            console.error(`[CREATE PROJECT] Invalid keyframe found in element ${element.id}:`, kf);
                        }

                        return isValid;
                    });

                    if (validKeyframes.length !== element.keyframes.length) {
                        console.warn(`[CREATE PROJECT] Filtered out ${element.keyframes.length - validKeyframes.length} invalid keyframes from element ${element.id}`);
                    }

                    if (validKeyframes.length > 0) {
                        keyframesData[element.id] = validKeyframes;
                        totalKeyframes += validKeyframes.length;
                        console.log(`[CREATE PROJECT] Saved ${validKeyframes.length} valid keyframes for element ${element.id}`);
                    }

                    // Remove keyframes from element to avoid duplication
                    delete element.keyframes;
                }
            } else {
                console.error(`[CREATE PROJECT] Element at index ${index} is missing ID, cannot save keyframes`);
            }
        });

        console.log(`[CREATE PROJECT] Total extracted keyframes: ${totalKeyframes} from ${Object.keys(keyframesData).length} elements`);

        // Convert keyframesData to JSON string
        let keyframesJson = null;
        try {
            if (totalKeyframes > 0) {
                keyframesJson = JSON.stringify(keyframesData);
                console.log(`[CREATE PROJECT] Serialized ${totalKeyframes} keyframes to JSON string (${keyframesJson.length} chars)`);

                // Verify JSON is valid by parsing it back
                const parsed = JSON.parse(keyframesJson);
                const parsedKeyframesCount = Object.values(parsed).reduce((sum, arr) => sum + arr.length, 0);
                if (parsedKeyframesCount !== totalKeyframes) {
                    console.error(`[CREATE PROJECT] JSON serialization/deserialization issue: ${parsedKeyframesCount} != ${totalKeyframes}`);
                }
            } else {
                console.log('[CREATE PROJECT] No valid keyframes to save');
            }
        } catch (jsonError) {
            console.error('[CREATE PROJECT] Error serializing keyframes to JSON:', jsonError);
            return res.status(500).json({ message: 'Error processing keyframes', error: jsonError.message });
        }

        // Set timestamps
        const now = new Date();
        projectData.createdAt = now;
        projectData.updatedAt = now;

        // Create a new project with keyframesJson
        const newProject = new Project({
            ...projectData,
            keyframesJson
        });

        // Save the new project
        const savedProject = await newProject.save();
        console.log(`[CREATE PROJECT] New project saved successfully with ID: ${savedProject._id}`);

        // Convert to plain object to modify
        const projectToReturn = savedProject.toObject();

        // Process keyframes back into elements
        if (projectToReturn.keyframesJson) {
            try {
                const keyframesData = JSON.parse(projectToReturn.keyframesJson);
                console.log(`[CREATE PROJECT] Parsed keyframes data with ${Object.keys(keyframesData).length} element entries`);

                // Attach keyframes to corresponding elements
                let attachedKeyframes = 0;
                projectToReturn.elements.forEach(element => {
                    if (keyframesData[element.id]) {
                        element.keyframes = keyframesData[element.id];
                        attachedKeyframes += element.keyframes.length;
                        console.log(`[CREATE PROJECT] Attached ${element.keyframes.length} keyframes to element ${element.id}`);
                    } else {
                        element.keyframes = [];
                    }
                });

                console.log(`[CREATE PROJECT] Total attached keyframes: ${attachedKeyframes}`);

                // Remove keyframesJson from response
                delete projectToReturn.keyframesJson;
            } catch (parseError) {
                console.error('[CREATE PROJECT] Error parsing keyframes JSON:', parseError);
                // Still return the project but with empty keyframes
                projectToReturn.elements.forEach(element => {
                    element.keyframes = [];
                });
            }
        } else {
            console.log('[CREATE PROJECT] No keyframes data found in created project');
            // Ensure all elements have keyframes array
            projectToReturn.elements.forEach(element => {
                element.keyframes = [];
            });
        }

        console.log(`[CREATE PROJECT] Returning new project with ${projectToReturn.elements.length} elements`);

        res.status(201).json(projectToReturn);
    } catch (error) {
        console.error('[CREATE PROJECT] Error creating project:', error);
        res.status(500).json({ message: 'Error creating project', error: error.message });
    }
});

// PUT update project
router.put('/:id', async (req, res) => {
    try {
        const projectId = req.params.id;
        console.log(`[UPDATE PROJECT] Processing update for project ID: ${projectId}`);

        // Get the project data from the request body
        const projectData = req.body;
        console.log(`[UPDATE PROJECT] Project has ${projectData.elements?.length || 0} elements`);

        // Validate project data
        if (!projectData || !projectData.elements) {
            console.error('[UPDATE PROJECT] Invalid project data - missing elements array');
            return res.status(400).json({ message: 'Invalid project data' });
        }

        // CRITICAL: Extract and validate keyframes from all elements
        const keyframesData = {};
        let totalKeyframes = 0;

        projectData.elements.forEach((element, index) => {
            if (element.id) {
                // Initialize keyframes array if it doesn't exist
                if (!element.keyframes) {
                    console.log(`[UPDATE PROJECT] Element ${element.id} has no keyframes array, creating empty array`);
                    element.keyframes = [];
                } else if (!Array.isArray(element.keyframes)) {
                    console.error(`[UPDATE PROJECT] Element ${element.id} has non-array keyframes: ${typeof element.keyframes}`);
                    element.keyframes = [];
                }

                // Validate each keyframe and collect valid ones
                if (element.keyframes && element.keyframes.length > 0) {
                    console.log(`[UPDATE PROJECT] Element ${element.id} has ${element.keyframes.length} keyframes`);

                    // Filter valid keyframes
                    const validKeyframes = element.keyframes.filter(kf => {
                        const isValid = kf &&
                            typeof kf.time === 'number' && !isNaN(kf.time) &&
                            kf.position &&
                            typeof kf.position.x === 'number' && !isNaN(kf.position.x) &&
                            typeof kf.position.y === 'number' && !isNaN(kf.position.y) &&
                            typeof kf.opacity === 'number' && !isNaN(kf.opacity);

                        if (!isValid) {
                            console.error(`[UPDATE PROJECT] Invalid keyframe found in element ${element.id}:`, kf);
                        }

                        return isValid;
                    });

                    if (validKeyframes.length !== element.keyframes.length) {
                        console.warn(`[UPDATE PROJECT] Filtered out ${element.keyframes.length - validKeyframes.length} invalid keyframes from element ${element.id}`);
                    }

                    if (validKeyframes.length > 0) {
                        keyframesData[element.id] = validKeyframes;
                        totalKeyframes += validKeyframes.length;
                        console.log(`[UPDATE PROJECT] Saved ${validKeyframes.length} valid keyframes for element ${element.id}`);
                    }

                    // Remove keyframes from element to avoid duplication
                    delete element.keyframes;
                }
            } else {
                console.error(`[UPDATE PROJECT] Element at index ${index} is missing ID, cannot save keyframes`);
            }
        });

        console.log(`[UPDATE PROJECT] Total extracted keyframes: ${totalKeyframes} from ${Object.keys(keyframesData).length} elements`);

        // Convert keyframesData to JSON string
        let keyframesJson = null;
        try {
            if (totalKeyframes > 0) {
                keyframesJson = JSON.stringify(keyframesData);
                console.log(`[UPDATE PROJECT] Serialized ${totalKeyframes} keyframes to JSON string (${keyframesJson.length} chars)`);

                // Verify JSON is valid by parsing it back
                const parsed = JSON.parse(keyframesJson);
                const parsedKeyframesCount = Object.values(parsed).reduce((sum, arr) => sum + arr.length, 0);
                if (parsedKeyframesCount !== totalKeyframes) {
                    console.error(`[UPDATE PROJECT] JSON serialization/deserialization issue: ${parsedKeyframesCount} != ${totalKeyframes}`);
                }
            } else {
                console.log('[UPDATE PROJECT] No valid keyframes to save');
                keyframesJson = "{}";
            }
        } catch (jsonError) {
            console.error('[UPDATE PROJECT] Error serializing keyframes to JSON:', jsonError);
            return res.status(500).json({ message: 'Error processing keyframes', error: jsonError.message });
        }

        // Set updated timestamp
        projectData.updatedAt = new Date();

        // Remove any keyframes from projectData (they should be in keyframesJson)
        if (projectData.elements) {
            projectData.elements.forEach(element => {
                if (element.keyframes) {
                    delete element.keyframes;
                }
            });
        }

        // Save keyframesJson to the project
        const updateData = {
            ...projectData,
            keyframesJson
        };

        console.log(`[UPDATE PROJECT] Final keyframesJson length: ${keyframesJson ? keyframesJson.length : 0}`);
        console.log(`[UPDATE PROJECT] keyframesJson sample: ${keyframesJson ? keyframesJson.substring(0, 100) + '...' : 'null'}`);

        // For direct debugging, log the entire updateData object
        logWithDetails("[UPDATE PROJECT] Full update data for MongoDB:", {
            projectId,
            totalKeyframes,
            keyframesJsonLength: keyframesJson ? keyframesJson.length : 0,
            updateData: {
                ...updateData,
                keyframesJson: keyframesJson ? (keyframesJson.length > 100 ? keyframesJson.substring(0, 100) + '...' : keyframesJson) : null
            }
        });

        // CRITICAL FIX: Make sure we're using the correct method for the update
        // Update the project in the database with an explicit update of the keyframesJson field
        try {
            // First update the project excluding the keyframesJson field
            const { keyframesJson: _removed, ...dataWithoutKeyframes } = updateData;

            // First step: update basic project data
            let result = await Project.findByIdAndUpdate(
                projectId,
                dataWithoutKeyframes,
                { new: true, runValidators: true }
            );

            if (!result) {
                console.error(`[UPDATE PROJECT] Project with ID ${projectId} not found`);
                return res.status(404).json({ message: 'Project not found' });
            }

            // Second step: update keyframesJson separately to avoid any potential issues
            if (keyframesJson) {
                console.log(`[UPDATE PROJECT] Updating keyframesJson field separately`);
                result = await Project.findByIdAndUpdate(
                    projectId,
                    { keyframesJson },
                    { new: true }
                );

                console.log(`[UPDATE PROJECT] keyframesJson update completed`);
            }

            console.log(`[UPDATE PROJECT] Project updated successfully: ${result.name}`);

            // Verify keyframesJson was properly saved
            const verifyProject = await Project.findById(projectId);
            const savedKeyframesJson = verifyProject.keyframesJson;
            console.log(`[UPDATE PROJECT] Verification: keyframesJson in DB has length ${savedKeyframesJson ? savedKeyframesJson.length : 0}`);

            if (savedKeyframesJson) {
                try {
                    const parsedKeyframes = JSON.parse(savedKeyframesJson);
                    const elementCount = Object.keys(parsedKeyframes).length;
                    const savedKeyframesCount = Object.values(parsedKeyframes).reduce(
                        (sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0
                    );
                    console.log(`[UPDATE PROJECT] Verification: saved ${savedKeyframesCount} keyframes for ${elementCount} elements`);
                } catch (e) {
                    console.error(`[UPDATE PROJECT] Verification: failed to parse saved keyframesJson: ${e.message}`);
                }
            }

            // Fetch the updated project with keyframes reattached
            const updatedProject = await Project.findById(projectId);

            if (!updatedProject) {
                console.error('[UPDATE PROJECT] Failed to fetch updated project');
                return res.status(500).json({ message: 'Failed to fetch updated project' });
            }

            // Convert to plain object to modify
            const projectToReturn = updatedProject.toObject();

            // Process keyframes back into elements
            if (projectToReturn.keyframesJson) {
                try {
                    const keyframesData = JSON.parse(projectToReturn.keyframesJson);
                    console.log(`[UPDATE PROJECT] Parsed keyframes data with ${Object.keys(keyframesData).length} element entries`);

                    // Attach keyframes to corresponding elements
                    let attachedKeyframes = 0;
                    projectToReturn.elements.forEach(element => {
                        if (keyframesData[element.id]) {
                            element.keyframes = keyframesData[element.id];
                            attachedKeyframes += element.keyframes.length;
                            console.log(`[UPDATE PROJECT] Attached ${element.keyframes.length} keyframes to element ${element.id}`);
                        } else {
                            element.keyframes = [];
                        }
                    });

                    console.log(`[UPDATE PROJECT] Total attached keyframes: ${attachedKeyframes}`);

                    // Remove keyframesJson from response
                    delete projectToReturn.keyframesJson;
                } catch (parseError) {
                    console.error('[UPDATE PROJECT] Error parsing keyframes JSON:', parseError);
                    // Still return the project but with empty keyframes
                    projectToReturn.elements.forEach(element => {
                        element.keyframes = [];
                    });
                }
            } else {
                console.log('[UPDATE PROJECT] No keyframes data found in updated project');
                // Ensure all elements have keyframes array
                projectToReturn.elements.forEach(element => {
                    element.keyframes = [];
                });
            }

            console.log(`[UPDATE PROJECT] Returning updated project with ${projectToReturn.elements.length} elements`);

            res.json(projectToReturn);
        } catch (dbError) {
            console.error('[UPDATE PROJECT] Database error:', dbError);
            return res.status(500).json({ message: 'Database error during update', error: dbError.message });
        }
    } catch (error) {
        console.error('[UPDATE PROJECT] Error updating project:', error);
        res.status(500).json({ message: 'Error updating project', error: error.message });
    }
});

// DELETE a project
router.delete('/:id', async (req, res) => {
    try {
        const projectId = req.params.id;
        console.log(`[DELETE PROJECT] Deleting project with ID: ${projectId}`);

        const result = await Project.findByIdAndDelete(projectId);

        if (!result) {
            console.log(`[DELETE PROJECT] Project with ID ${projectId} not found`);
            return res.status(404).json({ message: 'Project not found' });
        }

        console.log(`[DELETE PROJECT] Project deleted successfully: ${result.name}`);
        res.json({ message: 'Project deleted successfully' });
    } catch (error) {
        console.error('[DELETE PROJECT] Error deleting project:', error);
        res.status(500).json({ message: 'Error deleting project', error: error.message });
    }
});

module.exports = router; 