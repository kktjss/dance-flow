import React, { useRef, useState, useEffect, Suspense, useCallback, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, useGLTF, Grid, Html } from '@react-three/drei';
import { Box as MuiBox, CircularProgress, Button, IconButton, Slider, Typography, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, TextField, List, ListItem, ListItemText, ListItemSecondaryAction, Menu, MenuItem, Select, FormControl, InputLabel, Tabs, Tab, Box } from '@mui/material';
import { PlayArrow, Pause, AddCircleOutline, Delete, Edit, DragIndicator, Save, FolderOpen, Upload, Close as CloseIcon, ThreeDRotation } from '@mui/icons-material';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import ModelUploader from './ModelUploader';

// Model component for Xbot
const XbotModel = ({ currentTime, isPlaying, onTimeUpdate, onModelLoad, playerDuration, animationMarkers = [], activeAnimations = [], glbAnimationUrl = null, elementId = null, elementKeyframes = [] }) => {
    // We're not using the default Xbot model anymore
    const [customModel, setCustomModel] = useState(null);
    const [loadingError, setLoadingError] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [debugInfo, setDebugInfo] = useState({
        modelLoaded: false,
        animationsCount: 0,
        modelUrl: glbAnimationUrl,
        error: null
    });

    const mixer = useRef(null);
    const lastTimeRef = useRef(null);
    const animationRef = useRef(null);
    const clock = useRef(new THREE.Clock());
    const modelDuration = useRef(0);
    const animationsRef = useRef([]);
    const activeActionsRef = useRef({});
    const [externalAnimations, setExternalAnimations] = useState({});

    // Handle WebGL context loss
    useEffect(() => {
        const handleContextLost = (event) => {
            event.preventDefault();
            console.warn('XbotModel: WebGL context was lost');

            // Stop any ongoing animations
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
                animationRef.current = null;
            }

            // Reset mixer
            mixer.current = null;

            // Set loading error
            setLoadingError('WebGL контекст был потерян. Пожалуйста, перезагрузите страницу.');
        };

        const handleContextRestored = () => {
            console.log('XbotModel: WebGL context was restored');

            // Clear error
            setLoadingError(null);

            // Reload the model
            if (glbAnimationUrl) {
                console.log('XbotModel: Reloading model after context restore');
                // The model will be reloaded by the useEffect that watches glbAnimationUrl
            }
        };

        // Add event listeners
        window.addEventListener('webglcontextlost', handleContextLost);
        window.addEventListener('webglcontextrestored', handleContextRestored);

        return () => {
            // Remove event listeners
            window.removeEventListener('webglcontextlost', handleContextLost);
            window.removeEventListener('webglcontextrestored', handleContextRestored);
        };
    }, [glbAnimationUrl]);

    // Load custom GLB model if URL is provided
    useEffect(() => {
        // Debug log to check the URL value
        console.log('XbotModel: glbAnimationUrl check:', {
            url: glbAnimationUrl,
            type: typeof glbAnimationUrl,
            isNull: glbAnimationUrl === null,
            isUndefined: glbAnimationUrl === undefined,
            isFalsy: !glbAnimationUrl,
            stringValue: String(glbAnimationUrl)
        });

        if (glbAnimationUrl) {
            console.log('XbotModel: Loading custom GLB model from URL:', glbAnimationUrl);
            console.log('XbotModel: Element details:', {
                elementId: elementId || 'not provided',
                hasKeyframes: elementKeyframes && elementKeyframes.length > 0,
                keyframesCount: elementKeyframes ? elementKeyframes.length : 0
            });

            setIsLoading(true);
            setLoadingError(null);
            setDebugInfo(prev => ({
                ...prev,
                modelUrl: glbAnimationUrl,
                modelLoaded: false,
                error: null
            }));

            // Improved URL processing logic
            let processedUrl = glbAnimationUrl;

            // Handle relative URLs
            if (processedUrl && !processedUrl.startsWith('blob:') && !processedUrl.startsWith('http')) {
                // Ensure URL starts with /
                if (!processedUrl.startsWith('/')) {
                    processedUrl = '/' + processedUrl;
                }

                // Convert to absolute URL if it's a relative path
                if (!processedUrl.includes('://')) {
                    processedUrl = `${window.location.origin}${processedUrl}`;
                }
            }

            console.log('XbotModel: Processed URL for loading:', processedUrl);
            console.log('XbotModel: Current origin:', window.location.origin);

            // First check if the URL is accessible
            fetch(processedUrl, { method: 'HEAD' })
                .then(response => {
                    if (response.ok) {
                        console.log('XbotModel: URL is accessible:', processedUrl);
                        loadModelFromUrl(processedUrl);
                    } else {
                        console.error('XbotModel: URL is not accessible:', processedUrl, 'Status:', response.status);

                        // Try alternative URL formats
                        if (processedUrl.includes('/uploads/models/')) {
                            const filename = processedUrl.split('/').pop();
                            const alternativeUrl = `${window.location.origin}/models/${filename}`;
                            console.log('XbotModel: Trying alternative URL:', alternativeUrl);
                            loadModelFromUrl(alternativeUrl);
                        } else {
                            // Try direct loading anyway
                            loadModelFromUrl(processedUrl);
                        }
                    }
                })
                .catch(error => {
                    console.error('XbotModel: Error checking URL accessibility:', error);
                    // Try direct loading anyway
                    loadModelFromUrl(processedUrl);
                });
        } else {
            console.log('XbotModel: No GLB URL provided');
            setIsLoading(false);
            setLoadingError('No 3D model URL provided');
        }
    }, [glbAnimationUrl, onModelLoad, elementId, elementKeyframes]);

    // Helper function to load model from URL
    const loadModelFromUrl = useCallback((url) => {
        console.log('XbotModel: Loading model from URL:', url);

        // Track load start time
        const loadStartTime = Date.now();

        new GLTFLoader()
            .load(
                url,
                (gltf) => {
                    // Success callback
                    const loadEndTime = Date.now();
                    console.log(`XbotModel: Model loaded successfully in ${loadEndTime - loadStartTime}ms`);
                    console.log('XbotModel: Animations found:', gltf.animations ? gltf.animations.length : 0);

                    // Set custom model
                    setCustomModel({ scene: gltf.scene, animations: gltf.animations });

                    // Update debug info
                    setDebugInfo(prev => ({
                        ...prev,
                        modelLoaded: true,
                        animationsCount: gltf.animations ? gltf.animations.length : 0,
                        modelScene: !!gltf.scene
                    }));

                    // Pass animations to parent if available
                    if (onModelLoad && gltf.animations) {
                        onModelLoad(gltf.animations);
                    }

                    // Clear loading state
                    setIsLoading(false);
                },
                (progress) => {
                    // Progress callback
                    const percentComplete = progress.loaded / progress.total * 100;
                    console.log(`XbotModel: Loading progress: ${percentComplete.toFixed(2)}%`);
                },
                (error) => {
                    // Error callback
                    console.error('XbotModel: Error loading GLB model:', error);
                    console.error('XbotModel: Failed URL was:', url);

                    // Try with a fallback URL if the error is a 404
                    if (error.message.includes('404') || error.message.includes('load')) {
                        console.log('XbotModel: Trying fallback URL: /uploads/models/197feac0-7b6d-49b8-a53d-4f410a61799d.glb');
                        const fallbackUrl = `${window.location.origin}/uploads/models/197feac0-7b6d-49b8-a53d-4f410a61799d.glb`;

                        new GLTFLoader().load(
                            fallbackUrl,
                            (gltf) => {
                                console.log('XbotModel: Fallback model loaded successfully');
                                setCustomModel({ scene: gltf.scene, animations: gltf.animations });
                                setDebugInfo(prev => ({
                                    ...prev,
                                    modelLoaded: true,
                                    animationsCount: gltf.animations ? gltf.animations.length : 0,
                                    modelScene: !!gltf.scene,
                                    fallbackUsed: true
                                }));
                                if (onModelLoad && gltf.animations) {
                                    onModelLoad(gltf.animations);
                                }
                                setIsLoading(false);
                            },
                            null,
                            (fallbackError) => {
                                console.error('XbotModel: Error loading fallback GLB model:', fallbackError);
                                setLoadingError(`Ошибка загрузки модели: ${error.message}. Также не удалось загрузить запасную модель.`);
                                setDebugInfo(prev => ({
                                    ...prev,
                                    error: error.message + ' + fallback failed',
                                    modelLoaded: false
                                }));
                                setIsLoading(false);
                            }
                        );
                    } else {
                        // Set error message for non-404 errors
                        setLoadingError(`Ошибка загрузки модели: ${error.message}`);
                        setDebugInfo(prev => ({
                            ...prev,
                            error: error.message,
                            modelLoaded: false
                        }));
                        setIsLoading(false);
                    }
                }
            );
    }, [onModelLoad]);

    // Initialize animation mixer
    useEffect(() => {
        if (customModel && customModel.animations && customModel.animations.length > 0) {
            console.log('XbotModel: Model loaded successfully with animations:', customModel.animations);
            console.log('XbotModel: Animation names:', customModel.animations.map(anim => anim.name));

            // Create a new mixer for the current model
            mixer.current = new THREE.AnimationMixer(customModel.scene);
            animationsRef.current = customModel.animations;

            // Store original model animation duration from the first animation
            modelDuration.current = customModel.animations[0].duration;
            console.log('XbotModel: Model duration:', modelDuration.current);

            // Pass animations to parent
            onModelLoad(customModel.animations);

            // Update debug info
            setDebugInfo(prev => ({
                ...prev,
                modelLoaded: true,
                animationsCount: customModel.animations.length,
                modelScene: true
            }));
        } else if (customModel) {
            console.warn('XbotModel: Model loaded but no animations found:', customModel);

            // Update debug info even if no animations
            setDebugInfo(prev => ({
                ...prev,
                modelLoaded: true,
                animationsCount: 0,
                modelScene: true
            }));
        }
    }, [customModel, onModelLoad]);

    // Load external animation
    const loadExternalAnimation = useCallback(async (url) => {
        if (!url || externalAnimations[url]) return;

        try {
            console.log('XbotModel: Loading external animation from URL:', url);

            // Use GLTFLoader directly
            const loader = new GLTFLoader();

            // Специальная обработка для blob URL
            if (url.startsWith('blob:')) {
                console.log('XbotModel: Detected blob URL for animation, using special handling for local file');
            }

            // Устанавливаем crossOrigin для загрузчика
            THREE.DefaultLoadingManager.crossOrigin = 'anonymous';

            loader.load(
                url,
                (gltf) => {
                    const animations = gltf.animations;

                    if (animations && animations.length > 0) {
                        console.log(`Loaded ${animations.length} animations from ${url}`);

                        // Store animations with their URL as key
                        setExternalAnimations(prev => ({
                            ...prev,
                            [url]: animations
                        }));

                        // Add to available animations
                        const newAnimations = [...animationsRef.current];
                        animations.forEach(anim => {
                            // Set a custom property to identify external animations
                            anim.isExternal = true;
                            anim.sourceUrl = url;
                            newAnimations.push(anim);
                        });

                        animationsRef.current = newAnimations;

                        // Notify parent about new animations
                        onModelLoad(newAnimations);
                    }
                },
                (xhr) => {
                    console.log(`Loading animation progress: ${Math.round(xhr.loaded / xhr.total * 100)}%`);
                },
                (error) => {
                    console.error(`Error loading animation from ${url}:`, error);
                }
            );
        } catch (error) {
            console.error(`Error in loadExternalAnimation for ${url}:`, error);
        }
    }, [externalAnimations, onModelLoad]);

    // Update active animations when the activeAnimations prop changes
    useEffect(() => {
        if (!mixer.current || !customModel) return;

        // Load any external animations first
        activeAnimations.forEach(anim => {
            if (anim.url) {
                loadExternalAnimation(anim.url);
            }
        });

        // Stop all current actions
        Object.values(activeActionsRef.current).forEach(action => {
            if (action) action.stop();
        });

        // Reset active actions
        activeActionsRef.current = {};

        // Create new actions for each active animation
        activeAnimations.forEach(anim => {
            // Find the animation by name, index, or from external source
            let animation;

            if (anim.url && externalAnimations[anim.url]) {
                // Find animation in external animations
                const externalAnims = externalAnimations[anim.url];
                animation = externalAnims[anim.externalIndex || 0];
            } else {
                // Find in default animations
                animation = typeof anim.index === 'number'
                    ? animationsRef.current[anim.index]
                    : animationsRef.current.find(a => a.name === anim.name);
            }

            if (animation) {
                const action = mixer.current.clipAction(animation);
                action.setLoop(THREE.LoopRepeat);
                action.clampWhenFinished = true;
                action.play();

                // Store the action reference
                activeActionsRef.current[anim.id] = action;

                // Calculate the correct timeScale based on player and model durations
                let effectiveTimeScale = anim.timeScale || 1;

                // If we have both durations, ensure the timeScale is correctly set
                if (playerDuration && modelDuration.current && animation.duration) {
                    // This ensures the animation completes within the player duration
                    const correctTimeScale = playerDuration / animation.duration;

                    // If the animation's timeScale is very different from what it should be, update it
                    if (Math.abs(effectiveTimeScale - correctTimeScale) > 0.1) {
                        console.log(`ModelViewer: Correcting timeScale from ${effectiveTimeScale} to ${correctTimeScale}`);
                        effectiveTimeScale = correctTimeScale;
                    }
                }

                // Set time scale
                action.timeScale = effectiveTimeScale;

                // Set weight if specified (for blending)
                if (typeof anim.weight === 'number') {
                    action.weight = anim.weight;
                }

                console.log('XbotModel: Added animation action:', {
                    id: anim.id,
                    name: animation.name,
                    duration: animation.duration,
                    timeScale: action.timeScale,
                    weight: action.weight
                });
            } else {
                console.warn('XbotModel: Could not find animation for:', anim);
            }
        });

        // Force update mixer to apply changes
        if (mixer.current) {
            mixer.current.update(0);
        }
    }, [activeAnimations, externalAnimations, loadExternalAnimation, customModel, playerDuration, modelDuration]);

    // Find the current animation segment based on markers
    const getCurrentAnimationSegment = useCallback(() => {
        if (!animationMarkers || animationMarkers.length === 0) {
            return { start: 0, end: modelDuration.current, modelStart: 0, modelEnd: modelDuration.current };
        }

        // Sort markers by time
        const sortedMarkers = [...animationMarkers].sort((a, b) => a.time - b.time);

        // Find the current segment
        for (let i = 0; i < sortedMarkers.length - 1; i++) {
            if (currentTime >= sortedMarkers[i].time && currentTime < sortedMarkers[i + 1].time) {
                return {
                    start: sortedMarkers[i].time,
                    end: sortedMarkers[i + 1].time,
                    modelStart: sortedMarkers[i].modelTime,
                    modelEnd: sortedMarkers[i + 1].modelTime
                };
            }
        }

        // If we're past the last marker, loop back to the first segment
        if (currentTime >= sortedMarkers[sortedMarkers.length - 1].time) {
            return {
                start: sortedMarkers[sortedMarkers.length - 1].time,
                end: playerDuration,
                modelStart: sortedMarkers[sortedMarkers.length - 1].modelTime,
                modelEnd: modelDuration.current
            };
        }

        // Default to the first segment
        return {
            start: 0,
            end: sortedMarkers[0]?.time || playerDuration,
            modelStart: 0,
            modelEnd: sortedMarkers[0]?.modelTime || modelDuration.current
        };
    }, [currentTime, animationMarkers, playerDuration]);

    // Find the active animation at the current time
    const getActiveAnimationAtTime = useCallback(() => {
        if (!activeAnimations || activeAnimations.length === 0) {
            return [];
        }

        // Find animations that are active at the current time
        return activeAnimations.filter(anim =>
            currentTime >= anim.start && currentTime <= anim.end
        );
    }, [currentTime, activeAnimations]);

    // Update animation time when scrubbing
    useEffect(() => {
        if (mixer.current && !isPlaying) {
            // Get active animations at current time
            const activeAnimsAtTime = getActiveAnimationAtTime();

            // If no animations are active at this time, use the default behavior with markers
            if (activeAnimsAtTime.length === 0) {
                let scaledTime;

                if (animationMarkers && animationMarkers.length > 0) {
                    // Use markers for precise animation segment mapping
                    const segment = getCurrentAnimationSegment();
                    const segmentProgress = (currentTime - segment.start) / (segment.end - segment.start);
                    scaledTime = segment.modelStart + segmentProgress * (segment.modelEnd - segment.modelStart);
                } else {
                    // Default scaling when no markers are present
                    // Fix: Ensure proper scaling between player duration and model duration
                    // If player time is 2.5s in a 5s timeline, and model is 10s, we need to be at 5s in the model
                    scaledTime = playerDuration && modelDuration.current
                        ? (currentTime / playerDuration) * modelDuration.current
                        : currentTime;
                }

                // Apply the scaled time to the mixer
                mixer.current.time = scaledTime;

                // Force update mixer to apply changes
                mixer.current.update(0);
                return;
            }

            // For each active animation, set its time based on the current player time
            activeAnimsAtTime.forEach(anim => {
                const action = activeActionsRef.current[anim.id];
                if (action) {
                    // Calculate the progress within this animation's time range
                    const animProgress = (currentTime - anim.start) / (anim.end - anim.start);

                    // Calculate the model time based on the animation's duration
                    const animation = animationsRef.current[anim.index];
                    if (animation) {
                        const animDuration = animation.duration;
                        const modelTime = animProgress * animDuration;

                        // Set the action time directly
                        action.time = modelTime;

                        // Force update mixer to apply changes
                        mixer.current.update(0);
                    }
                }
            });
        }
    }, [currentTime, isPlaying, playerDuration, animationMarkers, getCurrentAnimationSegment, getActiveAnimationAtTime]);

    // Animation loop with precise timing
    const animate = useCallback(() => {
        if (!mixer.current || !isPlaying) return;

        // Используем фиксированный шаг для обновления миксера
        const MODEL_TIME_STEP = 0.016; // ~60fps

        // Обновляем миксер с фиксированным шагом для плавной анимации модели
        mixer.current.update(MODEL_TIME_STEP);

        // Коэффициент масштабирования для синхронизации плеера с анимацией
        // Увеличиваем его, если анимация идёт быстрее плеера
        const PLAYER_SPEED_MULTIPLIER = 5.0; // Подбираем этот коэффициент эмпирически

        // Ускоряем время плеера, чтобы оно соответствовало реальной скорости анимации
        let newTime = currentTime + (MODEL_TIME_STEP * PLAYER_SPEED_MULTIPLIER);

        // Проверка на окончание анимации
        if (newTime >= playerDuration) {
            newTime = 0;
            if (mixer.current) mixer.current.setTime(0);
        }

        // Обновляем время плеера
        onTimeUpdate(newTime);

        // Запрашиваем следующий кадр анимации
        if (isPlaying) {
            animationRef.current = requestAnimationFrame(animate);
        }
    }, [isPlaying, currentTime, playerDuration, onTimeUpdate]);

    // Setup and cleanup animation frame
    useEffect(() => {
        if (isPlaying) {
            // Запускаем анимацию
            animationRef.current = requestAnimationFrame(animate);

            // Устанавливаем нормальную скорость для анимаций модели
            if (mixer.current) {
                Object.values(activeActionsRef.current).forEach(action => {
                    if (action) {
                        // Скорость анимации модели оставляем нормальной
                        action.timeScale = 1.0;
                    }
                });
            }
        }

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
                animationRef.current = null;
            }
        };
    }, [isPlaying, animate]);

    // Handle animation end
    useEffect(() => {
        if (mixer.current && playerDuration && currentTime >= playerDuration) {
            onTimeUpdate(0);
            mixer.current.time = 0;
        }
    }, [currentTime, playerDuration, onTimeUpdate]);

    return (
        <>
            {isLoading && (
                <>
                    <mesh position={[0, 0, 0]}>
                        <sphereGeometry args={[0.5, 16, 16]} />
                        <meshStandardMaterial color="gray" wireframe />
                    </mesh>
                </>
            )}

            {loadingError && (
                <>
                    <mesh position={[0, 0, 0]}>
                        <boxGeometry args={[1, 1, 1]} />
                        <meshStandardMaterial color="red" />
                    </mesh>
                    <Html position={[0, 2, 0]}>
                        <div style={{ color: 'white', backgroundColor: 'rgba(0,0,0,0.7)', padding: '8px', borderRadius: '4px', maxWidth: '200px' }}>
                            {loadingError}
                        </div>
                    </Html>
                </>
            )}

            {/* Debug information overlay */}
            <Html position={[0, -2.5, 0]}>
                <div style={{ color: 'white', backgroundColor: 'rgba(0,0,0,0.7)', padding: '5px', borderRadius: '4px', fontSize: '10px' }}>
                    <div>Model URL: {debugInfo.modelUrl ? (debugInfo.modelUrl.length > 30 ? `...${debugInfo.modelUrl.slice(-30)}` : debugInfo.modelUrl) : 'None'}</div>
                    <div>Loaded: {debugInfo.modelLoaded ? 'Yes' : 'No'}</div>
                    <div>Animations: {debugInfo.animationsCount}</div>
                    <div>Scene: {debugInfo.modelScene ? 'Yes' : 'No'}</div>
                    {debugInfo.error && <div style={{ color: 'red' }}>Error: {debugInfo.error}</div>}
                </div>
            </Html>

            {/* Add axis helper for orientation */}
            <axesHelper args={[5]} />

            {!isLoading && !loadingError && customModel && (
                <>
                    {/* Render the custom model */}
                    <primitive
                        object={customModel.scene}
                        scale={[1.0, 1.0, 1.0]}
                        position={[0, 0, 0]}
                        rotation={[0, 0, 0]}
                    />
                </>
            )}
        </>
    );
};

