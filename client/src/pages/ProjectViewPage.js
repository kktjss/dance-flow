import React, { useState, useEffect, useRef } from 'react';
import { Box, Container, Typography, CircularProgress, Alert, Paper, Button, ButtonGroup, IconButton } from '@mui/material';
import { ThreeDRotation, Videocam, Close } from '@mui/icons-material';
import { useParams } from 'react-router-dom';
import axios from 'axios';

// Import components
import Player from '../components/Player';
import Canvas from '../components/Canvas';
import Navbar from '../components/Navbar';
import CombinedViewer from '../components/CombinedViewer';

const API_URL = 'http://localhost:5000/api';

// Функция для преобразования элементов в правильный формат
const normalizeElements = (elements) => {
    // Default element to return if no valid elements are found
    const DEFAULT_ELEMENT = {
        id: 'default-element',
        type: 'rectangle',
        position: { x: 100, y: 100 },
        size: { width: 200, height: 100 },
        style: {
            opacity: 1,
            backgroundColor: '#e0e0e0',
            borderColor: '#cccccc',
            borderWidth: 1,
            zIndex: 0
        },
        content: '',
        keyframes: []
    };

    if (!elements || !Array.isArray(elements)) {
        console.warn('Elements is not an array or undefined:', elements);
        // Return a default element to prevent "No valid elements" error
        return [DEFAULT_ELEMENT];
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

    // If no valid elements were found, add a default one
    if (normalized.length === 0) {
        console.warn('No elements found after normalization, adding a default element');
        normalized.push(DEFAULT_ELEMENT);
    }

    // Additional check to ensure all elements have the required fields
    const validElements = normalized.filter(el => el && el.id && el.type && el.position);
    if (validElements.length === 0) {
        console.warn('No valid elements after normalization, using default element');
        return [DEFAULT_ELEMENT];
    }

    console.log('Final normalized elements:', validElements);
    return validElements;
};

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

    const [selectedElement, setSelectedElement] = useState(null);
    const [normalizedElements, setNormalizedElements] = useState([]);
    const [currentTime, setCurrentTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [error, setError] = useState(null);
    const [viewerMode, setViewerMode] = useState('canvas'); // 'canvas', '3d', or 'video'
    const [showCombinedViewer, setShowCombinedViewer] = useState(false);
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
                    const newTime = Math.min(currentTime + elapsed / 1000, project.duration || 60);
                    setCurrentTime(newTime);

                    if (newTime >= (project.duration || 60)) {
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

            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('Требуется авторизация');
            }

            const response = await axios.get(`${API_URL}/projects/${id}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response || !response.data) {
                throw new Error('No project data returned');
            }

            console.log('Project data received:', response.data);

            // Process keyframesJson if available
            let elementsToNormalize = response.data.elements || [];

            if (response.data.keyframesJson) {
                try {
                    console.log('KeyframesJson found, parsing...');
                    const keyframesData = JSON.parse(response.data.keyframesJson);

                    // Add keyframes to corresponding elements
                    if (keyframesData && typeof keyframesData === 'object') {
                        elementsToNormalize = elementsToNormalize.map(element => {
                            if (element.id && keyframesData[element.id]) {
                                console.log(`Adding ${keyframesData[element.id].length} keyframes to element ${element.id}`);
                                return {
                                    ...element,
                                    keyframes: keyframesData[element.id]
                                };
                            }
                            return element;
                        });
                    }
                } catch (err) {
                    console.error('Error parsing keyframesJson:', err);
                }
            }

            // Normalize elements
            if (elementsToNormalize.length > 0) {
                const normalized = normalizeElements(elementsToNormalize);
                console.log('Normalized elements:', normalized);
                setNormalizedElements(normalized);
            } else {
                setNormalizedElements([]);
            }

            // Set project data with a default duration if none is provided
            setProject({
                ...response.data,
                duration: response.data.duration || 60,
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
        console.log('Time updated to:', time);
        setCurrentTime(time);
    };

    // Handle play/pause
    const handlePlayPause = (playing) => {
        console.log('Play state changed to:', playing);
        setIsPlaying(playing);
    };

    // Show Combined Viewer
    const handleShowCombinedViewer = () => {
        setShowCombinedViewer(true);
        // Pause animation when showing viewer
        if (isPlaying) {
            setIsPlaying(false);
        }
    };

    // Hide Combined Viewer
    const handleHideCombinedViewer = () => {
        setShowCombinedViewer(false);
        setViewerMode('canvas');
    };

    // Switch viewer mode
    const handleModeChange = (mode) => {
        setViewerMode(mode);

        if (mode === '3d' || mode === 'video') {
            handleShowCombinedViewer();
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

    // Handle element selection
    const handleElementSelect = (element) => {
        console.log('Element selected:', element);
        setSelectedElement(element);
    };

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
                                            disabled={!videoUrl}
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
                                            elements={normalizedElements}
                                            currentTime={currentTime}
                                            isPlaying={isPlaying}
                                            readOnly={true}
                                            selectedElement={selectedElement}
                                            onElementSelect={handleElementSelect}
                                        />
                                    )}
                                </Box>
                            </Paper>

                            {/* Combined Viewer (3D Model + Video) */}
                            <CombinedViewer
                                isVisible={showCombinedViewer}
                                onClose={handleHideCombinedViewer}
                                videoUrl={videoUrl}
                                playerDuration={project.duration}
                                currentTime={currentTime}
                                isPlaying={isPlaying}
                                onTimeUpdate={handleTimeUpdate}
                                elementKeyframes={selectedElement?.keyframes || []}
                                elementId={selectedElement?.id}
                            />
                        </>
                    )}
                </Container>
            </Box>
        </Box>
    );
};

export default ProjectViewPage; 