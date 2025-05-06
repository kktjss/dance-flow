import React, { useState, useEffect, useRef } from 'react';
import { Box, Container, Typography, CircularProgress, Alert, Paper, Button, ButtonGroup, IconButton } from '@mui/material';
import { ThreeDRotation, Videocam, Close } from '@mui/icons-material';
import { useParams } from 'react-router-dom';
import axios from 'axios';

// Import components
import Player from '../components/Player';
import Canvas from '../components/Canvas';
import Navbar from '../components/Navbar';
import ModelViewer from '../components/ModelViewer';
import VideoViewer from '../components/VideoViewer';

const API_URL = 'http://localhost:5000/api';

const ProjectViewPage = () => {
    // State for project data
    const [project, setProject] = useState({
        _id: null,
        name: '',
        description: '',
        duration: 60,
        audioUrl: null,
        elements: [],
        loading: true
    });

    const [currentTime, setCurrentTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [error, setError] = useState(null);
    const [viewerMode, setViewerMode] = useState('canvas'); // 'canvas', '3d', or 'video'
    const [show3DModel, setShow3DModel] = useState(false);
    const [showVideoPlayer, setShowVideoPlayer] = useState(false);
    const animationRef = useRef(null);
    const lastTimeRef = useRef(null);

    const { projectId } = useParams();

    // Load project on mount
    useEffect(() => {
        if (projectId) {
            loadProject(projectId);
        }
    }, [projectId]);

    // Animation effect when no audio is present
    useEffect(() => {
        if (!project.audioUrl && isPlaying) {
            const animateTime = (timestamp) => {
                if (!lastTimeRef.current) {
                    lastTimeRef.current = timestamp;
                }

                const elapsed = timestamp - lastTimeRef.current;

                if (elapsed > 33) { // ~30fps
                    const newTime = Math.min(currentTime + elapsed / 1000, project.duration);
                    setCurrentTime(newTime);

                    if (newTime >= project.duration) {
                        setIsPlaying(false);
                        setCurrentTime(0);
                    }

                    lastTimeRef.current = timestamp;
                }

                if (isPlaying) {
                    animationRef.current = requestAnimationFrame(animateTime);
                }
            };

            lastTimeRef.current = null;
            animationRef.current = requestAnimationFrame(animateTime);
        }

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
                animationRef.current = null;
            }
        };
    }, [isPlaying, project.duration, project.audioUrl, currentTime]);

    // Load project from API
    const loadProject = async (id) => {
        try {
            setError(null);
            setProject(prev => ({ ...prev, loading: true }));

            const response = await axios.get(`${API_URL}/projects/${id}`);

            if (!response || !response.data) {
                throw new Error('No project data returned');
            }

            // Ensure elements have keyframes
            if (response.data.elements) {
                response.data.elements.forEach(element => {
                    if (!element.keyframes) {
                        element.keyframes = [];
                    }
                });
            }

            setProject({
                ...response.data,
                loading: false
            });
        } catch (err) {
            console.error('Error loading project:', err);
            setError(`Не удалось загрузить проект. ${err.message}`);
            setProject(prev => ({ ...prev, loading: false }));
        }
    };

    // Handle time update from player
    const handleTimeUpdate = (time) => {
        setCurrentTime(time);
    };

    // Handle play/pause
    const handlePlayPause = (playing) => {
        setIsPlaying(playing);
    };

    // Show 3D Model
    const handleShow3DModel = () => {
        setShow3DModel(true);
        // Pause animation when showing 3D model
        if (isPlaying) {
            setIsPlaying(false);
        }
    };

    // Hide 3D Model
    const handleHide3DModel = () => {
        setShow3DModel(false);
        setViewerMode('canvas');
    };

    // Show Video Player
    const handleShowVideoPlayer = () => {
        setShowVideoPlayer(true);
        // Pause animation when showing video
        if (isPlaying) {
            setIsPlaying(false);
        }
    };

    // Hide Video Player
    const handleHideVideoPlayer = () => {
        setShowVideoPlayer(false);
        setViewerMode('canvas');
    };

    // Switch viewer mode
    const handleModeChange = (mode) => {
        setViewerMode(mode);

        if (mode === '3d') {
            handleShow3DModel();
        } else if (mode === 'video') {
            handleShowVideoPlayer();
        }
    };

    // Get video URL from project data
    const getVideoUrl = () => {
        // Check if project has video
        if (project.videoUrl) {
            return project.videoUrl;
        }

        // Check if any element has video
        if (project.elements && project.elements.length > 0) {
            const elementWithVideo = project.elements.find(el => el.videoUrl);
            if (elementWithVideo) {
                return elementWithVideo.videoUrl;
            }
        }

        // No video found
        return null;
    };

    const videoUrl = getVideoUrl();

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <Navbar />
            <Box sx={{ flexGrow: 1, pt: 8 }}>
                <Container maxWidth="lg">
                    {error && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {error}
                        </Alert>
                    )}

                    {project.loading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                            <CircularProgress />
                        </Box>
                    ) : (
                        <>
                            <Box sx={{ mb: 4 }}>
                                <Typography variant="h4" component="h1">
                                    {project.name}
                                </Typography>
                                {project.description && (
                                    <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
                                        {project.description}
                                    </Typography>
                                )}
                            </Box>

                            {/* Player */}
                            <Box sx={{ mb: 2 }}>
                                <Player
                                    duration={project.duration}
                                    audioUrl={project.audioUrl}
                                    currentTime={currentTime}
                                    onTimeUpdate={handleTimeUpdate}
                                    onPlayPause={handlePlayPause}
                                    isPlaying={isPlaying}
                                    readOnly={true}
                                />
                            </Box>

                            {/* Canvas/3D/Video Container */}
                            <Paper
                                elevation={3}
                                sx={{
                                    position: 'relative',
                                    backgroundColor: '#f5f5f5',
                                    borderRadius: 1,
                                    overflow: 'hidden',
                                    height: 'calc(100vh - 300px)',
                                    minHeight: '600px',
                                    display: 'flex',
                                    flexDirection: 'column'
                                }}
                            >
                                {/* Mode selection buttons */}
                                <Box sx={{
                                    p: 1,
                                    display: 'flex',
                                    justifyContent: 'center',
                                    borderBottom: '1px solid rgba(0, 0, 0, 0.12)',
                                    backgroundColor: 'white'
                                }}>
                                    <ButtonGroup variant="contained">
                                        <Button
                                            onClick={() => handleModeChange('canvas')}
                                            variant={viewerMode === 'canvas' ? 'contained' : 'outlined'}
                                            color={viewerMode === 'canvas' ? 'primary' : 'inherit'}
                                        >
                                            Анимация
                                        </Button>
                                        <Button
                                            startIcon={<ThreeDRotation />}
                                            onClick={() => handleModeChange('3d')}
                                            variant={viewerMode === '3d' ? 'contained' : 'outlined'}
                                            color={viewerMode === '3d' ? 'primary' : 'inherit'}
                                        >
                                            3D Модель
                                        </Button>
                                        <Button
                                            startIcon={<Videocam />}
                                            onClick={() => handleModeChange('video')}
                                            variant={viewerMode === 'video' ? 'contained' : 'outlined'}
                                            color={viewerMode === 'video' ? 'primary' : 'inherit'}
                                        >
                                            Видео
                                        </Button>
                                    </ButtonGroup>
                                </Box>

                                {/* Content area */}
                                <Box sx={{ flexGrow: 1, position: 'relative' }}>
                                    {/* Canvas View - only render when it's the active view */}
                                    {viewerMode === 'canvas' && (
                                        <Canvas
                                            elements={project.elements}
                                            currentTime={currentTime}
                                            isPlaying={isPlaying}
                                            readOnly={true}
                                        />
                                    )}

                                    {/* Video View - fallback content when no video */}
                                    {viewerMode === 'video' && !videoUrl && (
                                        <Box sx={{
                                            width: '100%',
                                            height: '100%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexDirection: 'column',
                                            gap: 2
                                        }}>
                                            <Typography variant="h6" color="text.secondary">
                                                Видео не загружено для этого проекта
                                            </Typography>
                                            <Button
                                                variant="outlined"
                                                onClick={() => handleModeChange('canvas')}
                                                startIcon={<Close />}
                                            >
                                                Вернуться к анимации
                                            </Button>
                                        </Box>
                                    )}
                                </Box>
                            </Paper>

                            {/* 3D Model Viewer (full-screen overlay) */}
                            <ModelViewer
                                isVisible={show3DModel}
                                onClose={handleHide3DModel}
                            />

                            {/* Video Player (when video is available) */}
                            {videoUrl && viewerMode === 'video' && (
                                <VideoViewer
                                    isVisible={showVideoPlayer}
                                    videoUrl={videoUrl}
                                    onClose={handleHideVideoPlayer}
                                />
                            )}
                        </>
                    )}
                </Container>
            </Box>
        </Box>
    );
};

export default ProjectViewPage; 