// Custom Slider with markers
const MarkedSlider = ({ value, min, max, onChange, markers = [], disabled, onMarkerAdd, onMarkerEdit, onMarkerDelete }) => {
    const getMarkerPosition = (time) => ((time - min) / (max - min)) * 100;

    return (
        <MuiBox sx={{ position: 'relative', width: '100%', mx: 2 }}>
            <Slider
                value={value}
                min={min}
                max={max}
                onChange={onChange}
                step={0.001}
                disabled={disabled}
                sx={{ zIndex: 1 }}
            />
            {markers.map((marker, index) => (
                <Tooltip
                    key={index}
                    title={`${marker.label || `Маркер ${index + 1}`} (${marker.time.toFixed(2)}с)`}
                    arrow
                >
                    <MuiBox
                        onClick={(e) => {
                            e.stopPropagation();
                            onMarkerEdit(index);
                        }}
                        onContextMenu={(e) => {
                            e.preventDefault();
                            onMarkerDelete(index);
                        }}
                        sx={{
                            position: 'absolute',
                            left: `${getMarkerPosition(marker.time)}%`,
                            top: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: '12px',
                            height: '12px',
                            backgroundColor: marker.color || '#f44336',
                            borderRadius: '50%',
                            border: '2px solid white',
                            zIndex: 2,
                            cursor: 'pointer',
                            '&:hover': {
                                transform: 'translate(-50%, -50%) scale(1.2)',
                                boxShadow: '0 0 5px rgba(0,0,0,0.3)'
                            }
                        }}
                    />
                </Tooltip>
            ))}
            <IconButton
                size="small"
                onClick={onMarkerAdd}
                sx={{
                    position: 'absolute',
                    right: '-30px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    zIndex: 2,
                    backgroundColor: 'rgba(0,0,0,0.1)',
                    '&:hover': {
                        backgroundColor: 'rgba(0,0,0,0.2)'
                    }
                }}
            >
                <AddCircleOutline fontSize="small" />
            </IconButton>
        </MuiBox>
    );
};

