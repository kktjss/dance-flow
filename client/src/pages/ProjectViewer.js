import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Container, Typography, Paper, CircularProgress, Alert, Button, ButtonGroup } from '@mui/material';
import { ThreeDRotation, Videocam } from '@mui/icons-material';
import axios from 'axios';
import Navbar from '../components/Navbar';
import { API_BASE_URL } from '../constants';
import Player from '../components/Player';
import Canvas from '../components/Canvas';
import ModelViewer from '../components/ModelViewer';
import VideoViewer from '../components/VideoViewer';

const ProjectViewer = () => {
    const { teamId, projectId } = useParams();
    const navigate = useNavigate();
    const [project, setProject] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [viewerMode, setViewerMode] = useState('canvas');
    const [show3DModel, setShow3DModel] = useState(false);
    const [showVideoPlayer, setShowVideoPlayer] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);

    useEffect(() => {
        const fetchProject = async () => {
            try {
                setLoading(true);
                const token = localStorage.getItem('token');
                if (!token) {
                    throw new Error('Требуется авторизация');
                }

                const response = await axios.get(
                    `${API_BASE_URL}/api/teams/${teamId}/projects/${projectId}/viewer`,
                    {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    }
                );

                if (response.data.success) {
                    setProject(response.data.project);
                } else {
                    setError(response.data.message || 'Не удалось загрузить проект');
                }
            } catch (err) {
                console.error('Error fetching project:', err);
                if (err.response?.status === 403) {
                    setError('У вас нет доступа к этому проекту');
                } else if (err.response?.status === 404) {
                    setError('Проект не найден');
                } else {
                    setError('Не удалось загрузить проект. Пожалуйста, попробуйте позже.');
                }
            } finally {
                setLoading(false);
            }
        };

        if (teamId && projectId) {
            fetchProject();
        }
    }, [teamId, projectId]);

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
        if (project?.videoUrl) {
            return project.videoUrl;
        }
        if (project?.elements?.length > 0) {
            const elementWithVideo = project.elements.find(el => el.videoUrl);
            if (elementWithVideo) {
                return elementWithVideo.videoUrl;
            }
        }
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

                    {loading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                            <CircularProgress />
                        </Box>
                    ) : project ? (
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
                                    {/* Canvas View */}
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
                    ) : (
                        <Typography color="error">
                            Проект не найден
                        </Typography>
                    )}
                </Container>
            </Box>
        </Box>
    );
};

export default ProjectViewer; 