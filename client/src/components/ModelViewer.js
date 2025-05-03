import React, { useRef, useState, useEffect, Suspense, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, useGLTF, Grid } from '@react-three/drei';
import { Box as MuiBox, CircularProgress, Button, IconButton, Slider, Typography } from '@mui/material';
import { PlayArrow, Pause } from '@mui/icons-material';
import * as THREE from 'three';

// Model component for Hatsune Miku
const MikuModel = ({ currentTime, isPlaying, onTimeUpdate, onModelLoad }) => {
    const gltf = useGLTF('/models/hatsune_miku.glb');
    const mixer = useRef(null);
    const lastTimeRef = useRef(null);
    const animationRef = useRef(null);
    const clock = useRef(new THREE.Clock());

    // Initialize animation mixer
    useEffect(() => {
        if (gltf.animations && gltf.animations.length > 0) {
            mixer.current = new THREE.AnimationMixer(gltf.scene);
            const action = mixer.current.clipAction(gltf.animations[0]);
            action.setLoop(THREE.LoopRepeat);
            action.clampWhenFinished = true;
            action.play();
            onModelLoad(gltf.animations);
        }
    }, [gltf, onModelLoad]);

    // Update animation time when scrubbing
    useEffect(() => {
        if (mixer.current && !isPlaying) {
            mixer.current.time = currentTime;
        }
    }, [currentTime, isPlaying]);

    // Animation loop with precise timing
    const animate = useCallback((timestamp) => {
        if (!lastTimeRef.current) {
            lastTimeRef.current = timestamp;
        }

        const elapsed = timestamp - lastTimeRef.current;

        if (mixer.current && isPlaying) {
            const delta = clock.current.getDelta();
            mixer.current.update(delta);

            // Update time approximately 30 times per second
            if (elapsed > 33) { // ~30fps
                const newTime = mixer.current.time;
                onTimeUpdate(newTime);
                lastTimeRef.current = timestamp;
            }
        }

        if (isPlaying) {
            animationRef.current = requestAnimationFrame(animate);
        }
    }, [isPlaying, onTimeUpdate]);

    // Setup and cleanup animation frame
    useEffect(() => {
        if (isPlaying) {
            clock.current.start();
            lastTimeRef.current = null;
            animationRef.current = requestAnimationFrame(animate);
        } else {
            clock.current.stop();
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
        if (mixer.current && currentTime >= gltf.animations[0]?.duration) {
            onTimeUpdate(0);
            mixer.current.time = 0;
        }
    }, [currentTime, gltf.animations, onTimeUpdate]);

    return (
        <primitive
            object={gltf.scene}
            scale={1}
            position={[0, -1, 0]}
            rotation={[0, 0, 0]}
        />
    );
};

const ModelViewer = ({ isVisible, onClose }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(60); // Default duration in seconds
    const [modelLoaded, setModelLoaded] = useState(false);

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
        setCurrentTime(Number(newValue.toFixed(3))); // Keep 3 decimal places for milliseconds
    };

    // Handle play/pause
    const handlePlayPause = () => {
        setIsPlaying(!isPlaying);
    };

    // Handle time update from animation
    const handleTimeUpdate = useCallback((newTime) => {
        setCurrentTime(newTime);
    }, []);

    // Handle model load
    const handleModelLoad = useCallback((animations) => {
        if (animations && animations.length > 0) {
            setDuration(animations[0].duration);
            setModelLoaded(true);
        }
    }, []);

    if (!isVisible) return null;

    return (
        <MuiBox
            sx={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                zIndex: 1000,
                backgroundColor: 'rgba(0, 0, 0, 0.85)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            {isLoading ? (
                <MuiBox sx={{ color: 'white', textAlign: 'center' }}>
                    <CircularProgress color="primary" size={60} />
                    <MuiBox mt={2}>Загрузка 3D движка...</MuiBox>
                </MuiBox>
            ) : (
                <>
                    <MuiBox sx={{ width: '90%', height: '80%', border: '1px solid #444' }}>
                        <Canvas style={{ background: '#111' }}>
                            <ambientLight intensity={0.6} />
                            <directionalLight position={[5, 5, 5]} intensity={1} castShadow />
                            <directionalLight position={[-5, 5, 5]} intensity={0.5} />
                            <directionalLight position={[0, 5, -5]} intensity={0.5} />
                            <PerspectiveCamera makeDefault position={[0, 1, 5]} />
                            <Suspense fallback={null}>
                                <MikuModel
                                    currentTime={currentTime}
                                    isPlaying={isPlaying}
                                    onTimeUpdate={handleTimeUpdate}
                                    onModelLoad={handleModelLoad}
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
                            </Suspense>
                            <OrbitControls />
                        </Canvas>
                    </MuiBox>

                    {/* Animation Controls */}
                    <MuiBox sx={{ width: '90%', p: 2, bgcolor: '#f5f5f5', borderRadius: 1, mt: 2 }}>
                        <MuiBox sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <IconButton
                                onClick={handlePlayPause}
                                color="primary"
                                disabled={!modelLoaded}
                            >
                                {isPlaying ? <Pause /> : <PlayArrow />}
                            </IconButton>

                            <Typography variant="body2" sx={{ ml: 1, minWidth: 40 }}>
                                {formatTime(currentTime)}
                            </Typography>

                            <Slider
                                value={currentTime}
                                min={0}
                                max={duration}
                                onChange={handleTimeChange}
                                step={0.001} // 1ms precision
                                sx={{ mx: 2, flexGrow: 1 }}
                                disabled={!modelLoaded}
                            />

                            <Typography variant="body2" sx={{ minWidth: 40 }}>
                                {formatTime(duration)}
                            </Typography>
                        </MuiBox>
                    </MuiBox>

                    <Button
                        variant="contained"
                        color="primary"
                        onClick={onClose}
                        sx={{ mt: 2 }}
                    >
                        Закрыть
                    </Button>
                </>
            )}
        </MuiBox>
    );
};

// Preload the model
useGLTF.preload('/models/hatsune_miku.glb');

export default ModelViewer; 