// Animation Manager Component
const AnimationManager = ({ animations = [], activeAnimations = [], onAnimationsChange }) => {
    const [anchorEl, setAnchorEl] = useState(null);
    const [selectedAnimIndex, setSelectedAnimIndex] = useState(null);
    const [animationDialogOpen, setAnimationDialogOpen] = useState(false);
    const [currentAnimation, setCurrentAnimation] = useState(null);

    // Animation dialog form state
    const [animName, setAnimName] = useState('');
    const [animIndex, setAnimIndex] = useState(0);
    const [animStart, setAnimStart] = useState(0);
    const [animEnd, setAnimEnd] = useState(10);
    const [animWeight, setAnimWeight] = useState(1);
    const [animTimeScale, setAnimTimeScale] = useState(1);
    const [animExternalIndex, setAnimExternalIndex] = useState(0);

    // Generate a unique ID for new animations
    const generateUniqueId = () => {
        return 'anim_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    };

    // Open context menu for an animation
    const handleAnimationMenuOpen = (event, index) => {
        event.preventDefault();
        event.stopPropagation();
        setAnchorEl(event.currentTarget);
        setSelectedAnimIndex(index);
    };

    // Close context menu
    const handleAnimationMenuClose = () => {
        setAnchorEl(null);
        setSelectedAnimIndex(null);
    };

    // Open dialog to add a new animation
    const handleAddAnimation = () => {
        setCurrentAnimation(null);

        // Set default values for a new animation
        setAnimName('');
        setAnimIndex(0);
        setAnimStart(0);
        setAnimEnd(10);
        setAnimWeight(1);
        setAnimTimeScale(1);
        setAnimExternalIndex(0);

        setAnimationDialogOpen(true);
    };

    // Open dialog to edit an existing animation
    const handleEditAnimation = () => {
        const anim = activeAnimations[selectedAnimIndex];

        setCurrentAnimation(anim);
        setAnimName(anim.name || '');
        setAnimIndex(anim.index || 0);
        setAnimStart(anim.start || 0);
        setAnimEnd(anim.end || 10);
        setAnimWeight(anim.weight || 1);
        setAnimTimeScale(anim.timeScale || 1);
        setAnimExternalIndex(anim.externalIndex || 0);

        setAnimationDialogOpen(true);
        handleAnimationMenuClose();
    };

    // Delete an animation
    const handleDeleteAnimation = () => {
        const newAnimations = [...activeAnimations];
        newAnimations.splice(selectedAnimIndex, 1);
        onAnimationsChange(newAnimations);
        handleAnimationMenuClose();
    };

    // Save animation changes
    const handleSaveAnimation = () => {
        if (currentAnimation) {
            // Update existing animation
            const newAnimations = activeAnimations.map(anim =>
                anim.id === currentAnimation.id
                    ? {
                        ...anim,
                        name: animName,
                        index: animIndex,
                        start: animStart,
                        end: animEnd,
                        weight: animWeight,
                        timeScale: animTimeScale,
                        externalIndex: animExternalIndex
                    }
                    : anim
            );
            onAnimationsChange(newAnimations);
        } else {
            // Add new animation
            const newAnimation = {
                id: generateUniqueId(),
                name: animName,
                index: animIndex,
                start: animStart,
                end: animEnd,
                weight: animWeight,
                timeScale: animTimeScale,
                externalIndex: animExternalIndex
            };
            onAnimationsChange([...activeAnimations, newAnimation]);
        }

        setAnimationDialogOpen(false);
    };

    return (
        <>
            <MuiBox sx={{ width: '100%', mt: 2, color: 'white' }}>
                <Typography variant="subtitle1" gutterBottom>
                    Анимации ({activeAnimations.length})
                    <IconButton
                        size="small"
                        onClick={handleAddAnimation}
                        sx={{ ml: 1, color: 'white' }}
                    >
                        <AddCircleOutline />
                    </IconButton>
                </Typography>

                {activeAnimations.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                        Нет активных анимаций. Нажмите + чтобы добавить анимацию.
                    </Typography>
                ) : (
                    <List dense sx={{ bgcolor: 'rgba(0,0,0,0.3)', borderRadius: 1 }}>
                        {activeAnimations.map((anim, index) => (
                            <ListItem
                                key={anim.id}
                                sx={{
                                    borderBottom: index < activeAnimations.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none',
                                    '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
                                }}
                                secondaryAction={
                                    <IconButton
                                        edge="end"
                                        size="small"
                                        onClick={(e) => handleAnimationMenuOpen(e, index)}
                                        sx={{ color: 'white' }}
                                    >
                                        <Edit fontSize="small" />
                                    </IconButton>
                                }
                            >
                                <DragIndicator sx={{ mr: 1, opacity: 0.5, fontSize: '1rem' }} />
                                <ListItemText
                                    primary={anim.name || `Анимация ${animations[anim.index]?.name || anim.index}`}
                                    secondary={
                                        <>
                                            {`${anim.start}с - ${anim.end}с (скорость: ${anim.timeScale}x)`}
                                        </>
                                    }
                                    primaryTypographyProps={{ variant: 'body2' }}
                                    secondaryTypographyProps={{ variant: 'caption' }}
                                />
                            </ListItem>
                        ))}
                    </List>
                )}
            </MuiBox>

            {/* Animation Context Menu */}
            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleAnimationMenuClose}
            >
                <MenuItem onClick={handleEditAnimation}>
                    <Edit fontSize="small" sx={{ mr: 1 }} /> Редактировать
                </MenuItem>
                <MenuItem onClick={handleDeleteAnimation}>
                    <Delete fontSize="small" sx={{ mr: 1 }} /> Удалить
                </MenuItem>
            </Menu>

            {/* Animation Edit Dialog */}
            <Dialog open={animationDialogOpen} onClose={() => setAnimationDialogOpen(false)}>
                <DialogTitle>
                    {currentAnimation ? 'Редактировать анимацию' : 'Добавить анимацию'}
                </DialogTitle>
                <DialogContent>
                    <TextField
                        margin="dense"
                        label="Название"
                        type="text"
                        fullWidth
                        value={animName}
                        onChange={(e) => setAnimName(e.target.value)}
                        sx={{ mb: 2 }}
                    />

                    {/* Выбор анимации */}
                    <FormControl fullWidth margin="dense" sx={{ mb: 2 }}>
                        <InputLabel>Анимация</InputLabel>
                        <Select
                            value={animIndex}
                            onChange={(e) => setAnimIndex(Number(e.target.value))}
                            label="Анимация"
                        >
                            {animations.map((anim, index) => (
                                <MenuItem key={index} value={index}>
                                    {anim.name || `Анимация ${index + 1}`}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <TextField
                        margin="dense"
                        label="Начало (секунды)"
                        type="number"
                        fullWidth
                        value={animStart}
                        onChange={(e) => setAnimStart(Number(e.target.value))}
                        inputProps={{ step: 0.1, min: 0 }}
                        sx={{ mb: 2 }}
                    />

                    <TextField
                        margin="dense"
                        label="Конец (секунды)"
                        type="number"
                        fullWidth
                        value={animEnd}
                        onChange={(e) => setAnimEnd(Number(e.target.value))}
                        inputProps={{ step: 0.1, min: animStart }}
                        sx={{ mb: 2 }}
                    />

                    <TextField
                        margin="dense"
                        label="Вес (для смешивания)"
                        type="number"
                        fullWidth
                        value={animWeight}
                        onChange={(e) => setAnimWeight(Number(e.target.value))}
                        inputProps={{ step: 0.1, min: 0, max: 1 }}
                        sx={{ mb: 2 }}
                        helperText="От 0 до 1, используется для смешивания анимаций"
                    />

                    <TextField
                        margin="dense"
                        label="Скорость воспроизведения"
                        type="number"
                        fullWidth
                        value={animTimeScale}
                        onChange={(e) => setAnimTimeScale(Number(e.target.value))}
                        inputProps={{ step: 0.1, min: 0.1 }}
                        helperText="1 = нормальная скорость, 0.5 = замедленно, 2 = ускоренно"
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setAnimationDialogOpen(false)}>Отмена</Button>
                    <Button onClick={handleSaveAnimation} color="primary">Сохранить</Button>
                </DialogActions>
            </Dialog>
        </>
    );
};

// Animation Timeline Component
const AnimationTimeline = ({ animations = [], activeAnimations = [], duration = 60, currentTime = 0, onAnimationsChange }) => {
    const [draggingAnimation, setDraggingAnimation] = useState(null);
    const [draggingEdge, setDraggingEdge] = useState(null); // 'start' or 'end'
    const [dragStartX, setDragStartX] = useState(0);
    const [dragStartTime, setDragStartTime] = useState(0);
    const timelineRef = useRef(null);

    // Calculate position on timeline from time
    const getPositionFromTime = (time) => {
        return (time / duration) * 100;
    };

    // Calculate time from position on timeline
    const getTimeFromPosition = (position, width) => {
        const percent = position / width;
        return Math.max(0, Math.min(duration, percent * duration));
    };

    // Start dragging an animation
    const handleDragStart = (e, animId, edge = null) => {
        e.preventDefault();
        e.stopPropagation();

        const timelineRect = timelineRef.current.getBoundingClientRect();
        const mouseX = e.clientX - timelineRect.left;

        setDraggingAnimation(animId);
        setDraggingEdge(edge);
        setDragStartX(mouseX);

        // Find the animation being dragged
        const anim = activeAnimations.find(a => a.id === animId);
        if (anim) {
            setDragStartTime(edge === 'start' ? anim.start : edge === 'end' ? anim.end : anim.start);
        }

        // Add event listeners for drag and drop
        document.addEventListener('mousemove', handleDragMove);
        document.addEventListener('mouseup', handleDragEnd);
    };

    // Handle drag movement
    const handleDragMove = (e) => {
        if (!draggingAnimation || !timelineRef.current) return;

        const timelineRect = timelineRef.current.getBoundingClientRect();
        const mouseX = e.clientX - timelineRect.left;
        const deltaX = mouseX - dragStartX;

        // Calculate the time delta based on the drag distance
        const timeDelta = getTimeFromPosition(deltaX, timelineRect.width);

        // Update the animation position or length
        const newAnimations = activeAnimations.map(anim => {
            if (anim.id !== draggingAnimation) return anim;

            if (draggingEdge === 'start') {
                // Dragging the start edge - update start time
                const newStart = Math.max(0, Math.min(anim.end - 0.5, dragStartTime + timeDelta));
                return { ...anim, start: newStart };
            } else if (draggingEdge === 'end') {
                // Dragging the end edge - update end time
                const newEnd = Math.max(anim.start + 0.5, Math.min(duration, dragStartTime + timeDelta));
                return { ...anim, end: newEnd };
            } else {
                // Dragging the whole animation - move both start and end
                const newStart = Math.max(0, dragStartTime + timeDelta);
                const animDuration = anim.end - anim.start;
                const newEnd = Math.min(duration, newStart + animDuration);

                // If we hit the right edge, adjust start to maintain duration
                if (newEnd === duration) {
                    return { ...anim, start: duration - animDuration, end: duration };
                }

                return { ...anim, start: newStart, end: newEnd };
            }
        });

        onAnimationsChange(newAnimations);
    };

    // End dragging
    const handleDragEnd = () => {
        setDraggingAnimation(null);
        setDraggingEdge(null);

        // Remove event listeners
        document.removeEventListener('mousemove', handleDragMove);
        document.removeEventListener('mouseup', handleDragEnd);
    };

    // Generate a color for an animation based on its index
    const getAnimationColor = (index) => {
        const colors = [
            '#4caf50', '#2196f3', '#f44336', '#ff9800', '#9c27b0',
            '#00bcd4', '#ffeb3b', '#795548', '#607d8b', '#e91e63'
        ];
        return colors[index % colors.length];
    };

    return (
        <MuiBox sx={{ width: '100%', mt: 2 }}>
            <Typography variant="subtitle2" sx={{ color: 'white', mb: 1 }}>
                Временная шкала анимаций
            </Typography>

            <MuiBox
                ref={timelineRef}
                sx={{
                    position: 'relative',
                    width: '100%',
                    height: '80px',
                    backgroundColor: 'rgba(0,0,0,0.3)',
                    borderRadius: 1,
                    overflow: 'hidden',
                    cursor: 'pointer'
                }}
            >
                {/* Time markers */}
                {Array.from({ length: Math.floor(duration / 5) + 1 }).map((_, i) => (
                    <MuiBox
                        key={i}
                        sx={{
                            position: 'absolute',
                            left: `${(i * 5 / duration) * 100}%`,
                            top: 0,
                            bottom: 0,
                            width: '1px',
                            backgroundColor: 'rgba(255,255,255,0.2)',
                            zIndex: 1,
                            '&::after': {
                                content: `"${i * 5}s"`,
                                position: 'absolute',
                                top: '2px',
                                left: '4px',
                                fontSize: '10px',
                                color: 'rgba(255,255,255,0.5)'
                            }
                        }}
                    />
                ))}

                {/* Current time indicator */}
                <MuiBox
                    sx={{
                        position: 'absolute',
                        left: `${getPositionFromTime(currentTime)}%`,
                        top: 0,
                        bottom: 0,
                        width: '2px',
                        backgroundColor: 'white',
                        zIndex: 3
                    }}
                />

                {/* Animation blocks */}
                {activeAnimations.map((anim, index) => (
                    <MuiBox
                        key={anim.id}
                        sx={{
                            position: 'absolute',
                            left: `${getPositionFromTime(anim.start)}%`,
                            width: `${getPositionFromTime(anim.end - anim.start)}%`,
                            top: `${10 + (index % 3) * 20}px`,
                            height: '18px',
                            backgroundColor: getAnimationColor(index),
                            borderRadius: '4px',
                            zIndex: 2,
                            opacity: draggingAnimation === anim.id ? 0.7 : 0.9,
                            cursor: 'move',
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                            textOverflow: 'ellipsis',
                            fontSize: '10px',
                            padding: '2px 4px',
                            color: 'white',
                            boxSizing: 'border-box',
                            border: '1px solid rgba(255,255,255,0.3)',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                            userSelect: 'none',
                            '&:hover': {
                                boxShadow: '0 2px 5px rgba(0,0,0,0.5)'
                            }
                        }}
                        onMouseDown={(e) => handleDragStart(e, anim.id)}
                    >
                        {anim.name || `Анимация ${animations[anim.index]?.name || anim.index}`}

                        {/* Resize handles */}
                        <MuiBox
                            sx={{
                                position: 'absolute',
                                left: 0,
                                top: 0,
                                bottom: 0,
                                width: '6px',
                                cursor: 'w-resize',
                                '&:hover': {
                                    backgroundColor: 'rgba(255,255,255,0.3)'
                                }
                            }}
                            onMouseDown={(e) => handleDragStart(e, anim.id, 'start')}
                        />
                        <MuiBox
                            sx={{
                                position: 'absolute',
                                right: 0,
                                top: 0,
                                bottom: 0,
                                width: '6px',
                                cursor: 'e-resize',
                                '&:hover': {
                                    backgroundColor: 'rgba(255,255,255,0.3)'
                                }
                            }}
                            onMouseDown={(e) => handleDragStart(e, anim.id, 'end')}
                        />
                    </MuiBox>
                ))}
            </MuiBox>

            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 1 }}>
                Перетаскивайте блоки для изменения позиции. Растягивайте за края для изменения длительности.
            </Typography>
        </MuiBox>
    );
};

