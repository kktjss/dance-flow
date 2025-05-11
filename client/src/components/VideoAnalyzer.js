import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { processVideoFrame } from '../services/api';

// Advanced frame differencing worker for better motion detection
/* COMMENTED OUT - NOT NEEDED FOR PAUSE MODE DETECTION
const createImageProcessor = () => {
    // Only create worker if browser supports it
    if (typeof Worker !== 'undefined') {
        try {
            const workerCode = `
                // Precompute conversion tables for performance
                const YCbCrTable = {
                    r: new Float32Array(256),
                    g: new Float32Array(256),
                    b: new Float32Array(256)
                };
                
                for(let i = 0; i < 256; i++) {
                    // Precalculated RGB to YCbCr conversion (just Y component)
                    YCbCrTable.r[i] = 0.299 * i;
                    YCbCrTable.g[i] = 0.587 * i;
                    YCbCrTable.b[i] = 0.114 * i;
                }
                
                self.onmessage = function(e) {
                    const {videoData, width, height, lastFrameData, threshold} = e.data;
                    
                    // Create canvas in worker
                    const canvas = new OffscreenCanvas(width, height);
                    const ctx = canvas.getContext('2d');
                    
                    // Draw image data to canvas
                    const imgData = new ImageData(new Uint8ClampedArray(videoData), width, height);
                    ctx.putImageData(imgData, 0, 0);
                    
                    // Detect motion if lastFrameData exists
                    let motionDetected = true;
                    let diffScore = 0;
                    let motionAreas = [];
                    
                    if (lastFrameData) {
                        const currentData = ctx.getImageData(0, 0, width, height).data;
                        const lastData = new Uint8ClampedArray(lastFrameData);
                        
                        // Optimized frame comparison - compare luminance only
                        // and use block-based comparison for better performance
                        const blockSize = 16; // 16x16 pixel blocks
                        const blocksX = Math.ceil(width / blockSize);
                        const blocksY = Math.ceil(height / blockSize);
                        let diffBlocks = 0;
                        const totalBlocks = blocksX * blocksY;
                        
                        // Process each block
                        for (let by = 0; by < blocksY; by++) {
                            for (let bx = 0; bx < blocksX; bx++) {
                                let blockDiff = 0;
                                let pixelsChecked = 0;
                                
                                // Sample a few pixels in the block for efficiency
                                const startX = bx * blockSize;
                                const startY = by * blockSize;
                                const endX = Math.min(startX + blockSize, width);
                                const endY = Math.min(startY + blockSize, height);
                                
                                // Skip some pixels for performance
                                const skipFactor = 2;
                                
                                for (let y = startY; y < endY; y += skipFactor) {
                                    const rowOffset = y * width * 4;
                                    
                                    for (let x = startX; x < endX; x += skipFactor) {
                                        const idx = rowOffset + x * 4;
                                        
                                        // Fast Y (luminance) calculation using precalculated tables
                                        const y1 = YCbCrTable.r[currentData[idx]] + YCbCrTable.g[currentData[idx+1]] + YCbCrTable.b[currentData[idx+2]];
                                        const y2 = YCbCrTable.r[lastData[idx]] + YCbCrTable.g[lastData[idx+1]] + YCbCrTable.b[lastData[idx+2]];
                                        
                                        const diff = Math.abs(y1 - y2);
                                        if (diff > 15) { // Threshold for luminance difference
                                            blockDiff++;
                                        }
                                        
                                        pixelsChecked++;
                                    }
                                }
                                
                                // If enough pixels changed, mark the block as different
                                if (pixelsChecked > 0 && blockDiff / pixelsChecked > 0.2) {
                                    diffBlocks++;
                                    motionAreas.push({x: bx, y: by});
                                }
                            }
                        }
                        
                        diffScore = diffBlocks / totalBlocks;
                        motionDetected = diffScore > threshold;
                    }
                    
                    // Optimized JPEG compression
                    const quality = motionDetected ? 0.7 : 0.6; // Lower quality if no motion
                    
                    // Create blob with optimized settings
                    canvas.convertToBlob({type: 'image/jpeg', quality}).then(blob => {
                        self.postMessage({
                            blob,
                            width,
                            height,
                            frameData: videoData,
                            motionDetected,
                            diffScore,
                            motionAreas
                        });
                    });
                };
            `;

            const blob = new Blob([workerCode], { type: 'application/javascript' });
            const worker = new Worker(URL.createObjectURL(blob));
            return worker;
        } catch (e) {
            console.warn('Failed to create worker:', e);
            return null;
        }
    }
    return null;
};
*/

