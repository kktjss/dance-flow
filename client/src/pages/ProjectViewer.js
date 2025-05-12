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

// Функция для преобразования элементов в правильный формат
const normalizeElements = (elements) => {
    if (!elements || !Array.isArray(elements)) {
        console.warn('Elements is not an array or undefined:', elements);
        return [];
    }

    console.log('Raw elements from server:', JSON.stringify(elements, null, 2));

    // Если элементы приходят в виде строки JSON, попробуем распарсить
    let parsedElements = elements;
    if (elements.length === 1 && typeof elements[0] === 'string') {
        try {
            const parsed = JSON.parse(elements[0]);
            if (Array.isArray(parsed)) {
                parsedElements = parsed;
                console.log('Successfully parsed elements from JSON string');
            }
        } catch (e) {
            console.error('Failed to parse elements JSON string:', e);
        }
    }

    // Создаем уникальные ID для элементов, если их нет
    let idCounter = 1;

    const normalized = parsedElements.map(el => {
        // Если элемент вообще null или undefined, создаем базовый элемент
        if (!el) {
            const newId = `generated-${idCounter++}`;
            console.log('Created new element with ID:', newId);
            return {
                id: newId,
                type: 'rectangle',
                position: { x: 100, y: 100 },
                size: { width: 100, height: 100 },
                style: { opacity: 1, backgroundColor: '#cccccc' },
                content: '',
                keyframes: []
            };
        }

        // Проверяем наличие обязательных полей
        let elementId = el.id;

        // Если нет id, проверяем _id или генерируем новый
        if (!elementId) {
            if (el._id) {
                elementId = el._id;
                console.log('Used _id as id for element:', elementId);
            } else {
                elementId = `generated-${idCounter++}`;
                console.log('Generated new id for element:', elementId);
            }
        }

        // Определяем тип элемента
        let elementType = el.type;
        if (!elementType) {
            if (el.originalType) {
                elementType = el.originalType;
                console.log('Used originalType as type for element:', elementType);
            } else {
                elementType = 'rectangle'; // Тип по умолчанию
                console.log('Used default type for element:', elementId);
            }
        }

        // Создаем базовый элемент с обязательными полями
        const normalizedElement = {
            id: elementId,
            type: elementType,
            position: el.position || { x: 100, y: 100 },
            size: el.size || { width: 100, height: 100 },
            style: el.style || { opacity: 1, backgroundColor: '#cccccc' },
            content: el.content || '',
            keyframes: el.keyframes || []
        };

        // Проверяем и исправляем позицию
        if (!normalizedElement.position.x || isNaN(normalizedElement.position.x)) {
            normalizedElement.position.x = 100;
        }
        if (!normalizedElement.position.y || isNaN(normalizedElement.position.y)) {
            normalizedElement.position.y = 100;
        }

        // Проверяем и исправляем размер
        if (!normalizedElement.size.width || isNaN(normalizedElement.size.width)) {
            normalizedElement.size.width = 100;
        }
        if (!normalizedElement.size.height || isNaN(normalizedElement.size.height)) {
            normalizedElement.size.height = 100;
        }

        return normalizedElement;
    });

    console.log('Final normalized elements:', normalized);
    return normalized;
};

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
    const [normalizedElements, setNormalizedElements] = useState([]);

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
                    const fetchedProject = response.data.project;
                    console.log('Fetched project:', JSON.stringify(fetchedProject, null, 2));
                    setProject(fetchedProject);

                    // Пробуем разные источники данных для элементов
                    if (fetchedProject.elements && Array.isArray(fetchedProject.elements) && fetchedProject.elements.length > 0) {
                        console.log('Using elements array from project');
                        const normalized = normalizeElements(fetchedProject.elements);
                        setNormalizedElements(normalized);
                    } else if (fetchedProject.keyframesJSON) {
                        // Пробуем использовать keyframesJSON как источник элементов
                        try {
                            console.log('Trying to parse keyframesJSON:', fetchedProject.keyframesJSON.substring(0, 100) + '...');
                            const parsedKeyframes = JSON.parse(fetchedProject.keyframesJSON);
                            if (parsedKeyframes && Array.isArray(parsedKeyframes)) {
                                console.log('Using keyframesJSON as elements source');
                                const normalized = normalizeElements(parsedKeyframes);
                                setNormalizedElements(normalized);
                            } else if (parsedKeyframes && parsedKeyframes.elements && Array.isArray(parsedKeyframes.elements)) {
                                console.log('Using keyframesJSON.elements as elements source');
                                const normalized = normalizeElements(parsedKeyframes.elements);
                                setNormalizedElements(normalized);
                            } else {
                                console.warn('keyframesJSON does not contain valid elements array');
                                setNormalizedElements([]);
                            }
                        } catch (e) {
                            console.error('Failed to parse keyframesJSON:', e);
                            setNormalizedElements([]);
                        }
                    } else {
                        console.warn('Project has no elements array or keyframesJSON');
                        // Создаем базовый элемент, чтобы холст не был пустым
                        setNormalizedElements([{
                            id: 'default-element',
                            type: 'rectangle',
                            position: { x: 100, y: 100 },
                            size: { width: 100, height: 100 },
                            style: { opacity: 1, backgroundColor: '#cccccc' },
                            content: '',
                            keyframes: []
                        }]);
                    }
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
                                            elements={normalizedElements}
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

                                    {/* Video View - with video */}
                                    {viewerMode === 'video' && videoUrl && (
                                        <VideoViewer
                                            videoUrl={videoUrl}
                                            isPlaying={isPlaying}
                                            currentTime={currentTime}
                                            onClose={handleHideVideoPlayer}
                                        />
                                    )}

                                    {/* 3D Model View */}
                                    {viewerMode === '3d' && (
                                        <ModelViewer
                                            project={project}
                                            isPlaying={isPlaying}
                                            currentTime={currentTime}
                                            onClose={handleHide3DModel}
                                        />
                                    )}
                                </Box>
                            </Paper>
                        </>
                    ) : (
                        <Alert severity="info">Проект не найден</Alert>
                    )}
                </Container>
            </Box>
        </Box>
    );
};

export default ProjectViewer; 