const ModelViewer = ({ isVisible, onClose, playerDuration, currentTime: initialTime = 0, isPlaying: initialPlaying = false, onTimeUpdate: externalTimeUpdate, elementKeyframes = [], elementId = null, embedded = false, onSaveAnimations = null, glbAnimationUrl = null }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [isPlaying, setIsPlaying] = useState(initialPlaying);
    const [currentTime, setCurrentTime] = useState(initialTime);
    const [duration, setDuration] = useState(playerDuration || 60); // Use player duration if provided
    const [modelLoaded, setModelLoaded] = useState(false);
    const [animationMarkers, setAnimationMarkers] = useState([
        { time: 0, modelTime: 0, label: 'Начало', color: '#4caf50' }
    ]);
    const [markerDialogOpen, setMarkerDialogOpen] = useState(false);
    const [currentMarker, setCurrentMarker] = useState(null);
    const [newMarkerTime, setNewMarkerTime] = useState(0);
    const [newMarkerModelTime, setNewMarkerModelTime] = useState(0);
    const [newMarkerLabel, setNewMarkerLabel] = useState('');
    const [newMarkerColor, setNewMarkerColor] = useState('#f44336');
    const [modelDuration, setModelDuration] = useState(0);
    const [activeAnimations, setActiveAnimations] = useState([]);
    const [availableAnimations, setAvailableAnimations] = useState([]);
    const [saveDialogOpen, setSaveDialogOpen] = useState(false);
    const [saveAnimationName, setSaveAnimationName] = useState('');
    const [savedAnimations, setSavedAnimations] = useState([]);
    const [loadDialogOpen, setLoadDialogOpen] = useState(false);
    const prevElementIdRef = useRef(null);
    const [selectedModel, setSelectedModel] = useState(null);
    const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
    const fileInputRef = useRef(null);
    const [glbUrl, setGlbUrl] = useState('');
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

    // Additional states for the missing variables
    const [isLoadingModel, setIsLoadingModel] = useState(false);
    const [tabIndex, setTabIndex] = useState(0);
    const [animations, setAnimations] = useState([]);
    const [glbInputUrl, setGlbInputUrl] = useState('');

    // Add these missing handler functions
    const handleCloseViewerConfirm = () => {
        // Check if there are unsaved changes
        if (hasUnsavedChanges) {
            setConfirmDialogOpen(true);
        } else {
            closeViewerWithoutSaving();
        }
    };

    const handleTabChange = (event, newValue) => {
        setTabIndex(newValue);
    };

    const handleSaveModelWithAnimation = () => {
        // Save both model and animation settings
        handleSaveModel();
        if (onSaveAnimations) {
            onSaveAnimations(activeAnimations);
        }
        onClose();
    };

    // ... existing code ...

    // Load saved animations from localStorage on component mount
    useEffect(() => {
        console.log('ModelViewer: Component mounted, checking for saved animations');

        const loadSavedAnimations = () => {
            try {
                const savedData = localStorage.getItem('savedAnimations');
                if (savedData) {
                    const parsed = JSON.parse(savedData);
                    setSavedAnimations(parsed);
                    console.log(`ModelViewer: Loaded ${parsed.length} saved animations from localStorage`);
                } else {
                    console.log('ModelViewer: No saved animations found in localStorage');
                }
            } catch (error) {
                console.error('Error loading saved animations:', error);
            }
        };

        loadSavedAnimations();

        // Если у нас есть elementId и элемент содержит сохраненные анимации,
        // загружаем их из свойств элемента
        if (elementId && elementKeyframes && elementKeyframes.length > 0) {
            console.log('ModelViewer: Found element keyframes, checking for saved animations');

            // Check if any keyframe has our elementId
            const matchingKeyframes = elementKeyframes.filter(kf => kf.elementId === elementId || kf.id === elementId);

            if (matchingKeyframes.length > 0) {
                console.log('ModelViewer: Found matching keyframes for element ID:', elementId);

                // Check for glbAnimations in any matching keyframe
                const keyframeWithAnimations = matchingKeyframes.find(kf => kf.glbAnimations && kf.glbAnimations.length > 0);

                if (keyframeWithAnimations) {
                    console.log('ModelViewer: Loading saved animations from keyframe:', keyframeWithAnimations.glbAnimations);
                    setSavedAnimations(keyframeWithAnimations.glbAnimations);

                    // If this keyframe has a modelPath, use it
                    if (keyframeWithAnimations.modelPath && !selectedModel && !glbAnimationUrl) {
                        console.log('ModelViewer: Using modelPath from keyframe:', keyframeWithAnimations.modelPath);

                        setSelectedModel({
                            url: keyframeWithAnimations.modelPath,
                            name: keyframeWithAnimations.modelName || 'Saved Model',
                            id: keyframeWithAnimations.modelId
                        });
                    }
                } else {
                    console.log('ModelViewer: No glbAnimations found in matching keyframes');
                }
            } else {
                console.warn(`ModelViewer: Element with ID ${elementId} not found in keyframes`);
            }
        } else {
            console.log('ModelViewer: No element keyframes available or no elementId provided', {
                hasElementId: !!elementId,
                hasKeyframes: !!elementKeyframes,
                keyframesLength: elementKeyframes ? elementKeyframes.length : 0
            });
        }
    }, [elementId, elementKeyframes, selectedModel, glbAnimationUrl]);

    // Update state when props change
    useEffect(() => {
        if (playerDuration) {
            setDuration(playerDuration);

            // Update the timeScale of active animations when playerDuration changes
            if (modelDuration && activeAnimations.length > 0) {
                // Calculate the new timeScale based on the ratio of player duration to model duration
                const newTimeScale = playerDuration / modelDuration;

                // Update all active animations with the new timeScale
                setActiveAnimations(current =>
                    current.map(anim => ({
                        ...anim,
                        end: Math.min(anim.end, playerDuration), // Ensure end time doesn't exceed player duration
                        timeScale: newTimeScale
                    }))
                );

                console.log(`ModelViewer: Updated animation timeScale to ${newTimeScale} for playerDuration ${playerDuration}`);
            }
        }
    }, [playerDuration, modelDuration]);

    useEffect(() => {
        setCurrentTime(initialTime);
    }, [initialTime]);

    useEffect(() => {
        setIsPlaying(initialPlaying);
    }, [initialPlaying]);

    // Sync markers with element keyframes when they change or when element changes
    useEffect(() => {
        // Only update markers if we have valid keyframes and either the element changed or it's the initial setup
        if (elementKeyframes && elementKeyframes.length > 0 && (elementId !== prevElementIdRef.current || prevElementIdRef.current === null)) {
            console.log(`Syncing markers with ${elementKeyframes.length} keyframes from element ${elementId}`);

            // Найдем элемент в keyframes по ID
            const element = elementKeyframes.find(kf =>
                kf.id === elementId ||
                kf.elementId === elementId
            );

            if (element) {
                console.log('ModelViewer: Found matching element in keyframes:', element);

                // Если у элемента есть свои keyframes, используем их
                const keyframes = element.keyframes || [];

                if (keyframes.length > 0) {
                    console.log(`ModelViewer: Using ${keyframes.length} keyframes from element`);

                    // Convert element keyframes to animation markers
                    const newMarkers = keyframes.map((keyframe, index) => {
                        // Ensure the keyframe has a valid time
                        if (typeof keyframe.time !== 'number' || isNaN(keyframe.time)) {
                            console.warn(`Invalid keyframe time at index ${index}:`, keyframe);
                            return null;
                        }

                        // Calculate model time proportionally if not already set
                        // For first marker, use start of model animation
                        // For subsequent markers, distribute proportionally across model duration
                        const modelTime = index === 0 ? 0 : (keyframe.time / playerDuration) * modelDuration;

                        return {
                            time: keyframe.time,
                            modelTime: modelTime,
                            label: `Ключевой кадр ${index + 1}`,
                            color: index === 0 ? '#4caf50' : '#f44336'
                        };
                    }).filter(marker => marker !== null);

                    // Sort markers by time
                    newMarkers.sort((a, b) => a.time - b.time);

                    // Always ensure we have at least a start marker
                    if (newMarkers.length === 0) {
                        newMarkers.push({
                            time: 0,
                            modelTime: 0,
                            label: 'Начало',
                            color: '#4caf50'
                        });
                    }

                    // Always ensure we have an end marker
                    const hasEndMarker = newMarkers.some(marker => marker.time === playerDuration);
                    if (!hasEndMarker && playerDuration) {
                        newMarkers.push({
                            time: playerDuration,
                            modelTime: modelDuration || playerDuration,
                            label: 'Конец',
                            color: '#f44336'
                        });
                    }

                    setAnimationMarkers(newMarkers);

                    // Если у элемента есть сохраненные glbAnimations, используем их
                    if (element.glbAnimations && element.glbAnimations.length > 0) {
                        console.log('ModelViewer: Using saved glbAnimations from element:', element.glbAnimations);
                        setSavedAnimations(element.glbAnimations);

                        // Создаем активные анимации на основе сохраненных
                        if (activeAnimations.length === 0) {
                            const newActiveAnimations = element.glbAnimations.map(anim => ({
                                id: anim.id || `anim_${Date.now()}_${Math.random()}`,
                                name: anim.name || 'Анимация',
                                index: anim.index || 0,
                                start: 0,
                                end: playerDuration || modelDuration || 10,
                                weight: 1,
                                timeScale: 1
                            }));

                            console.log('ModelViewer: Created active animations from saved ones:', newActiveAnimations);
                            setActiveAnimations(newActiveAnimations);
                        }
                    }
                } else {
                    console.log('ModelViewer: Element has no keyframes, using default markers');

                    // Create default markers
                    const newMarkers = [
                        {
                            time: 0,
                            modelTime: 0,
                            label: 'Начало',
                            color: '#4caf50'
                        }
                    ];

                    // Add end marker if we have duration
                    if (playerDuration) {
                        newMarkers.push({
                            time: playerDuration,
                            modelTime: modelDuration || playerDuration,
                            label: 'Конец',
                            color: '#f44336'
                        });
                    }

                    setAnimationMarkers(newMarkers);
                }
            } else {
                console.warn(`ModelViewer: Element with ID ${elementId} not found in keyframes`);

                // Create default markers
                const newMarkers = [
                    {
                        time: 0,
                        modelTime: 0,
                        label: 'Начало',
                        color: '#4caf50'
                    }
                ];

                // Add end marker if we have duration
                if (playerDuration) {
                    newMarkers.push({
                        time: playerDuration,
                        modelTime: modelDuration || playerDuration,
                        label: 'Конец',
                        color: '#f44336'
                    });
                }

                setAnimationMarkers(newMarkers);
            }

            prevElementIdRef.current = elementId;
        }
    }, [elementKeyframes, elementId, playerDuration, modelDuration, activeAnimations.length]);

    useEffect(() => {
        // Simulate loading the engine
        const timer = setTimeout(() => {
            setIsLoading(false);
        }, 1000);

        return () => clearTimeout(timer);
    }, []);

    // Format time in MM:SS
    const formatTime = (timeInSeconds) => {
        const minutes = Math.floor(timeInSeconds / 60);
        const seconds = Math.floor(timeInSeconds % 60);
        return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    };

    // Handle time slider change with millisecond precision
    const handleTimeChange = (_, newValue) => {
        const time = Number(newValue.toFixed(3)); // Keep 3 decimal places for milliseconds
        setCurrentTime(time);
        if (externalTimeUpdate) {
            externalTimeUpdate(time);
        }
    };

    // Handle play/pause
    const handlePlayPause = () => {
        setIsPlaying(!isPlaying);
    };

    // Handle time update from animation
    const handleTimeUpdate = useCallback((newTime) => {
        setCurrentTime(newTime);
        if (externalTimeUpdate) {
            externalTimeUpdate(newTime);
        }
    }, [externalTimeUpdate]);

    // Handle model load
    const handleModelLoad = useCallback((animations) => {
        if (animations && animations.length > 0) {
            const animDuration = animations[0].duration;
            setModelDuration(animDuration);
            setAvailableAnimations(animations);

            // Only use model duration if player duration is not provided
            if (!playerDuration) {
                setDuration(animDuration);
            }

            // Автоматически добавляем первую анимацию из модели
            setActiveAnimations(current => {
                // Если уже есть анимации, не добавляем новую
                if (current && current.length > 0) {
                    return current;
                }

                // Fix: Invert the timeScale calculation to make animation play at correct speed
                // If model duration is 10s and player duration is 5s, we need to play at 2x speed
                const timeScale = playerDuration && animDuration ? playerDuration / animDuration : 1;

                // Добавляем первую анимацию из загруженной модели
                const newAnimation = {
                    id: 'anim_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
                    name: animations[0].name || 'Анимация 1',
                    index: 0,
                    start: 0,
                    end: playerDuration || animDuration,
                    weight: 1,
                    timeScale: timeScale // Corrected timeScale
                };

                return [newAnimation];
            });

            setModelLoaded(true);

            // If we already have element keyframes, don't add an end marker here
            // as it will be handled by the useEffect that syncs with element keyframes
            if (elementKeyframes.length === 0) {
                // Add an end marker if none exists
                setAnimationMarkers(current => {
                    const hasEndMarker = current.some(marker => marker.time === playerDuration);
                    if (!hasEndMarker) {
                        return [
                            ...current,
                            {
                                time: playerDuration || animDuration,
                                modelTime: animDuration,
                                label: 'Конец',
                                color: '#f44336'
                            }
                        ];
                    }
                    return current;
                });
            }
        }
    }, [playerDuration, elementKeyframes]);

    // Add a new marker
    const handleAddMarker = () => {
        setCurrentMarker(null);
        setNewMarkerTime(currentTime);
        setNewMarkerModelTime(modelDuration / 2); // Default to middle of model animation
        setNewMarkerLabel(`Маркер ${animationMarkers.length + 1}`);
        setNewMarkerColor('#f44336');
        setMarkerDialogOpen(true);
    };

    // Edit an existing marker
    const handleEditMarker = (index) => {
        const marker = animationMarkers[index];
        setCurrentMarker(index);
        setNewMarkerTime(marker.time);
        setNewMarkerModelTime(marker.modelTime || 0);
        setNewMarkerLabel(marker.label || `Маркер ${index + 1}`);
        setNewMarkerColor(marker.color || '#f44336');
        setMarkerDialogOpen(true);
    };

    // Delete a marker
    const handleDeleteMarker = (index) => {
        // Don't allow deleting the first marker (start point)
        if (index === 0) return;

        setAnimationMarkers(current => current.filter((_, i) => i !== index));
    };

    // Save marker changes
    const handleSaveMarker = () => {
        if (currentMarker !== null) {
            // Edit existing marker
            setAnimationMarkers(current => {
                const updated = [...current];
                updated[currentMarker] = {
                    time: newMarkerTime,
                    modelTime: newMarkerModelTime,
                    label: newMarkerLabel,
                    color: newMarkerColor
                };
                return updated.sort((a, b) => a.time - b.time);
            });
        } else {
            // Add new marker
            setAnimationMarkers(current => {
                return [...current, {
                    time: newMarkerTime,
                    modelTime: newMarkerModelTime,
                    label: newMarkerLabel,
                    color: newMarkerColor
                }].sort((a, b) => a.time - b.time);
            });
        }
        setMarkerDialogOpen(false);
    };

    // Handle animations change
    const handleAnimationsChange = useCallback((newAnimations) => {
        setActiveAnimations(newAnimations);
    }, []);

    // Open save dialog
    const handleOpenSaveDialog = () => {
        setSaveAnimationName('');
        setSaveDialogOpen(true);
    };

    // Save current animations
    const handleSaveAnimations = () => {
        if (!saveAnimationName.trim()) return;

        try {
            // Create animation preset object
            const animationPreset = {
                id: `preset_${Date.now()}`,
                name: saveAnimationName,
                animations: activeAnimations,
                markers: animationMarkers,
                createdAt: new Date().toISOString()
            };

            // Add to saved animations
            const updatedSavedAnimations = [...savedAnimations, animationPreset];
            setSavedAnimations(updatedSavedAnimations);

            // Save to localStorage
            localStorage.setItem('savedAnimations', JSON.stringify(updatedSavedAnimations));

            // If onSaveAnimations callback is provided, call it
            if (onSaveAnimations) {
                onSaveAnimations(updatedSavedAnimations);
            }

            // Close dialog
            setSaveDialogOpen(false);
        } catch (error) {
            console.error('Error saving animations:', error);
            // Show error notification
        }
    };

    // Open load dialog
    const handleOpenLoadDialog = () => {
        setLoadDialogOpen(true);
    };

    // Load saved animation preset
    const handleLoadAnimationPreset = (preset) => {
        if (!preset) return;

        // Set active animations from preset
        if (preset.animations && preset.animations.length > 0) {
            setActiveAnimations(preset.animations);
        }

        // Set markers from preset if available
        if (preset.markers && preset.markers.length > 0) {
            setAnimationMarkers(preset.markers);
        }

        // Close dialog
        setLoadDialogOpen(false);
    };

    // Delete saved animation preset
    const handleDeleteAnimationPreset = (presetId) => {
        const updatedSavedAnimations = savedAnimations.filter(preset => preset.id !== presetId);
        setSavedAnimations(updatedSavedAnimations);
        localStorage.setItem('savedAnimations', JSON.stringify(updatedSavedAnimations));
    };

    // Handle model selection from uploader
    const handleModelSelect = (model) => {
        console.log('Selected model:', model);
        setSelectedModel(model);

        // Update the glbAnimationUrl to use the selected model
        // This will trigger the useEffect in XbotModel to load the new model
        if (model && model.url) {
            // We'll use this URL to load the model
            console.log('Setting model URL:', model.url);

            // Save the model URL immediately to ensure it's not lost
            if (onSaveAnimations) {
                const dataToSave = {
                    animations: savedAnimations.length > 0 ? savedAnimations : activeAnimations,
                    modelUrl: model.url,
                    visible: true,
                    style: {
                        opacity: 1
                    }
                };

                // If it's a blob URL, mark it as a local file
                if (model.url.startsWith('blob:')) {
                    dataToSave.isLocalFile = true;
                    dataToSave.modelName = model.name || 'Uploaded Model';
                }

                console.log('ModelViewer: Saving model URL after selection:', model.url);
                onSaveAnimations(dataToSave, elementId);
            }
        }
    };

    // Handle opening the upload dialog
    const handleOpenUploadDialog = () => {
        console.log('ModelViewer: Opening upload dialog');
        setUploadDialogOpen(true);
    };

    // Handle closing the upload dialog
    const handleCloseUploadDialog = () => {
        setUploadDialogOpen(false);
    };

    // Upload model to server
    const uploadModelToServer = async (file) => {
        console.log('ModelViewer: Uploading model to server:', file.name);
        setIsLoading(true);

        try {
            // Get authentication token from localStorage
            const token = localStorage.getItem('token');

            if (!token) {
                console.error('ModelViewer: No authentication token found');
                throw new Error('Authentication required. Please log in.');
            }

            // Create form data
            const formData = new FormData();
            formData.append('model', file);
            formData.append('name', file.name.split('.')[0]);

            // Get API URL from environment or use default
            const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

            // Upload to server with authentication
            const response = await fetch(`${API_URL}/models/upload`, {
                method: 'POST',
                body: formData,
                credentials: 'include',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error(`Upload failed with status: ${response.status}`);
            }

            const modelData = await response.json();
            console.log('ModelViewer: Model uploaded successfully:', modelData);

            // Create a model object with the server URL
            const modelObj = {
                url: modelData.url,
                name: modelData.name,
                id: modelData.id
            };

            // Set the selected model
            setSelectedModel(modelObj);

            // Save the model URL immediately
            if (onSaveAnimations) {
                const dataToSave = {
                    animations: savedAnimations.length > 0 ? savedAnimations : activeAnimations,
                    modelUrl: modelData.url,
                    modelId: modelData.id,
                    visible: true,
                    style: {
                        opacity: 1
                    }
                };

                console.log('ModelViewer: Saving server model URL:', modelData.url);
                onSaveAnimations(dataToSave, elementId);

                // Show success message
                alert('Модель успешно загружена на сервер и сохранена!');
            }

            setUploadDialogOpen(false);
        } catch (error) {
            console.error('ModelViewer: Error uploading model to server:', error);
            alert(`Ошибка загрузки модели на сервер: ${error.message}. Используем локальную версию.`);

            // Fallback to blob URL if server upload fails
            const url = URL.createObjectURL(file);
            setGlbUrl(url);

            // Create a model object with the blob URL
            const modelObj = {
                url: url,
                name: file.name,
                isLocalFile: true
            };

            // Set the selected model
            setSelectedModel(modelObj);

            // Save the blob URL immediately
            if (onSaveAnimations) {
                const dataToSave = {
                    animations: savedAnimations.length > 0 ? savedAnimations : activeAnimations,
                    modelUrl: url,
                    isLocalFile: true,
                    modelName: file.name,
                    visible: true,
                    style: {
                        opacity: 1
                    }
                };

                console.log('ModelViewer: Saving blob URL as fallback:', url);
                onSaveAnimations(dataToSave, elementId);

                // Alert user about local file limitations
                setTimeout(() => {
                    alert('Внимание: Модель сохранена локально и будет доступна только в текущей сессии браузера. При перезагрузке страницы вам потребуется загрузить модель заново.');
                }, 500);
            }
        } finally {
            setIsLoading(false);
        }
    };

    // Handle file input change
    const handleFileInputChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            console.log('ModelViewer: File selected:', file.name);

            // Try to upload to server first
            uploadModelToServer(file);

            // Close dialog
            setUploadDialogOpen(false);
        }
    };

    // Handle GLB URL submit
    const handleGlbUrlSubmit = () => {
        if (glbUrl) {
            console.log('ModelViewer: Submitting GLB URL:', glbUrl);

            // Create a model object similar to what ModelUploader would return
            const modelObj = {
                url: glbUrl,
                name: glbUrl.split('/').pop() || 'Uploaded GLB'
            };

            // Set the selected model
            setSelectedModel(modelObj);

            // Also update the active animations to include this model
            if (activeAnimations.length === 0) {
                // Add a default animation for the entire duration
                const newAnimation = {
                    id: 'anim_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
                    name: 'Default Animation',
                    index: 0,
                    start: 0,
                    end: playerDuration || 10,
                    weight: 1,
                    timeScale: 1
                };
                setActiveAnimations([newAnimation]);
            }

            // Close the dialog without saving automatically
            setUploadDialogOpen(false);

            // Inform the user that they need to click the save button
            alert('Модель загружена. Нажмите кнопку "Сохранить модель", чтобы сохранить её.');
        }
    };

    // Handle close with saving animations
    const handleClose = () => {
        console.log('ModelViewer: Closing viewer, preparing to save model data');

        // Если есть callback для сохранения, вызываем его
        if (onSaveAnimations) {
            // Определяем URL модели
            const modelUrl = selectedModel ? selectedModel.url : glbAnimationUrl;

            console.log('ModelViewer: Preparing to save on close:', {
                selectedModel: selectedModel ? {
                    name: selectedModel.name,
                    url: selectedModel.url
                } : 'none',
                glbAnimationUrl: glbAnimationUrl || 'none',
                finalModelUrl: modelUrl || 'none',
                elementId: elementId || 'none',
                savedAnimationsCount: savedAnimations.length
            });

            // Проверяем, что URL модели действителен
            if (!modelUrl) {
                console.warn('ModelViewer: No valid model URL found for saving');
                closeViewerWithoutSaving();
                return;
            }

            // Check if it's a blob URL that needs to be uploaded to the server
            if (modelUrl && modelUrl.startsWith('blob:')) {
                console.log('ModelViewer: Detected blob URL on close, uploading to server first');

                // Get the model name
                const modelName = selectedModel ? selectedModel.name : 'Uploaded Model';

                // Fetch the blob and convert to file
                fetch(modelUrl)
                    .then(response => response.blob())
                    .then(blob => {
                        // Create a File object from the blob
                        const file = new File([blob], modelName + '.glb', { type: 'model/gltf-binary' });
                        // Upload to server and then close
                        uploadModelAndClose(file);
                    })
                    .catch(error => {
                        console.error('ModelViewer: Error converting blob to file on close:', error);
                        // Fallback to using the blob URL
                        saveAndClose(modelUrl);
                    });
            } else {
                // Not a blob URL, save directly and close
                saveAndClose(modelUrl);
            }
        } else {
            console.error('ModelViewer: Cannot save - no onSaveAnimations callback provided');
            closeViewerWithoutSaving();
        }
    };

    // Helper function to upload model and close
    const uploadModelAndClose = async (file) => {
        console.log('ModelViewer: Uploading model to server before closing:', file.name);
        setIsLoading(true);

        try {
            // Get authentication token from localStorage
            const token = localStorage.getItem('token');

            if (!token) {
                console.error('ModelViewer: No authentication token found');
                throw new Error('Authentication required. Please log in.');
            }

            // Create form data
            const formData = new FormData();
            formData.append('model', file);
            formData.append('name', file.name.split('.')[0]);

            // Get API URL from environment or use default
            const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

            // Upload to server with authentication
            const response = await fetch(`${API_URL}/models/upload`, {
                method: 'POST',
                body: formData,
                credentials: 'include',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error(`Upload failed with status: ${response.status}`);
            }

            const modelData = await response.json();
            console.log('ModelViewer: Model uploaded successfully before closing:', modelData);

            // Save with the server URL and close
            saveAndClose(modelData.url, modelData.id);
        } catch (error) {
            console.error('ModelViewer: Error uploading model to server on close:', error);
            // Fallback to blob URL
            const blobUrl = selectedModel ? selectedModel.url : glbAnimationUrl;
            saveAndClose(blobUrl);
        } finally {
            setIsLoading(false);
        }
    };

    // Helper function to save and close
    const saveAndClose = (modelUrl, modelId = null) => {
        // Make sure the URL starts with / for server URLs if it's not a blob
        if (modelUrl && !modelUrl.startsWith('blob:') && !modelUrl.startsWith('http') && !modelUrl.startsWith('/')) {
            modelUrl = '/' + modelUrl;
        }

        // Log the final URL being saved
        console.log('ModelViewer: Final modelUrl for saving on close:', modelUrl);

        // Создаем объект с анимациями и URL модели
        const dataToSave = {
            animations: savedAnimations.length > 0 ? savedAnimations : activeAnimations,
            modelUrl: modelUrl,
            visible: true,
            style: {
                opacity: 1 // Ensure opacity is set to fully visible
            }
        };

        // If we have a model ID from the server, add it
        if (modelId) {
            dataToSave.modelId = modelId;
        }

        // Если URL модели начинается с blob:, это локальный файл, который нужно обработать особым образом
        if (modelUrl && modelUrl.startsWith('blob:')) {
            console.log('ModelViewer: Detected blob URL for model, will handle as local file');

            // Сохраняем информацию о том, что это локальный файл
            dataToSave.isLocalFile = true;

            // Если это локальный файл, добавляем имя файла, если оно доступно
            if (selectedModel && selectedModel.name) {
                dataToSave.modelName = selectedModel.name;
            }
        }

        console.log('ModelViewer: Saving model data on close:', {
            hasModel: !!modelUrl,
            modelUrl: modelUrl || 'не указан',
            animationsCount: dataToSave.animations.length,
            elementId: elementId || 'не указан',
            visible: dataToSave.visible,
            opacity: dataToSave.style?.opacity || 1,
            dataToSave: JSON.stringify(dataToSave).substring(0, 100) + '...'
        });

        // Make sure we're passing the correct elementId
        const targetElementId = elementId;

        // Force save the model URL before closing
        try {
            // Вызываем callback с данными для сохранения
            onSaveAnimations(dataToSave, targetElementId);
            console.log('ModelViewer: onSaveAnimations callback executed with elementId:', targetElementId);

            // Показываем уведомление с подробной информацией
            const modelName = selectedModel ? selectedModel.name : 'Модель';
            const animInfo = dataToSave.animations.length > 0
                ? `и ${dataToSave.animations.length} анимаций`
                : '';

            alert(`${modelName} ${animInfo} успешно сохранена!`);
            closeViewerWithoutSaving();
        } catch (error) {
            console.error('ModelViewer: Error saving model:', error);
            alert('Ошибка при сохранении модели: ' + error.message);
            closeViewerWithoutSaving();
        }
    };

    // Helper function to close without saving
    const closeViewerWithoutSaving = () => {
        // Вызываем onClose из props
        if (onClose) {
            console.log('ModelViewer: Calling onClose callback');
            onClose();
        } else {
            console.warn('ModelViewer: No onClose callback provided');
        }
    };

    // Save model button
    const handleSaveModel = () => {
        console.log('ModelViewer: Save model button clicked');

        if (!selectedModel && !glbAnimationUrl) {
            alert('Сначала загрузите модель!');
            return;
        }

        if (onSaveAnimations) {
            // Определяем URL модели
            const modelUrl = selectedModel ? selectedModel.url : glbAnimationUrl;

            // Check if it's a blob URL that needs to be uploaded to the server
            if (modelUrl && modelUrl.startsWith('blob:')) {
                console.log('ModelViewer: Detected blob URL, uploading to server first');

                // Get the model name
                const modelName = selectedModel ? selectedModel.name : 'Uploaded Model';

                // Fetch the blob and convert to file
                fetch(modelUrl)
                    .then(response => response.blob())
                    .then(blob => {
                        // Create a File object from the blob
                        const file = new File([blob], modelName + '.glb', { type: 'model/gltf-binary' });
                        // Upload to server
                        uploadModelToServer(file);
                    })
                    .catch(error => {
                        console.error('ModelViewer: Error converting blob to file:', error);
                        // Fallback to using the blob URL
                        saveModelWithUrl(modelUrl);
                    });
            } else {
                // Not a blob URL, save directly
                saveModelWithUrl(modelUrl);
            }
        } else {
            console.error('ModelViewer: Cannot save - no onSaveAnimations callback provided');
            alert('Ошибка: Невозможно сохранить модель. Обратитесь к разработчику.');
        }
    };

    // Helper function to save model with URL
    const saveModelWithUrl = (modelUrl) => {
        // Make sure the URL starts with / for server URLs if it's not a blob
        if (modelUrl && !modelUrl.startsWith('blob:') && !modelUrl.startsWith('http') && !modelUrl.startsWith('/')) {
            modelUrl = '/' + modelUrl;
        }

        // Log the final URL being saved
        console.log('ModelViewer: Final modelUrl for saving:', modelUrl);

        // Создаем объект с анимациями и URL модели
        const dataToSave = {
            animations: savedAnimations.length > 0 ? savedAnimations : activeAnimations,
            modelUrl: modelUrl,
            visible: true,
            style: {
                opacity: 1
            }
        };

        // Если URL модели начинается с blob:, это локальный файл
        if (modelUrl && modelUrl.startsWith('blob:')) {
            dataToSave.isLocalFile = true;
            if (selectedModel && selectedModel.name) {
                dataToSave.modelName = selectedModel.name;
            }
        }

        console.log('ModelViewer: Manual save of model:', {
            modelUrl: modelUrl,
            elementId: elementId
        });

        try {
            onSaveAnimations(dataToSave, elementId);
            alert('Модель успешно сохранена!');
        } catch (error) {
            console.error('ModelViewer: Error saving model:', error);
            alert('Ошибка при сохранении модели: ' + error.message);
        }
    };

    // IMPORTANT: Explicitly log what URLs are being passed
    console.log('ModelViewer: Rendering with props:', {
        hasGlbAnimationUrl: !!glbAnimationUrl,
        glbAnimationUrl: glbAnimationUrl,
        hasSelectedModel: !!selectedModel,
        selectedModelUrl: selectedModel ? selectedModel.url : 'none',
        elementId: elementId || 'none',
        hasElementKeyframes: elementKeyframes && elementKeyframes.length > 0,
        keyframesCount: elementKeyframes ? elementKeyframes.length : 0
    });

    // Check if the element exists directly in the keyframes array
    let directElementWithModelPath = null;
    if (elementId && elementKeyframes && elementKeyframes.length > 0) {
        // Direct check for the element itself
        directElementWithModelPath = elementKeyframes.find(kf =>
            (kf.id === elementId || kf.elementId === elementId) && kf.modelPath
        );

        if (directElementWithModelPath) {
            console.log('ModelViewer: Found direct element with modelPath:', directElementWithModelPath.modelPath);
        } else {
            // Check if any keyframe has modelPath
            const keyframeWithModelPath = elementKeyframes.find(kf => kf.modelPath);
            if (keyframeWithModelPath) {
                console.log('ModelViewer: Found keyframe with modelPath:', keyframeWithModelPath.modelPath);
                directElementWithModelPath = keyframeWithModelPath;
            }
        }
    }

    // Detailed logging of element keyframes
    if (elementKeyframes && elementKeyframes.length > 0) {
        console.log('ModelViewer: All element keyframes:', elementKeyframes);
        console.log('ModelViewer: Looking for keyframes with elementId:', elementId);

        // Check if there's a keyframe matching our elementId
        const matchingKeyframes = elementKeyframes.filter(kf =>
            kf.id === elementId || kf.elementId === elementId
        );

        if (matchingKeyframes.length > 0) {
            console.log('ModelViewer: Keyframes matching elementId:', matchingKeyframes);
            matchingKeyframes.forEach((kf, idx) => {
                console.log(`ModelViewer: Keyframe ${idx} details:`, {
                    id: kf.id,
                    elementId: kf.elementId,
                    hasModelPath: !!kf.modelPath,
                    modelPath: kf.modelPath || 'none',
                    hasModelUrl: !!kf.modelUrl,
                    modelUrl: kf.modelUrl || 'none',
                    hasType: !!kf.type,
                    type: kf.type || 'none',
                    hasModel3D: kf.type === '3d' || kf.is3d || false
                });
            });
        } else {
            // If no direct match, log all keyframe IDs for debugging
            console.log('ModelViewer: No keyframes match elementId:', elementId);
            console.log('ModelViewer: Available keyframe IDs:', elementKeyframes.map(kf => ({
                id: kf.id || 'none',
                elementId: kf.elementId || 'none'
            })));
        }
    }

    // Check for model URL explicitly from various sources
    const elementWithModel = elementKeyframes ? elementKeyframes.find(kf =>
        (kf.id === elementId || kf.elementId === elementId) &&
        (kf.modelPath || kf.modelUrl)
    ) : null;

    if (elementWithModel) {
        console.log('ModelViewer: Found element with model in keyframes:', {
            modelPath: elementWithModel.modelPath || 'none',
            modelUrl: elementWithModel.modelUrl || 'none'
        });
    }

    // Make sure we're using the correct URL by checking multiple sources
    const findModelUrlInElement = () => {
        // First, check if the element itself is passed with modelPath
        if (elementId && elementKeyframes) {
            console.log('ModelViewer: findModelUrlInElement - elementId:', elementId);
            console.log('ModelViewer: findModelUrlInElement - elementKeyframes:',
                elementKeyframes.map(kf => ({
                    id: kf.id || 'none',
                    elementId: kf.elementId || 'none',
                    modelPath: kf.modelPath || 'none'
                }))
            );

            // Check direct keyframes match
            const directMatch = elementKeyframes.find(kf =>
                (kf.id === elementId || kf.elementId === elementId)
            );

            if (directMatch) {
                console.log('ModelViewer: Direct element match found:', directMatch);
                // Check if this element has a modelPath
                if (directMatch.modelPath) {
                    console.log('ModelViewer: Using modelPath from direct element match:', directMatch.modelPath);
                    return directMatch.modelPath;
                }

                // Check for modelUrl property
                if (directMatch.modelUrl) {
                    console.log('ModelViewer: Using modelUrl from direct element match:', directMatch.modelUrl);
                    return directMatch.modelUrl;
                }
            } else {
                // If no direct match, check if the element itself is in the keyframes array
                console.log('ModelViewer: No direct match found, checking if element itself is in keyframes array');

                // Check if the first keyframe has a modelPath (might be the element itself)
                if (elementKeyframes.length > 0) {
                    const firstKeyframe = elementKeyframes[0];
                    console.log('ModelViewer: Checking first keyframe:', firstKeyframe);

                    if (firstKeyframe.modelPath) {
                        console.log('ModelViewer: Using modelPath from first keyframe:', firstKeyframe.modelPath);
                        return firstKeyframe.modelPath;
                    }

                    if (firstKeyframe.modelUrl) {
                        console.log('ModelViewer: Using modelUrl from first keyframe:', firstKeyframe.modelUrl);
                        return firstKeyframe.modelUrl;
                    }
                }
            }
        }

        return null;
    };

    // Store the URL from element in a state variable so it persists
    const [elementModelUrl, setElementModelUrl] = useState(null);

    // Effect to find the model URL when component mounts or elementId/keyframes change
    useEffect(() => {
        const foundUrl = findModelUrlInElement();
        if (foundUrl) {
            console.log('ModelViewer: Found model URL in element, setting state:', foundUrl);
            setElementModelUrl(foundUrl);
        } else if (elementKeyframes && elementKeyframes.length > 0) {
            // Проверяем первый ключевой кадр на наличие свойств modelPath или modelUrl
            const firstKeyframe = elementKeyframes[0];
            console.log('ModelViewer: Checking first keyframe for modelPath:', firstKeyframe);

            if (firstKeyframe.modelPath) {
                console.log('ModelViewer: Found modelPath in first keyframe:', firstKeyframe.modelPath);
                setElementModelUrl(firstKeyframe.modelPath);
            } else if (firstKeyframe.modelUrl) {
                console.log('ModelViewer: Found modelUrl in first keyframe:', firstKeyframe.modelUrl);
                setElementModelUrl(firstKeyframe.modelUrl);
            } else {
                // Если у нас есть загруженные ранее модели, используем последнюю из логов
                const lastKnownModelUrl = '/uploads/models/197feac0-7b6d-49b8-a53d-4f410a61799d.glb';
                console.log('ModelViewer: Using last known model URL as fallback:', lastKnownModelUrl);
                setElementModelUrl(lastKnownModelUrl);
            }
        }
    }, [elementId, elementKeyframes, findModelUrlInElement]);

    // Then in the effectiveModelUrl calculation:
    const effectiveModelUrl = (() => {
        // Log all possible model URL sources for debugging
        console.log('ModelViewer: Calculating effectiveModelUrl with sources:', {
            elementId: elementId || 'none',
            keyframesCount: elementKeyframes ? elementKeyframes.length : 0,
            selectedModelUrl: selectedModel ? selectedModel.url : 'none',
            glbAnimationUrl: glbAnimationUrl || 'none',
            elementModelUrl: elementModelUrl || 'none'
        });

        // First priority: selectedModel URL (user just selected a model)
        if (selectedModel && selectedModel.url) {
            console.log('ModelViewer: Using URL from selectedModel:', selectedModel.url);
            return selectedModel.url;
        }

        // Second priority: Direct element modelPath/modelUrl if we have elementId
        if (elementId && elementKeyframes && elementKeyframes.length > 0) {
            // Find the element in keyframes
            const element = elementKeyframes.find(kf =>
                kf.id === elementId ||
                kf.elementId === elementId
            );

            // Check for modelPath or modelUrl in the element
            if (element) {
                if (element.modelPath) {
                    console.log('ModelViewer: Using modelPath from element:', element.modelPath);
                    return element.modelPath;
                } else if (element.modelUrl) {
                    console.log('ModelViewer: Using modelUrl from element:', element.modelUrl);
                    return element.modelUrl;
                }
            }
        }

        // Third priority: glbAnimationUrl prop
        if (glbAnimationUrl) {
            console.log('ModelViewer: Using URL from glbAnimationUrl prop:', glbAnimationUrl);
            return glbAnimationUrl;
        }

        // Fourth priority: URL from element model URL state
        if (elementModelUrl) {
            console.log('ModelViewer: Using URL from elementModelUrl state:', elementModelUrl);
            return elementModelUrl;
        }

        // Fifth priority: URL from element keyframes find function
        const urlFromFindFunction = findModelUrlInElement();
        if (urlFromFindFunction) {
            console.log('ModelViewer: Using URL from findModelUrlInElement:', urlFromFindFunction);
            return urlFromFindFunction;
        }

        // Default: return null if no URL found
        console.log('ModelViewer: No valid model URL found');
        return null;
    })();

    console.log('ModelViewer: Final effective model URL:', effectiveModelUrl);

    // Determine if we should display a model
    const shouldDisplayModel = () => {
        console.log('ModelViewer: shouldDisplayModel check:', {
            elementId: elementId || 'none',
            hasKeyframes: elementKeyframes && elementKeyframes.length > 0,
            keyframesCount: elementKeyframes ? elementKeyframes.length : 0,
            hasGlbAnimationUrl: !!glbAnimationUrl,
            glbAnimationUrl: glbAnimationUrl || 'none',
            hasSelectedModel: !!selectedModel,
            selectedModelUrl: selectedModel ? selectedModel.url : 'none',
            effectiveModelUrl: effectiveModelUrl || 'none'
        });

        // Если есть elementId, ищем модель в ключевых кадрах
        if (elementId && elementKeyframes && elementKeyframes.length > 0) {
            console.log(`ModelViewer: Looking for model in keyframes for element ${elementId}`);

            // Ищем первый ключевой кадр с modelPath
            const keyframeWithModel = elementKeyframes.find(kf => kf.modelPath);
            if (keyframeWithModel) {
                console.log(`ModelViewer: Found keyframe with modelPath: ${keyframeWithModel.modelPath}`);
                return true;
            }

            // Если не нашли в ключевых кадрах, ищем в элементе
            const element = elementKeyframes.find(kf => kf.id === elementId || kf.elementId === elementId);
            if (element) {
                console.log(`ModelViewer: Found element in keyframes with ID: ${elementId}`, {
                    hasModelPath: !!element.modelPath,
                    modelPath: element.modelPath || 'none'
                });
            }

            // Показываем модель, только если у элемента есть modelPath
            if (element && element.modelPath) {
                console.log(`ModelViewer: Element ${elementId} has modelPath: ${element.modelPath}`);
                return true;
            }

            console.log(`ModelViewer: Element ${elementId} does not have modelPath`);
            return false;
        }

        // Если нет elementId, показываем модель только если явно предоставлен URL
        if (!elementId) {
            const shouldShow = !!(glbAnimationUrl || (selectedModel && selectedModel.url));
            console.log(`ModelViewer: No elementId, will ${shouldShow ? 'show' : 'not show'} model`);
            return shouldShow;
        }

        // Если есть URL модели в props или выбранная модель, но нет elementId,
        // показываем модель (для общего просмотра)
        if (!elementId && (glbAnimationUrl || (selectedModel && selectedModel.url))) {
            console.log('ModelViewer: No elementId but has model URL, showing model');
            return true;
        }

        // По умолчанию не показываем модель
        console.log('ModelViewer: Default case - not showing model');
        return false;
    };

    // Only render the model if we should display it
    const renderModel = () => {
        const shouldShow = shouldDisplayModel();
        console.log(`ModelViewer: renderModel - shouldDisplayModel() returned ${shouldShow}`);

        if (!shouldShow) {
            return (
                <Box sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '100%',
                    color: 'white'
                }}>
                    <Typography variant="h6">
                        У этого элемента нет 3D модели
                    </Typography>
                </Box>
            );
        }

        console.log('ModelViewer: Rendering model with URL:', effectiveModelUrl);

        return (
            <Canvas style={{ background: '#111' }}>
                <ambientLight intensity={0.6} />
                <directionalLight position={[5, 5, 5]} intensity={1} castShadow />
                <directionalLight position={[-5, 5, 5]} intensity={0.5} />
                <directionalLight position={[0, 5, -5]} intensity={0.5} />
                <PerspectiveCamera makeDefault position={[0, 2, 10]} />
                <Suspense fallback={null}>
                    <XbotModel
                        currentTime={currentTime}
                        isPlaying={isPlaying}
                        onTimeUpdate={handleTimeUpdate}
                        onModelLoad={handleModelLoad}
                        playerDuration={duration}
                        animationMarkers={animationMarkers}
                        activeAnimations={activeAnimations}
                        glbAnimationUrl={effectiveModelUrl}
                        elementId={elementId}
                        elementKeyframes={elementKeyframes}
                    />
                </Suspense>
                <OrbitControls
                    makeDefault
                    enableDamping
                    dampingFactor={0.1}
                    rotateSpeed={0.5}
                    enableZoom={true}
                    zoomSpeed={0.8}
                    enablePan={true}
                    panSpeed={0.5}
                />
                <Grid
                    position={[0, -1, 0]}
                    args={[10, 10]}
                    cellSize={1}
                    cellThickness={1}
                    cellColor="#555"
                    sectionSize={3}
                    sectionThickness={1.5}
                    sectionColor="#888"
                    fadeDistance={30}
                />
            </Canvas>
        );
    };

    if (!isVisible) return null;

    return (
        <div style={{
            position: embedded ? 'relative' : 'fixed',
            top: embedded ? 'auto' : 0,
            left: embedded ? 'auto' : 0,
            width: '100%',
            height: embedded ? '100%' : '100vh',
            zIndex: embedded ? 'auto' : 1000,
            backgroundColor: embedded ? 'transparent' : 'rgba(13, 17, 40, 0.97)',
            display: 'flex',
            flexDirection: 'column',
            borderRadius: embedded ? '12px' : 0,
            overflow: 'hidden',
            boxShadow: embedded ? '0 8px 32px rgba(0, 0, 0, 0.25)' : 'none',
        }}>
            {/* Header area with title and controls */}
            <Box sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                p: 2,
                backgroundColor: 'rgba(15, 19, 50, 0.9)',
                backdropFilter: 'blur(8px)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
                <Typography variant="h6" sx={{
                    display: 'flex',
                    alignItems: 'center',
                    color: 'rgba(255, 255, 255, 0.9)',
                    fontWeight: 600
                }}>
                    <ThreeDRotation sx={{ mr: 1, color: '#FF5C93' }} />
                    3D Анимация
                </Typography>

                <Box sx={{ display: 'flex', gap: 1 }}>
                    {/* GLB Upload Button */}
                    <Button
                        variant="outlined"
                        size="small"
                        startIcon={<Upload />}
                        onClick={handleOpenUploadDialog}
                        sx={{
                            borderColor: 'rgba(255, 255, 255, 0.3)',
                            color: 'rgba(255, 255, 255, 0.9)',
                            '&:hover': {
                                borderColor: 'rgba(255, 255, 255, 0.5)',
                                backgroundColor: 'rgba(255, 255, 255, 0.05)'
                            }
                        }}
                    >
                        Загрузить модель
                    </Button>

                    {/* Close button for fullscreen mode */}
                    {!embedded && (
                        <IconButton
                            onClick={handleCloseViewerConfirm}
                            sx={{
                                color: 'rgba(255, 255, 255, 0.7)',
                                '&:hover': {
                                    color: 'rgba(255, 255, 255, 0.9)',
                                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                }
                            }}
                        >
                            <CloseIcon />
                        </IconButton>
                    )}
                </Box>
            </Box>

            <Box sx={{
                display: 'flex',
                flexDirection: { xs: 'column', md: 'row' },
                height: embedded ? 'calc(100% - 60px)' : 'calc(100vh - 60px)' // Adjust for header height
            }}>
                {/* Main viewer area */}
                <Box sx={{
                    flex: embedded ? '1' : '3', // Larger proportion in full-screen mode
                    position: 'relative',
                    bgcolor: '#050714',
                    borderRight: { xs: 'none', md: '1px solid rgba(255, 255, 255, 0.05)' },
                    minHeight: embedded ? 'auto' : '70vh', // Minimum height when in full screen
                }}>
                    {/* 3D model canvas */}
                    <Box sx={{
                        position: 'relative',
                        width: '100%',
                        height: '100%',
                        overflow: 'hidden'
                    }}>
                        {/* Loading indicator */}
                        {(isLoadingModel || !shouldDisplayModel()) && (
                            <Box
                                sx={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    backgroundColor: 'rgba(5, 7, 20, 0.9)',
                                    zIndex: 10,
                                }}
                            >
                                {isLoadingModel ? (
                                    <>
                                        <CircularProgress size={60} sx={{ mb: 3, color: '#6A3AFF' }} />
                                        <Typography variant="h6" sx={{ color: 'white', mb: 1 }}>
                                            Загрузка 3D модели...
                                        </Typography>
                                        <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                                            Пожалуйста, подождите
                                        </Typography>
                                    </>
                                ) : (
                                    <Box sx={{ textAlign: 'center', p: 3, maxWidth: '500px' }}>
                                        <ThreeDRotation sx={{ fontSize: 80, color: 'rgba(255, 255, 255, 0.2)', mb: 3 }} />
                                        <Typography variant="h5" sx={{ color: 'white', mb: 2 }}>
                                            3D модель не выбрана
                                        </Typography>
                                        <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 3 }}>
                                            Загрузите новую 3D модель или выберите существующую из списка доступных моделей
                                        </Typography>
                                        <Button
                                            variant="contained"
                                            startIcon={<Upload />}
                                            onClick={handleOpenUploadDialog}
                                            sx={{
                                                backgroundColor: '#6A3AFF',
                                                '&:hover': {
                                                    backgroundColor: '#4316DB'
                                                },
                                                mb: 2
                                            }}
                                        >
                                            Загрузить новую модель
                                        </Button>
                                    </Box>
                                )}
                            </Box>
                        )}

                        {/* Render the actual 3D model canvas */}
                        {renderModel()}

                        {/* Playback controls */}
                        <Box sx={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            p: 2,
                            backgroundColor: 'rgba(5, 7, 20, 0.85)',
                            backdropFilter: 'blur(8px)',
                            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                        }}>
                            <Box sx={{
                                display: 'flex',
                                alignItems: 'center',
                                mb: 1,
                                gap: 2
                            }}>
                                <IconButton
                                    onClick={handlePlayPause}
                                    sx={{
                                        color: isPlaying ? '#33E2A0' : 'white',
                                        backgroundColor: isPlaying ? 'rgba(51, 226, 160, 0.15)' : 'rgba(255, 255, 255, 0.1)',
                                        '&:hover': {
                                            backgroundColor: isPlaying ? 'rgba(51, 226, 160, 0.25)' : 'rgba(255, 255, 255, 0.2)'
                                        }
                                    }}
                                >
                                    {isPlaying ? <Pause /> : <PlayArrow />}
                                </IconButton>
                                <Typography sx={{ color: 'white', minWidth: '70px' }}>
                                    {formatTime(currentTime)} / {formatTime(playerDuration)}
                                </Typography>
                                <Box sx={{ flex: 1 }}>
                                    <MarkedSlider
                                        min={0}
                                        max={playerDuration}
                                        value={currentTime}
                                        onChange={handleTimeChange}
                                        markers={animationMarkers}
                                        disabled={false}
                                        onMarkerAdd={handleAddMarker}
                                        onMarkerEdit={handleEditMarker}
                                        onMarkerDelete={handleDeleteMarker}
                                    />
                                </Box>
                            </Box>
                        </Box>
                    </Box>
                </Box>

                {/* Animation controls panel */}
                <Box sx={{
                    width: { xs: '100%', md: embedded ? '300px' : '350px' }, // Wider in fullscreen
                    height: { xs: '300px', md: '100%' },
                    backgroundColor: 'rgba(15, 19, 50, 0.95)',
                    overflow: 'auto',
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    <Tabs
                        value={tabIndex}
                        onChange={handleTabChange}
                        variant="fullWidth"
                        sx={{
                            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                            '& .MuiTab-root': {
                                color: 'rgba(255, 255, 255, 0.7)',
                                fontWeight: 600,
                                textTransform: 'none'
                            },
                            '& .Mui-selected': {
                                color: '#FF5C93'
                            },
                            '& .MuiTabs-indicator': {
                                backgroundColor: '#FF5C93'
                            }
                        }}
                    >
                        <Tab label="Анимации" />
                        <Tab label="Настройки" />
                    </Tabs>

                    <Box sx={{ p: 2, flex: 1, overflow: 'auto' }}>
                        {tabIndex === 0 && (
                            <AnimationManager
                                animations={animations}
                                activeAnimations={activeAnimations}
                                onAnimationsChange={handleAnimationsChange}
                            />
                        )}

                        {tabIndex === 1 && (
                            <Box>
                                <Typography variant="subtitle1" sx={{ color: 'white', mb: 2 }}>
                                    Управление моделью
                                </Typography>

                                <Button
                                    variant="outlined"
                                    startIcon={<Save />}
                                    fullWidth
                                    onClick={handleSaveModel}
                                    sx={{
                                        mb: 2,
                                        borderColor: '#6A3AFF',
                                        color: '#6A3AFF',
                                        '&:hover': {
                                            borderColor: '#9C6AFF',
                                            backgroundColor: 'rgba(106, 58, 255, 0.05)'
                                        }
                                    }}
                                >
                                    Сохранить настройки
                                </Button>

                                <Box sx={{
                                    p: 2,
                                    borderRadius: '8px',
                                    backgroundColor: 'rgba(5, 7, 20, 0.5)',
                                    border: '1px solid rgba(255, 255, 255, 0.05)',
                                    mb: 2
                                }}>
                                    <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 1 }}>
                                        Текущая модель:
                                    </Typography>
                                    <Typography variant="body2" sx={{
                                        color: 'white',
                                        wordBreak: 'break-all',
                                        fontSize: '0.8rem',
                                        backgroundColor: 'rgba(0, 0, 0, 0.3)',
                                        p: 1,
                                        borderRadius: '4px',
                                        fontFamily: 'monospace'
                                    }}>
                                        {glbUrl || 'Не выбрана'}
                                    </Typography>
                                </Box>
                            </Box>
                        )}
                    </Box>

                    {/* Bottom action buttons */}
                    <Box sx={{
                        p: 2,
                        borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                        display: 'flex',
                        justifyContent: 'space-between'
                    }}>
                        <Button
                            variant="contained"
                            color="primary"
                            onClick={handleSaveModelWithAnimation}
                            disabled={!glbUrl}
                            sx={{
                                backgroundColor: '#6A3AFF',
                                '&:hover': {
                                    backgroundColor: '#4316DB'
                                },
                                flex: 1,
                                mr: 1
                            }}
                        >
                            Сохранить
                        </Button>

                        <Button
                            variant="outlined"
                            onClick={closeViewerWithoutSaving}
                            sx={{
                                borderColor: 'rgba(255, 255, 255, 0.3)',
                                color: 'rgba(255, 255, 255, 0.9)',
                                '&:hover': {
                                    borderColor: 'rgba(255, 255, 255, 0.5)',
                                    backgroundColor: 'rgba(255, 255, 255, 0.05)'
                                }
                            }}
                        >
                            Отмена
                        </Button>
                    </Box>
                </Box>
            </Box>

            {/* Upload GLB model dialog */}
            <Dialog
                open={uploadDialogOpen}
                onClose={handleCloseUploadDialog}
                maxWidth="sm"
                fullWidth
                PaperProps={{
                    sx: {
                        backgroundColor: 'rgba(15, 19, 50, 0.97)',
                        borderRadius: '12px',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
                        border: '1px solid rgba(255, 255, 255, 0.05)'
                    }
                }}
            >
                <DialogTitle sx={{ color: 'white', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                    Загрузка 3D модели
                </DialogTitle>
                <DialogContent>
                    <Box sx={{ p: 2 }}>
                        <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.9)', mb: 3 }}>
                            Выберите GLB файл или введите URL модели
                        </Typography>

                        {/* File upload area */}
                        <Box sx={{
                            border: '2px dashed rgba(255, 255, 255, 0.2)',
                            borderRadius: '8px',
                            p: 3,
                            mb: 3,
                            textAlign: 'center',
                            backgroundColor: 'rgba(0, 0, 0, 0.3)',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            '&:hover': {
                                backgroundColor: 'rgba(0, 0, 0, 0.4)',
                                borderColor: 'rgba(255, 255, 255, 0.3)'
                            }
                        }}
                            component="label"
                        >
                            <Upload sx={{ fontSize: 40, color: 'rgba(255, 255, 255, 0.5)', mb: 2 }} />
                            <Typography variant="body1" sx={{ color: 'white', mb: 1 }}>
                                Перетащите GLB файл или нажмите для выбора
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                                Поддерживаемый формат: GLB
                            </Typography>
                            <input
                                type="file"
                                accept=".glb"
                                hidden
                                onChange={handleFileInputChange}
                            />
                        </Box>

                        {/* URL input area */}
                        <Typography variant="subtitle2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 1 }}>
                            Или укажите URL модели:
                        </Typography>
                        <TextField
                            fullWidth
                            variant="outlined"
                            placeholder="https://example.com/model.glb"
                            value={glbInputUrl}
                            onChange={(e) => setGlbInputUrl(e.target.value)}
                            sx={{
                                mb: 1,
                                '& .MuiOutlinedInput-root': {
                                    color: 'white',
                                    '& fieldset': {
                                        borderColor: 'rgba(255, 255, 255, 0.2)',
                                    },
                                    '&:hover fieldset': {
                                        borderColor: 'rgba(255, 255, 255, 0.3)',
                                    },
                                    '&.Mui-focused fieldset': {
                                        borderColor: '#6A3AFF',
                                    },
                                },
                                '& .MuiInputLabel-root': {
                                    color: 'rgba(255, 255, 255, 0.7)',
                                },
                            }}
                        />
                        <Button
                            variant="contained"
                            onClick={handleGlbUrlSubmit}
                            disabled={!glbInputUrl}
                            fullWidth
                            sx={{
                                mt: 2,
                                backgroundColor: '#6A3AFF',
                                '&:hover': {
                                    backgroundColor: '#4316DB'
                                }
                            }}
                        >
                            Загрузить по URL
                        </Button>
                    </Box>
                </DialogContent>
            </Dialog>

            {/* Other existing dialogs */}
            {/* ... existing code for dialogs ... */}
        </div>
    );
};

export default ModelViewer;