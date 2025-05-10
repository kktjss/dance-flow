import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';

// Create offscreen worker for image processing if supported
const createImageProcessor = () => {
    // Only create worker if browser supports it
    if (typeof Worker !== 'undefined') {
        try {
            const workerCode = `
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
                    
                    if (lastFrameData) {
                        const currentData = ctx.getImageData(0, 0, width, height).data;
                        const lastData = new Uint8ClampedArray(lastFrameData);
                        
                        // Compare pixels (sample 1 in 10 pixels for performance)
                        let diffCount = 0;
                        const pixelsToCompare = Math.min(10000, currentData.length / 4);
                        const step = Math.floor(currentData.length / 4 / pixelsToCompare);
                        
                        for (let i = 0; i < currentData.length; i += step * 4) {
                            const diff = Math.abs(currentData[i] - lastData[i]) +
                                         Math.abs(currentData[i+1] - lastData[i+1]) +
                                         Math.abs(currentData[i+2] - lastData[i+2]);
                            if (diff > 30) {
                                diffCount++;
                            }
                        }
                        
                        diffScore = diffCount / pixelsToCompare;
                        motionDetected = diffScore > threshold;
                    }
                    
                    // Create blob
                    canvas.convertToBlob({type: 'image/jpeg', quality: 0.8}).then(blob => {
                        self.postMessage({
                            blob,
                            width,
                            height,
                            frameData: videoData,
                            motionDetected,
                            diffScore
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
    const consecutiveErrorCount = useRef(0);
    const processingTimes = useRef([]);

    // Settings with adaptive quality
    const [settings, setSettings] = useState({
        frameInterval: 1000 / 15, // Target 15 FPS 
        maxProcessingTime: 100, // Skip frames if processing takes longer than this (ms)
        quality: 0.8, // JPEG quality (0-1)
        motionThreshold: 0.05, // Motion detection threshold (0-1)
        motionDetectionEnabled: true, // Enable/disable motion detection
        resizeEnabled: true, // Enable/disable backend frame resize
        adaptiveQuality: true, // Enable/disable adaptive quality
        userDevicePerformance: 'medium', // 'low', 'medium', 'high'
    });

    // Computed settings based on performance
    const computedSettings = useMemo(() => {
        let quality = settings.quality;
        let frameInterval = settings.frameInterval;
        let motionThreshold = settings.motionThreshold;

        // Adjust based on device performance
        if (settings.adaptiveQuality) {
            const avgProcessingTime = processingTimes.current.length > 0
                ? processingTimes.current.reduce((a, b) => a + b, 0) / processingTimes.current.length
                : 50;

            if (avgProcessingTime > 200) {
                // Very slow device - reduce quality significantly
                quality = Math.max(0.5, quality - 0.2);
                frameInterval = 1000 / 8; // 8 FPS
                motionThreshold = 0.12; // More motion required to trigger frame processing
            } else if (avgProcessingTime > 100) {
                // Slow device - reduce quality moderately
                quality = Math.max(0.6, quality - 0.1);
                frameInterval = 1000 / 12; // 12 FPS
                motionThreshold = 0.08;
            } else if (avgProcessingTime < 40) {
                // Fast device - can use higher quality
                quality = Math.min(0.9, quality + 0.05);
                frameInterval = 1000 / 20; // 20 FPS
                motionThreshold = 0.02;
            }
        }

        return {
            quality,
            frameInterval,
            motionThreshold,
            // Always use these settings for consistency
            type: 'image/jpeg',
        };
    }, [settings]);

    const frameSkipCount = useRef(0);
    const lastProcessingDuration = useRef(0);

    // Initialize worker when component mounts
    useEffect(() => {
        // Create image processor worker
        const worker = createImageProcessor();
        if (worker) {
            imageProcessorWorker.current = worker;

            // Set up worker message handler
            worker.onmessage = (e) => {
                const { blob, frameData, motionDetected, diffScore } = e.data;

                // Store frame data for next comparison
                lastFrameData.current = frameData;

                // If motion detection is enabled and no significant motion, skip processing
                if (settings.motionDetectionEnabled && !motionDetected && processingInProgress.current) {
                    return;
                }

                // Process the blob if not already processing
                if (!processingInProgress.current) {
                    processBlob(blob);
                }
            };
        }

        // Detect device performance
        detectDevicePerformance();

        return () => {
            // Cleanup worker
            if (imageProcessorWorker.current) {
                imageProcessorWorker.current.terminate();
            }
        };
    }, []);

    // Detect device performance
    const detectDevicePerformance = () => {
        const hardwareConcurrency = navigator.hardwareConcurrency || 2;

        // Simple device performance estimation
        if (hardwareConcurrency <= 2) {
            setSettings(prev => ({ ...prev, userDevicePerformance: 'low' }));
        } else if (hardwareConcurrency <= 4) {
            setSettings(prev => ({ ...prev, userDevicePerformance: 'medium' }));
        } else {
            setSettings(prev => ({ ...prev, userDevicePerformance: 'high' }));
        }
    };

    // Process blob and send to server
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

            // Send to server with timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const startTime = performance.now();

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

            const result = await response.json();
            const processingTime = performance.now() - startTime;

            // Store processing time for adaptive quality
            processingTimes.current.push(processingTime);
            if (processingTimes.current.length > 30) {
                processingTimes.current.shift();
            }

            lastProcessingDuration.current = processingTime;

            // Reset error count after successful request
            consecutiveErrorCount.current = 0;

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
                    const pose = {
                        keypoints: result.landmarks.map((landmark, index) => ({
                            name: `keypoint_${index}`,
                            x: landmark.x * canvas.width,
                            y: landmark.y * canvas.height,
                            score: landmark.visibility
                        }))
                    };
                    setCurrentPoses([pose]);
                } else {
                    setCurrentPoses([]);
                }
            }
        } catch (error) {
            console.error('Processing error:', error);

            // Increment error count
            consecutiveErrorCount.current++;

            // After 3 consecutive errors, adjust quality settings
            if (consecutiveErrorCount.current >= 3) {
                console.warn('Multiple errors detected, reducing quality');
                setSettings(prev => ({
                    ...prev,
                    quality: Math.max(0.5, prev.quality - 0.1),
                    frameInterval: prev.frameInterval * 1.5,
                    motionThreshold: Math.min(0.2, prev.motionThreshold + 0.02)
                }));
                consecutiveErrorCount.current = 0;
            }

            setCurrentPoses([]);
        } finally {
            processingInProgress.current = false;
        }
    };

    // Логируем изменение режима выбора танцора
    useEffect(() => {
        console.log('Dancer selection mode changed:', isDancerSelectionMode);
    }, [isDancerSelectionMode]);

    // Обновляем внутреннее состояние при изменении внешнего
    useEffect(() => {
        setSelectedPerson(externalSelectedPerson);
    }, [externalSelectedPerson]);

    // Capture video frame using offscreen canvas if available or regular canvas
    const captureVideoFrame = useCallback((video) => {
        if (!video) return null;

        const width = video.videoWidth;
        const height = video.videoHeight;

        // Use worker if available
        if (imageProcessorWorker.current) {
            try {
                // Create temporary canvas to get video data
                if (!offscreenCanvasRef.current) {
                    offscreenCanvasRef.current = document.createElement('canvas');
                }
                const offCanvas = offscreenCanvasRef.current;
                offCanvas.width = width;
                offCanvas.height = height;
                const offCtx = offCanvas.getContext('2d');
                offCtx.drawImage(video, 0, 0, width, height);

                // Get image data and send to worker
                const imageData = offCtx.getImageData(0, 0, width, height);

                imageProcessorWorker.current.postMessage({
                    videoData: imageData.data.buffer,
                    width,
                    height,
                    lastFrameData: lastFrameData.current,
                    threshold: computedSettings.motionThreshold
                }, [imageData.data.buffer]); // Transfer the buffer to avoid copy

                return null; // Worker will handle the blob creation
            } catch (e) {
                console.warn('Worker processing failed, falling back to main thread:', e);
            }
        }

        // Fallback to main thread processing
        const canvas = offscreenCanvasRef.current || document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, width, height);

        return new Promise(resolve => {
            canvas.toBlob(resolve, computedSettings.type, computedSettings.quality);
        });
    }, [computedSettings]);

    // Process video frame
    const processFrame = useCallback(async (timestamp) => {
        if (!isProcessingRef.current || !isVideoReady || !videoRef.current) {
            return;
        }

        // Apply frame rate control
        if (timestamp - lastProcessTime.current < computedSettings.frameInterval) {
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
        if (lastProcessingDuration.current > settings.maxProcessingTime) {
            const skipFrames = Math.floor(lastProcessingDuration.current / settings.maxProcessingTime);
            if ((timestamp - lastProcessTime.current) < (computedSettings.frameInterval * skipFrames)) {
                animationFrameRef.current = requestAnimationFrame(processFrame);
                return;
            }
        }

        lastProcessTime.current = timestamp;

        // Set up canvas dimensions if needed
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (canvas && (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight)) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
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
    const handleCanvasClick = useCallback((event) => {
        if (!isDancerSelectionMode || !currentPoses.length) {
            return;
        }

        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const x = (event.clientX - rect.left) * scaleX;
        const y = (event.clientY - rect.top) * scaleY;

        // Ищем позу, в которой находится точка клика
        const clickedPoseIndex = currentPoses.findIndex(pose => isPointInPose(x, y, pose));

        if (clickedPoseIndex !== -1) {
            setSelectedPerson(clickedPoseIndex);
            if (onPersonSelected) {
                onPersonSelected(clickedPoseIndex);
            }
        } else {
            setSelectedPerson(null);
            if (onPersonSelected) {
                onPersonSelected(null);
            }
        }
    }, [isDancerSelectionMode, currentPoses, onPersonSelected, isPointInPose]);

    // Optional: Performance settings UI
    const [showSettings, setShowSettings] = useState(false);

    const toggleSettings = useCallback(() => {
        setShowSettings(prev => !prev);
    }, []);

    const handleSettingChange = useCallback((setting, value) => {
        setSettings(prev => ({ ...prev, [setting]: value }));
    }, []);

    return (
        <div className="video-analyzer-container" style={{ position: 'relative' }}>
            <video
                ref={videoRef}
                src={videoUrl}
                controls
                style={{ display: 'block', width: '100%' }}
            />
            <canvas
                ref={canvasRef}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    pointerEvents: isDancerSelectionMode ? 'auto' : 'none',
                }}
                onClick={handleCanvasClick}
            />
            {isProcessing && (
                <div className="processing-indicator" style={{
                    position: 'absolute',
                    bottom: 10,
                    right: 10,
                    background: 'rgba(0,0,0,0.5)',
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                }}>
                    Processing...
                </div>
            )}
            <button
                onClick={toggleSettings}
                style={{
                    position: 'absolute',
                    top: 10,
                    right: 10,
                    background: 'rgba(0,0,0,0.5)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    cursor: 'pointer',
                    fontSize: '12px',
                }}
            >
                ⚙️
            </button>

            {showSettings && (
                <div style={{
                    position: 'absolute',
                    top: 40,
                    right: 10,
                    background: 'rgba(0,0,0,0.7)',
                    color: 'white',
                    padding: '10px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    width: '200px',
                }}>
                    <div style={{ marginBottom: '8px' }}>
                        <label>
                            <input
                                type="checkbox"
                                checked={settings.adaptiveQuality}
                                onChange={e => handleSettingChange('adaptiveQuality', e.target.checked)}
                            />
                            Adaptive Quality
                        </label>
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                        <label>
                            <input
                                type="checkbox"
                                checked={settings.motionDetectionEnabled}
                                onChange={e => handleSettingChange('motionDetectionEnabled', e.target.checked)}
                            />
                            Motion Detection
                        </label>
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                        <label>
                            <input
                                type="checkbox"
                                checked={settings.resizeEnabled}
                                onChange={e => handleSettingChange('resizeEnabled', e.target.checked)}
                            />
                            Server Resize
                        </label>
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                        <label>
                            Quality: {Math.round(computedSettings.quality * 100)}%
                            <input
                                type="range"
                                min="0.5"
                                max="1"
                                step="0.05"
                                value={settings.quality}
                                onChange={e => handleSettingChange('quality', parseFloat(e.target.value))}
                                style={{ width: '100%' }}
                            />
                        </label>
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                        <label>
                            FPS: {Math.round(1000 / computedSettings.frameInterval)}
                            <input
                                type="range"
                                min="5"
                                max="30"
                                step="1"
                                value={Math.round(1000 / settings.frameInterval)}
                                onChange={e => handleSettingChange('frameInterval', 1000 / parseInt(e.target.value))}
                                style={{ width: '100%' }}
                            />
                        </label>
                    </div>
                    <div style={{ fontSize: '10px', opacity: 0.8 }}>
                        Device: {settings.userDevicePerformance}
                        <br />
                        Processing: {Math.round(lastProcessingDuration.current)}ms
                    </div>
                </div>
            )}
        </div>
    );
};

export default VideoAnalyzer; 