// Create request queue for better network request management
const createRequestQueue = () => {
    const queue = [];
    let isProcessing = false;

    const processQueue = async () => {
        if (isProcessing || queue.length === 0) return;

        isProcessing = true;
        const { request, resolve, reject } = queue.shift();

        try {
            const response = await request();
            resolve(response);
        } catch (error) {
            reject(error);
        } finally {
            isProcessing = false;
            processQueue(); // Process next request
        }
    };

    return {
        add: (requestFn) => {
            return new Promise((resolve, reject) => {
                queue.push({ request: requestFn, resolve, reject });
                processQueue();
            });
        },
        clear: () => {
            queue.length = 0;
        },
        size: () => queue.length
    };
};

const VideoAnalyzer = ({ videoUrl, onPersonSelected, selectedPerson: externalSelectedPerson, isDancerSelectionMode }) => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const offscreenCanvasRef = useRef(null);
    const [selectedPerson, setSelectedPerson] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [currentPoses, setCurrentPoses] = useState([]);
    const [isVideoReady, setIsVideoReady] = useState(false);
    const lastProcessTime = useRef(0);
    const animationFrameRef = useRef(null);
    const isProcessingRef = useRef(false);
    const processingInProgress = useRef(false);
    const lastFrameData = useRef(null);
    const imageProcessorWorker = useRef(null);
    const requestQueue = useRef(null);
    const consecutiveErrorCount = useRef(0);
    const processingTimes = useRef([]);
    const lastSelectedPose = useRef(null);  // Track the last selected pose
    const poseSimilarityCache = useRef(new Map()); // Cache for pose similarity calculations
    const devicePixelRatio = useRef(window.devicePixelRatio || 1);
    const lastDetectedPoses = useRef([]);
    const framesToSkip = useRef(0);
    const [showMessage, setShowMessage] = useState(false);
    const overlayCanvasRef = useRef(null);
    const pausedForSelectionRef = useRef(false);

    // Improved adaptive settings to match device capabilities
    const [settings, setSettings] = useState({
        frameInterval: 1000 / 15, // Target 15 FPS 
        maxProcessingTime: 100, // Skip frames if processing takes too long (ms)
        quality: 0.8, // JPEG quality (0-1)
        motionThreshold: 0.05, // Motion detection threshold (0-1)
        motionDetectionEnabled: true, // Enable/disable motion detection
        resizeEnabled: true, // Enable/disable backend frame resize
        adaptiveQuality: true, // Enable/disable adaptive quality
        userDevicePerformance: 'medium', // 'low', 'medium', 'high'
        smartSkipping: true, // Enable smart frame skipping
        trackingMode: 'hybrid', // 'simple', 'advanced', 'hybrid'
        maxConcurrentRequests: 1, // Max concurrent requests to server
    });

    // Computed settings based on performance - more dynamic response to device capabilities
    const computedSettings = useMemo(() => {
        let quality = settings.quality;
        let frameInterval = settings.frameInterval;
        let motionThreshold = settings.motionThreshold;
        let skipThreshold = 0.02; // Default threshold for frame skipping
        let sizeLimit = 640; // Default max size for video frames

        // Adjust based on device performance
        if (settings.adaptiveQuality) {
            const avgProcessingTime = processingTimes.current.length > 0
                ? processingTimes.current.reduce((a, b) => a + b, 0) / processingTimes.current.length
                : 50;

            // More detailed performance tiers
            if (avgProcessingTime > 250) {
                // Very slow device
                quality = 0.5;
                frameInterval = 1000 / 6; // 6 FPS
                motionThreshold = 0.15;
                skipThreshold = 0.05;
                sizeLimit = 320;
            } else if (avgProcessingTime > 200) {
                // Slow device
                quality = 0.55;
                frameInterval = 1000 / 8; // 8 FPS
                motionThreshold = 0.12;
                skipThreshold = 0.04;
                sizeLimit = 480;
            } else if (avgProcessingTime > 150) {
                // Below average device
                quality = 0.6;
                frameInterval = 1000 / 10; // 10 FPS
                motionThreshold = 0.1;
                skipThreshold = 0.03;
                sizeLimit = 480;
            } else if (avgProcessingTime > 100) {
                // Average device
                quality = 0.65;
                frameInterval = 1000 / 12; // 12 FPS
                motionThreshold = 0.08;
                skipThreshold = 0.03;
                sizeLimit = 640;
            } else if (avgProcessingTime > 50) {
                // Good device
                quality = 0.75;
                frameInterval = 1000 / 15; // 15 FPS
                motionThreshold = 0.05;
                skipThreshold = 0.02;
                sizeLimit = 720;
            } else if (avgProcessingTime < 30) {
                // High-end device
                quality = 0.85;
                frameInterval = 1000 / 24; // 24 FPS
                motionThreshold = 0.02;
                skipThreshold = 0.01;
                sizeLimit = 960;
            }
        }

        return {
            quality,
            frameInterval,
            motionThreshold,
            skipThreshold,
            sizeLimit,
            type: 'image/jpeg',
        };
    }, [settings, processingTimes.current.length]);

    const frameSkipCount = useRef(0);
    const lastProcessingDuration = useRef(0);

    // Initialize worker and request queue when component mounts
    useEffect(() => {
        // Create image processor worker - COMMENTED OUT
        /* const worker = createImageProcessor();
        if (worker) {
            imageProcessorWorker.current = worker;

            // Set up worker message handler
            worker.onmessage = (e) => {
                const { blob, frameData, motionDetected, diffScore, motionAreas } = e.data;

                // Store frame data for next comparison
                lastFrameData.current = frameData;

                // If motion detection is enabled and no significant motion, skip processing
                if (settings.motionDetectionEnabled && !motionDetected && processingInProgress.current) {
                    // Skip processing but update frame skip counter for metrics
                    frameSkipCount.current++;

                    // Even with no motion, we should periodically process frames
                    // to ensure we don't miss pose changes
                    if (frameSkipCount.current % 15 === 0) { // Process every 15th frame minimum
                        processBlob(blob);
                    }
                    return;
                }

                // Determine if we should process this frame based on smart skipping
                if (settings.smartSkipping && framesToSkip.current > 0) {
                    framesToSkip.current--;
                    return;
                }

                // Process the blob if not already processing
                if (!processingInProgress.current) {
                    processBlob(blob);
                }
            };
        } */

        // Create request queue for network request management
        requestQueue.current = createRequestQueue();

        // Detect device performance
        detectDevicePerformance();

        // Memory cleanup
        return () => {
            // Cleanup worker
            if (imageProcessorWorker.current) {
                imageProcessorWorker.current.terminate();
            }

            // Clear request queue
            if (requestQueue.current) {
                requestQueue.current.clear();
            }

            // Clear caches
            poseSimilarityCache.current.clear();
            lastSelectedPose.current = null;
        };
    }, []);

    // Detect device performance
    const detectDevicePerformance = () => {
        // More sophisticated device detection
        const hardwareConcurrency = navigator.hardwareConcurrency || 2;
        const memory = navigator.deviceMemory || 4; // Default to 4GB if not available
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        let performanceLevel = 'medium';

        // Check device capabilities
        if (isMobile) {
            if (hardwareConcurrency <= 4 || memory <= 2) {
                performanceLevel = 'low';
            } else if (hardwareConcurrency >= 8 && memory >= 4) {
                performanceLevel = 'high';
            } else {
                performanceLevel = 'medium';
            }
        } else { // Desktop
            if (hardwareConcurrency <= 2 || memory <= 4) {
                performanceLevel = 'low';
            } else if (hardwareConcurrency >= 8 && memory >= 8) {
                performanceLevel = 'high';
            } else {
                performanceLevel = 'medium';
            }
        }

        setSettings(prev => ({
            ...prev,
            userDevicePerformance: performanceLevel,
            // Adjust settings based on detected performance
            quality: performanceLevel === 'low' ? 0.6 : performanceLevel === 'medium' ? 0.7 : 0.8,
            frameInterval: performanceLevel === 'low' ? 1000 / 10 : performanceLevel === 'medium' ? 1000 / 15 : 1000 / 24,
        }));
    };

    // Process blob and send to server with optimized network handling
    const processBlob = async (blob) => {
        if (processingInProgress.current) {
            return;
        }

        processingInProgress.current = true;
        try {
            // Create form data
            const formData = new FormData();
            formData.append('file', blob, 'frame.jpg');

            // Add resize parameter based on settings
            const resize = settings.resizeEnabled ? 1 : 0;

            // Use request queue to manage concurrent requests
            const makeRequest = async () => {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000);

                try {
                    const response = await fetch(`http://127.0.0.1:8000/process-frame?resize=${resize}`, {
                        method: 'POST',
                        body: formData,
                        headers: {
                            'Accept': 'application/json',
                        },
                        mode: 'cors',
                        credentials: 'omit',
                        signal: controller.signal
                    });

                    clearTimeout(timeoutId);

                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }

                    return await response.json();
                } finally {
                    clearTimeout(timeoutId);
                }
            };

            const startTime = performance.now();

            // Use the queue to manage the request
            const result = await requestQueue.current.add(makeRequest);

            const processingTime = performance.now() - startTime;

            // Store processing time for adaptive quality
            processingTimes.current.push(processingTime);
            if (processingTimes.current.length > 30) {
                processingTimes.current.shift();
            }

            lastProcessingDuration.current = processingTime;

            // Reset error count after successful request
            consecutiveErrorCount.current = 0;

            // Set smart frame skipping based on processing time
            if (settings.smartSkipping) {
                const skipFrames = Math.floor(processingTime / computedSettings.frameInterval);
                framesToSkip.current = Math.min(5, skipFrames); // Cap at 5 frames to skip
            }

            // Handle response
            if (result.success && canvasRef.current) {
                const canvas = canvasRef.current;
                const ctx = canvas.getContext('2d');

                // Create image from response
                const img = new Image();

                await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = reject;
                    img.src = `data:image/${result.format || 'png'};base64,${result.image}`;
                });

                // Clear canvas and draw skeleton
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                // Process landmarks
                if (result.landmarks && result.landmarks.length > 0) {
                    const poses = result.landmarks.map(landmarks => ({
                        keypoints: landmarks.map((landmark, index) => ({
                            name: `keypoint_${index}`,
                            x: landmark.x * canvas.width,
                            y: landmark.y * canvas.height,
                            score: landmark.visibility
                        }))
                    }));

                    // Save the detected poses for future reference
                    lastDetectedPoses.current = poses;

                    // Improved tracking logic using last selected pose
                    if (selectedPerson !== null && lastSelectedPose.current) {
                        const trackPose = () => {
                            // Try to find the selected person first by index if it exists
                            if (poses[selectedPerson]) {
                                const similarity = calculatePoseSimilarity(poses[selectedPerson], lastSelectedPose.current);

                                if (similarity > 0.7) {
                                    // Still tracking the same person at same index
                                    lastSelectedPose.current = poses[selectedPerson];
                                    return selectedPerson;
                                }
                            }

                            // If not found or similarity is low, search all poses
                            let bestMatch = null;
                            let bestSimilarity = 0;

                            poses.forEach((pose, index) => {
                                const similarity = calculatePoseSimilarity(pose, lastSelectedPose.current);
                                if (similarity > bestSimilarity) {
                                    bestSimilarity = similarity;
                                    bestMatch = index;
                                }
                            });

                            if (bestMatch !== null && bestSimilarity > 0.6) {
                                // Found a match in a different position
                                lastSelectedPose.current = poses[bestMatch];
                                return bestMatch;
                            }

                            // Keep current selection if we couldn't find a better match
                            return selectedPerson;
                        };

                        // Apply tracking strategy
                        const newSelectedPerson = trackPose();

                        if (newSelectedPerson !== selectedPerson) {
                            setSelectedPerson(newSelectedPerson);
                            if (onPersonSelected) {
                                onPersonSelected(newSelectedPerson);
                            }
                        }
                    } else if (selectedPerson !== null && selectedPerson < poses.length) {
                        // First frame after selection or no previous pose reference
                        lastSelectedPose.current = poses[selectedPerson];
                    }

                    setCurrentPoses(poses);
                } else {
                    setCurrentPoses([]);
                    // If no poses detected but we had a selection, keep the last selection
                    lastDetectedPoses.current = [];
                }
            }
        } catch (error) {
            console.error('Processing error:', error);
            consecutiveErrorCount.current++;
            if (consecutiveErrorCount.current >= 3) {
                console.warn('Multiple errors detected, reducing quality');
                setSettings(prev => ({
                    ...prev,
                    quality: Math.max(0.45, prev.quality - 0.15),
                    frameInterval: Math.min(200, prev.frameInterval * 1.5),
                    motionThreshold: Math.min(0.25, prev.motionThreshold + 0.05)
                }));
                consecutiveErrorCount.current = 0;
            }
            setCurrentPoses([]);
        } finally {
            processingInProgress.current = false;
        }
    };

    // Optimized pose similarity calculation with caching
    const calculatePoseSimilarity = (pose1, pose2) => {
        if (!pose1 || !pose2) return 0;

        // Create a cache key
        const keypoints1 = JSON.stringify(pose1.keypoints.map(kp => [Math.round(kp.x), Math.round(kp.y), kp.score > 0.5 ? 1 : 0]));
        const keypoints2 = JSON.stringify(pose2.keypoints.map(kp => [Math.round(kp.x), Math.round(kp.y), kp.score > 0.5 ? 1 : 0]));

        const cacheKey = keypoints1 + '|' + keypoints2;
        const reverseCacheKey = keypoints2 + '|' + keypoints1;

        // Check cache
        if (poseSimilarityCache.current.has(cacheKey)) {
            return poseSimilarityCache.current.get(cacheKey);
        }

        if (poseSimilarityCache.current.has(reverseCacheKey)) {
            return poseSimilarityCache.current.get(reverseCacheKey);
        }

        // Calculate similarity if not in cache
        let totalScore = 0;
        let validPoints = 0;
        let importantPointsScore = 0;
        let importantPointsCount = 0;

        // Define important keypoints for tracking (shoulders, hips, head)
        const importantIndices = [0, 11, 12, 23, 24]; // assuming these are the indices for head, shoulders, hips

        pose1.keypoints.forEach((kp1, i) => {
            const kp2 = pose2.keypoints[i];
            const isImportant = importantIndices.includes(i);

            if (kp1.score > 0.5 && kp2.score > 0.5) {
                const dx = kp1.x - kp2.x;
                const dy = kp1.y - kp2.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const similarity = Math.max(0, 1 - distance / 120);  // Adjusted normalization

                totalScore += similarity;
                validPoints++;

                if (isImportant) {
                    importantPointsScore += similarity;
                    importantPointsCount++;
                }
            }
        });

        // Calculate overall similarity with emphasis on important points
        let finalScore = 0;
        if (validPoints > 0) {
            const regularScore = totalScore / validPoints;
            const importantScore = importantPointsCount > 0 ? importantPointsScore / importantPointsCount : 0;
            finalScore = regularScore * 0.4 + importantScore * 0.6;  // Weight important points higher
        }

        // Cache the result (limit cache size to prevent memory issues)
        if (poseSimilarityCache.current.size > 1000) {
            // Clear half the cache when it gets too large
            const keys = Array.from(poseSimilarityCache.current.keys());
            keys.slice(0, 500).forEach(key => poseSimilarityCache.current.delete(key));
        }

        poseSimilarityCache.current.set(cacheKey, finalScore);
        return finalScore;
    };

    // Capture video frame at original resolution
    const captureVideoFrame = useCallback((video) => {
        if (!video) return null;

        // Always use the video's native dimensions
        const width = video.videoWidth;
        const height = video.videoHeight;

        console.log(`Capturing frame at native resolution: ${width}x${height}`);

        // Create canvas if needed
        if (!offscreenCanvasRef.current) {
            offscreenCanvasRef.current = document.createElement('canvas');
        }

        const canvas = offscreenCanvasRef.current;

        // Set canvas to match video dimensions exactly
        canvas.width = width;
        canvas.height = height;

        // Get context and draw the video frame
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Очищаем канвас перед рисованием
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Fill with black background first to ensure no transparency
        ctx.fillStyle = 'rgb(0,0,0)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Рисуем видео на канвас, гарантируя непрозрачность
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Проверяем данные пикселей (для отладки)
        try {
            const imageData = ctx.getImageData(0, 0, 10, 10);
            console.log(`Sample image data (first 10x10 pixels):`,
                imageData.data.length,
                `bytes, ${imageData.width}x${imageData.height} pixels`);
        } catch (e) {
            console.warn("Could not read image data:", e);
        }

        // Return as blob
        return new Promise(resolve => {
            canvas.toBlob(resolve, 'image/jpeg', 0.95); // Высокое качество JPEG, RGB формат
        });
    }, []);

    // Process video frame with optimized scheduling
    const processFrame = useCallback(async (timestamp) => {
        if (!isProcessingRef.current || !isVideoReady || !videoRef.current) {
            return;
        }

        // Apply adaptive frame rate control
        const targetInterval = computedSettings.frameInterval;
        if (timestamp - lastProcessTime.current < targetInterval) {
            animationFrameRef.current = requestAnimationFrame(processFrame);
            return;
        }

        // Skip if already processing a frame
        if (processingInProgress.current) {
            frameSkipCount.current++;
            if (frameSkipCount.current % 30 === 0) {
                console.log(`Skipped ${frameSkipCount.current} frames due to ongoing processing`);
            }
            animationFrameRef.current = requestAnimationFrame(processFrame);
            return;
        }

        // Skip frames if processing is taking too long (adaptive frame skipping)
        const skipThreshold = settings.maxProcessingTime;
        if (lastProcessingDuration.current > skipThreshold) {
            const skipFrames = Math.floor(lastProcessingDuration.current / skipThreshold);
            const targetFrameTime = targetInterval * skipFrames;

            if ((timestamp - lastProcessTime.current) < targetFrameTime) {
                animationFrameRef.current = requestAnimationFrame(processFrame);
                return;
            }
        }

        lastProcessTime.current = timestamp;

        // Get video element and its dimensions
        const video = videoRef.current;
        const canvas = canvasRef.current;

        if (canvas) {
            // Always use native video resolution for processing
            if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
                console.log(`Updating canvas dimensions to match video: ${video.videoWidth}x${video.videoHeight}`);
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
            }
        }

        // Capture frame - this will either return a blob or trigger the worker process
        const blob = await captureVideoFrame(video);

        // If blob was returned (not using worker), process it
        if (blob) {
            processBlob(blob);
        }

        // Continue the animation loop
        animationFrameRef.current = requestAnimationFrame(processFrame);
    }, [isVideoReady, captureVideoFrame, computedSettings, settings.maxProcessingTime]);

    // Логируем изменение режима выбора танцора
    useEffect(() => {
        console.log('Dancer selection mode changed:', isDancerSelectionMode);
    }, [isDancerSelectionMode]);

    // Обновляем внутреннее состояние при изменении внешнего
    useEffect(() => {
        setSelectedPerson(externalSelectedPerson);
    }, [externalSelectedPerson]);

    // Обработка готовности видео
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handleVideoReady = () => {
            console.log('Video is ready to play');
            setIsVideoReady(true);
        };

        const handleVideoError = (error) => {
            console.error('Error loading video:', error);
        };

        if (video.readyState >= 3) {
            handleVideoReady();
        }

        video.addEventListener('loadeddata', handleVideoReady);
        video.addEventListener('canplay', handleVideoReady);
        video.addEventListener('error', handleVideoError);

        return () => {
            video.removeEventListener('loadeddata', handleVideoReady);
            video.removeEventListener('canplay', handleVideoReady);
            video.removeEventListener('error', handleVideoError);
        };
    }, [videoUrl]);

    // Video processing setup
    useEffect(() => {
        if (!videoRef.current || !canvasRef.current || !isVideoReady) {
            return;
        }

        const video = videoRef.current;

        const handlePlay = () => {
            console.log('Video started playing, starting pose detection');
            isProcessingRef.current = true;
            setIsProcessing(true);
            frameSkipCount.current = 0;
            if (!animationFrameRef.current) {
                animationFrameRef.current = requestAnimationFrame(processFrame);
            }
        };

        const handlePause = () => {
            console.log('Video paused, stopping pose detection');
            isProcessingRef.current = false;
            setIsProcessing(false);
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
        };

        const handleEnded = () => {
            console.log('Video ended, stopping pose detection');
            isProcessingRef.current = false;
            setIsProcessing(false);
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
        };

        video.addEventListener('play', handlePlay);
        video.addEventListener('pause', handlePause);
        video.addEventListener('ended', handleEnded);

        return () => {
            console.log('Cleaning up video processing effect');
            video.removeEventListener('play', handlePlay);
            video.removeEventListener('pause', handlePause);
            video.removeEventListener('ended', handleEnded);
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
        };
    }, [isVideoReady, processFrame]);

    // Функция для проверки, находится ли точка клика внутри позы
    const isPointInPose = useCallback((x, y, pose) => {
        if (!pose || !pose.keypoints) return false;

        // Находим границы позы
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        pose.keypoints.forEach(keypoint => {
            if (keypoint.score > 0.5) {
                minX = Math.min(minX, keypoint.x);
                minY = Math.min(minY, keypoint.y);
                maxX = Math.max(maxX, keypoint.x);
                maxY = Math.max(maxY, keypoint.y);
            }
        });

        // Добавляем отступ для более удобного выбора
        const padding = 20;
        return x >= minX - padding && x <= maxX + padding &&
            y >= minY - padding && y <= maxY + padding;
    }, []);

    // Обработчик клика по canvas
    const handleCanvasClick = useCallback(async (event) => {
        // Only process clicks in dancer selection mode and when video is paused
        if (!isDancerSelectionMode || !videoRef.current || !videoRef.current.paused) {
            return;
        }

        setIsProcessing(true);
        setShowMessage(true);

        try {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const overlay = overlayCanvasRef.current;

            if (!video || !canvas || !overlay) {
                throw new Error("Video or canvas elements not available");
            }

            // Get overlay position and dimensions
            const overlayRect = overlay.getBoundingClientRect();

            // Get original video dimensions
            const videoWidth = video.videoWidth;
            const videoHeight = video.videoHeight;

            // Calculate the actual displayed video dimensions within the overlay
            const containerWidth = overlayRect.width;
            const containerHeight = overlayRect.height;
            const videoAspect = videoWidth / videoHeight;
            const containerAspect = containerWidth / containerHeight;

            let displayedWidth, displayedHeight, offsetX = 0, offsetY = 0;

            if (containerAspect > videoAspect) {
                // Video height is constrained to container height
                displayedHeight = containerHeight;
                displayedWidth = displayedHeight * videoAspect;
                // Calculate left offset for centering
                offsetX = (containerWidth - displayedWidth) / 2;
            } else {
                // Video width is constrained to container width
                displayedWidth = containerWidth;
                displayedHeight = displayedWidth / videoAspect;
                // Calculate top offset for centering
                offsetY = (containerHeight - displayedHeight) / 2;
            }

            // Calculate click position relative to the video display area
            const clickX = event.clientX - overlayRect.left - offsetX;
            const clickY = event.clientY - overlayRect.top - offsetY;

            // Convert click position to video coordinates
            const videoX = (clickX / displayedWidth) * videoWidth;
            const videoY = (clickY / displayedHeight) * videoHeight;

            console.log(`Click at client (${event.clientX}, ${event.clientY})`);
            console.log(`Video display: ${displayedWidth}x${displayedHeight} with offset (${offsetX}, ${offsetY})`);
            console.log(`Mapped to video coordinates: (${videoX}, ${videoY})`);

            // Skip if the click is outside the video display area
            if (clickX < 0 || clickX > displayedWidth || clickY < 0 || clickY > displayedHeight) {
                console.log("Click outside of video area");
                setIsProcessing(false);
                return;
            }

            // Ensure video frame is captured to canvas
            canvas.width = videoWidth;
            canvas.height = videoHeight;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });

            // Очищаем канвас перед рисованием
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Draw video on canvas with proper RGB format
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            // Проверяем данные пикселей (для отладки)
            try {
                const imageData = ctx.getImageData(0, 0, 10, 10);
                console.log(`Sample image data (first 10x10 pixels):`,
                    imageData.data.length,
                    `bytes, ${imageData.width}x${imageData.height} pixels`);
            } catch (e) {
                console.warn("Could not read image data:", e);
            }

            // Convert canvas to blob for API request with proper BGR encoding
            const blob = await new Promise(resolve => {
                canvas.toBlob(resolve, 'image/jpeg', 0.95);
            });

            // Send request to backend for pose detection with click coordinates
            console.log("Sending request for pose detection...");
            const result = await requestQueue.current.add(() =>
                processVideoFrame(blob, {
                    overlay: true,
                    resize: settings.resizeEnabled,
                    clickX: Math.round(videoX),
                    clickY: Math.round(videoY)
                })
            );

            console.log("Got result from server:", result);

            // Reset error count on successful request
            consecutiveErrorCount.current = 0;

            if (result.error) {
                console.error("Server returned error:", result.error);
                throw new Error(result.error);
            }

            // Check if poses were detected
            if (result.poses && result.poses.length > 0) {
                console.log(`Detected ${result.poses.length} poses, selected index: ${result.selected_pose_index}`);
                const poses = result.poses;
                setCurrentPoses(poses);

                // Get the selected pose if available
                if (result.selected_pose_index !== undefined) {
                    const selectedPose = poses[result.selected_pose_index];
                    console.log("Selected pose:", selectedPose);
                    setSelectedPerson(selectedPose);

                    if (onPersonSelected) {
                        onPersonSelected(selectedPose);
                    }

                    // Draw the pose overlay
                    if (result.image) {
                        console.log("Drawing pose overlay from server image");
                        drawPoseOverlay(result.image);
                    } else {
                        console.warn("No image data in result");
                    }

                    setShowMessage(false);
                } else {
                    // No pose was close to the click point
                    console.warn("No pose selected near click point");
                    setShowMessage(true);
                    setTimeout(() => setShowMessage(false), 3000);
                }
            } else {
                // No poses detected
                console.warn("No poses detected in the frame");
                setCurrentPoses([]);
                setSelectedPerson(null);
                setShowMessage(true);
                setTimeout(() => setShowMessage(false), 3000);
            }
        } catch (error) {
            console.error("Error processing click:", error);

            // Increment error count
            consecutiveErrorCount.current++;

            // Show error message briefly
            setShowMessage(true);
            setTimeout(() => setShowMessage(false), 3000);
        } finally {
            setIsProcessing(false);
        }
    }, [isDancerSelectionMode, onPersonSelected, settings.quality, settings.resizeEnabled]);

    // Draw the pose overlay on the transparent canvas
    const drawPoseOverlay = useCallback((imageData) => {
        if (!overlayCanvasRef.current || !videoRef.current) return;

        const video = videoRef.current;
        const overlay = overlayCanvasRef.current;

        // Ensure overlay dimensions match video dimensions
        if (overlay.width !== video.videoWidth || overlay.height !== video.videoHeight) {
            overlay.width = video.videoWidth;
            overlay.height = video.videoHeight;
            console.log(`Adjusted overlay dimensions to match video: ${overlay.width}x${overlay.height}`);
        }

        const img = new Image();
        img.onload = () => {
            const ctx = overlay.getContext('2d');

            // Clear previous drawing
            ctx.clearRect(0, 0, overlay.width, overlay.height);

            // Draw the pose skeleton from the server response
            ctx.drawImage(img, 0, 0, overlay.width, overlay.height);
            console.log("Pose overlay drawn successfully");
        };

        img.onerror = (err) => {
            console.error("Failed to load pose overlay image:", err);
        };

        // Set image source to the data URL from the server
        img.src = imageData;
    }, []);

    // Initialize canvas sizes when video is ready
    const setupCanvases = useCallback(() => {
        if (!videoRef.current) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const overlay = overlayCanvasRef.current;

        if (canvas && video.videoWidth && video.videoHeight) {
            console.log(`Setting up canvases for native video resolution: ${video.videoWidth}x${video.videoHeight}`);

            // Set the main canvas size to match video's native resolution
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            // Set the overlay canvas size to match video's native resolution
            if (overlay) {
                // Always use the original video dimensions for the canvas size
                overlay.width = video.videoWidth;
                overlay.height = video.videoHeight;

                console.log(`Overlay canvas set to: ${overlay.width}x${overlay.height}`);
            }
        }
    }, []);

    // Handle video events
    useEffect(() => {
        const video = videoRef.current;

        if (!video) return;

        const handleVideoReady = () => {
            setIsVideoReady(true);
            setupCanvases();
        };

        const handleVideoError = (error) => {
            console.error("Video error:", error);
            setIsVideoReady(false);
        };

        const handlePlay = () => {
            // Clear any pose overlays when video plays
            if (overlayCanvasRef.current) {
                const ctx = overlayCanvasRef.current.getContext('2d');
                ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
            }

            // If in dancer selection mode, pause the video
            if (isDancerSelectionMode && !pausedForSelectionRef.current) {
                video.pause();
                pausedForSelectionRef.current = true;
                setShowMessage(true);
                setTimeout(() => setShowMessage(false), 5000);
            }
        };

        const handlePause = () => {
            // Draw the current frame to the canvas when paused
            if (canvasRef.current && isVideoReady) {
                const ctx = canvasRef.current.getContext('2d');
                ctx.drawImage(video, 0, 0, canvasRef.current.width, canvasRef.current.height);
            }
        };

        // Add event listeners
        video.addEventListener('loadedmetadata', handleVideoReady);
        video.addEventListener('error', handleVideoError);
        video.addEventListener('play', handlePlay);
        video.addEventListener('pause', handlePause);

        // Clean up event listeners
        return () => {
            video.removeEventListener('loadedmetadata', handleVideoReady);
            video.removeEventListener('error', handleVideoError);
            video.removeEventListener('play', handlePlay);
            video.removeEventListener('pause', handlePause);
        };
    }, [isVideoReady, setupCanvases, isDancerSelectionMode]);

    // Update selected person from external props
    useEffect(() => {
        if (externalSelectedPerson !== undefined) {
            setSelectedPerson(externalSelectedPerson);
        }
    }, [externalSelectedPerson]);

    // Update effect when dancer selection mode changes
    useEffect(() => {
        const video = videoRef.current;

        if (!video) return;

        // If entering dancer selection mode and video is playing, pause it
        if (isDancerSelectionMode && !video.paused) {
            video.pause();
            pausedForSelectionRef.current = true;
            setShowMessage(true);
            setTimeout(() => setShowMessage(false), 5000);
        } else if (!isDancerSelectionMode) {
            // Reset when leaving dancer selection mode
            pausedForSelectionRef.current = false;

            // Clear overlay
            if (overlayCanvasRef.current) {
                const ctx = overlayCanvasRef.current.getContext('2d');
                ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
            }
        }
    }, [isDancerSelectionMode]);

    return (
        <div className="video-analyzer" style={{ position: 'relative', overflow: 'hidden', width: '100%', height: '100%' }}>
            {/* Main video element */}
            <video
                ref={videoRef}
                src={videoUrl}
                controls={!isDancerSelectionMode}
                style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 'auto',
                    height: 'auto',
                    maxWidth: '100%',
                    maxHeight: '100%',
                    pointerEvents: isDancerSelectionMode ? 'none' : 'auto'
                }}
            />

            {/* Hidden canvas for processing frames */}
            <canvas
                ref={canvasRef}
                style={{ display: 'none' }}
            />

            {/* Overlay canvas for displaying pose detection */}
            <canvas
                ref={overlayCanvasRef}
                onClick={handleCanvasClick}
                style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 'auto',
                    height: 'auto',
                    maxWidth: '100%',
                    maxHeight: '100%',
                    pointerEvents: isDancerSelectionMode ? 'auto' : 'none',
                    cursor: isDancerSelectionMode ? 'crosshair' : 'default'
                }}
            />

            {/* Instruction overlay in dancer selection mode */}
            {isDancerSelectionMode && (
                <div
                    style={{
                        position: 'absolute',
                        top: '10px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        backgroundColor: 'rgba(0, 0, 0, 0.7)',
                        color: 'white',
                        padding: '10px',
                        borderRadius: '5px',
                        textAlign: 'center',
                        maxWidth: '80%',
                        zIndex: 10
                    }}
                >
                    Click on a dancer to select them
                </div>
            )}

            {/* Processing or error message */}
            {showMessage && (
                <div
                    style={{
                        position: 'absolute',
                        bottom: '20px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        backgroundColor: isProcessing ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 0, 0, 0.7)',
                        color: 'white',
                        padding: '10px',
                        borderRadius: '5px',
                        textAlign: 'center',
                        zIndex: 10
                    }}
                >
                    {isProcessing ?
                        'Processing...' :
                        currentPoses.length ? 'No dancer found at click position' : 'No dancers detected'}
                </div>
            )}
        </div>
    );
};

export default VideoAnalyzer; 